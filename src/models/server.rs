use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use super::credential::{Credential, CredentialKind};

// ── Auth Method ──

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ServerAuthMethod {
    Password,
    PrivateKey,
}

// ── OS Type ──

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum OsType {
    Apple,
    Ubuntu,
    Debian,
    Centos,
    Redhat,
    Alpine,
    LinuxUnknown,
    Windows,
    Unknown,
}

// ── OS Detection Status ──

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum OsDetectionStatus {
    Unknown,
    Pending,
    Detected,
    Failed,
}

// ── OS Detected From ──

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum OsDetectedFrom {
    SshProbe,
    ManualSync,
    None,
}

// ── Server ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Server {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_method: ServerAuthMethod,
    pub credential_id: String,
    pub group_id: Option<String>,
    pub os_type: OsType,
    pub os_detection_status: OsDetectionStatus,
    pub os_detected_from: OsDetectedFrom,
    pub sftp_directory: Option<String>,
    pub wol_mac: Option<String>,
    pub enable_metrics: bool,
    pub enable_containers: bool,
    pub description: Option<String>,
    pub tags: Vec<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub last_connected_at: Option<DateTime<Utc>>,
    pub last_os_sync_at: Option<DateTime<Utc>>,
}

// ── Server Group ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerGroup {
    pub id: String,
    pub name: String,
    pub icon: Option<String>,
    pub sort_order: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ── Server Index ──

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ServerIndex {
    pub servers: Vec<Server>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct GroupIndex {
    pub groups: Vec<ServerGroup>,
}

// ── Validation ──

#[derive(Debug, thiserror::Error)]
pub enum ServerValidationError {
    #[error("server '{0}' has empty name")]
    EmptyName(String),
    #[error("server '{0}' has empty host")]
    EmptyHost(String),
    #[error("server '{0}' has empty username")]
    EmptyUsername(String),
    #[error("server '{0}' port must be 1-65535, got {1}")]
    InvalidPort(String, u16),
    #[error("server '{0}' credential_id is empty")]
    EmptyCredentialId(String),
    #[error("server auth_method '{0:?}' does not match credential kind '{1:?}'")]
    AuthMethodKindMismatch(ServerAuthMethod, CredentialKind),
    #[error("duplicate server id '{0}'")]
    DuplicateServerId(String),
    #[error("duplicate group id '{0}'")]
    DuplicateGroupId(String),
    #[error("group '{0}' not found")]
    GroupNotFound(String),
}

pub fn validate_server_shape(server: &Server) -> Result<(), ServerValidationError> {
    if server.name.trim().is_empty() {
        return Err(ServerValidationError::EmptyName(server.id.clone()));
    }
    if server.host.trim().is_empty() {
        return Err(ServerValidationError::EmptyHost(server.id.clone()));
    }
    if server.username.trim().is_empty() {
        return Err(ServerValidationError::EmptyUsername(server.id.clone()));
    }
    if server.port == 0 {
        return Err(ServerValidationError::InvalidPort(
            server.id.clone(),
            server.port,
        ));
    }
    if server.credential_id.trim().is_empty() {
        return Err(ServerValidationError::EmptyCredentialId(server.id.clone()));
    }
    Ok(())
}

pub fn validate_server_credential_binding(
    server: &Server,
    credential: &Credential,
) -> Result<(), ServerValidationError> {
    let expected_kind = match server.auth_method {
        ServerAuthMethod::Password => CredentialKind::Password,
        ServerAuthMethod::PrivateKey => CredentialKind::PrivateKey,
    };
    if credential.kind != expected_kind {
        return Err(ServerValidationError::AuthMethodKindMismatch(
            server.auth_method.clone(),
            credential.kind.clone(),
        ));
    }
    Ok(())
}

pub fn validate_server_index(index: &ServerIndex) -> Result<(), ServerValidationError> {
    let mut seen = std::collections::HashSet::new();
    for server in &index.servers {
        if !seen.insert(&server.id) {
            return Err(ServerValidationError::DuplicateServerId(server.id.clone()));
        }
        validate_server_shape(server)?;
    }
    Ok(())
}

pub fn validate_group_index(index: &GroupIndex) -> Result<(), ServerValidationError> {
    let mut seen = std::collections::HashSet::new();
    for group in &index.groups {
        if !seen.insert(&group.id) {
            return Err(ServerValidationError::DuplicateGroupId(group.id.clone()));
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::credential::{
        Credential, CredentialKind, CredentialStorageMode,
    };

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
            name: "Test Server".to_string(),
            host: "192.168.1.1".to_string(),
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
    fn test_valid_server_shape_passes() {
        let server = make_server("s1", ServerAuthMethod::Password, "c1");
        assert!(validate_server_shape(&server).is_ok());
    }

    #[test]
    fn test_empty_name_fails() {
        let mut server = make_server("s1", ServerAuthMethod::Password, "c1");
        server.name = "".to_string();
        assert!(validate_server_shape(&server).is_err());
    }

    #[test]
    fn test_empty_host_fails() {
        let mut server = make_server("s1", ServerAuthMethod::Password, "c1");
        server.host = "".to_string();
        assert!(validate_server_shape(&server).is_err());
    }

    #[test]
    fn test_empty_username_fails() {
        let mut server = make_server("s1", ServerAuthMethod::Password, "c1");
        server.username = "".to_string();
        assert!(validate_server_shape(&server).is_err());
    }

    #[test]
    fn test_port_zero_fails() {
        let mut server = make_server("s1", ServerAuthMethod::Password, "c1");
        server.port = 0;
        assert!(validate_server_shape(&server).is_err());
    }

    #[test]
    fn test_empty_credential_id_fails() {
        let mut server = make_server("s1", ServerAuthMethod::Password, "c1");
        server.credential_id = "".to_string();
        assert!(validate_server_shape(&server).is_err());
    }

    #[test]
    fn test_auth_method_password_matches_password_credential() {
        let server = make_server("s1", ServerAuthMethod::Password, "c1");
        let cred = make_credential("c1", CredentialKind::Password);
        assert!(validate_server_credential_binding(&server, &cred).is_ok());
    }

    #[test]
    fn test_auth_method_private_key_matches_pk_credential() {
        let server = make_server("s1", ServerAuthMethod::PrivateKey, "c1");
        let cred = make_credential("c1", CredentialKind::PrivateKey);
        assert!(validate_server_credential_binding(&server, &cred).is_ok());
    }

    #[test]
    fn test_auth_method_mismatch_fails() {
        let server = make_server("s1", ServerAuthMethod::Password, "c1");
        let cred = make_credential("c1", CredentialKind::PrivateKey);
        let err = validate_server_credential_binding(&server, &cred).unwrap_err();
        assert!(matches!(
            err,
            ServerValidationError::AuthMethodKindMismatch(_, _)
        ));
    }

    #[test]
    fn test_duplicate_server_id_detected() {
        let index = ServerIndex {
            servers: vec![
                make_server("s1", ServerAuthMethod::Password, "c1"),
                make_server("s1", ServerAuthMethod::PrivateKey, "c2"),
            ],
        };
        let err = validate_server_index(&index).unwrap_err();
        assert!(matches!(err, ServerValidationError::DuplicateServerId(_)));
    }

    #[test]
    fn test_duplicate_group_id_detected() {
        let index = GroupIndex {
            groups: vec![
                ServerGroup {
                    id: "g1".to_string(),
                    name: "Group 1".to_string(),
                    icon: None,
                    sort_order: 0,
                    created_at: Utc::now(),
                    updated_at: Utc::now(),
                },
                ServerGroup {
                    id: "g1".to_string(),
                    name: "Group 2".to_string(),
                    icon: None,
                    sort_order: 1,
                    created_at: Utc::now(),
                    updated_at: Utc::now(),
                },
            ],
        };
        let err = validate_group_index(&index).unwrap_err();
        assert!(matches!(err, ServerValidationError::DuplicateGroupId(_)));
    }

    #[test]
    fn test_valid_server_index_passes() {
        let index = ServerIndex {
            servers: vec![
                make_server("s1", ServerAuthMethod::Password, "c1"),
                make_server("s2", ServerAuthMethod::PrivateKey, "c2"),
            ],
        };
        assert!(validate_server_index(&index).is_ok());
    }

    #[test]
    fn test_os_type_serialization() {
        let os = OsType::Ubuntu;
        let json = serde_json::to_string(&os).unwrap();
        assert_eq!(json, "\"ubuntu\"");
        let decoded: OsType = serde_json::from_str(&json).unwrap();
        assert_eq!(decoded, OsType::Ubuntu);
    }
}
