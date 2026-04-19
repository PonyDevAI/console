use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};

use crate::storage::CloudCodePaths;

/// Envelope for encrypted secret storage fallback.
/// Uses AES-256-GCM with a base64-encoded nonce and ciphertext.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptedSecretEnvelope {
    pub version: u8,
    pub algorithm: String,
    pub nonce_b64: String,
    pub ciphertext_b64: String,
}

/// Trait for secure secret storage.
/// Implementations must not log or expose secret material.
pub trait SecureStore: Send + Sync {
    /// Store secret bytes, return a storage reference.
    fn store_secret(&self, id: &str, bytes: &[u8]) -> Result<String>;

    /// Load secret bytes by storage reference.
    fn load_secret(&self, storage_ref: &str) -> Result<Vec<u8>>;

    /// Update secret bytes at an existing storage reference.
    fn update_secret(&self, storage_ref: &str, bytes: &[u8]) -> Result<()>;

    /// Delete secret at storage reference.
    fn delete_secret(&self, storage_ref: &str) -> Result<()>;
}

/// Fallback encrypted file store.
/// Used when platform secure storage (keychain) is unavailable.
pub struct EncryptedFileStore {
    paths: CloudCodePaths,
}

impl EncryptedFileStore {
    pub fn new(paths: CloudCodePaths) -> Self {
        Self { paths }
    }

    fn master_key_file(&self) -> std::path::PathBuf {
        self.paths.credentials_master_key_file()
    }

    fn ensure_master_key(&self) -> Result<[u8; 32]> {
        use base64::{engine::general_purpose::STANDARD, Engine};
        use rand::RngCore;

        let file = self.master_key_file();
        if file.exists() {
            return self.load_master_key();
        }

        let mut key = [0u8; 32];
        rand::thread_rng().fill_bytes(&mut key);
        std::fs::write(&file, STANDARD.encode(key))?;

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let permissions = std::fs::Permissions::from_mode(0o600);
            std::fs::set_permissions(&file, permissions)?;
        }

        Ok(key)
    }

    fn load_master_key(&self) -> Result<[u8; 32]> {
        use base64::{engine::general_purpose::STANDARD, Engine};

        let file = self.master_key_file();
        let raw = std::fs::read_to_string(&file)?;
        let decoded = STANDARD
            .decode(raw.trim())
            .map_err(|e| anyhow!("master key decode failed: {}", e))?;
        let key: [u8; 32] = decoded
            .try_into()
            .map_err(|_| anyhow!("master key has invalid length"))?;
        Ok(key)
    }

    /// Encrypt bytes using AES-256-GCM and write to .enc file.
    pub fn encrypt_and_store(&self, id: &str, bytes: &[u8]) -> Result<String> {
        use aes_gcm::{
            aead::{Aead, AeadCore, KeyInit},
            Aes256Gcm,
        };
        use base64::{engine::general_purpose::STANDARD, Engine};

        let key = self.ensure_master_key()?;
        let key = aes_gcm::Key::<Aes256Gcm>::from_slice(&key);
        let cipher = Aes256Gcm::new(key);
        let nonce = Aes256Gcm::generate_nonce(rand::thread_rng());

        let ciphertext = cipher
            .encrypt(&nonce, bytes)
            .map_err(|e| anyhow!("encryption failed: {:?}", e))?;

        let envelope = EncryptedSecretEnvelope {
            version: 1,
            algorithm: "aes-256-gcm".to_string(),
            nonce_b64: STANDARD.encode(nonce.as_slice()),
            ciphertext_b64: STANDARD.encode(&ciphertext),
        };

        let file = self.paths.credential_encrypted_file(id);
        let data = serde_json::to_string_pretty(&envelope)?;
        std::fs::write(&file, data)?;

        Ok(format!("encrypted:{}", id))
    }

    /// Load and decrypt bytes from .enc file.
    /// Note: This is a simplified version. In production, the key would be
    /// stored separately in the platform keychain.
    pub fn load_and_decrypt(&self, id: &str) -> Result<Vec<u8>> {
        use aes_gcm::{
            aead::{Aead, KeyInit},
            Aes256Gcm,
        };
        use base64::{engine::general_purpose::STANDARD, Engine};

        let file = self.paths.credential_encrypted_file(id);
        if !file.exists() {
            return Err(anyhow!("encrypted file not found for credential: {}", id));
        }

        let data = std::fs::read_to_string(&file)?;
        let envelope: EncryptedSecretEnvelope = serde_json::from_str(&data)?;

        let key_bytes = self.load_master_key()?;
        let key = aes_gcm::Key::<Aes256Gcm>::from_slice(&key_bytes);
        let cipher = Aes256Gcm::new(key);
        let nonce_bytes = STANDARD.decode(&envelope.nonce_b64)?;
        let nonce = aes_gcm::Nonce::from_slice(&nonce_bytes);
        let ciphertext = STANDARD.decode(&envelope.ciphertext_b64)?;

        cipher
            .decrypt(nonce, ciphertext.as_ref())
            .map_err(|e| anyhow!("decryption failed: {:?}", e))
    }

    /// Delete the encrypted file and key for a credential.
    pub fn delete_encrypted_file(&self, id: &str) -> Result<()> {
        let file = self.paths.credential_encrypted_file(id);
        if file.exists() {
            std::fs::remove_file(&file)?;
        }
        Ok(())
    }
}

