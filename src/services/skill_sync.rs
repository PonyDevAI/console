use anyhow::Result;
use std::path::PathBuf;

use crate::adapters;
use crate::models::Skill;
use crate::storage::ConsolePaths;

fn ssot_dir() -> PathBuf {
    ConsolePaths::default().root.join("skills")
}

fn app_skills_dir(app_name: &str) -> Result<PathBuf> {
    let registry = adapters::registry();
    for adapter in registry.adapters() {
        if adapter.name() == app_name {
            return Ok(adapter.config_dir()?.join("skills"));
        }
    }
    anyhow::bail!("unknown app: {app_name}")
}

pub fn sync_skill_to_apps(skill: &Skill) -> Result<u32> {
    let ssot_skill_dir = ssot_dir().join(&skill.name);
    if !ssot_skill_dir.exists() {
        anyhow::bail!("skill SSOT directory not found: {}", ssot_skill_dir.display());
    }

    let mut count = 0u32;
    for app_name in &skill.apps {
        let target_dir = match app_skills_dir(app_name) {
            Ok(dir) => dir,
            Err(_) => continue,
        };
        std::fs::create_dir_all(&target_dir)?;
        let link_path = target_dir.join(&skill.name);

        if link_path.exists() || link_path.symlink_metadata().is_ok() {
            if link_path.is_dir() {
                std::fs::remove_dir_all(&link_path)?;
            } else {
                std::fs::remove_file(&link_path)?;
            }
        }

        #[cfg(unix)]
        {
            match std::os::unix::fs::symlink(&ssot_skill_dir, &link_path) {
                Ok(()) => {
                    tracing::info!("Symlinked skill '{}' to {}", skill.name, link_path.display());
                    count += 1;
                    continue;
                }
                Err(e) => {
                    tracing::warn!("Symlink failed for '{}': {e}, falling back to copy", skill.name);
                }
            }
        }

        copy_dir_recursive(&ssot_skill_dir, &link_path)?;
        tracing::info!("Copied skill '{}' to {}", skill.name, link_path.display());
        count += 1;
    }

    Ok(count)
}

pub fn remove_skill_from_apps(skill: &Skill) -> Result<()> {
    for app_name in &skill.apps {
        let target_dir = match app_skills_dir(app_name) {
            Ok(dir) => dir,
            Err(_) => continue,
        };
        let link_path = target_dir.join(&skill.name);
        if link_path.exists() || link_path.symlink_metadata().is_ok() {
            if link_path.is_dir() {
                std::fs::remove_dir_all(&link_path)?;
            } else {
                std::fs::remove_file(&link_path)?;
            }
            tracing::info!("Removed skill '{}' from {}", skill.name, link_path.display());
        }
    }
    Ok(())
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
