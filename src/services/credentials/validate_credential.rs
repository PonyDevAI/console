use anyhow::{anyhow, Result};
use chrono::Utc;

use crate::models::{CredentialIndex, CredentialKind};
use crate::storage::credentials::{
    file_store::{
        get_credential, get_password_meta, get_private_key_meta, upsert_credential_metadata,
    },
    secure_store::SecureStore,
};

use super::import_private_key::parse_private_key;

/// Validate an existing credential by loading the stored secret and checking
/// that it is still structurally usable for its declared kind.
///
/// For password credentials this means the secret is present and non-empty.
/// For private key credentials this means the secret can be parsed and its
/// metadata still matches the stored fingerprint/algorithm/bit size.
pub fn validate_credential(
    id: &str,
    index: &mut CredentialIndex,
    store: &dyn SecureStore,
) -> Result<()> {
    let credential =
        get_credential(index, id).ok_or_else(|| anyhow!("credential not found: {}", id))?;

    let secret_bytes = store.load_secret(&credential.storage_ref)?;
    if secret_bytes.is_empty() {
        return Err(anyhow!("stored secret is empty"));
    }

    match credential.kind {
        CredentialKind::Password => validate_password_credential(index, id, &secret_bytes)?,
        CredentialKind::PrivateKey => validate_private_key_credential(index, id, &secret_bytes)?,
    }

    let now = Utc::now();
    let mut updated = credential.clone();
    updated.updated_at = now;
    updated.last_validated_at = Some(now);
    upsert_credential_metadata(index, updated);

    Ok(())
}

fn validate_password_credential(
    index: &CredentialIndex,
    id: &str,
    secret_bytes: &[u8],
) -> Result<()> {
    let meta = get_password_meta(index, id)
        .ok_or_else(|| anyhow!("password metadata not found for credential: {}", id))?;

    if !meta.has_value {
        return Err(anyhow!("password credential metadata indicates no value"));
    }

    let secret = std::str::from_utf8(secret_bytes)
        .map_err(|e| anyhow!("password secret is not valid utf8: {}", e))?;
    if secret.trim().is_empty() {
        return Err(anyhow!("password secret is empty"));
    }

    Ok(())
}

fn validate_private_key_credential(
    index: &CredentialIndex,
    id: &str,
    secret_bytes: &[u8],
) -> Result<()> {
    let meta = get_private_key_meta(index, id)
        .ok_or_else(|| anyhow!("private key metadata not found for credential: {}", id))?;

    let secret = std::str::from_utf8(secret_bytes)
        .map_err(|e| anyhow!("private key secret is not valid utf8: {}", e))?;
    let parsed = parse_private_key(secret, None)?;

    if parsed.algorithm != meta.algorithm {
        return Err(anyhow!(
            "private key algorithm mismatch: stored {:?}, parsed {:?}",
            meta.algorithm,
            parsed.algorithm
        ));
    }

    if parsed.rsa_bits != meta.rsa_bits {
        return Err(anyhow!(
            "private key size mismatch: stored {:?}, parsed {:?}",
            meta.rsa_bits,
            parsed.rsa_bits
        ));
    }

    if parsed.fingerprint != meta.fingerprint {
        return Err(anyhow!(
            "private key fingerprint mismatch: stored {}, parsed {}",
            meta.fingerprint,
            parsed.fingerprint
        ));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::credentials::{
        generate_private_key::{generate_private_key, GenerateAlgorithm, GeneratePrivateKeyInput},
        password_credential::{create_password_credential, CreatePasswordCredentialInput},
    };
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
    fn test_validate_password_credential() {
        let mut index = CredentialIndex::default();
        let store = make_store();

        let cred = create_password_credential(
            CreatePasswordCredentialInput {
                name: "test password".to_string(),
                secret: "supersecret".to_string(),
            },
            &mut index,
            &store,
        )
        .unwrap();

        let previous_validated_at = cred.last_validated_at;
        validate_credential(&cred.id, &mut index, &store).unwrap();
        let updated = get_credential(&index, &cred.id).unwrap();
        assert!(updated.last_validated_at.is_some());
        assert!(updated.last_validated_at >= previous_validated_at);
    }

    #[test]
    fn test_validate_private_key_credential() {
        let mut index = CredentialIndex::default();
        let store = make_store();

        let cred = generate_private_key(
            GeneratePrivateKeyInput {
                name: "test key".to_string(),
                algorithm: GenerateAlgorithm::Ed25519,
                rsa_bits: None,
            },
            &mut index,
            &store,
        )
        .unwrap();

        validate_credential(&cred.id, &mut index, &store).unwrap();
        let updated = get_credential(&index, &cred.id).unwrap();
        assert!(updated.last_validated_at.is_some());
    }

    #[test]
    fn test_validate_nonexistent_credential_fails() {
        let mut index = CredentialIndex::default();
        let store = make_store();

        let result = validate_credential("missing", &mut index, &store);
        assert!(result.is_err());
    }
}
