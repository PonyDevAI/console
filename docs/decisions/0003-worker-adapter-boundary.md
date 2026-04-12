# ADR 0003: Isolate worker CLIs behind a shared adapter contract

## Status
Accepted

## Context
CloudCode must support multiple local worker CLIs (Cursor, Claude, Codex) without coupling control-plane logic to a single tool.

## Decision
Define and enforce a shared worker adapter contract. Core control-plane logic depends only on the adapter interface, while worker-specific invocation details remain inside each adapter implementation.

## Consequences
- Enables adding/replacing workers without modifying core routing/session logic.
- Keeps control-plane and execution-plane responsibilities explicit.
- Introduces a need for normalized run/event models that all adapters map into.
