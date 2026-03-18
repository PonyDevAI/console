use anyhow::Result;

use crate::models::{ModelAssignment, ModelAssignmentsState};
use crate::storage::{self, ConsolePaths};

fn load() -> Result<ModelAssignmentsState> {
    let paths = ConsolePaths::default();
    let file = paths.model_assignments_file();
    if !file.exists() {
        return Ok(ModelAssignmentsState::default());
    }
    storage::read_json(&file)
}

fn save(state: &ModelAssignmentsState) -> Result<()> {
    let paths = ConsolePaths::default();
    storage::write_json(&paths.model_assignments_file(), state)
}

pub fn list() -> Result<Vec<ModelAssignment>> {
    Ok(load()?.assignments)
}

pub fn get(app: &str) -> Result<Option<ModelAssignment>> {
    Ok(load()?.assignments.into_iter().find(|assignment| assignment.app == app))
}

pub fn set(app: String, provider_id: String, model: String) -> Result<ModelAssignment> {
    let mut state = load()?;
    let assignment = ModelAssignment {
        app: app.clone(),
        provider_id,
        model,
        updated_at: chrono::Utc::now(),
    };

    if let Some(existing) = state.assignments.iter_mut().find(|item| item.app == app) {
        *existing = assignment.clone();
    } else {
        state.assignments.push(assignment.clone());
    }

    save(&state)?;
    Ok(assignment)
}

pub fn remove(app: &str) -> Result<()> {
    let mut state = load()?;
    state.assignments.retain(|assignment| assignment.app != app);
    save(&state)
}
