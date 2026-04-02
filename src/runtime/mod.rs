//! Agent Runtime subsystem
//! 
//! This module provides the execution plane for running AI agent CLIs.
//! It is separate from the management plane (`src/adapters/`).

pub mod models;
pub mod errors;
pub mod registry;
pub mod manager;
pub mod gateway;
pub mod adapters;
pub mod stream;

pub use models::{RuntimeEvent, ThreadEvent, *};
// These are re-exported for completeness even if not used in all crates
#[allow(unused_imports)]
pub use errors::{RuntimeError, Result};
pub use registry::{RuntimeAdapter, RunHandle, CancelHandle};
pub use manager::RuntimeManager;
pub use gateway::RuntimeGateway;
