use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tokio::sync::broadcast;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Task {
    pub id: String,
    pub action: String,
    pub target: String,
    pub status: TaskStatus,
    pub message: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum TaskStatus {
    Pending,
    Running,
    Completed,
    Failed,
}

#[derive(Debug, Clone, Serialize)]
pub struct TaskEvent {
    pub task: Task,
}

pub struct TaskQueue {
    tasks: Mutex<HashMap<String, Task>>,
    tx: broadcast::Sender<TaskEvent>,
}

impl TaskQueue {
    pub fn new() -> Arc<Self> {
        let (tx, _) = broadcast::channel(64);
        Arc::new(Self {
            tasks: Mutex::new(HashMap::new()),
            tx,
        })
    }

    pub fn submit(&self, action: &str, target: &str) -> Task {
        let now = chrono::Utc::now().to_rfc3339();
        let task = Task {
            id: Uuid::new_v4().to_string(),
            action: action.to_string(),
            target: target.to_string(),
            status: TaskStatus::Pending,
            message: None,
            created_at: now.clone(),
            updated_at: now,
        };
        self.tasks
            .lock()
            .unwrap()
            .insert(task.id.clone(), task.clone());
        let _ = self.tx.send(TaskEvent { task: task.clone() });
        task
    }

    pub fn update_status(&self, id: &str, status: TaskStatus, message: Option<String>) {
        let mut tasks = self.tasks.lock().unwrap();
        if let Some(task) = tasks.get_mut(id) {
            task.status = status;
            task.message = message;
            task.updated_at = chrono::Utc::now().to_rfc3339();
            let _ = self.tx.send(TaskEvent { task: task.clone() });
        }
    }

    pub fn get(&self, id: &str) -> Option<Task> {
        self.tasks.lock().unwrap().get(id).cloned()
    }

    pub fn list(&self) -> Vec<Task> {
        let tasks = self.tasks.lock().unwrap();
        let mut list: Vec<Task> = tasks.values().cloned().collect();
        list.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        list
    }

    pub fn subscribe(&self) -> broadcast::Receiver<TaskEvent> {
        self.tx.subscribe()
    }

    /// Remove completed/failed tasks older than the given duration.
    pub fn cleanup(&self, max_age: std::time::Duration) {
        let cutoff = chrono::Utc::now() - chrono::Duration::from_std(max_age).unwrap_or_default();
        let cutoff_str = cutoff.to_rfc3339();
        let mut tasks = self.tasks.lock().unwrap();
        tasks.retain(|_, t| {
            t.status == TaskStatus::Pending
                || t.status == TaskStatus::Running
                || t.updated_at > cutoff_str
        });
    }
}
