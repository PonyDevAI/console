use crate::storage::ConsolePaths;
use anyhow::Result;
use std::collections::HashMap;

const STATE_FILES: &[&str] = &[
    "providers.json",
    "mcp_servers.json",
    "prompts.json",
    "employees.json",
    "skills.json",
    "model_assignments.json",
    "settings.json",
];

pub fn list() -> Result<Vec<crate::models::BackupMeta>> {
    let paths = ConsolePaths::default();
    let dir = paths.backups_dir();
    let mut metas = vec![];

    let entries = std::fs::read_dir(&dir)?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }
        if let Ok(data) = std::fs::read_to_string(&path) {
            if let Ok(snap) = serde_json::from_str::<crate::models::BackupSnapshot>(&data) {
                metas.push(snap.meta);
            }
        }
    }

    metas.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(metas)
}

pub fn create(label: &str) -> Result<crate::models::BackupMeta> {
    let paths = ConsolePaths::default();
    let state_dir = paths.state_dir();
    let backups_dir = paths.backups_dir();

    let mut files: HashMap<String, serde_json::Value> = HashMap::new();
    for name in STATE_FILES {
        let file_path = state_dir.join(name);
        if file_path.exists() {
            let content = std::fs::read_to_string(&file_path)?;
            let val: serde_json::Value =
                serde_json::from_str(&content).unwrap_or(serde_json::Value::Null);
            files.insert(name.to_string(), val);
        }
    }

    let id = uuid::Uuid::new_v4().to_string();
    let created_at = chrono::Utc::now();
    let snapshot = crate::models::BackupSnapshot {
        meta: crate::models::BackupMeta {
            id: id.clone(),
            label: label.to_string(),
            created_at,
            size_bytes: 0,
        },
        files,
    };

    let content = serde_json::to_string_pretty(&snapshot)?;
    let size_bytes = content.len() as u64;

    let filename = format!(
        "{}_{}.json",
        created_at.format("%Y%m%d_%H%M%S"),
        id.split('-').next().unwrap_or("bak")
    );
    let backup_path = backups_dir.join(&filename);
    std::fs::write(&backup_path, &content)?;

    let meta = crate::models::BackupMeta {
        id,
        label: label.to_string(),
        created_at,
        size_bytes,
    };
    let snapshot2 = crate::models::BackupSnapshot {
        meta: meta.clone(),
        files: snapshot.files,
    };
    std::fs::write(&backup_path, serde_json::to_string_pretty(&snapshot2)?)?;

    crate::services::logs::push("info", "backup", &format!("Created backup '{}'", label));
    Ok(meta)
}

pub fn restore(id: &str) -> Result<()> {
    let paths = ConsolePaths::default();
    let backup_path = find_backup_path(id)?;
    let content = std::fs::read_to_string(&backup_path)?;
    let snapshot: crate::models::BackupSnapshot = serde_json::from_str(&content)?;

    let state_dir = paths.state_dir();
    for (name, value) in &snapshot.files {
        let file_path = state_dir.join(name);
        std::fs::write(&file_path, serde_json::to_string_pretty(value)?)?;
    }

    crate::services::logs::push(
        "info",
        "backup",
        &format!("Restored backup '{}'", snapshot.meta.label),
    );
    Ok(())
}

pub fn delete(id: &str) -> Result<()> {
    let path = find_backup_path(id)?;
    std::fs::remove_file(path)?;
    Ok(())
}

fn find_backup_path(id: &str) -> Result<std::path::PathBuf> {
    let paths = ConsolePaths::default();
    let dir = paths.backups_dir();
    for entry in std::fs::read_dir(&dir)?.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }
        if let Ok(data) = std::fs::read_to_string(&path) {
            if let Ok(snap) = serde_json::from_str::<crate::models::BackupSnapshot>(&data) {
                if snap.meta.id == id {
                    return Ok(path);
                }
            }
        }
    }
    anyhow::bail!("Backup not found: {}", id)
}
