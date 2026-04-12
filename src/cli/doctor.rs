use crate::adapters;

pub async fn run() -> anyhow::Result<()> {
    println!("CloudCode Doctor — running diagnostics\n");

    // Check ~/.console/ structure
    let paths = crate::storage::ConsolePaths::default();
    if paths.root.exists() {
        println!("[OK] ~/.console/ directory exists");
    } else {
        println!("[!!] ~/.console/ directory missing — run `console init`");
    }

    // Check CLI tools
    let registry = adapters::registry();
    for adapter in registry.adapters() {
        match adapter.detect_installation() {
            Ok(Some(info)) => {
                println!("[OK] {} v{} at {}", adapter.display_name(), info.version, info.path.display());
            }
            Ok(None) => {
                println!("[--] {} not installed", adapter.display_name());
            }
            Err(e) => {
                println!("[!!] {} detection error: {e}", adapter.display_name());
            }
        }
    }

    println!("\nDiagnostics complete.");
    Ok(())
}
