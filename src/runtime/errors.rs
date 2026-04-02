use thiserror::Error;

#[derive(Debug, Error)]
pub enum RuntimeError {
    #[error("Adapter not found: {0}")]
    AdapterNotFound(String),

    #[error("Adapter unavailable: {0}")]
    AdapterUnavailable(String),

    #[error("Workspace denied: {0}")]
    WorkspaceDenied(String),

    #[error("Invalid request: {0}")]
    InvalidRequest(String),

    #[error("Process failed: {0}")]
    ProcessFailed(String),

    #[error("Stream broken: {0}")]
    StreamBroken(String),

    #[error("Cancelled")]
    Cancelled,

    #[error("Timeout")]
    Timeout,

    #[error("Internal error: {0}")]
    InternalError(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

pub type Result<T> = std::result::Result<T, RuntimeError>;
