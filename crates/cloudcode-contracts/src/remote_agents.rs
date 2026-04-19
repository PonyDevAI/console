use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct CreateRemoteAgentRequest {
    pub name: String,
    pub display_name: String,
    pub endpoint: String,
    pub api_key: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub source_type: Option<String>,
    #[serde(default)]
    pub origin: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
pub struct UpdateRemoteAgentRequest {
    pub display_name: Option<String>,
    pub endpoint: Option<String>,
    pub api_key: Option<String>,
    pub tags: Option<Vec<String>>,
    pub source_type: Option<String>,
    pub origin: Option<String>,
}
