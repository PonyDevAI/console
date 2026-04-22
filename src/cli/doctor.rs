use crate::adapters;

pub async fn run() -> anyhow::Result<()> {
    println!("CloudCode Doctor — running diagnostics\n");

    // Check ~/.cloudcode/ structure
    let paths = crate::storage::CloudCodePaths::default();
    if paths.root.exists() {
        println!("[OK] ~/.cloudcode/ directory exists");
    } else {
        println!("[!!] ~/.cloudcode/ directory missing — run `cloudcode init`");
    }

    // Check CLI tools
    let registry = adapters::registry();
    for adapter in registry.adapters() {
        match adapter.detect_installation() {
            Ok(Some(info)) => {
                println!(
                    "[OK] {} v{} at {}",
                    adapter.display_name(),
                    info.version,
                    info.path.display()
                );
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
