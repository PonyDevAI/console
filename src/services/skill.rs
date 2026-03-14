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

#[allow(dead_code)]
fn save(state: &SkillsState) -> Result<()> {
    storage::write_json(&skills_state_file(), state)
}

pub fn list() -> Result<Vec<Skill>> {
    Ok(load()?.skills)
}

#[allow(dead_code)]
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

#[allow(dead_code)]
pub fn uninstall(name: &str) -> Result<()> {
    let mut state = load()?;
    state.skills.retain(|s| s.name != name);
    save(&state)
}

#[allow(dead_code)]
pub fn mark_installed(id: &str) -> Result<Skill> {
    let mut state = load()?;
    if let Some(skill) = state.skills.iter_mut().find(|s| s.id == id) {
        skill.installed_at = Some(chrono::Utc::now());
        let updated = skill.clone();
        save(&state)?;
        Ok(updated)
    } else {
        anyhow::bail!("skill not found: {id}")
    }
}

/// Mark a skill as installed by ID and persist.
pub fn install_by_id(id: &str) -> Result<()> {
    let paths = ConsolePaths::default();
    let file = paths.skills_file();
    let mut skills: Vec<Skill> = if file.exists() {
        storage::read_json(&file)?
    } else {
        vec![]
    };
    if let Some(skill) = skills.iter_mut().find(|s| s.id == id) {
        skill.installed_at = Some(chrono::Utc::now());
    } else {
        anyhow::bail!("skill not found: {id}");
    }
    storage::write_json(&file, &skills)?;
    Ok(())
}

/// Mark a skill as uninstalled by ID and persist.
pub fn uninstall_by_id(id: &str) -> Result<()> {
    let paths = ConsolePaths::default();
    let file = paths.skills_file();
    let mut skills: Vec<Skill> = if file.exists() {
        storage::read_json(&file)?
    } else {
        vec![]
    };
    if let Some(skill) = skills.iter_mut().find(|s| s.id == id) {
        skill.installed_at = None;
    } else {
        anyhow::bail!("skill not found: {id}");
    }
    storage::write_json(&file, &skills)?;
    Ok(())
}

#[allow(dead_code)]
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

#[allow(dead_code)]
pub fn disable_for_app(name: &str, app: &str) -> Result<()> {
    let mut state = load()?;
    if let Some(s) = state.skills.iter_mut().find(|s| s.name == name) {
        s.enabled_apps.retain(|a| a != app);
        save(&state)
    } else {
        anyhow::bail!("skill not found: {name}")
    }
}
