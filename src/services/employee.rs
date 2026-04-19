use anyhow::Result;
use chrono::Utc;
use tokio::sync::Mutex;

use crate::models::{AgentBinding, DispatchHistory, DispatchRecord, Employee, EmployeesState, PersonaFiles, SoulFiles, EmployeeStatus, EmployeeType};
use crate::storage::{read_json, write_json, CloudCodePaths};
use std::fs;

static STATE: Mutex<Option<EmployeesState>> = Mutex::const_new(None);

pub fn load() -> Result<EmployeesState> {
    let paths = CloudCodePaths::default();
    let state = read_json(&paths.employees_file()).unwrap_or_else(|_| EmployeesState { employees: vec![] });
    Ok(state)
}

pub fn save(state: &EmployeesState) -> Result<()> {
    let paths = CloudCodePaths::default();
    write_json(&paths.employees_file(), state)?;
    Ok(())
}

async fn get_state() -> Result<EmployeesState> {
    let global = STATE.lock().await;
    if let Some(ref state) = *global {
        Ok(state.clone())
    } else {
        let state = load()?;
        Ok(state)
    }
}

async fn set_state(state: EmployeesState) -> Result<()> {
    let mut global = STATE.lock().await;
    *global = Some(state.clone());
    save(&state)?;
    Ok(())
}

pub async fn list() -> Result<Vec<Employee>> {
    let state = get_state().await?;
    Ok(state.employees)
}

pub async fn create(
    name: &str,
    display_name: Option<&str>,
    agent_id: &str,
    model: Option<&str>,
    avatar_color: Option<&str>,
    tags: Vec<String>,
    role: Option<&str>,
    employee_type: Option<EmployeeType>,
    source_id: Option<&str>,
    remote_agent_name: Option<&str>,
) -> Result<Employee> {
    let mut state = get_state().await?;
    
    let id = uuid::Uuid::new_v4().to_string();
    let now = Utc::now();
    let display_name = display_name.unwrap_or(name).to_string();
    let avatar_color = avatar_color.unwrap_or("#3B82F6").to_string();
    
    let employee = Employee {
        id: id.clone(),
        name: name.to_string(),
        display_name,
        agent_id: Some(agent_id.to_string()),
        model: model.map(String::from),
        status: EmployeeStatus::Unknown,
        avatar_color,
        tags,
        created_at: now,
        updated_at: now,
        last_dispatched_at: None,
        dispatch_count: 0,
        dispatch_success_count: 0,
        bindings: None,
        role: role.map(String::from),
        employee_type,
        source_id: source_id.map(String::from),
        remote_agent_name: remote_agent_name.map(String::from),
    };
    
    let paths = CloudCodePaths::default();
    let emp_dir = paths.employee_dir(&id);
    fs::create_dir_all(&emp_dir)?;
    
    let identity_file = paths.employee_identity_file(&id);
    let soul_file = paths.employee_soul_file(&id);
    let skills_file = paths.employee_skills_file(&id);
    let rules_file = paths.employee_rules_file(&id);
    
    fs::write(&identity_file, "")?;
    fs::write(&soul_file, "")?;
    fs::write(&skills_file, "")?;
    fs::write(&rules_file, "")?;
    
    state.employees.push(employee.clone());
    set_state(state).await?;
    
    Ok(employee)
}

pub async fn get(id: &str) -> Result<Employee> {
    let state = get_state().await?;
    let employee = state.employees
        .into_iter()
        .find(|e| e.id == id)
        .ok_or_else(|| anyhow::anyhow!("Employee not found"))?;
    Ok(employee)
}

