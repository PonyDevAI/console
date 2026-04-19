use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

// ── Credential ──

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum CredentialKind {
    Password,
    PrivateKey,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum CredentialStorageMode {
    KeychainRef,
    EncryptedFile,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Credential {
    pub id: String,
    pub kind: CredentialKind,
    pub name: String,
    pub storage_mode: CredentialStorageMode,
    pub storage_ref: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub last_validated_at: Option<DateTime<Utc>>,
    pub archived_at: Option<DateTime<Utc>>,
}

// ── Private Key ──

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum PrivateKeyAlgorithm {
    Ed25519,
    Rsa,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum CredentialStrength {
    Recommended,
    Compatible,
    Legacy,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrivateKeyMeta {
    pub credential_id: String,
    pub algorithm: PrivateKeyAlgorithm,
    pub rsa_bits: Option<u32>,
    pub format: KeyFormat,
    pub fingerprint: String,
    pub public_key: String,
    pub has_passphrase: bool,
    pub source: KeySource,
    pub strength: CredentialStrength,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum KeyFormat {
    Openssh,
    Pem,
    Pkcs8,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum KeySource {
    Imported,
    Generated,
}

// ── Password ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PasswordMeta {
    pub credential_id: String,
    pub has_value: bool,
    pub source: PasswordSource,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum PasswordSource {
    Manual,
}

// ── Index ──

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CredentialIndex {
    pub credentials: Vec<Credential>,
    pub private_keys: Vec<PrivateKeyMeta>,
    pub passwords: Vec<PasswordMeta>,
}

// ── Validation ──

#[derive(Debug, thiserror::Error)]
pub enum CredentialValidationError {
    #[error("ed25519 key must not have rsa_bits set")]
    Ed25519HasRsaBits,
    #[error("rsa key must have rsa_bits set to 2048, 3072, or 4096")]
    RsaMissingBits,
    #[error("rsa_bits must be 2048, 3072, or 4096, got {0}")]
    InvalidRsaBits(u32),
    #[error("credential kind '{0}' must have matching metadata")]
    KindMetadataMismatch(String),
    #[error("credential index contains duplicate id '{0}'")]
    DuplicateCredentialId(String),
    #[error("private key meta credential_id '{0}' not found in credentials")]
    OrphanPrivateKeyMeta(String),
    #[error("password meta credential_id '{0}' not found in credentials")]
    OrphanPasswordMeta(String),
    #[error("generated rsa keys must be 4096 bits, got {0}")]
    GeneratedRsaNot4096(u32),
}

pub fn validate_private_key_meta(meta: &PrivateKeyMeta) -> Result<(), CredentialValidationError> {
    match meta.algorithm {
        PrivateKeyAlgorithm::Ed25519 => {
            if meta.rsa_bits.is_some() {
                return Err(CredentialValidationError::Ed25519HasRsaBits);
            }
        }
        PrivateKeyAlgorithm::Rsa => {
            let bits = meta
                .rsa_bits
                .ok_or(CredentialValidationError::RsaMissingBits)?;
            if bits != 2048 && bits != 3072 && bits != 4096 {
                return Err(CredentialValidationError::InvalidRsaBits(bits));
            }
            // Generated RSA must always be 4096
            if meta.source == KeySource::Generated && bits != 4096 {
                return Err(CredentialValidationError::GeneratedRsaNot4096(bits));
            }
        }
    }
    Ok(())
}

pub fn validate_credential_index(
    index: &CredentialIndex,
) -> Result<(), CredentialValidationError> {
    // Check for duplicate credential IDs
    let mut seen = std::collections::HashSet::new();
    for cred in &index.credentials {
        if !seen.insert(&cred.id) {
            return Err(CredentialValidationError::DuplicateCredentialId(
                cred.id.clone(),
            ));
        }
    }

    // Check kind/metadata alignment
    for pk in &index.private_keys {
        let cred = index
            .credentials
            .iter()
            .find(|c| c.id == pk.credential_id)
            .ok_or_else(|| {
                CredentialValidationError::OrphanPrivateKeyMeta(pk.credential_id.clone())
            })?;
        if cred.kind != CredentialKind::PrivateKey {
            return Err(CredentialValidationError::KindMetadataMismatch(format!(
                "credential {} is {:?} but has PrivateKeyMeta",
                cred.id, cred.kind
            )));
        }
        validate_private_key_meta(pk)?;
    }

    for pw in &index.passwords {
        let cred = index
            .credentials
            .iter()
            .find(|c| c.id == pw.credential_id)
            .ok_or_else(|| {
                CredentialValidationError::OrphanPasswordMeta(pw.credential_id.clone())
            })?;
        if cred.kind != CredentialKind::Password {
            return Err(CredentialValidationError::KindMetadataMismatch(format!(
                "credential {} is {:?} but has PasswordMeta",
                cred.id, cred.kind
            )));
        }
    }

    Ok(())
}

// ── Strength helpers ──

pub fn classify_rsa_strength(bits: u32) -> CredentialStrength {
    match bits {
        4096 => CredentialStrength::Recommended,
        3072 => CredentialStrength::Compatible,
        2048 => CredentialStrength::Legacy,
        _ => CredentialStrength::Legacy,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_credential(id: &str, kind: CredentialKind) -> Credential {
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
    fn test_ed25519_with_rsa_bits_fails() {
        let meta = PrivateKeyMeta {
            credential_id: "c1".to_string(),
            algorithm: PrivateKeyAlgorithm::Ed25519,
            rsa_bits: Some(4096),
            format: KeyFormat::Openssh,
            fingerprint: "fp".to_string(),
            public_key: "pub".to_string(),
            has_passphrase: false,
            source: KeySource::Generated,
            strength: CredentialStrength::Recommended,
        };
        assert!(validate_private_key_meta(&meta).is_err());
    }

    #[test]
    fn test_rsa_without_bits_fails() {
        let meta = PrivateKeyMeta {
            credential_id: "c1".to_string(),
            algorithm: PrivateKeyAlgorithm::Rsa,
            rsa_bits: None,
            format: KeyFormat::Openssh,
            fingerprint: "fp".to_string(),
            public_key: "pub".to_string(),
            has_passphrase: false,
            source: KeySource::Generated,
            strength: CredentialStrength::Recommended,
        };
        assert!(validate_private_key_meta(&meta).is_err());
    }

    #[test]
    fn test_generated_rsa_2048_fails() {
        let meta = PrivateKeyMeta {
            credential_id: "c1".to_string(),
            algorithm: PrivateKeyAlgorithm::Rsa,
            rsa_bits: Some(2048),
            format: KeyFormat::Openssh,
            fingerprint: "fp".to_string(),
            public_key: "pub".to_string(),
            has_passphrase: false,
            source: KeySource::Generated,
            strength: CredentialStrength::Legacy,
        };
        assert!(validate_private_key_meta(&meta).is_err());
    }

    #[test]
    fn test_imported_rsa_2048_passes() {
        let meta = PrivateKeyMeta {
            credential_id: "c1".to_string(),
            algorithm: PrivateKeyAlgorithm::Rsa,
            rsa_bits: Some(2048),
            format: KeyFormat::Openssh,
            fingerprint: "fp".to_string(),
            public_key: "pub".to_string(),
            has_passphrase: false,
            source: KeySource::Imported,
            strength: CredentialStrength::Legacy,
        };
        assert!(validate_private_key_meta(&meta).is_ok());
    }

    #[test]
    fn test_generated_rsa_4096_passes() {
        let meta = PrivateKeyMeta {
            credential_id: "c1".to_string(),
            algorithm: PrivateKeyAlgorithm::Rsa,
            rsa_bits: Some(4096),
            format: KeyFormat::Openssh,
            fingerprint: "fp".to_string(),
            public_key: "pub".to_string(),
            has_passphrase: false,
            source: KeySource::Generated,
            strength: CredentialStrength::Recommended,
        };
        assert!(validate_private_key_meta(&meta).is_ok());
    }

    #[test]
    fn test_invalid_rsa_bits_fails() {
        let meta = PrivateKeyMeta {
            credential_id: "c1".to_string(),
            algorithm: PrivateKeyAlgorithm::Rsa,
            rsa_bits: Some(1024),
            format: KeyFormat::Openssh,
            fingerprint: "fp".to_string(),
            public_key: "pub".to_string(),
            has_passphrase: false,
            source: KeySource::Imported,
            strength: CredentialStrength::Legacy,
        };
        assert!(validate_private_key_meta(&meta).is_err());
    }

    #[test]
    fn test_kind_metadata_mismatch_detected() {
        let index = CredentialIndex {
            credentials: vec![make_credential("c1", CredentialKind::Password)],
            private_keys: vec![PrivateKeyMeta {
                credential_id: "c1".to_string(),
                algorithm: PrivateKeyAlgorithm::Ed25519,
                rsa_bits: None,
                format: KeyFormat::Openssh,
                fingerprint: "fp".to_string(),
                public_key: "pub".to_string(),
                has_passphrase: false,
                source: KeySource::Generated,
                strength: CredentialStrength::Recommended,
            }],
            passwords: vec![],
        };
        let err = validate_credential_index(&index).unwrap_err();
        assert!(matches!(
            err,
            CredentialValidationError::KindMetadataMismatch(_)
        ));
    }

    #[test]
    fn test_orphan_private_key_meta_detected() {
        let index = CredentialIndex {
            credentials: vec![],
            private_keys: vec![PrivateKeyMeta {
                credential_id: "orphan".to_string(),
                algorithm: PrivateKeyAlgorithm::Ed25519,
                rsa_bits: None,
                format: KeyFormat::Openssh,
                fingerprint: "fp".to_string(),
                public_key: "pub".to_string(),
                has_passphrase: false,
                source: KeySource::Generated,
                strength: CredentialStrength::Recommended,
            }],
            passwords: vec![],
        };
        let err = validate_credential_index(&index).unwrap_err();
        assert!(matches!(
            err,
            CredentialValidationError::OrphanPrivateKeyMeta(_)
        ));
    }

    #[test]
    fn test_duplicate_credential_id_detected() {
        let index = CredentialIndex {
            credentials: vec![
                make_credential("c1", CredentialKind::Password),
                make_credential("c1", CredentialKind::PrivateKey),
            ],
            private_keys: vec![],
            passwords: vec![],
        };
        let err = validate_credential_index(&index).unwrap_err();
        assert!(matches!(
            err,
            CredentialValidationError::DuplicateCredentialId(_)
        ));
    }

    #[test]
    fn test_valid_index_passes() {
        let index = CredentialIndex {
            credentials: vec![
                make_credential("c1", CredentialKind::PrivateKey),
                make_credential("c2", CredentialKind::Password),
            ],
            private_keys: vec![PrivateKeyMeta {
                credential_id: "c1".to_string(),
                algorithm: PrivateKeyAlgorithm::Ed25519,
                rsa_bits: None,
                format: KeyFormat::Openssh,
                fingerprint: "fp".to_string(),
                public_key: "pub".to_string(),
                has_passphrase: false,
                source: KeySource::Generated,
                strength: CredentialStrength::Recommended,
            }],
            passwords: vec![PasswordMeta {
                credential_id: "c2".to_string(),
                has_value: true,
                source: PasswordSource::Manual,
            }],
        };
        assert!(validate_credential_index(&index).is_ok());
    }

    #[test]
    fn test_classify_rsa_strength() {
        assert_eq!(
            classify_rsa_strength(4096),
            CredentialStrength::Recommended
        );
        assert_eq!(classify_rsa_strength(3072), CredentialStrength::Compatible);
        assert_eq!(classify_rsa_strength(2048), CredentialStrength::Legacy);
    }
}
