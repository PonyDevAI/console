use anyhow::Result;
use reqwest::header::USER_AGENT;
use std::path::{Path, PathBuf};

pub async fn run(version: Option<String>, dry_run: bool) -> Result<()> {
    let paths = crate::storage::ConsolePaths::default();
    let target_bin = paths.root.join("bin").join("console");
    if !target_bin.exists() {
        anyhow::bail!(
            "Console is not installed at {}. Run install.sh first.",
            target_bin.display()
        );
    }

    let current = installed_version(&target_bin)?;
    let latest = if let Some(v) = version {
        if v.starts_with('v') { v } else { format!("v{v}") }
    } else {
        println!("Checking for updates...");
        crate::services::self_update::check_latest().await?
    };

    if !crate::services::self_update::update_available(&current, &latest) {
        println!("Already up to date (v{})", crate::services::self_update::normalize_version(&current));
        return Ok(());
    }

    if dry_run {
        println!(
            "Update available: v{} -> {}",
            crate::services::self_update::normalize_version(&current),
            latest
        );
        return Ok(());
    }

    let os = map_os(std::env::consts::OS)?;
    let arch = map_arch(std::env::consts::ARCH)?;
    let repo = crate::services::self_update::github_repo();
    let file_name = format!("console-{}-{}-{}.tar.gz", latest, os, arch);
    let url = format!("https://github.com/{repo}/releases/download/{latest}/{file_name}");

    println!("Downloading {}...", file_name);

    let tmp_root = std::env::temp_dir().join(format!("console-upgrade-{}", uuid::Uuid::new_v4()));
    let archive = tmp_root.join(&file_name);
    let extract_dir = tmp_root.join("extract");
    std::fs::create_dir_all(&extract_dir)?;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()?;
    let bytes = client
        .get(&url)
        .header(USER_AGENT, "console-self-update")
        .send()
        .await?
        .error_for_status()?
        .bytes()
        .await?;
    std::fs::write(&archive, &bytes)?;

    let status = std::process::Command::new("tar")
        .arg("-xzf")
        .arg(&archive)
        .arg("-C")
        .arg(&extract_dir)
        .status()?;
    if !status.success() {
        anyhow::bail!("failed to extract archive with tar");
    }

    println!("Installing...");

    let new_bin = find_named_file(&extract_dir, "console")
        .ok_or_else(|| anyhow::anyhow!("archive does not contain console binary"))?;

    let backup = target_bin.with_file_name("console.old");
    if backup.exists() {
        std::fs::remove_file(&backup)?;
    }

    std::fs::rename(&target_bin, &backup)?;
    if let Err(e) = std::fs::rename(&new_bin, &target_bin) {
        let _ = std::fs::rename(&backup, &target_bin);
        return Err(e.into());
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = std::fs::metadata(&target_bin)?.permissions();
        perms.set_mode(0o755);
        std::fs::set_permissions(&target_bin, perms)?;
    }

    let _ = std::fs::remove_file(&backup);

    if let Some(web_dir) = find_named_dir(&extract_dir, "web") {
        let target_web = crate::storage::ConsolePaths::default().root.join("web");
        if target_web.exists() {
            std::fs::remove_dir_all(&target_web)?;
        }
        copy_dir_recursive(&web_dir, &target_web)?;
    }

    let _ = std::fs::remove_dir_all(&tmp_root);

    println!(
        "Upgraded: v{} -> {}",
        crate::services::self_update::normalize_version(&current),
        latest
    );
    Ok(())
}

fn installed_version(path: &Path) -> Result<String> {
    let output = std::process::Command::new(path)
        .arg("--version")
        .output()?;
    if !output.status.success() {
        anyhow::bail!("failed to read installed version from {}", path.display());
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    let raw = stdout
        .split_whitespace()
        .nth(1)
        .ok_or_else(|| anyhow::anyhow!("unexpected --version output: {}", stdout.trim()))?;
    Ok(crate::services::self_update::normalize_version(raw))
}

fn map_os(os: &str) -> Result<&'static str> {
    match os {
        "macos" => Ok("darwin"),
        "linux" => Ok("linux"),
        other => anyhow::bail!("unsupported OS: {other}"),
    }
}

fn map_arch(arch: &str) -> Result<&'static str> {
    match arch {
        "x86_64" => Ok("amd64"),
        "aarch64" => Ok("arm64"),
        other => anyhow::bail!("unsupported arch: {other}"),
    }
}

fn find_named_file(root: &Path, name: &str) -> Option<PathBuf> {
    for entry in std::fs::read_dir(root).ok()? {
        let entry = entry.ok()?;
        let path = entry.path();
        if path.is_file() && path.file_name().and_then(|s| s.to_str()) == Some(name) {
            return Some(path);
        }
        if path.is_dir() {
            if let Some(found) = find_named_file(&path, name) {
                return Some(found);
            }
        }
    }
    None
}

fn find_named_dir(root: &Path, name: &str) -> Option<PathBuf> {
    for entry in std::fs::read_dir(root).ok()? {
        let entry = entry.ok()?;
        let path = entry.path();
        if path.is_dir() {
            if path.file_name().and_then(|s| s.to_str()) == Some(name) {
                return Some(path);
            }
            if let Some(found) = find_named_dir(&path, name) {
                return Some(found);
            }
        }
    }
    None
}

fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<()> {
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
