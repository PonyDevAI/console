use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SoulFiles {
    pub soul: String,
    pub skills: String,
    pub rules: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PersonaFiles {
    pub identity: String,
    pub soul: String,
    pub skills: String,
    pub rules: String,
}

impl From<SoulFiles> for PersonaFiles {
    fn from(sf: SoulFiles) -> Self {
        PersonaFiles {
            identity: String::new(),
            soul: sf.soul,
            skills: sf.skills,
            rules: sf.rules,
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct CreateEmployeeRequest {
    pub name: String,
    #[serde(default)]
    pub display_name: Option<String>,
    pub agent_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(default)]
    pub avatar_color: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub role: Option<String>,
    #[serde(default)]
    pub employee_type: Option<String>,
    #[serde(default)]
    pub source_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub remote_agent_name: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
pub struct UpdateEmployeeRequest {
    pub display_name: Option<String>,
    pub agent_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    pub avatar_color: Option<String>,
    #[serde(default)]
    pub tags: Option<Vec<String>>,
    #[serde(default)]
    pub role: Option<String>,
    #[serde(default)]
    pub source_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub remote_agent_name: Option<String>,
}
