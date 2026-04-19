use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct UpdateSkillRequest {
    pub apps: Vec<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct AddSkillRepoRequest {
    pub name: String,
    pub url: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ToggleSkillRepoRequest {
    pub enabled: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct InstallFromUrlRequest {
    pub name: String,
    pub source_url: String,
    pub apps: Vec<String>,
}
