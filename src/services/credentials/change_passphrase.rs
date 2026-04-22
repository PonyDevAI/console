use anyhow::{anyhow, Result};
use chrono::Utc;

use crate::models::{validate_credential_index, CredentialIndex, CredentialKind};
use crate::storage::credentials::{
    file_store::{get_credential, get_private_key_meta, upsert_credential_metadata},
    secure_store::SecureStore,
};

/// Input for changing a private key passphrase.
pub struct ChangePassphraseInput {
    pub old_passphrase: Option<String>,
    pub new_passphrase: Option<String>,
}

/// Change the passphrase of an existing private key.
/// Must NOT change credentialId or key fingerprint.
pub fn change_private_key_passphrase(
    id: &str,
    input: ChangePassphraseInput,
    index: &mut CredentialIndex,
    store: &dyn SecureStore,
) -> Result<()> {
    let credential =
        get_credential(index, id).ok_or_else(|| anyhow!("credential not found: {}", id))?;

    if credential.kind != CredentialKind::PrivateKey {
        return Err(anyhow!("credential {} is not a private key credential", id));
    }

    let pk_meta = get_private_key_meta(index, id)
        .ok_or_else(|| anyhow!("private key metadata not found for credential: {}", id))?;

    let original_fingerprint = pk_meta.fingerprint.clone();
    let pk_meta = pk_meta.clone();

    if input.old_passphrase.is_none() && input.new_passphrase.is_none() {
        return Err(anyhow!(
            "at least one of old_passphrase or new_passphrase must be provided"
        ));
    }

    let secret_bytes = store.load_secret(&credential.storage_ref)?;
    let pem_str = String::from_utf8(secret_bytes)
        .map_err(|e| anyhow!("invalid utf8 in stored key: {}", e))?;

    // Parse the key (may be encrypted or unencrypted)
    let key = ssh_key::PrivateKey::from_openssh(&pem_str)
        .map_err(|e| anyhow!("failed to parse stored key: {}", e))?;

    // Decrypt if the key has a passphrase
    let decrypted_key = if pk_meta.has_passphrase {
        let old_pass = input
            .old_passphrase
            .as_ref()
            .ok_or_else(|| anyhow!("key has a passphrase, old_passphrase is required"))?;
        key.decrypt(old_pass)
            .map_err(|e| anyhow!("failed to decrypt key with old passphrase: {}", e))?
    } else {
        if input.old_passphrase.is_some() {
            return Err(anyhow!(
                "key does not have a passphrase, but old_passphrase was provided"
            ));
        }
        key
    };

    // Verify fingerprint hasn't changed after decryption
    let decrypted_fingerprint = decrypted_key
        .fingerprint(ssh_key::HashAlg::Sha256)
        .to_string();
    if decrypted_fingerprint != original_fingerprint {
        return Err(anyhow!("fingerprint mismatch after decryption"));
    }

    // Re-encrypt with new passphrase (or keep unencrypted)
    let final_key = if let Some(new_pass) = &input.new_passphrase {
        if new_pass.is_empty() {
            // Empty passphrase means keep it unencrypted
            decrypted_key
        } else {
            decrypted_key
                .encrypt(&mut rand::thread_rng(), new_pass)
                .map_err(|e| anyhow!("failed to encrypt key with new passphrase: {}", e))?
        }
    } else {
        // No new passphrase provided, keep decrypted (unencrypted)
        decrypted_key
    };

    // Verify fingerprint after re-encryption
    let final_fingerprint = final_key.fingerprint(ssh_key::HashAlg::Sha256).to_string();
    if final_fingerprint != original_fingerprint {
        return Err(anyhow!(
            "fingerprint changed after passphrase update: {} -> {}",
            original_fingerprint,
            final_fingerprint
        ));
    }

    // Serialize and store
    let new_pem = final_key
        .to_openssh(ssh_key::LineEnding::LF)
        .map_err(|e| anyhow!("failed to serialize key: {}", e))?;

    let new_secret_bytes = new_pem.to_string().as_bytes().to_vec();
    store.update_secret(&credential.storage_ref, &new_secret_bytes)?;

    // Update timestamps
    let now = Utc::now();
    let mut updated = credential.clone();
    updated.updated_at = now;

    upsert_credential_metadata(index, updated);

    // Update has_passphrase in metadata
    let mut updated_meta = pk_meta.clone();
    updated_meta.has_passphrase = input
        .new_passphrase
        .as_ref()
        .map(|p| !p.is_empty())
        .unwrap_or(false);

    // We need to update the private_keys entry
    index.private_keys.retain(|pk| pk.credential_id != id);
    index.private_keys.push(updated_meta);

    validate_credential_index(index)?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::credentials::generate_private_key::{
        generate_private_key, GenerateAlgorithm, GeneratePrivateKeyInput,
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
    fn test_change_passphrase_requires_at_least_one() {
        let mut index = CredentialIndex::default();
        let store = make_store();

        let cred = generate_private_key(
            GeneratePrivateKeyInput {
                name: "test".to_string(),
                algorithm: GenerateAlgorithm::Ed25519,
                rsa_bits: None,
            },
            &mut index,
            &store,
        )
        .unwrap();

        let input = ChangePassphraseInput {
            old_passphrase: None,
            new_passphrase: None,
        };
        let result = change_private_key_passphrase(&cred.id, input, &mut index, &store);
        assert!(result.is_err());
        let err_msg = result.unwrap_err().to_string();
        assert!(
            err_msg.contains("at least one") || err_msg.contains("old_passphrase"),
            "unexpected error: {}",
            err_msg
        );
    }

    #[test]
    fn test_change_passphrase_on_nonexistent_fails() {
        let mut index = CredentialIndex::default();
        let store = make_store();

        let input = ChangePassphraseInput {
            old_passphrase: None,
            new_passphrase: Some("new".to_string()),
        };
        let result = change_private_key_passphrase("nonexistent", input, &mut index, &store);
        assert!(result.is_err());
    }

    #[test]
    fn test_change_passphrase_on_password_credential_fails() {
        use crate::services::credentials::password_credential::{
            create_password_credential, CreatePasswordCredentialInput,
        };

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

        let input = ChangePassphraseInput {
            old_passphrase: None,
            new_passphrase: Some("new".to_string()),
        };
        let result = change_private_key_passphrase(&cred.id, input, &mut index, &store);
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("not a private key"));
    }
}
