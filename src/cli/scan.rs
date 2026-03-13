use crate::services;

pub async fn run() -> anyhow::Result<()> {
    println!("Scanning for installed CLI tools...\n");

    let state = services::version::scan_all()?;
    for tool in &state.tools {
        if tool.installed {
            println!(
                "  Found: {} v{}",
                tool.display_name,
                tool.local_version.as_deref().unwrap_or("unknown")
            );
        } else {
            println!("  Not found: {}", tool.display_name);
        }
    }

    services::version::save(&state)?;
    let paths = crate::storage::ConsolePaths::default();
    println!("\nSaved to {}", paths.cli_tools_file().display());

    Ok(())
}
