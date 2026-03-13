use anyhow::Result;

use crate::models::{Provider, ProvidersState};
use crate::storage::{self, ConsolePaths};

fn load() -> Result<ProvidersState> {
    let paths = ConsolePaths::default();
    storage::read_json(&paths.providers_file())
}

fn save(state: &ProvidersState) -> Result<()> {
    let paths = ConsolePaths::default();
    storage::write_json(&paths.providers_file(), state)
}

pub fn list() -> Result<Vec<Provider>> {
    Ok(load()?.providers)
}

pub fn create(
    name: String,
    api_endpoint: String,
    api_key_ref: String,
    apps: Vec<String>,
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
        created_at: now,
        modified_at: now,
    };
    state.providers.push(provider.clone());
    save(&state)?;
    Ok(provider)
}

pub fn update(id: &str, updated: Provider) -> Result<Provider> {
    let mut state = load()?;
    if let Some(p) = state.providers.iter_mut().find(|p| p.id == id) {
        p.name = updated.name;
        p.api_endpoint = updated.api_endpoint;
        p.api_key_ref = updated.api_key_ref;
        p.apps = updated.apps;
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
    for p in &mut state.providers {
        p.active = p.id == id;
    }
    save(&state)
}

pub fn get_active() -> Result<Option<Provider>> {
    let state = load()?;
    Ok(state.providers.into_iter().find(|p| p.active))
}
