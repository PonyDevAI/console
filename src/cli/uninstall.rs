use anyhow::Result;
use std::io::{self, Write};

pub async fn run(purge: bool, yes: bool) -> Result<()> {
    if !yes {
        println!("This will remove CloudCode binary and web assets.");
        if purge {
            println!("Purge is enabled: ~/.cloudcode will be removed completely.");
        } else {
            println!("Config/state under ~/.cloudcode will be kept.");
        }
        print!("Continue? [y/N]: ");
        io::stdout().flush()?;

        let mut input = String::new();
        io::stdin().read_line(&mut input)?;
        let confirmed = matches!(input.trim().to_lowercase().as_str(), "y" | "yes");
        if !confirmed {
            println!("Uninstall cancelled.");
            return Ok(());
        }
    }

    let paths = crate::storage::CloudCodePaths::default();
    let installed_bin = paths.root.join("bin").join("console");

    // Always target the installed binary, not the currently running executable.
    if installed_bin.exists() {
        std::fs::remove_file(&installed_bin)?;
    }

    let web_dir = paths.root.join("web");
    if web_dir.exists() {
        std::fs::remove_dir_all(&web_dir)?;
    }

    let bin_dir = paths.root.join("bin");
    if bin_dir.exists() && bin_dir.read_dir()?.next().is_none() {
        std::fs::remove_dir_all(&bin_dir)?;
    }

    // Clean PATH from shell rc files
    clean_shell_rc(&paths.root.join("bin"));

    if purge && paths.root.exists() {
        std::fs::remove_dir_all(&paths.root)?;
        println!("CloudCode removed, including ~/.cloudcode");
    } else {
        println!(
            "CloudCode removed. Preserved config at {}",
            paths.root.display()
        );
    }

    Ok(())
}

/// Remove the PATH line we added from common shell rc files.
fn clean_shell_rc(bin_dir: &std::path::Path) {
    let home = match dirs::home_dir() {
        Some(h) => h,
        None => return,
    };

    let dynamic_path_line = format!(r#"export PATH="{}:$PATH""#, bin_dir.display());
    let dynamic_fish_line = format!("set -gx PATH {} $PATH", bin_dir.display());
    for rc_path in [home.join(".zshrc"), home.join(".bashrc")] {
        remove_line_from_file(&rc_path, &dynamic_path_line);
    }

    let fish_rc = home.join(".config/fish/config.fish");
    remove_line_from_file(&fish_rc, &dynamic_fish_line);
}

fn remove_line_from_file(path: &std::path::Path, line: &str) {
    if !path.exists() {
        return;
    }
    let Ok(content) = std::fs::read_to_string(path) else {
        return;
    };
    let filtered: Vec<&str> = content.lines().filter(|l| *l != line).collect();
    // Only rewrite if we actually removed something
    if filtered.len() < content.lines().count() {
        let _ = std::fs::write(path, filtered.join("\n") + "\n");
    }
}
