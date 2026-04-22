use anyhow::Result;
use chrono::Utc;

use crate::models::{Server, ServerIndex};
use crate::storage::servers::file_store::{get_server, upsert_server};

// ── Duplicate ──

pub fn duplicate_server(id: &str, server_index: &mut ServerIndex) -> Result<Server> {
    let original = get_server(server_index, id)
        .ok_or_else(|| anyhow::anyhow!("server '{}' not found", id))?
        .clone();

    let now = Utc::now();
    let new_id = uuid::Uuid::new_v4().to_string();
    let new_name = format!("{} (copy)", original.name);

    let copy = Server {
        id: new_id,
        name: new_name,
        host: original.host,
        port: original.port,
        username: original.username,
        auth_method: original.auth_method,
        credential_id: original.credential_id,
        group_id: original.group_id,
        os_type: original.os_type,
        os_detection_status: original.os_detection_status,
        os_detected_from: original.os_detected_from,
        sftp_directory: original.sftp_directory,
        wol_mac: original.wol_mac,
        enable_metrics: original.enable_metrics,
        enable_containers: original.enable_containers,
        description: original.description,
        tags: original.tags,
        created_at: now,
        updated_at: now,
        last_connected_at: None,
        last_os_sync_at: None,
    };

    upsert_server(server_index, copy.clone());
    Ok(copy)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{OsDetectedFrom, OsDetectionStatus, OsType, ServerAuthMethod};

    fn make_server(id: &str) -> Server {
        Server {
            id: id.to_string(),
            name: "My Server".to_string(),
            host: "192.168.1.1".to_string(),
            port: 22,
            username: "admin".to_string(),
            auth_method: ServerAuthMethod::Password,
            credential_id: "c1".to_string(),
            group_id: Some("g1".to_string()),
            os_type: OsType::Ubuntu,
            os_detection_status: OsDetectionStatus::Detected,
            os_detected_from: OsDetectedFrom::SshProbe,
            sftp_directory: Some("/home/admin".to_string()),
            wol_mac: Some("00:11:22:33:44:55".to_string()),
            enable_metrics: true,
            enable_containers: true,
            description: Some("test".to_string()),
            tags: vec!["prod".to_string()],
            created_at: Utc::now(),
            updated_at: Utc::now(),
            last_connected_at: Some(Utc::now()),
            last_os_sync_at: Some(Utc::now()),
        }
    }

    #[test]
    fn test_duplicate_server() {
        let mut server_index = ServerIndex {
            servers: vec![make_server("s1")],
        };
        let copy = duplicate_server("s1", &mut server_index).unwrap();

        assert_ne!(copy.id, "s1");
        assert_eq!(copy.name, "My Server (copy)");
        assert_eq!(copy.host, "192.168.1.1");
        assert_eq!(copy.credential_id, "c1");
        assert_eq!(copy.group_id, Some("g1".to_string()));
        assert!(copy.last_connected_at.is_none());
        assert!(copy.last_os_sync_at.is_none());
        assert_eq!(server_index.servers.len(), 2);
    }

    #[test]
    fn test_duplicate_server_not_found() {
        let mut server_index = ServerIndex::default();
        let err = duplicate_server("nonexistent", &mut server_index).unwrap_err();
        assert!(err.to_string().contains("not found"));
    }

    #[test]
    fn test_duplicate_server_keeps_all_fields() {
        let mut server_index = ServerIndex {
            servers: vec![make_server("s1")],
        };
        let copy = duplicate_server("s1", &mut server_index).unwrap();

        assert_eq!(copy.port, 22);
        assert_eq!(copy.username, "admin");
        assert_eq!(copy.auth_method, ServerAuthMethod::Password);
        assert_eq!(copy.os_type, OsType::Ubuntu);
        assert_eq!(copy.sftp_directory, Some("/home/admin".to_string()));
        assert_eq!(copy.wol_mac, Some("00:11:22:33:44:55".to_string()));
        assert!(copy.enable_metrics);
        assert!(copy.enable_containers);
        assert_eq!(copy.description, Some("test".to_string()));
        assert_eq!(copy.tags, vec!["prod".to_string()]);
    }

    #[test]
    fn test_duplicate_server_has_new_timestamps() {
        let mut server_index = ServerIndex {
            servers: vec![make_server("s1")],
        };
        let before = Utc::now();
        let copy = duplicate_server("s1", &mut server_index).unwrap();
        assert!(copy.created_at >= before);
        assert!(copy.updated_at >= before);
    }
}
