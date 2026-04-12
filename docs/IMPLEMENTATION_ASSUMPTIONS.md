# Implementation Assumptions and Ambiguities

This file records assumptions made for early implementation and questions that should be confirmed before deeper build-out.

## Assumptions
- A single local CloudCode daemon process is sufficient for initial management and coordination.
- Worker CLIs are installed and available on PATH for the local user running CloudCode.
- File-based state in `~/.console/` is acceptable for initial reliability and recovery expectations.
- Each CLI tool has a known config directory and file format that the adapter can read/write.
- CloudCode's config sync engine is the primary way to push unified config to CLI tools.

## Ambiguities to review
1. **Adapter config format details**
   - Exact JSON/TOML field mappings for each CLI's provider, MCP, and skill config need validation against real CLI versions.
2. **Credential handling boundaries**
   - Which secrets are stored by CloudCode versus delegated to worker CLIs needs a clear policy.
3. **Sync conflict resolution**
   - When a CLI's config is modified externally, the merge/overwrite strategy is not yet defined.
4. **Version detection reliability**
   - `--version` flag output format varies across CLI tools and versions; parsing needs to be robust.
5. **Skill sync method**
   - Symlink vs copy trade-offs for cross-platform compatibility (especially Windows) need testing.
