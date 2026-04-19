use anyhow::{bail, Result};
use chrono::Utc;
use serde::{Deserialize, Serialize};

use crate::models::{GroupIndex, ServerGroup, ServerIndex};
use crate::storage::servers::file_store::{
    move_server_to_group, remove_group, upsert_group,
};

// ── Create Group ──

pub fn create_group(name: &str, group_index: &mut GroupIndex) -> Result<ServerGroup> {
    let now = Utc::now();
    let group = ServerGroup {
        id: uuid::Uuid::new_v4().to_string(),
        name: name.to_string(),
        icon: None,
        sort_order: group_index.groups.len() as i32,
        created_at: now,
        updated_at: now,
    };
    upsert_group(group_index, group.clone());
    Ok(group)
}

// ── Rename Group ──

pub fn rename_group(
    id: &str,
    name: &str,
    group_index: &mut GroupIndex,
) -> Result<ServerGroup> {
    let group = group_index
        .groups
        .iter_mut()
        .find(|g| g.id == id)
        .ok_or_else(|| anyhow::anyhow!("group '{}' not found", id))?;
    group.name = name.to_string();
    group.updated_at = Utc::now();
    Ok(group.clone())
}

// ── Move Server to Group ──

pub fn move_server_to_group_svc(
    server_id: &str,
    group_id: Option<&str>,
    server_index: &mut ServerIndex,
    group_index: &GroupIndex,
) -> Result<()> {
    // If group_id is Some, verify the group exists
    if let Some(gid) = group_id {
        if !group_index.groups.iter().any(|g| g.id == gid) {
            bail!("group '{}' not found", gid);
        }
    }
    let moved = move_server_to_group(server_index, server_id, group_id.map(|s| s.to_string()));
    if !moved {
        bail!("server '{}' not found", server_id);
    }
    Ok(())
}

// ── Delete Group Strategy ──

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DeleteGroupStrategy {
    Rehome,
    DeleteWithMembers,
}

impl Default for DeleteGroupStrategy {
    fn default() -> Self {
        DeleteGroupStrategy::Rehome
    }
}

// ── Delete Group ──

