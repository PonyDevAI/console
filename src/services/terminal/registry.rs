use std::sync::Arc;
use anyhow::{Result, anyhow};

use super::backend::TerminalBackend;
use super::models::{BackendKind, BackendInfo, BackendsResponse};
use super::backends::{TmuxBackend, PtyBackend, ScreenBackend, ZellijBackend};

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
        let available = self.backends.iter().map(|b| {
            BackendInfo {
                kind: b.kind().as_str().to_string(),
                persistence: b.persistence().as_str().to_string(),
                available: b.is_available(),
            }
        }).collect();

        let default_backend = self.find_default_backend()
            .map(|b| b.kind().as_str().to_string())
            .unwrap_or_else(|| "pty".to_string());

        BackendsResponse {
            available,
            default_backend,
        }
    }

    pub fn find_default_backend(&self) -> Option<Arc<dyn TerminalBackend>> {
        // Priority: tmux > screen > zellij > pty
        for kind in [BackendKind::Tmux, BackendKind::Screen, BackendKind::Zellij, BackendKind::Pty] {
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
            None | Some("auto") => {
                self.find_default_backend()
                    .ok_or_else(|| anyhow!("No available terminal backend"))
            }
            Some(spec) => {
                let kind = BackendKind::from_str(spec)
                    .ok_or_else(|| anyhow!("Unknown backend: {}", spec))?;
                
                let backend = self.find_backend(kind)
                    .ok_or_else(|| anyhow!("Backend {} not found", spec))?;

                if !backend.is_available() {
                    return Err(anyhow!("Backend {} is not available on this system", spec));
                }

                Ok(backend)
            }
        }
    }

    pub fn is_backend_available(&self, kind: BackendKind) -> bool {
        self.find_backend(kind).map(|b| b.is_available()).unwrap_or(false)
    }
}

impl Default for BackendRegistry {
    fn default() -> Self {
        Self::new()
    }
}