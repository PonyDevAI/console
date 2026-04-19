use anyhow::Result;

use crate::models::{Credential, Server};

/// Combined validation: shape + credential binding.
pub fn validate_server(server: &Server, credential: &Credential) -> Result<()> {
    crate::models::validate_server_shape(server).map_err(|e| anyhow::anyhow!(e))?;
    crate::models::validate_server_credential_binding(server, credential)
        .map_err(|e| anyhow::anyhow!(e))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{
        CredentialKind, CredentialStorageMode, OsDetectedFrom, OsDetectionStatus, OsType,
        ServerAuthMethod,
    };
    use chrono::Utc;

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

    fn make_server(id: &str, auth: ServerAuthMethod, cred_id: &str) -> Server {
        Server {
            id: id.to_string(),
            name: "Test".to_string(),
            host: "1.2.3.4".to_string(),
            port: 22,
            username: "admin".to_string(),
            auth_method: auth,
            credential_id: cred_id.to_string(),
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
    fn test_validate_server_pass() {
        let server = make_server("s1", ServerAuthMethod::Password, "c1");
        let cred = make_credential("c1", CredentialKind::Password);
        assert!(validate_server(&server, &cred).is_ok());
    }

    #[test]
    fn test_validate_server_shape_fail() {
        let mut server = make_server("s1", ServerAuthMethod::Password, "c1");
        server.name = "".to_string();
        let cred = make_credential("c1", CredentialKind::Password);
        assert!(validate_server(&server, &cred).is_err());
    }

    #[test]
    fn test_validate_server_binding_fail() {
        let server = make_server("s1", ServerAuthMethod::Password, "c1");
        let cred = make_credential("c1", CredentialKind::PrivateKey);
        let err = validate_server(&server, &cred).unwrap_err();
        assert!(err.to_string().contains("auth_method"));
    }

    #[test]
    fn test_validate_server_private_key_pass() {
        let server = make_server("s1", ServerAuthMethod::PrivateKey, "c1");
        let cred = make_credential("c1", CredentialKind::PrivateKey);
        assert!(validate_server(&server, &cred).is_ok());
    }
}
