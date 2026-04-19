use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct CreatePromptRequest {
    pub name: String,
    pub content: String,
    pub apps: Vec<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct UpdatePromptRequest {
    pub name: Option<String>,
    pub content: Option<String>,
    pub apps: Option<Vec<String>>,
}
