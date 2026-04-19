# Config Sync Validation Spec

## Goal

Validate CloudCode's core differentiator: unified config translated into native CLI config files.

## Applies To

- `src/sync/*`
- provider, MCP, skill, and prompt sync behavior
- reverse import or read-back behavior
- conflict detection or merge semantics
- docs that define native config mapping behavior

## Required Questions

1. What unified config changed?
2. Which native config files are affected?
3. Is the write mapping correct?
4. Can CloudCode read back the written state correctly?
5. Does the target CLI remain usable after the sync?
6. If conflict handling changed, is the new rule documented?

## Required Validation

### A. Static Validation

- compile/typecheck
- relevant narrow tests for mapping logic

### B. Local Validation

- exercise the changed sync path locally
- inspect the resulting CloudCode-owned state and generated native config output
- verify API/UI reflects the updated state

### C. Real Host Validation

When the claim depends on actual CLI-native compatibility:

- sync to a real CLI config location
- inspect the generated native file
- run the target CLI or a real read-back path when feasible
- confirm CloudCode can import or read the resulting state

## Hard Rules

1. Config sync claims must identify the native files touched.
2. If sync semantics changed, the corresponding docs must change in the same PR.
3. Helper commands can execute the flow, but the spec defines what evidence is required.

## Reporting Rule

Always record:

- changed config domains
- native files touched
- read-back result
- host CLI verification result
- remaining gaps
