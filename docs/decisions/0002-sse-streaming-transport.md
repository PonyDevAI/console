# ADR 0002: Use SSE for default run-output streaming

## Status
Accepted

## Context
The core UX requires streaming worker output to the web UI with low complexity and good browser compatibility.

## Decision
Use Server-Sent Events (SSE) as the default transport for streaming run output from the backend control plane to the frontend.

## Consequences
- Simplifies one-way streaming from server to client.
- Reduces protocol complexity compared with introducing a bi-directional transport early.
- May require revisiting if future features need high-frequency client-to-server signaling over the same channel.
