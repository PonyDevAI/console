# iOS Shell

This directory is the reserved iOS application surface for CloudCode.

Current status:

- scaffold placeholder only
- no iOS runtime chosen yet
- expected future contents: native shell, app bootstrap, platform bridge

Current rule:

- keep iOS UI independent from `apps/web/` and `apps/desktop/`
- share contracts and lower Rust/core logic before considering shared UI
