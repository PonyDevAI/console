use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use tokio::sync::broadcast;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum SessionEvent {
    MessageCreated {
        message_id: String,
        author_label: String,
        author_id: Option<String>,
        kind: String,
        role: String,
        content: String,
        mentions: Vec<String>,
        created_at: String,
    },
    MessageDelta {
        message_id: String,
        delta: String,
    },
    MessageDone {
        message_id: String,
        content: String,
    },
    MessageError {
        message_id: String,
        error: String,
    },
    ProposalUpdated {
        proposal_id: String,
        status: String,
    },
}

type Tx = broadcast::Sender<SessionEvent>;

#[derive(Default)]
pub struct SessionStreamRegistry {
    channels: RwLock<HashMap<String, Tx>>,
}

impl SessionStreamRegistry {
    pub fn get_or_create(&self, session_id: &str) -> Tx {
        let mut map = self.channels.write().unwrap();
        if let Some(tx) = map.get(session_id) {
            return tx.clone();
        }
        let (tx, _) = broadcast::channel(256);
        map.insert(session_id.to_string(), tx.clone());
        tx
    }

    pub fn subscribe(&self, session_id: &str) -> broadcast::Receiver<SessionEvent> {
        self.get_or_create(session_id).subscribe()
    }

    pub fn publish(&self, session_id: &str, event: SessionEvent) {
        let tx = self.get_or_create(session_id);
        let _ = tx.send(event);
    }
}

pub type SharedSessionRegistry = Arc<SessionStreamRegistry>;

pub fn new_registry() -> SharedSessionRegistry {
    Arc::new(SessionStreamRegistry::default())
}
