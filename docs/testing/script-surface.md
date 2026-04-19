# Script And Command Surface

## Goal

Document which command surfaces are part of the repository's standard workflow and what they are **not** allowed to represent.

## Rule

Commands and helper scripts execute validation steps.
They do **not** define the validation standard by themselves.

Canonical testing truth lives in:

- `docs/testing/test-strategy.md`
- `docs/testing/local-validation-spec.md`
- `docs/testing/adapter-validation-spec.md`
- `docs/testing/config-sync-validation-spec.md`
- `docs/testing/validation-report-template.md`

## 1. Canonical Command Surface

These commands are part of the standard repo workflow:

- `make init`
- `make dev`
- `make run`
- `make build`
- `make check`
- `make test`
- `make verify-local`
- `make doctor`
- `make scan`

## 2. What These Commands Mean

- `make check`: static validation only
- `make test`: unit and narrow integration execution only
- `make verify-local`: convenience entrypoint for the local validation layer
- `make doctor`: environment diagnostics only
- `make scan`: installed CLI discovery only

## 3. What These Commands Do Not Prove

- adapter correctness against a real host CLI
- native config compatibility by themselves
- complete end-to-end validation by themselves

## 4. Current Helper Script Surface

Current repo-level helper script surface is intentionally small:

- `install.sh`: installation/bootstrap helper, not a testing spec

If temporary scripts are added later:

- they must not silently become canonical test entrypoints
- they should be documented here if intentionally retained
- their proof boundary must be described explicitly
