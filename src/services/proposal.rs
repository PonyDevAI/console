use crate::models::{ProposalStatus, ProposalsState, TaskProposal};
use crate::storage::{read_json, write_json, ConsolePaths};
use anyhow::Result;
use chrono::Utc;

fn load(session_id: &str) -> Result<ProposalsState> {
    let paths = ConsolePaths::default();
    let path = paths.session_proposals_file(session_id);
    if !path.exists() {
        return Ok(ProposalsState::default());
    }
    read_json(&path).or_else(|_| Ok(ProposalsState::default()))
}

fn save(session_id: &str, state: &ProposalsState) -> Result<()> {
    let paths = ConsolePaths::default();
    let dir = paths.session_dir(session_id);
    std::fs::create_dir_all(&dir)?;
    write_json(&paths.session_proposals_file(session_id), state)
}

pub fn list(session_id: &str) -> Result<Vec<TaskProposal>> {
    Ok(load(session_id)?.proposals)
}

pub fn create(
    session_id: &str,
    title: &str,
    description: &str,
    employee_id: &str,
) -> Result<TaskProposal> {
    let proposal = TaskProposal {
        id: uuid::Uuid::new_v4().to_string(),
        session_id: session_id.to_string(),
        title: title.to_string(),
        description: description.to_string(),
        assigned_employee_id: employee_id.to_string(),
        status: ProposalStatus::Pending,
        dispatch_task_id: None,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };
    let mut state = load(session_id)?;
    state.proposals.push(proposal.clone());
    save(session_id, &state)?;
    Ok(proposal)
}

pub fn get(session_id: &str, proposal_id: &str) -> Result<TaskProposal> {
    load(session_id)?
        .proposals
        .into_iter()
        .find(|p| p.id == proposal_id)
        .ok_or_else(|| anyhow::anyhow!("Proposal not found"))
}

pub fn update_status(
    session_id: &str,
    proposal_id: &str,
    status: ProposalStatus,
) -> Result<TaskProposal> {
    let mut state = load(session_id)?;
    let p = state
        .proposals
        .iter_mut()
        .find(|p| p.id == proposal_id)
        .ok_or_else(|| anyhow::anyhow!("Proposal not found"))?;
    p.status = status;
    p.updated_at = Utc::now();
    let updated = p.clone();
    save(session_id, &state)?;
    Ok(updated)
}

#[allow(dead_code)]
pub fn set_dispatch_task_id(session_id: &str, proposal_id: &str, task_id: &str) -> Result<()> {
    let mut state = load(session_id)?;
    if let Some(p) = state.proposals.iter_mut().find(|p| p.id == proposal_id) {
        p.dispatch_task_id = Some(task_id.to_string());
        p.updated_at = Utc::now();
    }
    save(session_id, &state)
}

pub fn update_description(session_id: &str, proposal_id: &str, description: &str) -> Result<()> {
    let mut state = load(session_id)?;
    if let Some(p) = state.proposals.iter_mut().find(|p| p.id == proposal_id) {
        p.description = description.to_string();
        p.updated_at = Utc::now();
    }
    save(session_id, &state)
}
