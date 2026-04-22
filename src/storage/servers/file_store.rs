use anyhow::Result;

use crate::models::{GroupIndex, Server, ServerGroup, ServerIndex};
use crate::storage::{read_json, write_json, CloudCodePaths};

/// Load the server index from disk.
pub fn load_server_index(paths: &CloudCodePaths) -> Result<ServerIndex> {
    let file = paths.servers_file();
    if file.exists() {
        read_json(&file)
    } else {
        Ok(ServerIndex::default())
    }
}

/// Save the server index to disk.
pub fn save_server_index(paths: &CloudCodePaths, index: &ServerIndex) -> Result<()> {
    let file = paths.servers_file();
    write_json(&file, index)
}

/// Load the group index from disk.
pub fn load_group_index(paths: &CloudCodePaths) -> Result<GroupIndex> {
    let file = paths.groups_file();
    if file.exists() {
        read_json(&file)
    } else {
        Ok(GroupIndex::default())
    }
}

/// Save the group index to disk.
pub fn save_group_index(paths: &CloudCodePaths, index: &GroupIndex) -> Result<()> {
    let file = paths.groups_file();
    write_json(&file, index)
}

/// Upsert a server into the index.
pub fn upsert_server(index: &mut ServerIndex, server: Server) {
    index.servers.retain(|s| s.id != server.id);
    index.servers.push(server);
}

/// Remove a server from the index by id.
pub fn remove_server(index: &mut ServerIndex, id: &str) {
    index.servers.retain(|s| s.id != id);
}

/// Get a server by id.
pub fn get_server<'a>(index: &'a ServerIndex, id: &str) -> Option<&'a Server> {
    index.servers.iter().find(|s| s.id == id)
}

/// Get a mutable reference to a server by id.
pub fn get_server_mut<'a>(index: &'a mut ServerIndex, id: &str) -> Option<&'a mut Server> {
    index.servers.iter_mut().find(|s| s.id == id)
}

/// Upsert a group into the index.
pub fn upsert_group(index: &mut GroupIndex, group: ServerGroup) {
    index.groups.retain(|g| g.id != group.id);
    index.groups.push(group);
}

/// Remove a group from the index by id.
pub fn remove_group(index: &mut GroupIndex, id: &str) {
    index.groups.retain(|g| g.id != id);
}

/// Get a group by id.
pub fn get_group<'a>(index: &'a GroupIndex, id: &str) -> Option<&'a ServerGroup> {
    index.groups.iter().find(|g| g.id == id)
}

/// Find all servers in a group.
pub fn list_servers_by_group<'a>(server_index: &'a ServerIndex, group_id: &str) -> Vec<&'a Server> {
    server_index
        .servers
        .iter()
        .filter(|s| s.group_id.as_deref() == Some(group_id))
        .collect()
}

/// Move a server to a group (or ungroup).
pub fn move_server_to_group(
    server_index: &mut ServerIndex,
    server_id: &str,
    group_id: Option<String>,
) -> bool {
    if let Some(server) = get_server_mut(server_index, server_id) {
        server.group_id = group_id;
        server.updated_at = chrono::Utc::now();
        true
    } else {
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{OsDetectedFrom, OsDetectionStatus, OsType, ServerAuthMethod};
    use chrono::Utc;

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
    fn test_upsert_replaces_existing() {
        let mut index = ServerIndex::default();
        let s1 = make_server("s1", None);
        upsert_server(&mut index, s1);
        assert_eq!(index.servers.len(), 1);

        let s2 = make_server("s1", Some("g1".to_string()));
        upsert_server(&mut index, s2);
        assert_eq!(index.servers.len(), 1);
        assert_eq!(index.servers[0].group_id, Some("g1".to_string()));
    }

    #[test]
    fn test_move_server_to_group() {
        let mut index = ServerIndex {
            servers: vec![make_server("s1", None)],
        };
        assert!(move_server_to_group(
            &mut index,
            "s1",
            Some("g1".to_string())
        ));
        assert_eq!(index.servers[0].group_id, Some("g1".to_string()));
    }

    #[test]
    fn test_move_server_ungroup() {
        let mut index = ServerIndex {
            servers: vec![make_server("s1", Some("g1".to_string()))],
        };
        assert!(move_server_to_group(&mut index, "s1", None));
        assert_eq!(index.servers[0].group_id, None);
    }

    #[test]
    fn test_list_servers_by_group() {
        let index = ServerIndex {
            servers: vec![
                make_server("s1", Some("g1".to_string())),
                make_server("s2", Some("g1".to_string())),
                make_server("s3", Some("g2".to_string())),
                make_server("s4", None),
            ],
        };
        let g1_servers = list_servers_by_group(&index, "g1");
        assert_eq!(g1_servers.len(), 2);
        let ungrouped = list_servers_by_group(&index, "");
        assert!(ungrouped.is_empty());
    }

    #[test]
    fn test_remove_server() {
        let mut index = ServerIndex {
            servers: vec![make_server("s1", None), make_server("s2", None)],
        };
        remove_server(&mut index, "s1");
        assert_eq!(index.servers.len(), 1);
        assert_eq!(index.servers[0].id, "s2");
    }
}
