use crate::storage;

pub async fn run() -> anyhow::Result<()> {
    let paths = storage::CloudCodePaths::default();
    paths.ensure_dirs()?;
    paths.init_default_files()?;
    tracing::info!("Initialized ~/.cloudcode/ directory structure");
    println!("CloudCode initialized at {}", paths.root.display());
    Ok(())
}