pub async fn update(
    id: &str,
    display_name: Option<&str>,
    agent_id: Option<&str>,
    model: Option<&str>,
    avatar_color: Option<&str>,
    tags: Option<Vec<String>>,
    role: Option<&str>,
    source_id: Option<&str>,
    remote_agent_name: Option<&str>,
) -> Result<Employee> {
    let mut state = get_state().await?;
    
    let employee = state.employees
        .iter_mut()
        .find(|e| e.id == id)
        .ok_or_else(|| anyhow::anyhow!("Employee not found"))?;
    
    if let Some(dn) = display_name {
        employee.display_name = dn.to_string();
    }
    if let Some(aid) = agent_id {
        employee.agent_id = Some(aid.to_string());
    }
    if let Some(ac) = avatar_color {
        employee.avatar_color = ac.to_string();
    }
    if let Some(t) = tags {
        employee.tags = t;
    }
    if let Some(r) = role {
        employee.role = Some(r.to_string());
    }
    if let Some(sid) = source_id {
        employee.source_id = Some(sid.to_string());
    }
    if let Some(ran) = remote_agent_name {
        employee.remote_agent_name = Some(ran.to_string());
    }
    if let Some(m) = model {
        employee.model = Some(m.to_string());
    }
    employee.updated_at = Utc::now();
    
    let updated = employee.clone();
    set_state(state).await?;
    
    Ok(updated)
}

pub async fn delete(id: &str) -> Result<()> {
    let mut state = get_state().await?;
    
    let initial_len = state.employees.len();
    state.employees.retain(|e| e.id != id);
    
    if state.employees.len() == initial_len {
        anyhow::bail!("Employee not found");
    }
    
    let paths = CloudCodePaths::default();
    let emp_dir = paths.employee_dir(id);
    if emp_dir.exists() {
        fs::remove_dir_all(&emp_dir)?;
    }
    
    set_state(state).await?;
    Ok(())
}

pub fn read_soul_files(id: &str) -> Result<SoulFiles> {
    let paths = CloudCodePaths::default();
    
    let soul = fs::read_to_string(paths.employee_soul_file(id))
        .unwrap_or_default();
    let skills = fs::read_to_string(paths.employee_skills_file(id))
        .unwrap_or_default();
    let rules = fs::read_to_string(paths.employee_rules_file(id))
        .unwrap_or_default();
    
    Ok(SoulFiles { soul, skills, rules })
}

pub fn write_soul_files(id: &str, soul_files: &SoulFiles) -> Result<()> {
    let paths = CloudCodePaths::default();
    let emp_dir = paths.employee_dir(id);
    fs::create_dir_all(&emp_dir)?;
    
    fs::write(paths.employee_soul_file(id), &soul_files.soul)?;
    fs::write(paths.employee_skills_file(id), &soul_files.skills)?;
    fs::write(paths.employee_rules_file(id), &soul_files.rules)?;
    
    Ok(())
}

pub fn read_persona_files(id: &str) -> Result<PersonaFiles> {
    let paths = CloudCodePaths::default();
    
    let identity = fs::read_to_string(paths.employee_identity_file(id))
        .unwrap_or_default();
    let soul = fs::read_to_string(paths.employee_soul_file(id))
        .unwrap_or_default();
    let skills = fs::read_to_string(paths.employee_skills_file(id))
        .unwrap_or_default();
    let rules = fs::read_to_string(paths.employee_rules_file(id))
        .unwrap_or_default();
    
    Ok(PersonaFiles { identity, soul, skills, rules })
}

pub fn write_persona_files(id: &str, persona: &PersonaFiles) -> Result<()> {
    let paths = CloudCodePaths::default();
    let emp_dir = paths.employee_dir(id);
    fs::create_dir_all(&emp_dir)?;
    
    fs::write(paths.employee_identity_file(id), &persona.identity)?;
    fs::write(paths.employee_soul_file(id), &persona.soul)?;
    fs::write(paths.employee_skills_file(id), &persona.skills)?;
    fs::write(paths.employee_rules_file(id), &persona.rules)?;
    
    Ok(())
}

pub async fn add_binding(id: &str, binding: AgentBinding) -> Result<Employee> {
    let mut state = get_state().await?;
    
    let employee = state.employees
        .iter_mut()
        .find(|e| e.id == id)
        .ok_or_else(|| anyhow::anyhow!("Employee not found"))?;
    
    if employee.bindings.is_none() {
        employee.bindings = Some(vec![]);
    }
    
    if binding.is_primary {
        if let Some(ref mut bindings) = employee.bindings {
            for b in bindings.iter_mut() {
                b.is_primary = false;
            }
        }
    }
    
    if let Some(ref mut bindings) = employee.bindings {
        bindings.push(binding);
    }
    employee.updated_at = Utc::now();
    
    let updated = employee.clone();
    set_state(state).await?;
    
    Ok(updated)
}

