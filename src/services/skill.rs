use anyhow::Result;

use crate::models::{Skill, SkillManifest, SkillRepo, SkillReposState, SkillsState};
use crate::storage::{self, ConsolePaths};

fn skills_state_file() -> std::path::PathBuf {
    ConsolePaths::default().skills_file()
}

fn skill_repos_state_file() -> std::path::PathBuf {
    ConsolePaths::default().skill_repos_file()
}

fn cache_dir() -> std::path::PathBuf {
    dirs::home_dir()
        .expect("home dir not found")
        .join(".console")
        .join("cache")
        .join("repos")
}

fn cache_file(id: &str) -> std::path::PathBuf {
    cache_dir().join(format!("{}.json", id))
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

fn load_repos() -> Result<SkillReposState> {
    let path = skill_repos_state_file();
    if path.exists() {
        storage::read_json(&path)
    } else {
        Ok(SkillReposState { repos: vec![] })
    }
}

fn save_repos(state: &SkillReposState) -> Result<()> {
    storage::write_json(&skill_repos_state_file(), state)
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
    let mut state = load()?;
    if let Some(skill) = state.skills.iter_mut().find(|s| s.id == id) {
        skill.installed_at = Some(chrono::Utc::now());
        let to_sync = skill.clone();
        save(&state)?;
        crate::services::skill_sync::sync_skill_to_apps(&to_sync)?;
        Ok(())
    } else {
        anyhow::bail!("skill not found: {id}");
    }
}

/// Mark a skill as uninstalled by ID and persist.
pub fn uninstall_by_id(id: &str) -> Result<()> {
    let mut state = load()?;
    if let Some(skill) = state.skills.iter_mut().find(|s| s.id == id) {
        skill.installed_at = None;
        let to_remove = skill.clone();
        save(&state)?;
        crate::services::skill_sync::remove_skill_from_apps(&to_remove)?;
        Ok(())
    } else {
        anyhow::bail!("skill not found: {id}");
    }
}

pub fn update_apps(id: &str, apps: Vec<String>) -> Result<Skill> {
    let mut state = load()?;
    if let Some(skill) = state.skills.iter_mut().find(|s| s.id == id) {
        skill.apps = apps;
        let updated = skill.clone();
        save(&state)?;
        Ok(updated)
    } else {
        anyhow::bail!("skill not found: {id}")
    }
}

#[allow(dead_code)]
pub fn enable_for_app(name: &str, app: &str) -> Result<()> {
    let mut state = load()?;
    if let Some(s) = state.skills.iter_mut().find(|s| s.name == name) {
        if !s.apps.contains(&app.to_string()) {
            s.apps.push(app.to_string());
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
        s.apps.retain(|a| a != app);
        save(&state)
    } else {
        anyhow::bail!("skill not found: {name}")
    }
}

pub fn list_repos() -> Result<Vec<SkillRepo>> {
    Ok(load_repos()?.repos)
}

pub fn add_repo(name: String, url: String) -> Result<SkillRepo> {
    let mut state = load_repos()?;
    let repo = SkillRepo {
        id: uuid::Uuid::new_v4().to_string(),
        name,
        url,
        enabled: true,
        last_synced: None,
    };
    state.repos.push(repo.clone());
    save_repos(&state)?;
    Ok(repo)
}

pub fn remove_repo(id: &str) -> Result<()> {
    let mut state = load_repos()?;
    state.repos.retain(|r| r.id != id);
    save_repos(&state)
}

pub fn toggle_repo(id: &str, enabled: bool) -> Result<()> {
    let mut state = load_repos()?;
    if let Some(repo) = state.repos.iter_mut().find(|r| r.id == id) {
        repo.enabled = enabled;
        save_repos(&state)
    } else {
        anyhow::bail!("skill repo not found: {id}")
    }
}

pub async fn fetch_repo(id: &str) -> Result<Vec<SkillManifest>> {
    use chrono::Utc;
    use std::fs;

    let repos = list_repos()?;
    let repo = repos
        .into_iter()
        .find(|r| r.id == id)
        .ok_or_else(|| anyhow::anyhow!("repo not found: {}", id))?;

    let mut url = repo.url.clone();
    if url.contains("github.com") {
        let stripped = url
            .trim_end_matches('/')
            .trim_end_matches(".git");
        let segments: Vec<&str> = stripped.split('/').collect();
        if segments.len() == 5 && segments[2] == "github.com" {
            let user = segments[3];
            let name = segments[4];
            url = format!("https://raw.githubusercontent.com/{user}/{name}/main/skills.json");
        } else {
            anyhow::bail!("unsupported GitHub URL format: {}", url);
        }
    } else if !url.ends_with("/skills.json") {
        url = format!("{}/skills.json", url.trim_end_matches('/'));
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()?;
    let resp = client.get(&url).send().await?;
    let index: crate::models::SkillRepoIndex = resp.error_for_status()?.json().await?;

    fs::create_dir_all(cache_dir())?;
    let cache_path = cache_file(id);
    let json = serde_json::to_string_pretty(&index.skills)?;
    fs::write(&cache_path, json)?;

    let mut repo_state = load_repos()?;
    if let Some(r) = repo_state.repos.iter_mut().find(|r| r.id == id) {
        r.last_synced = Some(Utc::now());
    }
    save_repos(&repo_state)?;

    Ok(index.skills)
}

pub fn get_repo_cache(id: &str) -> Result<Vec<SkillManifest>> {
    use std::fs;

    let cache_path = cache_file(id);
    if !cache_path.exists() {
        return Ok(vec![]);
    }

    let content = fs::read_to_string(&cache_path)?;
    let skills: Vec<SkillManifest> = serde_json::from_str(&content)?;
    Ok(skills)
}

pub async fn install_from_url(name: &str, source_url: &str, apps: Vec<String>) -> Result<Skill> {
    use chrono::Utc;
    use std::fs;

    if !source_url.starts_with("https://") && !source_url.starts_with("http://") {
        anyhow::bail!("invalid URL: must start with http:// or https://");
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()?;
    let resp = client.get(source_url).send().await?;
    let content = resp.error_for_status()?.text().await?;

    let skills_dir = ConsolePaths::default().skills_dir();
    let skill_dir = skills_dir.join(name);
    fs::create_dir_all(&skill_dir)?;

    let skill_md_path = skill_dir.join("SKILL.md");
    fs::write(&skill_md_path, &content)?;

    let mut state = load()?;
    let skill = Skill {
        id: uuid::Uuid::new_v4().to_string(),
        name: name.to_string(),
        description: String::new(),
        source: "github".to_string(),
        source_url: Some(source_url.to_string()),
        apps,
        installed_at: Some(Utc::now()),
        version: None,
    };

    state.skills.push(skill.clone());
    save(&state)?;

    crate::services::skill_sync::sync_skill_to_apps(&skill)?;

    Ok(skill)
}

pub fn install_from_zip(zip_data: &[u8]) -> Result<Vec<Skill>> {
    use chrono::Utc;
    use std::fs;
    use std::io::{Read, Write};
    use zip::read::ZipArchive;

    let mut archive = ZipArchive::new(std::io::Cursor::new(zip_data))?;
    let mut installed = Vec::new();

    let temp_dir = std::env::temp_dir().join(format!("console_zip_{}", uuid::Uuid::new_v4()));
    fs::create_dir_all(&temp_dir)?;

    for i in 0..archive.len() {
        let mut file = archive.by_index(i)?;
        let outpath = temp_dir.join(file.name());
        if file.name().ends_with('/') {
            fs::create_dir_all(&outpath)?;
        } else {
            if let Some(parent) = outpath.parent() {
                fs::create_dir_all(parent)?;
            }
            let mut outfile = fs::File::create(&outpath)?;
            let mut contents = Vec::new();
            file.read_to_end(&mut contents)?;
            outfile.write_all(&contents)?;
        }
    }

    let skills_dir = ConsolePaths::default().skills_dir();
    fs::create_dir_all(&skills_dir)?;

    for entry in fs::read_dir(&temp_dir)? {
        let entry = entry?;
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let skill_md = path.join("SKILL.md");
        if !skill_md.exists() {
            continue;
        }

        let skill_name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown");

        let dest_dir = skills_dir.join(skill_name);
        if dest_dir.exists() {
            continue;
        }

        copy_dir_recursive(&path, &dest_dir)?;

        let skill = Skill {
            id: uuid::Uuid::new_v4().to_string(),
            name: skill_name.to_string(),
            description: String::new(),
            source: "zip".to_string(),
            source_url: None,
            apps: vec![],
            installed_at: Some(Utc::now()),
            version: None,
        };

        crate::services::skill_sync::sync_skill_to_apps(&skill)?;
        installed.push(skill);
    }

    let mut state = load()?;
    for skill in &installed {
        state.skills.push(skill.clone());
    }
    save(&state)?;

    let _ = std::fs::remove_dir_all(&temp_dir);
    Ok(installed)
}

pub fn import_from_app(app: &str) -> Result<Vec<Skill>> {
    use chrono::Utc;
    use std::fs;

    let registry = crate::adapters::registry();
    let adapter = registry
        .find(app)
        .ok_or_else(|| anyhow::anyhow!("app not found: {}", app))?;

    let skills_source = adapter.config_dir()?.join("skills");
    if !skills_source.exists() {
        return Ok(vec![]);
    }

    let skills_dir = ConsolePaths::default().skills_dir();
    fs::create_dir_all(&skills_dir)?;

    let mut state = load()?;
    let mut installed = Vec::new();

    for entry in fs::read_dir(&skills_source)? {
        let entry = entry?;
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let skill_md = path.join("SKILL.md");
        if !skill_md.exists() {
            continue;
        }

        let skill_name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown");

        if state.skills.iter().any(|s| s.name == skill_name) {
            continue;
        }

        let dest_dir = skills_dir.join(skill_name);
        fs::create_dir_all(&dest_dir)?;
        for entry in fs::read_dir(&path)? {
            let entry = entry?;
            let src_path = entry.path();
            let dst_path = dest_dir.join(entry.file_name());
            if src_path.is_file() {
                fs::copy(&src_path, &dst_path)?;
            }
        }

        let skill = Skill {
            id: uuid::Uuid::new_v4().to_string(),
            name: skill_name.to_string(),
            description: String::new(),
            source: "local".to_string(),
            source_url: Some(path.to_string_lossy().to_string()),
            apps: vec![app.to_string()],
            installed_at: Some(Utc::now()),
            version: None,
        };
        state.skills.push(skill.clone());
        installed.push(skill);
    }

    save(&state)?;
    Ok(installed)
}

fn copy_dir_recursive(src: &std::path::Path, dst: &std::path::Path) -> Result<()> {
    std::fs::create_dir_all(dst)?;
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());
        if src_path.is_dir() {
            copy_dir_recursive(&src_path, &dst_path)?;
        } else {
            std::fs::copy(&src_path, &dst_path)?;
        }
    }
    Ok(())
}
