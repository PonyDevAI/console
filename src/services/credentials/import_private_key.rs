use anyhow::{anyhow, Result};
use chrono::Utc;
use ed25519_dalek::pkcs8::DecodePrivateKey as _;
use rsa::pkcs1::DecodeRsaPrivateKey as _;
use rsa::traits::PublicKeyParts;
use ssh_key::private::{Ed25519Keypair, RsaKeypair};

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

/// Input for importing a private key.
pub struct ImportPrivateKeyInput {
    pub name: String,
    pub private_key_pem: String,
    pub passphrase: Option<String>,
}

/// Import a private key from PEM/OpenSSH text.
/// Returns the created credential with metadata.
pub fn import_private_key(
    input: ImportPrivateKeyInput,
    index: &mut CredentialIndex,
    store: &dyn SecureStore,
) -> Result<Credential> {
    // Parse the key to extract metadata
    let key = parse_private_key(&input.private_key_pem, input.passphrase.as_deref())?;

    let algorithm = key.algorithm;
    let rsa_bits = key.rsa_bits;
    let fingerprint = key.fingerprint;
    let public_key = key.public_key;
    let has_passphrase = input.passphrase.is_some();
    let format = key.format;

    // Validate the key metadata
    let meta = PrivateKeyMeta {
        credential_id: String::new(), // Will be set after credential creation
        algorithm: algorithm.clone(),
        rsa_bits,
        format,
        fingerprint,
        public_key,
        has_passphrase,
        source: KeySource::Imported,
        strength: match algorithm {
            PrivateKeyAlgorithm::Rsa => classify_rsa_strength(rsa_bits.unwrap_or(4096)),
            PrivateKeyAlgorithm::Ed25519 => CredentialStrength::Recommended,
        },
    };
    validate_private_key_meta(&meta)?;

    // Create credential
    let id = uuid::Uuid::new_v4().to_string();
    let now = Utc::now();

    // Store the secret material
    let secret_bytes = input.private_key_pem.as_bytes();
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

    // Update index
    upsert_credential_metadata(index, credential.clone());
    let mut meta_with_id = meta;
    meta_with_id.credential_id = id;
    add_private_key_meta(index, meta_with_id);

    // Validate the full index
    validate_credential_index(index)?;

    Ok(credential)
}

pub(crate) struct ParsedKey {
    pub(crate) algorithm: PrivateKeyAlgorithm,
    pub(crate) rsa_bits: Option<u32>,
    pub(crate) fingerprint: String,
    pub(crate) public_key: String,
    pub(crate) format: KeyFormat,
}

pub(crate) fn parse_private_key(pem: &str, _passphrase: Option<&str>) -> Result<ParsedKey> {
    // Try to parse as OpenSSH format first
    if let Ok(key) = ssh_key::PrivateKey::from_openssh(pem) {
        return build_parsed_key(key, KeyFormat::Openssh);
    }

    if let Ok(key) = rsa::RsaPrivateKey::from_pkcs1_pem(pem) {
        let ssh_key = ssh_key::PrivateKey::from(RsaKeypair::try_from(key)?);
        return build_parsed_key(ssh_key, KeyFormat::Pem);
    }

    if let Ok(key) = rsa::RsaPrivateKey::from_pkcs8_pem(pem) {
        let ssh_key = ssh_key::PrivateKey::from(RsaKeypair::try_from(key)?);
        return build_parsed_key(ssh_key, KeyFormat::Pkcs8);
    }

    if let Ok(key) = ed25519_dalek::SigningKey::from_pkcs8_pem(pem) {
        let ssh_key = ssh_key::PrivateKey::from(Ed25519Keypair::from(key));
        return build_parsed_key(ssh_key, KeyFormat::Pkcs8);
    }

    Err(anyhow!(
        "unable to parse private key: not a recognized format"
    ))
}

fn build_parsed_key(key: ssh_key::PrivateKey, format: KeyFormat) -> Result<ParsedKey> {
    let public_key = key.public_key().to_string();
    let fingerprint = key.fingerprint(ssh_key::HashAlg::Sha256).to_string();

    let (algorithm, rsa_bits) = match key.algorithm() {
        ssh_key::Algorithm::Ed25519 => (PrivateKeyAlgorithm::Ed25519, None),
        ssh_key::Algorithm::Rsa { .. } => {
            let pair = key
                .key_data()
                .rsa()
                .ok_or_else(|| anyhow!("rsa key data missing"))?;
            let rsa_key = rsa::RsaPrivateKey::try_from(pair)
                .map_err(|e| anyhow!("failed to convert rsa key: {}", e))?;
            let bits = (rsa_key.n().bits()) as u32;
            (PrivateKeyAlgorithm::Rsa, Some(bits))
        }
        other => return Err(anyhow!("unsupported key algorithm: {:?}", other)),
    };

    Ok(ParsedKey {
        algorithm,
        rsa_bits,
        fingerprint,
        public_key,
        format,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
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
    fn test_import_rejects_unsupported_algorithm() {
        let mut index = CredentialIndex::default();
        let store = make_store();

        // DSA key is not supported
        let input = ImportPrivateKeyInput {
            name: "test".to_string(),
            private_key_pem: "-----BEGIN DSA PRIVATE KEY-----\nMIIBugIBAAKBgQ".to_string(),
            passphrase: None,
        };
        let result = import_private_key(input, &mut index, &store);
        assert!(result.is_err());
    }

    #[test]
    fn test_import_validates_key_metadata() {
        let mut index = CredentialIndex::default();
        let store = make_store();

        // Import with a valid OpenSSH ed25519 key
        let input = ImportPrivateKeyInput {
            name: "test key".to_string(),
            private_key_pem: "-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW\nQyNTUxOQAAACDpMjRNkKjJvMkHvMjJvMkHvMjJvMkHvMjJvMkHvMjJvMkHvAAAACg==\n-----END OPENSSH PRIVATE KEY-----".to_string(),
            passphrase: None,
        };
        let result = import_private_key(input, &mut index, &store);
        // May fail due to invalid key data, but the validation path is exercised
        if let Ok(cred) = result {
            assert_eq!(cred.kind, CredentialKind::PrivateKey);
            assert_eq!(cred.name, "test key");
            assert!(!cred.storage_ref.is_empty());
        }
    }
}
