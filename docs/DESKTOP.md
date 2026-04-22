# Desktop Shell

## Purpose

`apps/desktop/` is the dedicated desktop application surface for CloudCode.

It exists to support:

- native windowing and menu behavior
- future tray and host integration
- desktop-specific interaction flows
- a Rust shell that stays separate from the HTTP server process

## Current boundary

The desktop stack is intentionally split:

- `apps/desktop/src/` is the desktop UI
- `apps/desktop/src-tauri/` is the desktop Rust shell

This UI is intentionally independent from `apps/web/`.
The current rule is:

- do not share page components between web and desktop
- do not treat desktop as a visual clone of the browser dashboard
- share only lower-level contracts and Rust logic when justified

## Relationship to server

`apps/server/` and `apps/desktop/src-tauri/` are separate application shells.

They may share lower crates over time, but:

- desktop should not embed the server route layer
- desktop should not depend on HTTP as its only local integration mechanism
- server remains the browser-facing management API surface

## Current status

Current desktop implementation now includes a first mock UI shell:

- independent React/Vite frontend exists
- Tauri shell exists
- desktop-specific layout and navigation exist
- mock pages exist for Overview, Agent Sources, Providers, MCP, and Settings
- no real data wiring is in place yet

## Development commands

Use the root helpers:

```bash
make init
make desk
```

`make desk` is the canonical desktop dev entrypoint.
On a fresh checkout, run `make init` first so the desktop app dependencies are installed.
`make android` and `make ios` are reserved mobile targets and currently fail until those app shells are scaffolded.

## Build version label

The desktop sidebar footer shows a build label sourced from `VITE_CLOUDCODE_BUILD_VERSION`.

- local development defaults to `Dev`
- CI for development builds should inject a commit ref
- CI for release builds should inject the release tag

Example:

```bash
VITE_CLOUDCODE_BUILD_VERSION="$GITHUB_SHA" pnpm --dir apps/desktop build
```

These are development helpers only.
Validation claims still follow `docs/testing/`.

## macOS window controls

On macOS, the desktop shell now installs the sidebar collapse/expand control as a
native titlebar accessory from the Rust/Tauri layer instead of positioning it in
the web content area.

This keeps the control in the same native window-control band as the traffic
lights and avoids frontend layout drift inside the content surface.
