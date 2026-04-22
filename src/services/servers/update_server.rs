use anyhow::{bail, Result};
use chrono::Utc;
use serde::{Deserialize, Serialize};

use crate::models::{CredentialIndex, Server, ServerAuthMethod, ServerIndex};
use crate::storage::servers::file_store::{get_server, upsert_server};

use super::validate_server::validate_server;

// ── Input ──

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct UpdateServerInput {
    pub name: Option<String>,
    pub host: Option<String>,
    pub port: Option<u16>,
    pub username: Option<String>,
    pub auth_method: Option<ServerAuthMethod>,
    pub credential_id: Option<String>,
    pub group_id: Option<Option<String>>,
    pub description: Option<Option<String>>,
    pub tags: Option<Vec<String>>,
    pub sftp_directory: Option<Option<String>>,
    pub wol_mac: Option<Option<String>>,
    pub enable_metrics: Option<bool>,
    pub enable_containers: Option<bool>,
}

// ── Update ──

pub fn update_server(
    id: &str,
    patch: UpdateServerInput,
    server_index: &mut ServerIndex,
    credential_index: &CredentialIndex,
) -> Result<Server> {
    let server = get_server(server_index, id)
        .ok_or_else(|| anyhow::anyhow!("server '{}' not found", id))?
        .clone();

    let mut updated = server.clone();

    if let Some(name) = patch.name {
        updated.name = name;
    }
    if let Some(host) = patch.host {
        updated.host = host;
    }
    if let Some(port) = patch.port {
        updated.port = port;
    }
    if let Some(username) = patch.username {
        updated.username = username;
    }
    if let Some(auth_method) = patch.auth_method {
        updated.auth_method = auth_method;
    }
    if let Some(credential_id) = patch.credential_id {
        updated.credential_id = credential_id;
    }
    // group_id can be set to Some(value) or explicitly cleared to None
    if let Some(group_id) = patch.group_id {
        updated.group_id = group_id;
    }
    if let Some(description) = patch.description {
        updated.description = description;
    }
    if let Some(tags) = patch.tags {
        updated.tags = tags;
    }
    if let Some(sftp_directory) = patch.sftp_directory {
        updated.sftp_directory = sftp_directory;
    }
    if let Some(wol_mac) = patch.wol_mac {
        updated.wol_mac = wol_mac;
    }
    if let Some(enable_metrics) = patch.enable_metrics {
        updated.enable_metrics = enable_metrics;
    }
    if let Some(enable_containers) = patch.enable_containers {
        updated.enable_containers = enable_containers;
    }

    // Validate shape
    crate::models::validate_server_shape(&updated).map_err(|e| anyhow::anyhow!(e))?;

    // Validate credential binding
    if let Some(cred) = credential_index
        .credentials
        .iter()
        .find(|c| c.id == updated.credential_id)
    {
        validate_server(&updated, cred)?;
    } else {
        bail!("credential '{}' not found", updated.credential_id);
    }

    updated.updated_at = Utc::now();

    upsert_server(server_index, updated.clone());
    Ok(updated)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{
        Credential, CredentialKind, CredentialStorageMode, OsDetectedFrom, OsDetectionStatus,
        OsType, Server, ServerAuthMethod,
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
    fn test_update_server_name() {
        let mut server_index = ServerIndex {
            servers: vec![make_server("s1", ServerAuthMethod::Password, "c1")],
        };
        let cred_index = CredentialIndex {
            credentials: vec![make_credential("c1", CredentialKind::Password)],
            ..Default::default()
        };
        let patch = UpdateServerInput {
            name: Some("New Name".to_string()),
            ..Default::default()
        };
        let server = update_server("s1", patch, &mut server_index, &cred_index).unwrap();
        assert_eq!(server.name, "New Name");
    }

    #[test]
    fn test_update_server_port() {
        let mut server_index = ServerIndex {
            servers: vec![make_server("s1", ServerAuthMethod::Password, "c1")],
        };
        let cred_index = CredentialIndex {
            credentials: vec![make_credential("c1", CredentialKind::Password)],
            ..Default::default()
        };
        let patch = UpdateServerInput {
            port: Some(2222),
            ..Default::default()
        };
        let server = update_server("s1", patch, &mut server_index, &cred_index).unwrap();
        assert_eq!(server.port, 2222);
    }

    #[test]
    fn test_update_server_not_found() {
        let mut server_index = ServerIndex::default();
        let cred_index = CredentialIndex::default();
        let patch = UpdateServerInput::default();
        let err = update_server("nonexistent", patch, &mut server_index, &cred_index).unwrap_err();
        assert!(err.to_string().contains("not found"));
    }

    #[test]
    fn test_update_server_auth_method_mismatch() {
        let mut server_index = ServerIndex {
            servers: vec![make_server("s1", ServerAuthMethod::Password, "c1")],
        };
        let cred_index = CredentialIndex {
            credentials: vec![make_credential("c1", CredentialKind::Password)],
            ..Default::default()
        };
        let patch = UpdateServerInput {
            auth_method: Some(ServerAuthMethod::PrivateKey),
            ..Default::default()
        };
        let err = update_server("s1", patch, &mut server_index, &cred_index).unwrap_err();
        assert!(err.to_string().contains("auth_method"));
    }

    #[test]
    fn test_update_server_clear_group_id() {
        let mut server_index = ServerIndex {
            servers: vec![{
                let mut s = make_server("s1", ServerAuthMethod::Password, "c1");
                s.group_id = Some("g1".to_string());
                s
            }],
        };
        let cred_index = CredentialIndex {
            credentials: vec![make_credential("c1", CredentialKind::Password)],
            ..Default::default()
        };
        let patch = UpdateServerInput {
            group_id: Some(None),
            ..Default::default()
        };
        let server = update_server("s1", patch, &mut server_index, &cred_index).unwrap();
        assert_eq!(server.group_id, None);
    }

    #[test]
    fn test_update_server_sets_updated_at() {
        let mut server_index = ServerIndex {
            servers: vec![make_server("s1", ServerAuthMethod::Password, "c1")],
        };
        let cred_index = CredentialIndex {
            credentials: vec![make_credential("c1", CredentialKind::Password)],
            ..Default::default()
        };
        let patch = UpdateServerInput {
            name: Some("Updated".to_string()),
            ..Default::default()
        };
        let before = Utc::now();
        let server = update_server("s1", patch, &mut server_index, &cred_index).unwrap();
        assert!(server.updated_at >= before);
    }

    #[test]
    fn test_update_server_switch_auth_and_credential() {
        let mut server_index = ServerIndex {
            servers: vec![make_server("s1", ServerAuthMethod::Password, "c1")],
        };
        let cred_index = CredentialIndex {
            credentials: vec![
                make_credential("c1", CredentialKind::Password),
                make_credential("c2", CredentialKind::PrivateKey),
            ],
            ..Default::default()
        };
        let patch = UpdateServerInput {
            auth_method: Some(ServerAuthMethod::PrivateKey),
            credential_id: Some("c2".to_string()),
            ..Default::default()
        };
        let server = update_server("s1", patch, &mut server_index, &cred_index).unwrap();
        assert_eq!(server.auth_method, ServerAuthMethod::PrivateKey);
        assert_eq!(server.credential_id, "c2");
    }
}
