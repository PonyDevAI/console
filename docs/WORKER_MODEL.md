# Worker Adapter Model

Console uses worker adapters to normalize interactions with local AI coding CLIs.

## Why adapters

Each CLI has unique invocation patterns, flags, output formats, and authentication expectations.
Adapters isolate these differences so the rest of Console can operate on a common run model.

## Initial worker targets

- Cursor CLI
- Claude CLI
- Codex CLI

These are treated as independent backends that implement a shared adapter contract.

## Adapter responsibilities

- Detect whether the worker CLI is installed and callable.
- Identify basic capabilities (version/features where available).
- Build worker-specific command invocations from normalized run requests.
- Execute the worker process in the correct repository context.
- Stream output events back in a normalized format.
- Return terminal status and artifact references.

## Normalized run request (conceptual)

A run request should include at least:
- Workspace reference.
- Repository path/reference.
- Worker identity.
- User prompt/instructions.
- Optional execution settings (timeouts, approval mode, etc.).

## Normalized run events (conceptual)

Adapters should emit consistent event types such as:
- `run.started`
- `run.output`
- `run.warning`
- `run.error`
- `run.completed`

The control plane forwards these to the web UI stream.

## Failure and compatibility model

Common failure classes:
- CLI not installed.
- CLI authentication/credential issue.
- Unsupported flags/version mismatch.
- Process execution failure.

Adapters should return structured errors with:
- category,
- worker name,
- likely cause,
- suggested remediation.

## Security and credentials

- Credentials are local and stored under `~/.console/credentials/`.
- Adapters should minimize secret exposure in logs/events.
- Console should avoid embedding credentials in plain command traces.
