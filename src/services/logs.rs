use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::sync::{Mutex, MutexGuard};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub id: String,
    pub timestamp: DateTime<Utc>,
    pub level: String,
    pub source: String,
    pub message: String,
}

static LOG_BUFFER: Mutex<Option<VecDeque<LogEntry>>> = Mutex::new(None);

const MAX_LOGS: usize = 500;

fn buffer() -> MutexGuard<'static, Option<VecDeque<LogEntry>>> {
    LOG_BUFFER.lock().expect("log buffer mutex poisoned")
}

pub fn push(level: &str, source: &str, message: &str) {
    let entry = LogEntry {
        id: uuid::Uuid::new_v4().to_string(),
        timestamp: Utc::now(),
        level: level.to_string(),
        source: source.to_string(),
        message: message.to_string(),
    };

    let mut buf = buffer();
    let deque = buf.get_or_insert_with(VecDeque::new);
    if deque.len() >= MAX_LOGS {
        deque.pop_front();
    }
    deque.push_back(entry);
}

pub fn list(level: Option<&str>, source: Option<&str>, limit: Option<usize>) -> Vec<LogEntry> {
    let buf = buffer();
    let deque = match buf.as_ref() {
        Some(d) => d,
        None => return vec![],
    };

    let mut result: Vec<LogEntry> = deque
        .iter()
        .filter(|e| level.is_none_or(|l| e.level == l))
        .filter(|e| source.is_none_or(|s| e.source == s))
        .cloned()
        .collect();

    result.reverse();
    if let Some(lim) = limit {
        result.truncate(lim);
    }
    result
}

pub fn init_startup_logs() {
    push("info", "daemon", "Console daemon started");
    push("info", "scanner", "CLI tool scan initiated");
}
