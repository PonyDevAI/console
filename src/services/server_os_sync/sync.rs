use std::collections::HashMap;

use anyhow::Result;
use chrono::Utc;

use crate::models::{OsDetectedFrom, OsDetectionStatus, OsType, Server, ServerIndex};

use super::detect::detect_server_os;

/// Summary of a bulk OS sync operation.
#[derive(Debug, Clone, serde::Serialize)]
pub struct SyncSummary {
    pub total: usize,
    pub detected: usize,
    pub failed: usize,
    pub unchanged: usize,
}

/// Sync OS detection for a single server.
///
/// Only updates: os_type, os_detection_status, os_detected_from, last_os_sync_at.
/// Does NOT affect: credential_id, auth_method, or any other server config.
pub fn sync_server_os(
    server_index: &mut ServerIndex,
    server_id: &str,
    probe_output: &str,
) -> Result<Server> {
    let server = server_index
        .servers
        .iter_mut()
        .find(|s| s.id == server_id)
        .ok_or_else(|| anyhow::anyhow!("server '{}' not found", server_id))?;

    match detect_server_os(probe_output) {
        Ok(probe_result) => {
            let os_changed = server.os_type != probe_result.os_type;
            server.os_type = probe_result.os_type;
            server.os_detection_status = OsDetectionStatus::Detected;
            server.os_detected_from = OsDetectedFrom::SshProbe;
            server.last_os_sync_at = Some(Utc::now());

            if !os_changed
                && server.os_type != OsType::Unknown
                && server.os_type != OsType::LinuxUnknown
            {
                // Return the updated server; caller can check if anything meaningful changed
            }

            Ok(server.clone())
        }
        Err(_) => {
            // On failure: set status to Failed, do not change os_type
            server.os_detection_status = OsDetectionStatus::Failed;
            server.last_os_sync_at = Some(Utc::now());
            Ok(server.clone())
        }
    }
}

