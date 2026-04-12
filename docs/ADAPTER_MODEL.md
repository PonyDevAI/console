# CLI Adapter Model

CloudCode uses CLI adapters to normalize interactions with different AI coding CLI tools.

## Why adapters

Each CLI has unique installation methods, config file formats, config file paths, and invocation patterns. Adapters isolate these differences so CloudCode's core services operate on a unified model.

## Supported CLI tools

| CLI | Config format | Config path |
|-----|--------------|-------------|
| Claude CLI | JSON | `~/.claude/settings.json`, `~/.claude.json` |
| Codex CLI | TOML | `~/.codex/config.toml` |
| Gemini CLI | JSON | `~/.gemini/settings.json` |
| Cursor CLI | JSON | `~/.cursor/` (various files) |

New CLIs can be added by implementing the adapter trait.

## Adapter trait (Rust)

```rust
trait CliAdapter: Send + Sync {
    /// Adapter identity
    fn name(&self) -> &str;
    fn display_name(&self) -> &str;

    /// Version management
    fn detect_installation(&self) -> Result<Option<InstalledInfo>>;
    fn check_remote_version(&self) -> Result<Option<String>>;
    fn install(&self) -> Result<()>;
    fn upgrade(&self) -> Result<()>;
    fn uninstall(&self) -> Result<()>;

    /// Config paths
    fn config_paths(&self) -> ConfigPaths;

    /// Provider config sync
    fn read_provider_config(&self) -> Result<ProviderConfig>;
    fn write_provider_config(&self, config: &ProviderConfig) -> Result<()>;

    /// MCP config sync
    fn read_mcp_config(&self) -> Result<McpConfig>;
    fn write_mcp_config(&self, config: &McpConfig) -> Result<()>;

    /// Skills sync
    fn read_skills(&self) -> Result<Vec<Skill>>;
    fn sync_skills(&self, skills: &[Skill]) -> Result<()>;
    fn skills_dir(&self) -> Option<PathBuf>;

    /// Prompt sync
    fn read_prompt(&self) -> Result<Option<String>>;
    fn write_prompt(&self, content: &str) -> Result<()>;
    fn prompt_filename(&self) -> &str;
}
```

## Adapter responsibilities

- Detect whether the CLI is installed and its version.
- Know where the CLI's config files live and their format.
- Read/write provider, MCP, skill, and prompt configs in native format.
- Support installation, upgrade, and uninstall operations.
- Return structured errors with category, CLI name, likely cause, and suggested remediation.

## Config sync flow

```
CloudCode unified config
        |
        v
  Sync Engine
        |
   +---------+---------+---------+
   |         |         |         |
   v         v         v         v
 Claude    Codex    Gemini    Cursor
 adapter   adapter  adapter   adapter
   |         |         |         |
   v         v         v         v
 ~/.claude  ~/.codex  ~/.gemini  ~/.cursor
```

## Security

- Credentials are stored under `~/.console/credentials/`, not in adapter config files.
- Adapters write API key references, not raw keys, into CLI configs where possible.
- Minimize secret exposure in logs and events.
