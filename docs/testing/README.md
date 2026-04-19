# Testing Docs

This directory is the **canonical testing entrypoint** for CloudCode.

## Rule

Testing is defined by these documents first.
Commands, helper scripts, CI jobs, and historical notes support execution, but they are **not** the testing truth by themselves.

## Document Priority

1. `docs/testing/test-strategy.md`
2. `docs/testing/local-validation-spec.md`
3. `docs/testing/adapter-validation-spec.md`
4. `docs/testing/config-sync-validation-spec.md`
5. `docs/testing/script-surface.md`
6. `docs/testing/validation-report-template.md`

## Usage

- Use `test-strategy.md` to decide which validation layer is required.
- Use `local-validation-spec.md` for deterministic local checks.
- Use `adapter-validation-spec.md` when changing CLI detection, install/upgrade, or adapter behavior.
- Use `config-sync-validation-spec.md` when changing provider/MCP/skill/prompt sync behavior.
- Use `script-surface.md` to understand which commands are canonical entrypoints and what they do not prove.
- Use `validation-report-template.md` for change summaries that claim validation.

## Historical Material

Ad hoc commands, one-off scripts, and prior reports are references only.
They do not replace the active testing specs in this directory.