pub async fn update_binding(
    id: &str,
    binding_id: &str,
    label: Option<&str>,
    is_primary: Option<bool>,
    protocol: Option<crate::models::AgentProtocol>,
) -> Result<Employee> {
    let mut state = get_state().await?;
    
    let employee = state.employees
        .iter_mut()
        .find(|e| e.id == id)
        .ok_or_else(|| anyhow::anyhow!("Employee not found"))?;
    
    let bindings = employee.bindings.as_ref()
        .ok_or_else(|| anyhow::anyhow!("No bindings"))?;
    
    let binding_exists = bindings.iter().any(|b| b.id == binding_id);
    if !binding_exists {
        anyhow::bail!("Binding not found");
    }
    
    if let Some(l) = label {
        if let Some(ref mut bindings) = employee.bindings {
            for b in bindings.iter_mut() {
                if b.id == binding_id {
                    b.label = l.to_string();
                }
            }
        }
    }
    if let Some(ip) = is_primary {
        if let Some(ref mut bindings) = employee.bindings {
            if ip {
                for b in bindings.iter_mut() {
                    b.is_primary = false;
                }
            }
            for b in bindings.iter_mut() {
                if b.id == binding_id {
                    b.is_primary = ip;
                }
            }
        }
    }
    
    if let Some(p) = protocol {
        if let Some(ref mut bindings) = employee.bindings {
            for b in bindings.iter_mut() {
                if b.id == binding_id {
                    b.protocol = p.clone();
                }
            }
        }
    }
    
    employee.updated_at = Utc::now();
    
    let updated = employee.clone();
    set_state(state).await?;
    
    Ok(updated)
}

pub async fn delete_binding(id: &str, binding_id: &str) -> Result<Employee> {
    let mut state = get_state().await?;
    
    let employee = state.employees
        .iter_mut()
        .find(|e| e.id == id)
        .ok_or_else(|| anyhow::anyhow!("Employee not found"))?;
    
    let bindings = employee.bindings.as_mut()
        .ok_or_else(|| anyhow::anyhow!("No bindings"))?;
    
    let initial_len = bindings.len();
    bindings.retain(|b| b.id != binding_id);
    
    if bindings.len() == initial_len {
        anyhow::bail!("Binding not found");
    }
    
    employee.updated_at = Utc::now();
    
    let updated = employee.clone();
    set_state(state).await?;
    
    Ok(updated)
}

pub fn append_dispatch_record(id: &str, record: DispatchRecord) -> Result<()> {
    let paths = CloudCodePaths::default();
    let path = paths.employee_history_file(id);
    let mut history: DispatchHistory = if path.exists() {
        read_json(&path).unwrap_or_default()
    } else {
        Default::default()
    };
    history.records.insert(0, record);
    history.records.truncate(50);
    write_json(&path, &history)?;
    Ok(())
}

pub fn get_dispatch_history(id: &str) -> Result<DispatchHistory> {
    let paths = CloudCodePaths::default();
    let path = paths.employee_history_file(id);
    if !path.exists() {
        return Ok(Default::default());
    }
    Ok(read_json(&path).unwrap_or_default())
}

pub async fn record_dispatch_result(id: &str, success: bool) -> Result<()> {
    let mut state = get_state().await?;
    if let Some(emp) = state.employees.iter_mut().find(|e| e.id == id) {
        emp.last_dispatched_at = Some(chrono::Utc::now());
        emp.dispatch_count += 1;
        if success {
            emp.dispatch_success_count += 1;
        }
        emp.updated_at = chrono::Utc::now();
    }
    set_state(state).await
}

