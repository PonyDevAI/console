use anyhow::{anyhow, Result};

use crate::models::{CredentialIndex, ServerIndex};
use crate::storage::credentials::{
    file_store::{get_credential, remove_credential_metadata},
    secure_store::SecureStore,
};

/// Error returned when attempting to delete a credential that is still in use.
#[derive(Debug, thiserror::Error)]
#[error("credential '{0}' is still referenced by one or more servers")]
pub struct CredentialInUse(pub String);

/// Delete a credential and its associated data.
/// Fails if any server in server_index still binds this credential.
pub fn delete_credential(
    id: &str,
    index: &mut CredentialIndex,
    store: &dyn SecureStore,
    server_index: &ServerIndex,
) -> Result<()> {
    let credential = get_credential(index, id)
        .ok_or_else(|| anyhow!("credential not found: {}", id))?;

    let referencing_servers: Vec<&str> = server_index
        .servers
        .iter()
        .filter(|s| s.credential_id == id)
        .map(|s| s.name.as_str())
        .collect();

    if !referencing_servers.is_empty() {
        return Err(CredentialInUse(id.to_string()).into());
    }

    store.delete_secret(&credential.storage_ref)?;

    remove_credential_metadata(index, id);

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{
        OsDetectedFrom, OsDetectionStatus, OsType, Server, ServerAuthMethod,
    };
    use crate::services::credentials::generate_private_key::{
        generate_private_key, GenerateAlgorithm, GeneratePrivateKeyInput,
    };
    use crate::services::credentials::password_credential::{
        create_password_credential, CreatePasswordCredentialInput,
    };
    use crate::storage::credentials::secure_store::EncryptedFileStore;
    use crate::storage::CloudCodePaths;
    use chrono::Utc;

    fn make_store() -> EncryptedFileStore {
        let paths = CloudCodePaths::from_root(
            std::env::temp_dir().join(format!("cloudcode-test-{}", uuid::Uuid::new_v4())),
        );
        paths.ensure_dirs().unwrap();
        EncryptedFileStore::new(paths)
    }

    fn make_server(id: &str, credential_id: &str) -> Server {
        Server {
            id: id.to_string(),
            name: format!("Server {}", id),
            host: "192.168.1.1".to_string(),
            port: 22,
            username: "admin".to_string(),
            auth_method: ServerAuthMethod::Password,
            credential_id: credential_id.to_string(),
            group_id: None,
            os_type: OsType::Unknown,
            os_detection_status: OsDetectionStatus::Unknown,
            os_detected_from: OsDetectedFrom::None,
            sftp_directory: None,
            wol_mac: None,
            enable_metrics: false,
            enable_containers: false,
            description: None,
            tags: vec![],
            created_at: Utc::now(),
            updated_at: Utc::now(),
            last_connected_at: None,
            last_os_sync_at: None,
        }
    }

    #[test]
    fn test_delete_unused_credential_succeeds() {
        let mut index = CredentialIndex::default();
        let store = make_store();
        let server_index = ServerIndex::default();

        let cred = create_password_credential(
            CreatePasswordCredentialInput {
                name: "test password".to_string(),
                secret: "secret".to_string(),
            },
            &mut index,
            &store,
        )
        .unwrap();

        let result = delete_credential(&cred.id, &mut index, &store, &server_index);
        assert!(result.is_ok());
        assert!(get_credential(&index, &cred.id).is_none());
        assert!(index.passwords.is_empty());
    }

    #[test]
    fn test_delete_credential_in_use_fails() {
        let mut index = CredentialIndex::default();
        let store = make_store();

        let cred = create_password_credential(
            CreatePasswordCredentialInput {
                name: "test password".to_string(),
                secret: "secret".to_string(),
            },
            &mut index,
            &store,
        )
        .unwrap();

        let server_index = ServerIndex {
            servers: vec![make_server("s1", &cred.id)],
        };

        let result = delete_credential(&cred.id, &mut index, &store, &server_index);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("still referenced"));
        assert!(get_credential(&index, &cred.id).is_some());
    }

    fn make_private_key_server(id: &str, credential_id: &str) -> Server {
        let mut s = make_server(id, credential_id);
        s.auth_method = ServerAuthMethod::PrivateKey;
        s
    }

    #[test]
    fn test_delete_private_key_in_use_fails() {
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

        let server_index = ServerIndex {
            servers: vec![make_private_key_server("s1", &cred.id)],
        };

        let result = delete_credential(&cred.id, &mut index, &store, &server_index);
        assert!(result.is_err());
    }

    #[test]
    fn test_delete_nonexistent_credential_fails() {
        let mut index = CredentialIndex::default();
        let store = make_store();
        let server_index = ServerIndex::default();

        let result = delete_credential("nonexistent", &mut index, &store, &server_index);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("not found"));
    }
}
