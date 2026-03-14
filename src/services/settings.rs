use anyhow::Result;
use serde::{Deserialize, Serialize};

use crate::storage::{self, ConsolePaths};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    pub storage_path: String,
    pub default_worker: String,
    pub theme: String,
    pub log_level: String,
    pub auto_check_updates: bool,
    pub sync_on_change: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            storage_path: "~/.console".to_string(),
            default_worker: "claude".to_string(),
            theme: "dark".to_string(),
            log_level: "info".to_string(),
            auto_check_updates: true,
            sync_on_change: false,
        }
    }
}

pub fn load() -> Result<Settings> {
    let paths = ConsolePaths::default();
    let file = paths.settings_file();
    if file.exists() {
        storage::read_json(&file)
    } else {
        Ok(Settings::default())
    }
}

pub fn save(settings: &Settings) -> Result<()> {
    let paths = ConsolePaths::default();
    let file = paths.settings_file();
    storage::write_json(&file, settings)
}
