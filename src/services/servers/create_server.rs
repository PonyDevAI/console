use anyhow::{bail, Result};
use chrono::Utc;
use serde::{Deserialize, Serialize};

use crate::models::{
    CredentialIndex, OsDetectedFrom, OsDetectionStatus, OsType, Server, ServerAuthMethod,
    ServerIndex,
};
use crate::storage::servers::file_store::upsert_server;

use super::validate_server::validate_server;

// ── Input ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateServerInput {
    pub name: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_method: ServerAuthMethod,
    pub credential_id: String,
    pub group_id: Option<String>,
    pub description: Option<String>,
    pub tags: Vec<String>,
    pub sftp_directory: Option<String>,
    pub wol_mac: Option<String>,
    pub enable_metrics: bool,
    pub enable_containers: bool,
}

// ── Create ──

pub fn create_server(
    input: CreateServerInput,
    server_index: &mut ServerIndex,
    credential_index: &CredentialIndex,
) -> Result<Server> {
    let now = Utc::now();
    let id = uuid::Uuid::new_v4().to_string();

    let server = Server {
        id: id.clone(),
        name: input.name.clone(),
        host: input.host.clone(),
        port: input.port,
        username: input.username.clone(),
        auth_method: input.auth_method.clone(),
        credential_id: input.credential_id.clone(),
        group_id: input.group_id,
        os_type: OsType::Unknown,
        os_detection_status: OsDetectionStatus::Unknown,
        os_detected_from: OsDetectedFrom::None,
        sftp_directory: input.sftp_directory,
        wol_mac: input.wol_mac,
        enable_metrics: input.enable_metrics,
        enable_containers: input.enable_containers,
        description: input.description,
        tags: input.tags,
        created_at: now,
        updated_at: now,
        last_connected_at: None,
        last_os_sync_at: None,
    };

    // Validate shape
    crate::models::validate_server_shape(&server).map_err(|e| anyhow::anyhow!(e))?;

    // Validate credential binding if credential exists
    if let Some(cred) = credential_index
        .credentials
        .iter()
        .find(|c| c.id == input.credential_id)
    {
        validate_server(&server, cred)?;
    } else {
        bail!("credential '{}' not found", input.credential_id);
    }

    upsert_server(server_index, server.clone());
    Ok(server)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{
        Credential, CredentialKind, CredentialStorageMode, ServerAuthMethod,
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

    #[test]
    fn test_create_server_password() {
        let mut server_index = ServerIndex::default();
        let cred_index = CredentialIndex {
            credentials: vec![make_credential("c1", CredentialKind::Password)],
            ..Default::default()
        };
        let input = CreateServerInput {
            name: "My Server".to_string(),
            host: "192.168.1.1".to_string(),
            port: 22,
            username: "admin".to_string(),
            auth_method: ServerAuthMethod::Password,
            credential_id: "c1".to_string(),
            group_id: None,
            description: None,
            tags: vec![],
            sftp_directory: None,
            wol_mac: None,
            enable_metrics: false,
            enable_containers: false,
        };
        let server = create_server(input, &mut server_index, &cred_index).unwrap();
        assert_eq!(server.name, "My Server");
        assert_eq!(server.os_type, OsType::Unknown);
        assert_eq!(server.os_detection_status, OsDetectionStatus::Unknown);
        assert!(server.last_connected_at.is_none());
        assert!(server.last_os_sync_at.is_none());
        assert_eq!(server_index.servers.len(), 1);
    }

    #[test]
    fn test_create_server_private_key() {
        let mut server_index = ServerIndex::default();
        let cred_index = CredentialIndex {
            credentials: vec![make_credential("c1", CredentialKind::PrivateKey)],
            ..Default::default()
        };
        let input = CreateServerInput {
            name: "PK Server".to_string(),
            host: "10.0.0.1".to_string(),
            port: 2222,
            username: "deploy".to_string(),
            auth_method: ServerAuthMethod::PrivateKey,
            credential_id: "c1".to_string(),
            group_id: None,
            description: Some("test".to_string()),
            tags: vec!["prod".to_string()],
            sftp_directory: None,
            wol_mac: None,
            enable_metrics: true,
            enable_containers: true,
        };
        let server = create_server(input, &mut server_index, &cred_index).unwrap();
        assert_eq!(server.auth_method, ServerAuthMethod::PrivateKey);
        assert_eq!(server.port, 2222);
        assert!(server.description.is_some());
        assert_eq!(server.tags.len(), 1);
    }

    #[test]
    fn test_create_server_auth_mismatch_fails() {
        let mut server_index = ServerIndex::default();
        let cred_index = CredentialIndex {
            credentials: vec![make_credential("c1", CredentialKind::PrivateKey)],
            ..Default::default()
        };
        let input = CreateServerInput {
            name: "Bad".to_string(),
            host: "10.0.0.1".to_string(),
            port: 22,
            username: "admin".to_string(),
            auth_method: ServerAuthMethod::Password,
            credential_id: "c1".to_string(),
            group_id: None,
            description: None,
            tags: vec![],
            sftp_directory: None,
            wol_mac: None,
            enable_metrics: false,
            enable_containers: false,
        };
        let err = create_server(input, &mut server_index, &cred_index).unwrap_err();
        assert!(err.to_string().contains("auth_method"));
    }

    #[test]
    fn test_create_server_missing_credential_fails() {
        let mut server_index = ServerIndex::default();
        let cred_index = CredentialIndex::default();
        let input = CreateServerInput {
            name: "Bad".to_string(),
            host: "10.0.0.1".to_string(),
            port: 22,
            username: "admin".to_string(),
            auth_method: ServerAuthMethod::Password,
            credential_id: "nonexistent".to_string(),
            group_id: None,
            description: None,
            tags: vec![],
            sftp_directory: None,
            wol_mac: None,
            enable_metrics: false,
            enable_containers: false,
        };
        let err = create_server(input, &mut server_index, &cred_index).unwrap_err();
        assert!(err.to_string().contains("not found"));
    }

    #[test]
    fn test_create_server_empty_name_fails() {
        let mut server_index = ServerIndex::default();
        let cred_index = CredentialIndex {
            credentials: vec![make_credential("c1", CredentialKind::Password)],
            ..Default::default()
        };
        let input = CreateServerInput {
            name: "".to_string(),
            host: "10.0.0.1".to_string(),
            port: 22,
            username: "admin".to_string(),
            auth_method: ServerAuthMethod::Password,
            credential_id: "c1".to_string(),
            group_id: None,
            description: None,
            tags: vec![],
            sftp_directory: None,
            wol_mac: None,
            enable_metrics: false,
            enable_containers: false,
        };
        let err = create_server(input, &mut server_index, &cred_index).unwrap_err();
        assert!(err.to_string().contains("name"));
    }

    #[test]
    fn test_create_server_with_group_id() {
        let mut server_index = ServerIndex::default();
        let cred_index = CredentialIndex {
            credentials: vec![make_credential("c1", CredentialKind::Password)],
            ..Default::default()
        };
        let input = CreateServerInput {
            name: "Grouped".to_string(),
            host: "10.0.0.1".to_string(),
            port: 22,
            username: "admin".to_string(),
            auth_method: ServerAuthMethod::Password,
            credential_id: "c1".to_string(),
            group_id: Some("g1".to_string()),
            description: None,
            tags: vec![],
            sftp_directory: None,
            wol_mac: None,
            enable_metrics: false,
            enable_containers: false,
        };
        let server = create_server(input, &mut server_index, &cred_index).unwrap();
        assert_eq!(server.group_id, Some("g1".to_string()));
    }
}