/// Sync OS detection for all servers in the index.
///
/// `probe_outputs` maps server_id → raw probe output.
/// Servers not present in the map are skipped.
pub fn sync_all_server_os(
    server_index: &mut ServerIndex,
    probe_outputs: HashMap<String, String>,
) -> Result<SyncSummary> {
    let mut summary = SyncSummary {
        total: probe_outputs.len(),
        detected: 0,
        failed: 0,
        unchanged: 0,
    };

    for (server_id, probe_output) in &probe_outputs {
        let server = server_index.servers.iter().find(|s| s.id == *server_id);

        let prev_os = server.map(|s| s.os_type.clone());

        match sync_server_os(server_index, server_id, probe_output) {
            Ok(updated) => {
                if updated.os_detection_status == OsDetectionStatus::Detected {
                    if prev_os.as_ref() == Some(&updated.os_type) {
                        summary.unchanged += 1;
                    } else {
                        summary.detected += 1;
                    }
                } else {
                    summary.failed += 1;
                }
            }
            Err(_) => {
                summary.failed += 1;
            }
        }
    }

    Ok(summary)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{ServerAuthMethod, ServerIndex};
    use chrono::Utc;

    fn make_server(id: &str) -> Server {
        Server {
            id: id.to_string(),
            name: format!("Server {}", id),
            host: "192.168.1.1".to_string(),
            port: 22,
            username: "admin".to_string(),
            auth_method: ServerAuthMethod::Password,
            credential_id: "c1".to_string(),
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
    fn test_sync_server_os_detects_darwin() {
        let mut index = ServerIndex {
            servers: vec![make_server("s1")],
        };
        let result = sync_server_os(&mut index, "s1", "Darwin").unwrap();
        assert_eq!(result.os_type, OsType::Apple);
        assert_eq!(result.os_detection_status, OsDetectionStatus::Detected);
        assert!(matches!(result.os_detected_from, OsDetectedFrom::SshProbe));
        assert!(result.last_os_sync_at.is_some());
    }

    #[test]
    fn test_sync_server_os_detects_ubuntu() {
        let mut index = ServerIndex {
            servers: vec![make_server("s1")],
        };
        let output = r#"NAME="Ubuntu"
ID=ubuntu"#;
        let result = sync_server_os(&mut index, "s1", output).unwrap();
        assert_eq!(result.os_type, OsType::Ubuntu);
        assert_eq!(result.os_detection_status, OsDetectionStatus::Detected);
    }

    #[test]
    fn test_sync_server_os_does_not_touch_credential() {
        let mut index = ServerIndex {
            servers: vec![make_server("s1")],
        };
        let before_cred = index.servers[0].credential_id.clone();
        let before_auth = index.servers[0].auth_method.clone();

        sync_server_os(&mut index, "s1", "Darwin").unwrap();

        let server = &index.servers[0];
        assert_eq!(server.credential_id, before_cred);
        assert_eq!(server.auth_method, before_auth);
    }

    #[test]
    fn test_sync_server_os_not_found() {
        let mut index = ServerIndex { servers: vec![] };
        let err = sync_server_os(&mut index, "nonexistent", "Darwin").unwrap_err();
        assert!(err.to_string().contains("not found"));
    }

    #[test]
    fn test_sync_server_os_failure_sets_failed_status() {
        let mut index = ServerIndex {
            servers: vec![make_server("s1")],
        };
        let result = sync_server_os(&mut index, "s1", "").unwrap();
        assert_eq!(result.os_type, OsType::Unknown);
        assert_eq!(result.os_detection_status, OsDetectionStatus::Failed);
    }

    #[test]
    fn test_sync_all_server_os() {
        let mut index = ServerIndex {
            servers: vec![make_server("s1"), make_server("s2")],
        };
        let mut outputs = HashMap::new();
        outputs.insert("s1".to_string(), "Darwin".to_string());
        outputs.insert("s2".to_string(), "Linux".to_string());

        let summary = sync_all_server_os(&mut index, outputs).unwrap();
        assert_eq!(summary.total, 2);
        assert_eq!(summary.detected, 2);
        assert_eq!(summary.failed, 0);
        assert_eq!(summary.unchanged, 0);
    }

    #[test]
    fn test_sync_all_server_os_unchanged() {
        let mut s1 = make_server("s1");
        s1.os_type = OsType::Apple;
        s1.os_detection_status = OsDetectionStatus::Detected;

        let mut index = ServerIndex { servers: vec![s1] };
        let mut outputs = HashMap::new();
        outputs.insert("s1".to_string(), "Darwin".to_string());

        let summary = sync_all_server_os(&mut index, outputs).unwrap();
        assert_eq!(summary.total, 1);
        assert_eq!(summary.detected, 0);
        assert_eq!(summary.unchanged, 1);
    }

    #[test]
    fn test_sync_all_server_os_skips_missing_servers() {
        let mut index = ServerIndex {
            servers: vec![make_server("s1")],
        };
        let mut outputs = HashMap::new();
        outputs.insert("s1".to_string(), "Darwin".to_string());
        outputs.insert("s99".to_string(), "Linux".to_string());

        let summary = sync_all_server_os(&mut index, outputs).unwrap();
        assert_eq!(summary.total, 2);
        assert_eq!(summary.detected, 1);
        assert_eq!(summary.failed, 1); // s99 not found
    }

    #[test]
    fn test_sync_server_os_preserves_other_fields() {
        let mut server = make_server("s1");
        server.name = "My Production Server".to_string();
        server.host = "10.0.0.1".to_string();
        server.port = 2222;
        server.username = "deploy".to_string();
        server.sftp_directory = Some("/var/www".to_string());
        server.wol_mac = Some("00:11:22:33:44:55".to_string());
        server.enable_metrics = true;
        server.enable_containers = true;
        server.description = Some("Important server".to_string());
        server.tags = vec!["prod".to_string(), "web".to_string()];

        let mut index = ServerIndex {
            servers: vec![server],
        };

        sync_server_os(&mut index, "s1", "Darwin").unwrap();

        let updated = &index.servers[0];
        assert_eq!(updated.name, "My Production Server");
        assert_eq!(updated.host, "10.0.0.1");
        assert_eq!(updated.port, 2222);
        assert_eq!(updated.username, "deploy");
        assert_eq!(updated.sftp_directory, Some("/var/www".to_string()));
        assert_eq!(updated.wol_mac, Some("00:11:22:33:44:55".to_string()));
        assert!(updated.enable_metrics);
        assert!(updated.enable_containers);
        assert_eq!(updated.description, Some("Important server".to_string()));
        assert_eq!(updated.tags, vec!["prod".to_string(), "web".to_string()]);
    }
}
