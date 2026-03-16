use anyhow::Result;

pub async fn run(version: Option<String>) -> Result<()> {
    let paths = crate::storage::ConsolePaths::default();
    let versions_dir = paths.root.join("versions");

    if !versions_dir.exists() {
        anyhow::bail!("No versions found at {}", versions_dir.display());
    }

    let target = if let Some(v) = version {
        if v.starts_with('v') { v } else { format!("v{v}") }
    } else {
        println!("Available versions:");
        let mut versions: Vec<String> = std::fs::read_dir(&versions_dir)?
            .filter_map(|e| e.ok())
            .filter(|e| e.path().is_dir())
            .filter_map(|e| e.file_name().into_string().ok())
            .collect();
        versions.sort_by(|a, b| {
            let parse = |s: &str| -> Vec<u64> {
                s.trim_start_matches('v')
                    .split('.')
                    .filter_map(|p| p.parse().ok())
                    .collect()
            };
            parse(a).cmp(&parse(b))
        });
        for v in &versions {
            let marker = if is_current(&paths.root, v) { " (current)" } else { "" };
            println!("  {v}{marker}");
        }

        print!("Roll back to which version? ");
        std::io::Write::flush(&mut std::io::stdout())?;
        let mut input = String::new();
        std::io::stdin().read_line(&mut input)?;
        let input = input.trim().to_string();
        if input.is_empty() {
            println!("Cancelled.");
            return Ok(());
        }
        if input.starts_with('v') { input } else { format!("v{input}") }
    };

    let target_dir = versions_dir.join(&target);
    if !target_dir.exists() {
        anyhow::bail!("Version {} not found in {}", target, versions_dir.display());
    }

    let current_link = paths.root.join("current");
    if current_link.exists() || current_link.is_symlink() {
        std::fs::remove_file(&current_link)?;
    }
    #[cfg(unix)]
    std::os::unix::fs::symlink(&target_dir, &current_link)?;

    println!("Rolled back to {target}");
    Ok(())
}

fn is_current(root: &std::path::Path, version: &str) -> bool {
    let current = root.join("current");
    if let Ok(target) = std::fs::read_link(&current) {
        target.ends_with(version)
    } else {
        false
    }
}
