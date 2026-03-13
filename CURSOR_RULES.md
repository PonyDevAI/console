# CURSOR_RULES.md

This repository uses `AGENTS.md` as the canonical engineering guide.

## Rule source

- Follow `AGENTS.md` for project identity, architecture, storage, adapter model, UI model, coding rules, and scope limits.
- If this file and `AGENTS.md` ever conflict, `AGENTS.md` wins.

## Cursor-specific note

- Keep changes small, explicit, and aligned with the local-first management-platform direction described in `AGENTS.md`.
- Backend is Rust (axum). Frontend is Vite + React + Tailwind.
