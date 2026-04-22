use anyhow::{anyhow, Result};
use chrono::Utc;

use crate::models::{
    classify_rsa_strength, validate_credential_index, validate_private_key_meta, Credential,
    CredentialIndex, CredentialKind, CredentialStorageMode, CredentialStrength, KeyFormat,
    KeySource, PrivateKeyAlgorithm, PrivateKeyMeta,
};
use crate::storage::credentials::{
    file_store::{add_private_key_meta, upsert_credential_metadata},
    secure_store::SecureStore,
};

fn storage_mode_from_ref(storage_ref: &str) -> CredentialStorageMode {
    if storage_ref.starts_with("keychain:") {
        CredentialStorageMode::KeychainRef
    } else {
        CredentialStorageMode::EncryptedFile
    }
}

/// Supported key generation algorithms.
#[derive(Debug, Clone)]
pub enum GenerateAlgorithm {
    Ed25519,
    Rsa,
}

/// Input for generating a new private key.
pub struct GeneratePrivateKeyInput {
    pub name: String,
    pub algorithm: GenerateAlgorithm,
    pub rsa_bits: Option<u32>,
}

/// Generate a new SSH private key and store it.
/// Generated RSA keys MUST be 4096 bits only.
pub fn generate_private_key(
    input: GeneratePrivateKeyInput,
    index: &mut CredentialIndex,
    store: &dyn SecureStore,
) -> Result<Credential> {
    let (algorithm, rsa_bits, ssh_algorithm) = match &input.algorithm {
        GenerateAlgorithm::Ed25519 => {
            if input.rsa_bits.is_some() {
                return Err(anyhow!("ed25519 keys must not have rsa_bits set"));
            }
            (
                PrivateKeyAlgorithm::Ed25519,
                None,
                ssh_key::Algorithm::Ed25519,
            )
        }
        GenerateAlgorithm::Rsa => {
            let bits = input.rsa_bits.unwrap_or(4096);
            if bits != 4096 {
                return Err(anyhow!(
                    "generated RSA keys must be 4096 bits, got {}",
                    bits
                ));
            }
            (
                PrivateKeyAlgorithm::Rsa,
                Some(bits),
                ssh_key::Algorithm::Rsa { hash: None },
            )
        }
    };

    let key = ssh_key::PrivateKey::random(&mut rand::thread_rng(), ssh_algorithm)
        .map_err(|e| anyhow!("failed to generate key: {:?}", e))?;

    let fingerprint = key.fingerprint(ssh_key::HashAlg::Sha256).to_string();
    let public_key = key.public_key().to_string();

    let strength = match &input.algorithm {
        GenerateAlgorithm::Ed25519 => CredentialStrength::Recommended,
        GenerateAlgorithm::Rsa => classify_rsa_strength(rsa_bits.unwrap_or(4096)),
    };

    let meta = PrivateKeyMeta {
        credential_id: String::new(),
        algorithm,
        rsa_bits,
        format: KeyFormat::Openssh,
        fingerprint,
        public_key,
        has_passphrase: false,
        source: KeySource::Generated,
        strength,
    };
    validate_private_key_meta(&meta)?;

    let id = uuid::Uuid::new_v4().to_string();
    let now = Utc::now();

    let pem = key
        .to_openssh(ssh_key::LineEnding::LF)
        .map_err(|e| anyhow!("failed to serialize key: {:?}", e))?
        .to_string();

    let secret_bytes = pem.as_bytes();
    let storage_ref = store.store_secret(&id, secret_bytes)?;

    let credential = Credential {
        id: id.clone(),
        kind: CredentialKind::PrivateKey,
        name: input.name,
        storage_mode: storage_mode_from_ref(&storage_ref),
        storage_ref,
        created_at: now,
        updated_at: now,
        last_validated_at: Some(now),
        archived_at: None,
    };

    upsert_credential_metadata(index, credential.clone());
    let mut meta_with_id = meta;
    meta_with_id.credential_id = id;
    add_private_key_meta(index, meta_with_id);

    validate_credential_index(index)?;

    Ok(credential)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::CredentialIndex;
    use crate::storage::credentials::secure_store::EncryptedFileStore;
    use crate::storage::CloudCodePaths;

    fn make_store() -> EncryptedFileStore {
        let paths = CloudCodePaths::from_root(
            std::env::temp_dir().join(format!("cloudcode-test-{}", uuid::Uuid::new_v4())),
        );
        paths.ensure_dirs().unwrap();
        EncryptedFileStore::new(paths)
    }

    #[test]
    fn test_generate_ed25519_key() {
        let mut index = CredentialIndex::default();
        let store = make_store();

        let input = GeneratePrivateKeyInput {
            name: "test ed25519".to_string(),
            algorithm: GenerateAlgorithm::Ed25519,
            rsa_bits: None,
        };
        let result = generate_private_key(input, &mut index, &store);
        assert!(result.is_ok());
        let cred = result.unwrap();
        assert_eq!(cred.kind, CredentialKind::PrivateKey);
        assert_eq!(cred.name, "test ed25519");
        assert!(!cred.storage_ref.is_empty());
        assert_eq!(index.private_keys.len(), 1);
        assert_eq!(
            index.private_keys[0].algorithm,
            PrivateKeyAlgorithm::Ed25519
        );
        assert!(index.private_keys[0].rsa_bits.is_none());
        assert_eq!(index.private_keys[0].source, KeySource::Generated);
        assert_eq!(
            index.private_keys[0].strength,
            CredentialStrength::Recommended
        );
    }

    #[test]
    fn test_generate_rsa_4096_key() {
        let mut index = CredentialIndex::default();
        let store = make_store();

        let input = GeneratePrivateKeyInput {
            name: "test rsa".to_string(),
            algorithm: GenerateAlgorithm::Rsa,
            rsa_bits: Some(4096),
        };
        let result = generate_private_key(input, &mut index, &store);
        assert!(result.is_ok());
        let cred = result.unwrap();
        assert_eq!(cred.kind, CredentialKind::PrivateKey);
        assert_eq!(index.private_keys.len(), 1);
        assert_eq!(index.private_keys[0].algorithm, PrivateKeyAlgorithm::Rsa);
        assert_eq!(index.private_keys[0].rsa_bits, Some(4096));
        assert_eq!(index.private_keys[0].source, KeySource::Generated);
        assert_eq!(
            index.private_keys[0].strength,
            CredentialStrength::Recommended
        );
    }

    #[test]
    fn test_generate_rsa_default_4096() {
        let mut index = CredentialIndex::default();
        let store = make_store();

        let input = GeneratePrivateKeyInput {
            name: "test rsa default".to_string(),
            algorithm: GenerateAlgorithm::Rsa,
            rsa_bits: None,
        };
        let result = generate_private_key(input, &mut index, &store);
        assert!(result.is_ok());
        assert_eq!(index.private_keys[0].rsa_bits, Some(4096));
    }

    #[test]
    fn test_generate_rsa_rejects_non_4096() {
        let mut index = CredentialIndex::default();
        let store = make_store();

        let input = GeneratePrivateKeyInput {
            name: "test rsa".to_string(),
            algorithm: GenerateAlgorithm::Rsa,
            rsa_bits: Some(2048),
        };
        let result = generate_private_key(input, &mut index, &store);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("4096"));
    }

    #[test]
    fn test_generate_ed25519_rejects_rsa_bits() {
        let mut index = CredentialIndex::default();
        let store = make_store();

        let input = GeneratePrivateKeyInput {
            name: "test ed25519".to_string(),
            algorithm: GenerateAlgorithm::Ed25519,
            rsa_bits: Some(4096),
        };
        let result = generate_private_key(input, &mut index, &store);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("rsa_bits"));
    }

    #[test]
    fn test_generated_key_has_fingerprint() {
        let mut index = CredentialIndex::default();
        let store = make_store();

        let input = GeneratePrivateKeyInput {
            name: "test".to_string(),
            algorithm: GenerateAlgorithm::Ed25519,
            rsa_bits: None,
        };
        let _cred = generate_private_key(input, &mut index, &store).unwrap();
        let meta = &index.private_keys[0];
        assert!(!meta.fingerprint.is_empty());
        assert!(!meta.public_key.is_empty());
        assert!(meta.fingerprint.starts_with("SHA256:"));
    }
}
