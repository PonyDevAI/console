use anyhow::{anyhow, Result};
use chrono::Utc;

use crate::models::{
    validate_credential_index, Credential, CredentialIndex, CredentialKind, CredentialStorageMode,
    PasswordMeta, PasswordSource,
};
use crate::storage::credentials::{
    file_store::{add_password_meta, get_credential, upsert_credential_metadata},
    secure_store::SecureStore,
};

fn storage_mode_from_ref(storage_ref: &str) -> CredentialStorageMode {
    if storage_ref.starts_with("keychain:") {
        CredentialStorageMode::KeychainRef
    } else {
        CredentialStorageMode::EncryptedFile
    }
}

/// Input for creating a new password credential.
pub struct CreatePasswordCredentialInput {
    pub name: String,
    pub secret: String,
}

/// Input for updating an existing password credential.
pub struct UpdatePasswordCredentialInput {
    pub secret: String,
}

/// Create a new password credential.
pub fn create_password_credential(
    input: CreatePasswordCredentialInput,
    index: &mut CredentialIndex,
    store: &dyn SecureStore,
) -> Result<Credential> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = Utc::now();

    let secret_bytes = input.secret.as_bytes();
    let storage_ref = store.store_secret(&id, secret_bytes)?;

    let credential = Credential {
        id: id.clone(),
        kind: CredentialKind::Password,
        name: input.name,
        storage_mode: storage_mode_from_ref(&storage_ref),
        storage_ref,
        created_at: now,
        updated_at: now,
        last_validated_at: Some(now),
        archived_at: None,
    };

    let meta = PasswordMeta {
        credential_id: id.clone(),
        has_value: true,
        source: PasswordSource::Manual,
    };

    upsert_credential_metadata(index, credential.clone());
    add_password_meta(index, meta);

    validate_credential_index(index)?;

    Ok(credential)
}

/// Update an existing password credential's secret.
pub fn update_password_credential(
    id: &str,
    input: UpdatePasswordCredentialInput,
    index: &mut CredentialIndex,
    store: &dyn SecureStore,
) -> Result<()> {
    let credential = get_credential(index, id)
        .ok_or_else(|| anyhow!("credential not found: {}", id))?;

    if credential.kind != CredentialKind::Password {
        return Err(anyhow!(
            "credential {} is not a password credential",
            id
        ));
    }

    let secret_bytes = input.secret.as_bytes();
    store.update_secret(&credential.storage_ref, secret_bytes)?;

    let now = Utc::now();
    let mut updated = credential.clone();
    updated.updated_at = now;
    updated.last_validated_at = Some(now);

    upsert_credential_metadata(index, updated);

    validate_credential_index(index)?;

    Ok(())
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
    fn test_create_password_credential() {
        let mut index = CredentialIndex::default();
        let store = make_store();

        let input = CreatePasswordCredentialInput {
            name: "test password".to_string(),
            secret: "supersecret".to_string(),
        };
        let result = create_password_credential(input, &mut index, &store);
        assert!(result.is_ok());
        let cred = result.unwrap();
        assert_eq!(cred.kind, CredentialKind::Password);
        assert_eq!(cred.name, "test password");
        assert!(!cred.storage_ref.is_empty());
        assert_eq!(index.passwords.len(), 1);
        assert_eq!(index.passwords[0].credential_id, cred.id);
        assert!(index.passwords[0].has_value);
        assert_eq!(index.passwords[0].source, PasswordSource::Manual);
    }

    #[test]
    fn test_update_password_credential() {
        let mut index = CredentialIndex::default();
        let store = make_store();

        let input = CreatePasswordCredentialInput {
            name: "test password".to_string(),
            secret: "original".to_string(),
        };
        let cred = create_password_credential(input, &mut index, &store).unwrap();
        let id = cred.id.clone();

        let update_input = UpdatePasswordCredentialInput {
            secret: "newsecret".to_string(),
        };
        let result = update_password_credential(&id, update_input, &mut index, &store);
        assert!(result.is_ok());

        let updated = get_credential(&index, &id).unwrap();
        assert_eq!(updated.kind, CredentialKind::Password);
    }

    #[test]
    fn test_update_nonexistent_password_fails() {
        let mut index = CredentialIndex::default();
        let store = make_store();

        let update_input = UpdatePasswordCredentialInput {
            secret: "newsecret".to_string(),
        };
        let result = update_password_credential("nonexistent", update_input, &mut index, &store);
        assert!(result.is_err());
    }

    #[test]
    fn test_update_wrong_kind_fails() {
        let mut index = CredentialIndex::default();
        let store = make_store();

        let cred = crate::services::credentials::generate_private_key::generate_private_key(
            crate::services::credentials::generate_private_key::GeneratePrivateKeyInput {
                name: "test key".to_string(),
                algorithm: crate::services::credentials::generate_private_key::GenerateAlgorithm::Ed25519,
                rsa_bits: None,
            },
            &mut index,
            &store,
        ).unwrap();

        let update_input = UpdatePasswordCredentialInput {
            secret: "newsecret".to_string(),
        };
        let result = update_password_credential(&cred.id, update_input, &mut index, &store);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("not a password"));
    }
}
