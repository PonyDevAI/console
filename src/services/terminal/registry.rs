use anyhow::{anyhow, Result};
use std::sync::Arc;

use super::backend::TerminalBackend;
use super::backends::{PtyBackend, ScreenBackend, TmuxBackend, ZellijBackend};
use super::models::{BackendInfo, BackendKind, BackendsResponse};

pub struct BackendRegistry {
    backends: Vec<Arc<dyn TerminalBackend>>,
}

impl BackendRegistry {
    pub fn new() -> Self {
        let backends: Vec<Arc<dyn TerminalBackend>> = vec![
            Arc::new(TmuxBackend::new()),
            Arc::new(ZellijBackend::new()),
            Arc::new(ScreenBackend::new()),
            Arc::new(PtyBackend::new()),
        ];
        Self { backends }
    }

    pub fn get_backends_response(&self) -> BackendsResponse {
        let available = self
            .backends
            .iter()
            .map(|b| BackendInfo {
                kind: b.kind().as_str().to_string(),
                persistence: b.persistence().as_str().to_string(),
                available: b.is_available(),
            })
            .collect();

        let default_backend = self
            .find_default_backend()
            .map(|b| b.kind().as_str().to_string())
            .unwrap_or_else(|| "pty".to_string());

        BackendsResponse {
            available,
            default_backend,
        }
    }

    pub fn find_default_backend(&self) -> Option<Arc<dyn TerminalBackend>> {
        // Generic/remote-facing auto priority: tmux > screen > pty.
        // zellij remains explicit-only until its backend is implemented end-to-end.
        for kind in [BackendKind::Tmux, BackendKind::Screen, BackendKind::Pty] {
            if let Some(backend) = self.find_backend(kind) {
                if backend.is_available() {
                    return Some(backend);
                }
            }
        }
        None
    }

    pub fn find_default_local_backend(&self) -> Option<Arc<dyn TerminalBackend>> {
        // Desktop-local priority intentionally prefers pty over screen.
        // On macOS desktop, detached screen sessions do not integrate reliably
        // with our attach/resize model and can reopen with unstable viewport
        // placement. Keep screen as an explicit/compatibility backend instead
        // of the default local auto path.
        for kind in [BackendKind::Tmux, BackendKind::Pty, BackendKind::Screen] {
            if let Some(backend) = self.find_backend(kind) {
                if backend.is_available() {
                    return Some(backend);
                }
            }
        }
        None
    }

    pub fn find_backend(&self, kind: BackendKind) -> Option<Arc<dyn TerminalBackend>> {
        self.backends.iter().find(|b| b.kind() == kind).cloned()
    }

    pub fn resolve_backend(&self, backend_spec: Option<&str>) -> Result<Arc<dyn TerminalBackend>> {
        match backend_spec {
            None | Some("auto") => self
                .find_default_backend()
                .ok_or_else(|| anyhow!("No available terminal backend")),
            Some(spec) => {
                let kind = BackendKind::from_str(spec)
                    .ok_or_else(|| anyhow!("Unknown backend: {}", spec))?;

                let backend = self
                    .find_backend(kind)
                    .ok_or_else(|| anyhow!("Backend {} not found", spec))?;

                if !backend.is_available() {
                    return Err(anyhow!("Backend {} is not available on this system", spec));
                }

                Ok(backend)
            }
        }
    }

    pub fn resolve_local_backend(
        &self,
        backend_spec: Option<&str>,
    ) -> Result<Arc<dyn TerminalBackend>> {
        match backend_spec {
            None | Some("auto") => self
                .find_default_local_backend()
                .ok_or_else(|| anyhow!("No available terminal backend")),
            Some(spec) => self.resolve_backend(Some(spec)),
        }
    }

    pub fn is_backend_available(&self, kind: BackendKind) -> bool {
        self.find_backend(kind)
            .map(|b| b.is_available())
            .unwrap_or(false)
    }
}

impl Default for BackendRegistry {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::terminal::models::{AttachBridgeComponents, Persistence, TerminalSessionMeta};

    struct FakeBackend {
        kind: BackendKind,
        available: bool,
    }

    impl TerminalBackend for FakeBackend {
        fn kind(&self) -> BackendKind {
            self.kind
        }

        fn persistence(&self) -> Persistence {
            match self.kind {
                BackendKind::Pty => Persistence::Ephemeral,
                _ => Persistence::Persistent,
            }
        }

        fn is_available(&self) -> bool {
            self.available
        }

        fn create_session(
            &self,
            _id: &str,
            _cwd: Option<&str>,
            _shell: Option<&str>,
            _cols: u16,
            _rows: u16,
        ) -> Result<TerminalSessionMeta> {
            anyhow::bail!("not needed in test")
        }

        fn terminate_session(&self, _session_name: &str) -> Result<()> {
            anyhow::bail!("not needed in test")
        }

        fn resize_session(&self, _session_name: &str, _cols: u16, _rows: u16) -> Result<()> {
            anyhow::bail!("not needed in test")
        }

        fn sync_status(&self, _session_name: &str) -> Result<String> {
            anyhow::bail!("not needed in test")
        }

        fn spawn_attach_bridge(
            &self,
            _session_name: &str,
            _cwd: Option<&str>,
            _shell: Option<&str>,
            _cols: u16,
            _rows: u16,
        ) -> Result<AttachBridgeComponents> {
            anyhow::bail!("not needed in test")
        }
    }

    #[test]
    fn auto_priority_skips_unimplemented_zellij() {
        let registry = BackendRegistry {
            backends: vec![
                Arc::new(FakeBackend {
                    kind: BackendKind::Tmux,
                    available: false,
                }),
                Arc::new(FakeBackend {
                    kind: BackendKind::Zellij,
                    available: true,
                }),
                Arc::new(FakeBackend {
                    kind: BackendKind::Screen,
                    available: false,
                }),
                Arc::new(FakeBackend {
                    kind: BackendKind::Pty,
                    available: true,
                }),
            ],
        };

        let backend = registry.find_default_backend().expect("default backend");
        assert_eq!(backend.kind(), BackendKind::Pty);
    }

    #[test]
    fn auto_priority_prefers_screen_before_pty() {
        let registry = BackendRegistry {
            backends: vec![
                Arc::new(FakeBackend {
                    kind: BackendKind::Tmux,
                    available: false,
                }),
                Arc::new(FakeBackend {
                    kind: BackendKind::Screen,
                    available: true,
                }),
                Arc::new(FakeBackend {
                    kind: BackendKind::Pty,
                    available: true,
                }),
            ],
        };

        let backend = registry.find_default_backend().expect("default backend");
        assert_eq!(backend.kind(), BackendKind::Screen);
    }

    #[test]
    fn local_auto_priority_prefers_pty_before_screen() {
        let registry = BackendRegistry {
            backends: vec![
                Arc::new(FakeBackend {
                    kind: BackendKind::Tmux,
                    available: false,
                }),
                Arc::new(FakeBackend {
                    kind: BackendKind::Screen,
                    available: true,
                }),
                Arc::new(FakeBackend {
                    kind: BackendKind::Pty,
                    available: true,
                }),
            ],
        };

        let backend = registry
            .find_default_local_backend()
            .expect("default local backend");
        assert_eq!(backend.kind(), BackendKind::Pty);
    }
}