pub fn delete_group(
    id: &str,
    strategy: DeleteGroupStrategy,
    group_index: &mut GroupIndex,
    server_index: &mut ServerIndex,
) -> Result<()> {
    // Verify group exists
    if !group_index.groups.iter().any(|g| g.id == id) {
        bail!("group '{}' not found", id);
    }

    match strategy {
        DeleteGroupStrategy::Rehome => {
            // Collect member IDs first to avoid borrow conflict
            let member_ids: Vec<String> = server_index
                .servers
                .iter()
                .filter(|s| s.group_id.as_deref() == Some(id))
                .map(|s| s.id.clone())
                .collect();
            for sid in member_ids {
                move_server_to_group(server_index, &sid, None);
            }
        }
        DeleteGroupStrategy::DeleteWithMembers => {
            // Remove all member servers
            server_index.servers.retain(|s| s.group_id.as_deref() != Some(id));
        }
    }

    remove_group(group_index, id);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{
        OsDetectedFrom, OsDetectionStatus, OsType, Server, ServerAuthMethod,
    };

    fn make_server(id: &str, group_id: Option<String>) -> Server {
        Server {
            id: id.to_string(),
            name: format!("Server {}", id),
            host: "192.168.1.1".to_string(),
            port: 22,
            username: "admin".to_string(),
            auth_method: ServerAuthMethod::Password,
            credential_id: "c1".to_string(),
            group_id,
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
    fn test_create_group() {
        let mut group_index = GroupIndex::default();
        let group = create_group("Production", &mut group_index).unwrap();
        assert_eq!(group.name, "Production");
        assert_eq!(group_index.groups.len(), 1);
        assert!(!group.id.is_empty());
    }

    #[test]
    fn test_rename_group() {
        let mut group_index = GroupIndex::default();
        let group = create_group("Old", &mut group_index).unwrap();
        let id = group.id.clone();
        let renamed = rename_group(&id, "New", &mut group_index).unwrap();
        assert_eq!(renamed.name, "New");
    }

    #[test]
    fn test_rename_group_not_found() {
        let mut group_index = GroupIndex::default();
        let err = rename_group("nonexistent", "New", &mut group_index).unwrap_err();
        assert!(err.to_string().contains("not found"));
    }

    #[test]
    fn test_move_server_to_group_svc() {
        let mut group_index = GroupIndex::default();
        let group = create_group("Dev", &mut group_index).unwrap();
        let gid = group.id.clone();

        let mut server_index = ServerIndex {
            servers: vec![make_server("s1", None)],
        };
        move_server_to_group_svc("s1", Some(&gid), &mut server_index, &group_index).unwrap();
        assert_eq!(server_index.servers[0].group_id, Some(gid));
    }

    #[test]
    fn test_move_server_to_group_svc_group_not_found() {
        let group_index = GroupIndex::default();
        let mut server_index = ServerIndex {
            servers: vec![make_server("s1", None)],
        };
        let err =
            move_server_to_group_svc("s1", Some("nonexistent"), &mut server_index, &group_index)
                .unwrap_err();
        assert!(err.to_string().contains("not found"));
    }

    #[test]
    fn test_move_server_to_group_svc_server_not_found() {
        let group_index = GroupIndex::default();
        let mut server_index = ServerIndex::default();
        let err =
            move_server_to_group_svc("nonexistent", None, &mut server_index, &group_index)
                .unwrap_err();
        assert!(err.to_string().contains("not found"));
    }

    #[test]
    fn test_delete_group_rehome() {
        let mut group_index = GroupIndex::default();
        let group = create_group("Temp", &mut group_index).unwrap();
        let gid = group.id.clone();

        let mut server_index = ServerIndex {
            servers: vec![
                make_server("s1", Some(gid.clone())),
                make_server("s2", Some(gid.clone())),
                make_server("s3", None),
            ],
        };

        delete_group(
            &gid,
            DeleteGroupStrategy::Rehome,
            &mut group_index,
            &mut server_index,
        )
        .unwrap();

        assert!(group_index.groups.is_empty());
        assert_eq!(server_index.servers.len(), 3);
        assert_eq!(server_index.servers[0].group_id, None);
        assert_eq!(server_index.servers[1].group_id, None);
        assert_eq!(server_index.servers[2].group_id, None);
    }

    #[test]
    fn test_delete_group_with_members() {
        let mut group_index = GroupIndex::default();
        let group = create_group("Temp", &mut group_index).unwrap();
        let gid = group.id.clone();

        let mut server_index = ServerIndex {
            servers: vec![
                make_server("s1", Some(gid.clone())),
                make_server("s2", Some(gid.clone())),
                make_server("s3", None),
            ],
        };

        delete_group(
            &gid,
            DeleteGroupStrategy::DeleteWithMembers,
            &mut group_index,
            &mut server_index,
        )
        .unwrap();

        assert!(group_index.groups.is_empty());
        assert_eq!(server_index.servers.len(), 1);
        assert_eq!(server_index.servers[0].id, "s3");
    }

    #[test]
    fn test_delete_group_not_found() {
        let mut group_index = GroupIndex::default();
        let mut server_index = ServerIndex::default();
        let err = delete_group(
            "nonexistent",
            DeleteGroupStrategy::Rehome,
            &mut group_index,
            &mut server_index,
        )
        .unwrap_err();
        assert!(err.to_string().contains("not found"));
    }

    #[test]
    fn test_move_server_ungroup() {
        let group_index = GroupIndex::default();
        let mut server_index = ServerIndex {
            servers: vec![make_server("s1", Some("g1".to_string()))],
        };
        move_server_to_group_svc("s1", None, &mut server_index, &group_index).unwrap();
        assert_eq!(server_index.servers[0].group_id, None);
    }
}
