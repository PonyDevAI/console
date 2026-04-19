# Mobile Surfaces

## Purpose

CloudCode reserves separate mobile application surfaces under `apps/mobile/`.

Current target layout:

- `apps/mobile/android/`
- `apps/mobile/ios/`

## Current status

Mobile is not implemented yet.
These directories exist to lock the repo structure before the mobile runtime choice is finalized.

At this stage:

- no Android shell is wired
- no iOS shell is wired
- no shared mobile UI layer exists

## Boundary rules

Mobile should follow the same separation rule as desktop:

- keep mobile UI independent from `apps/web/`
- keep mobile UI independent from `apps/desktop/`
- share contracts and lower Rust/core logic first
- delay shared UI libraries until real overlap is proven

## Command surface

Use the root entrypoints:

```bash
make android
make ios
```

At the current stage, these commands confirm the reserved app paths and print the next expected implementation path.
