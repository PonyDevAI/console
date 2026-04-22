//! Agent Runtime subsystem
//!
//! This module provides the execution plane for running AI agent CLIs.
//! It is separate from the management plane (`src/adapters/`).

pub mod adapters;
pub mod errors;
pub mod gateway;
pub mod manager;
pub mod models;
pub mod registry;
pub mod stream;

pub use models::{RuntimeEvent, ThreadEvent, *};
// These are re-exported for completeness even if not used in all crates
#[allow(unused_imports)]
pub use errors::{Result, RuntimeError};
pub use gateway::RuntimeGateway;
pub use manager::RuntimeManager;
pub use registry::{CancelHandle, RunHandle, RuntimeAdapter};
