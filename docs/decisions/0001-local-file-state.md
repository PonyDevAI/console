# ADR 0001: Local file-based state under `~/.console/`

## Status
Accepted

## Context
Console is currently focused on single-machine operation, fast iteration, and clear local ownership of data.

## Decision
Use file-based config and state storage under `~/.console/` as the default persistence model for the initial implementation.

## Consequences
- Keeps early implementation simple and inspectable.
- Avoids premature database schema work before concrete query requirements are known.
- Requires explicit migration planning if/when SQLite is introduced later.
