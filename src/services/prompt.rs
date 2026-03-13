use anyhow::Result;

use crate::models::{PromptPreset, PromptsState};
use crate::storage::{self, ConsolePaths};

fn load() -> Result<PromptsState> {
    let paths = ConsolePaths::default();
    storage::read_json(&paths.prompts_file())
}

fn save(state: &PromptsState) -> Result<()> {
    let paths = ConsolePaths::default();
    storage::write_json(&paths.prompts_file(), state)
}

pub fn list() -> Result<Vec<PromptPreset>> {
    Ok(load()?.prompts)
}

pub fn create(mut preset: PromptPreset) -> Result<PromptPreset> {
    let mut state = load()?;
    if preset.id.is_empty() {
        preset.id = uuid::Uuid::new_v4().to_string();
    }
    state.prompts.push(preset.clone());
    save(&state)?;
    Ok(preset)
}

pub fn delete(id: &str) -> Result<()> {
    let mut state = load()?;
    state.prompts.retain(|p| p.id != id);
    save(&state)
}

pub fn activate(id: &str) -> Result<()> {
    let mut state = load()?;
    for p in &mut state.prompts {
        p.active = p.id == id;
    }
    save(&state)
}

pub fn deactivate_all() -> Result<()> {
    let mut state = load()?;
    for p in &mut state.prompts {
        p.active = false;
    }
    save(&state)
}
