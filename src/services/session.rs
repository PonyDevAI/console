use anyhow::Result;
use chrono::Utc;
use std::fs;
use std::sync::Mutex;
use crate::models::{Session, SessionMeta, SessionMessage, SessionParticipant};
use crate::storage::{ConsolePaths, read_json, write_json};

static MESSAGES_LOCK: Mutex<()> = Mutex::new(());

fn load_meta() -> Result<SessionMeta> {
    let paths = ConsolePaths::default();
    read_json(&paths.session_meta_file()).or_else(|_| Ok(SessionMeta::default()))
}

fn save_meta(meta: &SessionMeta) -> Result<()> {
    let paths = ConsolePaths::default();
    write_json(&paths.session_meta_file(), meta)
}

pub fn list() -> Result<Vec<Session>> {
    let mut meta = load_meta()?;
    meta.sessions.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    Ok(meta.sessions)
}

pub async fn create(title: &str, participant_ids: &[String]) -> Result<Session> {
    let paths = ConsolePaths::default();

    let employees = crate::services::employee::list().await?;
    let participants: Vec<SessionParticipant> = participant_ids.iter()
        .filter_map(|id| employees.iter().find(|e| e.id == *id))
        .map(|e| SessionParticipant {
            employee_id: e.id.clone(),
            display_name: e.display_name.clone(),
            avatar_color: e.avatar_color.clone(),
        })
        .collect();

    let session = Session {
        id: uuid::Uuid::new_v4().to_string(),
        title: title.to_string(),
        participants,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };

    let session_dir = paths.session_dir(&session.id);
    fs::create_dir_all(&session_dir)?;
    write_json(&paths.session_messages_file(&session.id), &Vec::<SessionMessage>::new())?;

    let mut meta = load_meta()?;
    meta.sessions.push(session.clone());
    save_meta(&meta)?;

    let system_msg = SessionMessage {
        id: uuid::Uuid::new_v4().to_string(),
        session_id: session.id.clone(),
        kind: crate::models::MessageKind::System,
        role: crate::models::MessageRole::User,
        author_id: None,
        author_label: "System".to_string(),
        content: format!("协作空间已创建，参与者：{}",
            session.participants.iter().map(|p| p.display_name.as_str()).collect::<Vec<_>>().join(","),
        ),
        mentions: vec![],
        created_at: Utc::now(),
    };
    append_message(&session.id, system_msg)?;

    Ok(session)
}

pub fn get(id: &str) -> Result<Session> {
    let meta = load_meta()?;
    meta.sessions.into_iter().find(|s| s.id == id)
        .ok_or_else(|| anyhow::anyhow!("Session not found"))
}

pub fn delete(id: &str) -> Result<()> {
    let paths = ConsolePaths::default();
    let mut meta = load_meta()?;
    meta.sessions.retain(|s| s.id != id);
    save_meta(&meta)?;
    let dir = paths.session_dir(id);
    if dir.exists() { fs::remove_dir_all(dir)?; }
    Ok(())
}

pub fn list_messages(session_id: &str) -> Result<Vec<SessionMessage>> {
    let paths = ConsolePaths::default();
    let path = paths.session_messages_file(session_id);
    if !path.exists() { return Ok(vec![]); }
    read_json(&path)
}

pub fn append_message(session_id: &str, msg: SessionMessage) -> Result<()> {
    let _guard = MESSAGES_LOCK.lock().unwrap();
    let paths = ConsolePaths::default();
    let path = paths.session_messages_file(session_id);
    let mut messages: Vec<SessionMessage> = if path.exists() {
        read_json(&path).unwrap_or_default()
    } else { vec![] };
    messages.push(msg);
    write_json(&path, &messages)?;

    let mut meta = load_meta()?;
    if let Some(s) = meta.sessions.iter_mut().find(|s| s.id == session_id) {
        s.updated_at = Utc::now();
    }
    save_meta(&meta)?;
    Ok(())
}

pub async fn update_participants(id: &str, add: &[String], remove: &[String]) -> Result<Session> {
    let employees = crate::services::employee::list().await?;
    let mut meta = load_meta()?;
    let session = meta.sessions.iter_mut().find(|s| s.id == id)
        .ok_or_else(|| anyhow::anyhow!("Session not found"))?;

    // remove
    session.participants.retain(|p| !remove.contains(&p.employee_id));

    // add (dedup)
    for emp_id in add {
        if session.participants.iter().any(|p| p.employee_id == *emp_id) { continue; }
        if let Some(e) = employees.iter().find(|e| e.id == *emp_id) {
            session.participants.push(SessionParticipant {
                employee_id: e.id.clone(),
                display_name: e.display_name.clone(),
                avatar_color: e.avatar_color.clone(),
            });
        }
    }
    session.updated_at = Utc::now();
    let updated = session.clone();
    save_meta(&meta)?;
    Ok(updated)
}

pub fn update_title(id: &str, title: &str) -> Result<Session> {
    let mut meta = load_meta()?;
    let session = meta.sessions.iter_mut().find(|s| s.id == id)
        .ok_or_else(|| anyhow::anyhow!("Session not found"))?;
    session.title = title.to_string();
    session.updated_at = Utc::now();
    let updated = session.clone();
    save_meta(&meta)?;
    Ok(updated)
}