pub fn compute_employee_status(employee: &Employee) -> crate::models::EmployeeStatus {
    let agent_id = match &employee.agent_id {
        Some(id) => id.clone(),
        None => {
            let resolved = resolve_agent_id_for_employee(employee);
            if resolved == "unresolved" {
                return crate::models::EmployeeStatus::Unknown;
            }
            resolved
        }
    };
    
    let is_remote_agent = agent_id.contains('/');
    
    if is_remote_agent {
        let source_id = agent_id.split('/').next().unwrap_or("");
        
        let sources = match crate::services::agent_source::list_agent_sources() {
            Ok(s) => s,
            Err(_) => return crate::models::EmployeeStatus::Unknown,
        };
        
        let source = match sources.into_iter().find(|s| s.id == source_id) {
            Some(s) => s,
            None => return crate::models::EmployeeStatus::Unknown,
        };
        
        if !source.healthy {
            return crate::models::EmployeeStatus::Offline;
        }
        
        let rt = tokio::runtime::Handle::current();
        let remote_agents = match rt.block_on(crate::services::agent_registry::fetch_remote_agents_from_source(source_id)) {
            Ok(agents) => agents,
            Err(_) => return crate::models::EmployeeStatus::Offline,
        };
        
        let agent_exists = remote_agents.iter().any(|a| a.id == agent_id);
        if agent_exists {
            crate::models::EmployeeStatus::Online
        } else {
            crate::models::EmployeeStatus::Offline
        }
    } else {
        let agent = match crate::services::agent_registry::get_agent(&agent_id) {
            Ok(Some(a)) => a,
            _ => return crate::models::EmployeeStatus::Unknown,
        };
        
        match agent.status {
            crate::models::AgentStatus::Online => crate::models::EmployeeStatus::Online,
            crate::models::AgentStatus::Offline => crate::models::EmployeeStatus::Offline,
            crate::models::AgentStatus::Busy => crate::models::EmployeeStatus::Busy,
            crate::models::AgentStatus::Unknown => crate::models::EmployeeStatus::Unknown,
        }
    }
}

pub async fn get_employee_with_status(id: &str) -> Result<Employee> {
    let mut employee = get(id).await?;
    employee.status = compute_employee_status(&employee);
    Ok(employee)
}

pub fn list_employees_with_status() -> Result<Vec<Employee>> {
    let state = load()?;
    let mut employees = state.employees;
    for emp in &mut employees {
        emp.status = compute_employee_status(emp);
    }
    Ok(employees)
}

pub fn get_agent_for_employee(employee: &Employee) -> Result<Option<crate::models::Agent>> {
    let agent_id = match &employee.agent_id {
        Some(id) => id.clone(),
        None => resolve_agent_id_for_employee(employee),
    };
    
    if agent_id == "unresolved" {
        return Ok(None);
    }
    
    crate::services::agent_registry::get_agent(&agent_id)
}

pub fn get_source_for_employee(employee: &Employee) -> Result<crate::models::AgentSource> {
    let agent_id = match &employee.agent_id {
        Some(id) => id.clone(),
        None => resolve_agent_id_for_employee(employee),
    };
    
    if agent_id == "unresolved" {
        anyhow::bail!("Employee has no valid agent_id and cannot be migrated");
    }
    
    let agent = crate::services::agent_registry::get_agent(&agent_id)?
        .ok_or_else(|| anyhow::anyhow!("Agent not found for employee"))?;
    
    crate::services::agent_source::get_source(&agent.source_id)
}

pub fn migrate_legacy_employee(emp: &Employee) -> Option<String> {
    if let Some(ref agent_id) = emp.agent_id {
        if !agent_id.is_empty() && agent_id != "unresolved" {
            return Some(agent_id.clone());
        }
    }
    
    if let Some(ref source_id) = emp.source_id {
        if let Some(ref remote_name) = emp.remote_agent_name {
            if source_id.starts_with("openclaw") || source_id.starts_with("remote") {
                return Some(format!("{}/{}", source_id, remote_name));
            }
        }
        
        let local_agent = match source_id.as_str() {
            "claude" | "claude-local" => Some("claude-cli"),
            "codex" | "codex-local" => Some("codex-cli"),
            "opencode" | "opencode-local" => Some("opencode-cli"),
            "gemini" | "gemini-local" => Some("gemini-cli"),
            _ => None,
        };
        
        if let Some(agent_id) = local_agent {
            return Some(agent_id.to_string());
        }
    }
    
    None
}

pub fn resolve_agent_id_for_employee(emp: &Employee) -> String {
    if let Some(agent_id) = migrate_legacy_employee(emp) {
        return agent_id;
    }
    "unresolved".to_string()
}
