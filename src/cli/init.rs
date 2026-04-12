use crate::storage;

pub async fn run() -> anyhow::Result<()> {
    let paths = storage::ConsolePaths::default();
    paths.ensure_dirs()?;
    paths.init_default_files()?;
    tracing::info!("Initialized ~/.console/ directory structure");
    println!("CloudCode initialized at {}", paths.root.display());
    Ok(())
}
