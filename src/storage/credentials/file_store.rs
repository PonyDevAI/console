use anyhow::Result;

use crate::models::{Credential, CredentialIndex, PasswordMeta, PrivateKeyMeta};
use crate::storage::{read_json, write_json, CloudCodePaths};

/// Load the credential index from disk.
pub fn load_credentials_index(paths: &CloudCodePaths) -> Result<CredentialIndex> {
    let file = paths.credentials_index_file();
    if file.exists() {
        read_json(&file)
    } else {
        Ok(CredentialIndex::default())
    }
}

/// Save the credential index to disk.
pub fn save_credentials_index(paths: &CloudCodePaths, index: &CredentialIndex) -> Result<()> {
    let file = paths.credentials_index_file();
    write_json(&file, index)
}

/// Upsert a credential into the index.
/// Replaces existing credential by id, or appends if new.
pub fn upsert_credential_metadata(index: &mut CredentialIndex, credential: Credential) {
    // Remove existing if present
    index.credentials.retain(|c| c.id != credential.id);
    index
        .private_keys
        .retain(|pk| pk.credential_id != credential.id);
    index
        .passwords
        .retain(|pw| pw.credential_id != credential.id);

    index.credentials.push(credential);
}

/// Remove a credential and its metadata from the index by id.
pub fn remove_credential_metadata(index: &mut CredentialIndex, id: &str) {
    index.credentials.retain(|c| c.id != id);
    index.private_keys.retain(|pk| pk.credential_id != id);
    index.passwords.retain(|pw| pw.credential_id != id);
}

/// Add private key metadata to the index.
pub fn add_private_key_meta(index: &mut CredentialIndex, meta: PrivateKeyMeta) {
    index
        .private_keys
        .retain(|pk| pk.credential_id != meta.credential_id);
    index.private_keys.push(meta);
}

/// Add password metadata to the index.
pub fn add_password_meta(index: &mut CredentialIndex, meta: PasswordMeta) {
    index
        .passwords
        .retain(|pw| pw.credential_id != meta.credential_id);
    index.passwords.push(meta);
}

/// Get a credential by id.
pub fn get_credential<'a>(index: &'a CredentialIndex, id: &str) -> Option<&'a Credential> {
    index.credentials.iter().find(|c| c.id == id)
}

/// Get private key metadata by credential_id.
pub fn get_private_key_meta<'a>(
    index: &'a CredentialIndex,
    credential_id: &str,
) -> Option<&'a PrivateKeyMeta> {
    index
        .private_keys
        .iter()
        .find(|pk| pk.credential_id == credential_id)
}

/// Get password metadata by credential_id.
pub fn get_password_meta<'a>(
    index: &'a CredentialIndex,
    credential_id: &str,
) -> Option<&'a PasswordMeta> {
    index
        .passwords
        .iter()
        .find(|pw| pw.credential_id == credential_id)
}

/// Find all credential ids that match a given kind.
pub fn list_credential_ids_by_kind(
    index: &CredentialIndex,
    kind: &crate::models::CredentialKind,
) -> Vec<String> {
    index
        .credentials
        .iter()
        .filter(|c| &c.kind == kind)
        .map(|c| c.id.clone())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{CredentialKind, CredentialStorageMode};
    use chrono::Utc;

    fn make_cred(id: &str, kind: CredentialKind) -> Credential {
        Credential {
            id: id.to_string(),
            kind,
            name: "test".to_string(),
            storage_mode: CredentialStorageMode::KeychainRef,
            storage_ref: "ref".to_string(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
            last_validated_at: None,
            archived_at: None,
        }
    }

    #[test]
    fn test_upsert_replaces_existing() {
        let mut index = CredentialIndex::default();
        let cred1 = make_cred("c1", CredentialKind::Password);
        upsert_credential_metadata(&mut index, cred1);
        assert_eq!(index.credentials.len(), 1);

        let cred2 = make_cred("c1", CredentialKind::PrivateKey);
        upsert_credential_metadata(&mut index, cred2);
        assert_eq!(index.credentials.len(), 1);
        assert_eq!(index.credentials[0].kind, CredentialKind::PrivateKey);
    }

    #[test]
    fn test_remove_clears_all_metadata() {
        let mut index = CredentialIndex {
            credentials: vec![make_cred("c1", CredentialKind::PrivateKey)],
            private_keys: vec![crate::models::PrivateKeyMeta {
                credential_id: "c1".to_string(),
                algorithm: crate::models::PrivateKeyAlgorithm::Ed25519,
                rsa_bits: None,
                format: crate::models::KeyFormat::Openssh,
                fingerprint: "fp".to_string(),
                public_key: "pub".to_string(),
                has_passphrase: false,
                source: crate::models::KeySource::Generated,
                strength: crate::models::CredentialStrength::Recommended,
            }],
            passwords: vec![],
        };
        remove_credential_metadata(&mut index, "c1");
        assert!(index.credentials.is_empty());
        assert!(index.private_keys.is_empty());
    }

    #[test]
    fn test_list_by_kind() {
        let index = CredentialIndex {
            credentials: vec![
                make_cred("c1", CredentialKind::Password),
                make_cred("c2", CredentialKind::PrivateKey),
                make_cred("c3", CredentialKind::Password),
            ],
            private_keys: vec![],
            passwords: vec![],
        };
        let pw_ids = list_credential_ids_by_kind(&index, &CredentialKind::Password);
        assert_eq!(pw_ids.len(), 2);
        assert!(pw_ids.contains(&"c1".to_string()));
        assert!(pw_ids.contains(&"c3".to_string()));
    }
}
