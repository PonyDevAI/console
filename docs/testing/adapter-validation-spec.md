# Adapter Validation Spec

## Goal

Validate changes that affect CLI adapter behavior against real host tooling whenever the host environment allows it.

## Applies To

- `src/adapters/*`
- `src/services/version.rs`
- `src/services/agent_source.rs`
- install / upgrade / uninstall / scan / test flows
- model detection and native config path assumptions

## Required Questions

For any adapter-facing change, answer the relevant questions explicitly:

1. Does detection still work against a real installed CLI?
2. Is version parsing based on real command output?
3. Are config paths correct for the target CLI?
4. If CloudCode writes native config, can the target CLI still read it?
5. If CloudCode reads native config, does the UI/API reflect the actual native state?

## Validation Layers

### A. Static / Unit

Required:

- relevant compile and test coverage
- parser or mapping tests when behavior is encoded in string parsing or config translation

### B. Local Service Validation

Required when API or state transitions changed:

- verify the affected backend route or service locally
- verify persisted state in CloudCode-owned files if relevant

### C. Real Host CLI Validation

Required when the claim depends on the external CLI:

- run the real detection command through CloudCode or the documented helper flow
- record the actual installed path/version/model evidence
- confirm any native file writes landed in the correct target path
- verify read-back through CloudCode after the native config change

## Not Allowed

- claiming adapter correctness from typecheck alone
- claiming install/upgrade correctness without host evidence
- treating a mocked CLI response as proof of real compatibility

## Reporting Rule

Always record:

- affected CLI(s)
- host evidence collected
- config paths touched
- what was not validated because the host tool was unavailable
