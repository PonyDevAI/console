# Android Shell

This directory is the reserved Android application surface for CloudCode.

Current status:

- scaffold placeholder only
- no Android runtime chosen yet
- expected future contents: native shell, app bootstrap, platform bridge

Current rule:

- keep Android UI independent from `apps/web/` and `apps/desktop/`
- share contracts and lower Rust/core logic before considering shared UI
