use anyhow::Result;
use serde::{de::DeserializeOwned, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

/// Paths under ~/.console/
pub struct ConsolePaths {
    pub root: PathBuf,
}

impl Default for ConsolePaths {
    fn default() -> Self {
        let home = dirs::home_dir().expect("cannot determine home directory");
        Self {
            root: home.join(".console"),
        }
    }
}

impl ConsolePaths {
    pub fn state_dir(&self) -> PathBuf {
        self.root.join("state")
    }
    pub fn credentials_dir(&self) -> PathBuf {
        self.root.join("credentials")
    }
    pub fn skills_dir(&self) -> PathBuf {
        self.root.join("skills")
    }
    pub fn logs_dir(&self) -> PathBuf {
        self.root.join("logs")
    }
    pub fn backups_dir(&self) -> PathBuf {
        self.root.join("backups")
    }
    pub fn cache_dir(&self) -> PathBuf {
        self.root.join("cache")
    }
    pub fn config_file(&self) -> PathBuf {
        self.root.join("config.json")
    }
    pub fn cli_tools_file(&self) -> PathBuf {
        self.state_dir().join("cli_tools.json")
    }
    pub fn providers_file(&self) -> PathBuf {
        self.state_dir().join("providers.json")
    }
    pub fn mcp_servers_file(&self) -> PathBuf {
        self.state_dir().join("mcp_servers.json")
    }
    pub fn skills_file(&self) -> PathBuf {
        self.state_dir().join("skills.json")
    }
    pub fn prompts_file(&self) -> PathBuf {
        self.state_dir().join("prompts.json")
    }
    pub fn skill_repos_file(&self) -> PathBuf {
        self.state_dir().join("skill_repos.json")
    }
    #[allow(dead_code)]
    pub fn workspaces_file(&self) -> PathBuf {
        self.state_dir().join("workspaces.json")
    }
    pub fn settings_file(&self) -> PathBuf {
        self.root.join("settings.json")
    }
    pub fn remote_agents_file(&self) -> PathBuf {
        self.state_dir().join("remote_agents.json")
    }

    /// Create all required directories.
    pub fn ensure_dirs(&self) -> Result<()> {
        let dirs = [
            &self.root,
            &self.state_dir(),
            &self.credentials_dir(),
            &self.skills_dir(),
            &self.logs_dir(),
            &self.backups_dir(),
            &self.cache_dir(),
        ];
        for d in dirs {
            fs::create_dir_all(d)?;
        }
        Ok(())
    }

    /// Write default files if they don't exist.
    pub fn init_default_files(&self) -> Result<()> {
        let config = self.config_file();
        if !config.exists() {
            write_json(&config, &crate::models::ConsoleConfig::default())?;
        }
        let tools = self.cli_tools_file();
        if !tools.exists() {
            write_json(&tools, &crate::models::CliToolsState { tools: vec![] })?;
        }
        let providers = self.providers_file();
        if !providers.exists() {
            write_json(
                &providers,
                &crate::models::ProvidersState {
                    providers: vec![],
                    switch_modes: std::collections::HashMap::new(),
                },
            )?;
        }
        let mcp = self.mcp_servers_file();
        if !mcp.exists() {
            write_json(&mcp, &crate::models::McpServersState { servers: vec![] })?;
        }
        let skills = self.skills_file();
        if !skills.exists() {
            write_json(&skills, &crate::models::SkillsState { skills: vec![] })?;
        }
        let prompts = self.prompts_file();
        if !prompts.exists() {
            write_json(&prompts, &crate::models::PromptsState { prompts: vec![] })?;
        }
        let skill_repos = self.skill_repos_file();
        if !skill_repos.exists() {
            write_json(
                &skill_repos,
                &crate::models::SkillReposState { repos: vec![] },
            )?;
        }
        let settings = self.settings_file();
        if !settings.exists() {
            write_json(&settings, &crate::services::settings::Settings::default())?;
        }
        Ok(())
    }
}

/// Read a JSON file and deserialize.
pub fn read_json<T: DeserializeOwned>(path: &Path) -> Result<T> {
    let data = fs::read_to_string(path)?;
    let val = serde_json::from_str(&data)?;
    Ok(val)
}

/// Serialize and write a JSON file (pretty-printed).
pub fn write_json<T: Serialize>(path: &Path, value: &T) -> Result<()> {
    let data = serde_json::to_string_pretty(value)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(path, data)?;
    Ok(())
}
