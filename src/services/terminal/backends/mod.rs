pub mod tmux;
pub mod pty;
pub mod screen;
pub mod zellij;
pub mod ssh;

pub use tmux::TmuxBackend;
pub use pty::PtyBackend;
pub use screen::ScreenBackend;
pub use zellij::ZellijBackend;
pub use ssh::{SshConnection, SshTmuxBackend, SshScreenBackend, SshPtyBackend};