impl SecureStore for EncryptedFileStore {
    fn store_secret(&self, id: &str, bytes: &[u8]) -> Result<String> {
        self.encrypt_and_store(id, bytes)
    }

    fn load_secret(&self, storage_ref: &str) -> Result<Vec<u8>> {
        let id = storage_ref
            .strip_prefix("encrypted:")
            .ok_or_else(|| anyhow!("invalid storage ref format: {}", storage_ref))?;
        self.load_and_decrypt(id)
    }

    fn update_secret(&self, storage_ref: &str, bytes: &[u8]) -> Result<()> {
        let id = storage_ref
            .strip_prefix("encrypted:")
            .ok_or_else(|| anyhow!("invalid storage ref format: {}", storage_ref))?;
        self.encrypt_and_store(id, bytes)?;
        Ok(())
    }

    fn delete_secret(&self, storage_ref: &str) -> Result<()> {
        let id = storage_ref
            .strip_prefix("encrypted:")
            .ok_or_else(|| anyhow!("invalid storage ref format: {}", storage_ref))?;
        self.delete_encrypted_file(id)
    }
}

/// Keychain-based secure store using platform secure storage.
pub struct KeychainStore;

impl KeychainStore {
    fn entry_for(id: &str) -> Result<keyring::Entry> {
        let entry = keyring::Entry::new("cloudcode", &format!("credential-{}", id))
            .map_err(|e| anyhow!("failed to create keychain entry: {}", e))?;
        Ok(entry)
    }
}

impl SecureStore for KeychainStore {
    fn store_secret(&self, id: &str, bytes: &[u8]) -> Result<String> {
        let entry = Self::entry_for(id)?;
        entry
            .set_secret(bytes)
            .map_err(|e| anyhow!("keychain store failed: {}", e))?;
        Ok(format!("keychain:{}", id))
    }

    fn load_secret(&self, storage_ref: &str) -> Result<Vec<u8>> {
        let id = storage_ref
            .strip_prefix("keychain:")
            .ok_or_else(|| anyhow!("invalid storage ref format: {}", storage_ref))?;
        let entry = Self::entry_for(id)?;
        entry
            .get_secret()
            .map_err(|e| anyhow!("keychain load failed: {}", e))
    }

    fn update_secret(&self, storage_ref: &str, bytes: &[u8]) -> Result<()> {
        let id = storage_ref
            .strip_prefix("keychain:")
            .ok_or_else(|| anyhow!("invalid storage ref format: {}", storage_ref))?;
        let entry = Self::entry_for(id)?;
        entry
            .set_secret(bytes)
            .map_err(|e| anyhow!("keychain update failed: {}", e))?;
        Ok(())
    }

    fn delete_secret(&self, storage_ref: &str) -> Result<()> {
        let id = storage_ref
            .strip_prefix("keychain:")
            .ok_or_else(|| anyhow!("invalid storage ref format: {}", storage_ref))?;
        let entry = Self::entry_for(id)?;
        entry
            .delete_credential()
            .map_err(|e| anyhow!("keychain delete failed: {}", e))?;
        Ok(())
    }
}

/// Create the appropriate secure store based on availability.
/// Prefers keychain, falls back to encrypted file store.
pub fn create_secure_store(paths: CloudCodePaths) -> Box<dyn SecureStore> {
    // Try keychain first
    if keyring::Entry::new("cloudcode", "probe").is_ok() {
        Box::new(KeychainStore)
    } else {
        Box::new(EncryptedFileStore::new(paths))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_envelope_serialization() {
        let envelope = EncryptedSecretEnvelope {
            version: 1,
            algorithm: "aes-256-gcm".to_string(),
            nonce_b64: "dGVzdG5vbmNl".to_string(),
            ciphertext_b64: "dGVzdGNpcGhlcg==".to_string(),
        };
        let json = serde_json::to_string(&envelope).unwrap();
        assert!(json.contains("aes-256-gcm"));
        let decoded: EncryptedSecretEnvelope = serde_json::from_str(&json).unwrap();
        assert_eq!(decoded.version, 1);
    }

    #[test]
    fn test_storage_ref_parsing() {
        let ref1 = "encrypted:cred-123";
        let id1 = ref1.strip_prefix("encrypted:").unwrap();
        assert_eq!(id1, "cred-123");

        let ref2 = "keychain:cred-456";
        let id2 = ref2.strip_prefix("keychain:").unwrap();
        assert_eq!(id2, "cred-456");
    }

    #[test]
    fn test_invalid_storage_ref() {
        let store = KeychainStore;
        let result = store.load_secret("invalid:format");
        assert!(result.is_err());
    }
}
