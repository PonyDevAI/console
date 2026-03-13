use anyhow::Result;

use crate::models::{Skill, SkillsState};
use crate::storage::{self, ConsolePaths};

fn skills_state_file() -> std::path::PathBuf {
    ConsolePaths::default().skills_file()
}

fn load() -> Result<SkillsState> {
    let path = skills_state_file();
    if path.exists() {
        storage::read_json(&path)
    } else {
        Ok(SkillsState { skills: vec![] })
    }
}

fn save(state: &SkillsState) -> Result<()> {
    storage::write_json(&skills_state_file(), state)
}

pub fn list() -> Result<Vec<Skill>> {
    Ok(load()?.skills)
}

pub fn install(mut skill: Skill) -> Result<Skill> {
    let mut state = load()?;
    if skill.id.is_empty() {
        skill.id = uuid::Uuid::new_v4().to_string();
    }
    skill.installed_at = Some(chrono::Utc::now());
    state.skills.push(skill.clone());
    save(&state)?;
    Ok(skill)
}

pub fn uninstall(name: &str) -> Result<()> {
    let mut state = load()?;
    state.skills.retain(|s| s.name != name);
    save(&state)
}

pub fn enable_for_app(name: &str, app: &str) -> Result<()> {
    let mut state = load()?;
    if let Some(s) = state.skills.iter_mut().find(|s| s.name == name) {
        if !s.enabled_apps.contains(&app.to_string()) {
            s.enabled_apps.push(app.to_string());
        }
        save(&state)
    } else {
        anyhow::bail!("skill not found: {name}")
    }
}

pub fn disable_for_app(name: &str, app: &str) -> Result<()> {
    let mut state = load()?;
    if let Some(s) = state.skills.iter_mut().find(|s| s.name == name) {
        s.enabled_apps.retain(|a| a != app);
        save(&state)
    } else {
        anyhow::bail!("skill not found: {name}")
    }
}
