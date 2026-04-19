use anyhow::Result;

use crate::models::{Provider, ProvidersState, SwitchMode};
use crate::storage::{self, CloudCodePaths};

fn load() -> Result<ProvidersState> {
    let paths = CloudCodePaths::default();
    storage::read_json(&paths.providers_file())
}

fn save(state: &ProvidersState) -> Result<()> {
    let paths = CloudCodePaths::default();
    storage::write_json(&paths.providers_file(), state)
}

pub fn list() -> Result<Vec<Provider>> {
    Ok(load()?.providers)
}

pub fn get_switch_modes() -> Result<std::collections::HashMap<String, SwitchMode>> {
    Ok(load()?.switch_modes)
}

pub fn set_switch_mode(app: &str, mode: SwitchMode) -> Result<()> {
    let mut state = load()?;
    state.switch_modes.insert(app.to_string(), mode);
    save(&state)
}

pub fn create(
    name: String,
    api_endpoint: String,
    api_key_ref: String,
    apps: Vec<String>,
    models: Vec<String>,
) -> Result<Provider> {
    let mut state = load()?;
    let now = chrono::Utc::now();
    let provider = Provider {
        id: uuid::Uuid::new_v4().to_string(),
        name,
        api_endpoint,
        api_key_ref,
        active: false,
        apps,
        models,
        created_at: now,
        modified_at: now,
    };
    state.providers.push(provider.clone());
    save(&state)?;
    Ok(provider)
}

pub fn update_fields(
    id: &str,
    name: String,
    api_endpoint: String,
    api_key_ref: String,
    apps: Vec<String>,
    models: Vec<String>,
) -> Result<Provider> {
    let mut state = load()?;
    if let Some(p) = state.providers.iter_mut().find(|p| p.id == id) {
        p.name = name;
        p.api_endpoint = api_endpoint;
        p.api_key_ref = api_key_ref;
        p.apps = apps;
        p.models = models;
        p.modified_at = chrono::Utc::now();
        let result = p.clone();
        save(&state)?;
        Ok(result)
    } else {
        anyhow::bail!("provider not found: {id}")
    }
}

pub fn delete(id: &str) -> Result<()> {
    let mut state = load()?;
    state.providers.retain(|p| p.id != id);
    save(&state)
}

pub fn activate(id: &str) -> Result<()> {
    let mut state = load()?;
    if !state.providers.iter().any(|p| p.id == id) {
        anyhow::bail!("provider not found: {id}");
    }
    for p in &mut state.providers {
        p.active = p.id == id;
    }
    save(&state)
}

pub fn get_active() -> Result<Option<Provider>> {
    let state = load()?;
    Ok(state.providers.into_iter().find(|p| p.active))
}

pub fn export_state() -> Result<serde_json::Value> {
    let state = load()?;
    Ok(serde_json::to_value(&state)?)
}

pub fn import_all(json_str: &str) -> Result<Vec<Provider>> {
    let imported: ProvidersState = serde_json::from_str(json_str)?;
    let mut state = load()?;
    let mut added = Vec::new();

    for provider in imported.providers {
        if !state
            .providers
            .iter()
            .any(|existing| existing.name == provider.name)
        {
            state.providers.push(provider.clone());
            added.push(provider);
        }
    }

    for (app, mode) in imported.switch_modes {
        state.switch_modes.insert(app, mode);
    }

    save(&state)?;
    Ok(added)
}
