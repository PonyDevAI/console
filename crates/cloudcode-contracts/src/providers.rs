use crate::common::SwitchMode;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct CreateProviderRequest {
    pub name: String,
    pub api_endpoint: String,
    pub api_key_ref: String,
    pub apps: Vec<String>,
    #[serde(default)]
    pub models: Vec<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ImportProvidersRequest {
    pub data: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct SetSwitchModeRequest {
    pub mode: SwitchMode,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct SetModelAssignmentRequest {
    pub provider_id: String,
    pub model: String,
}
