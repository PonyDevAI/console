use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct CreateAgentSourceRequest {
    pub name: String,
    pub display_name: String,
    pub source_type: String,
    pub endpoint: Option<String>,
    pub api_key: Option<String>,
    pub origin: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct UpdateAgentSourceRequest {
    pub display_name: Option<String>,
    pub endpoint: Option<String>,
    pub api_key: Option<String>,
    pub origin: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct SetDefaultModelRequest {
    pub model: String,
}
