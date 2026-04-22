pub mod backend;
pub mod backends;
pub mod models;
pub mod registry;
pub mod service;

pub use backend::TerminalBackend;
pub use models::*;
pub use registry::BackendRegistry;
pub use service::TerminalService;
