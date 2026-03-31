use anyhow::Result;
use chrono::Utc;
use tokio::sync::Mutex;

use crate::models::{AgentBinding, Employee, EmployeesState, SoulFiles};
use crate::storage::{read_json, write_json, ConsolePaths};
use std::fs;

static STATE: Mutex<Option<EmployeesState>> = Mutex::const_new(None);

pub fn load() -> Result<EmployeesState> {
    let paths = ConsolePaths::default();
    let state = read_json(&paths.employees_file()).unwrap_or_else(|_| EmployeesState { employees: vec![] });
    Ok(state)
}

pub fn save(state: &EmployeesState) -> Result<()> {
    let paths = ConsolePaths::default();
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
    display_name: &str,
    role: &str,
    avatar_color: &str,
) -> Result<Employee> {
    let mut state = get_state().await?;
    
    let id = uuid::Uuid::new_v4().to_string();
    let now = Utc::now();
    
    let employee = Employee {
        id: id.clone(),
        name: name.to_string(),
        display_name: display_name.to_string(),
        role: role.to_string(),
        avatar_color: avatar_color.to_string(),
        bindings: vec![],
        created_at: now,
        updated_at: now,
    };
    
    let paths = ConsolePaths::default();
    let emp_dir = paths.employee_dir(&id);
    fs::create_dir_all(&emp_dir)?;
    
    let soul_file = paths.employee_soul_file(&id);
    let skills_file = paths.employee_skills_file(&id);
    let rules_file = paths.employee_rules_file(&id);
    
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
    role: Option<&str>,
    avatar_color: Option<&str>,
) -> Result<Employee> {
    let mut state = get_state().await?;
    
    let employee = state.employees
        .iter_mut()
        .find(|e| e.id == id)
        .ok_or_else(|| anyhow::anyhow!("Employee not found"))?;
    
    if let Some(dn) = display_name {
        employee.display_name = dn.to_string();
    }
    if let Some(r) = role {
        employee.role = r.to_string();
    }
    if let Some(ac) = avatar_color {
        employee.avatar_color = ac.to_string();
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
    
    let paths = ConsolePaths::default();
    let emp_dir = paths.employee_dir(id);
    if emp_dir.exists() {
        fs::remove_dir_all(&emp_dir)?;
    }
    
    set_state(state).await?;
    Ok(())
}

pub fn read_soul_files(id: &str) -> Result<SoulFiles> {
    let paths = ConsolePaths::default();
    
    let soul = fs::read_to_string(paths.employee_soul_file(id))
        .unwrap_or_default();
    let skills = fs::read_to_string(paths.employee_skills_file(id))
        .unwrap_or_default();
    let rules = fs::read_to_string(paths.employee_rules_file(id))
        .unwrap_or_default();
    
    Ok(SoulFiles { soul, skills, rules })
}

pub fn write_soul_files(id: &str, soul_files: &SoulFiles) -> Result<()> {
    let paths = ConsolePaths::default();
    let emp_dir = paths.employee_dir(id);
    fs::create_dir_all(&emp_dir)?;
    
    fs::write(paths.employee_soul_file(id), &soul_files.soul)?;
    fs::write(paths.employee_skills_file(id), &soul_files.skills)?;
    fs::write(paths.employee_rules_file(id), &soul_files.rules)?;
    
    Ok(())
}

pub async fn add_binding(id: &str, binding: AgentBinding) -> Result<Employee> {
    let mut state = get_state().await?;
    
    let employee = state.employees
        .iter_mut()
        .find(|e| e.id == id)
        .ok_or_else(|| anyhow::anyhow!("Employee not found"))?;
    
    if binding.is_primary {
        for b in &mut employee.bindings {
            b.is_primary = false;
        }
    }
    
    employee.bindings.push(binding);
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
) -> Result<Employee> {
    let mut state = get_state().await?;
    
    let employee = state.employees
        .iter_mut()
        .find(|e| e.id == id)
        .ok_or_else(|| anyhow::anyhow!("Employee not found"))?;
    
    let binding_exists = employee.bindings.iter().any(|b| b.id == binding_id);
    if !binding_exists {
        anyhow::bail!("Binding not found");
    }
    
    if let Some(l) = label {
        for b in &mut employee.bindings {
            if b.id == binding_id {
                b.label = l.to_string();
            }
        }
    }
    if let Some(ip) = is_primary {
        if ip {
            for b in &mut employee.bindings {
                b.is_primary = false;
            }
        }
        for b in &mut employee.bindings {
            if b.id == binding_id {
                b.is_primary = ip;
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
    
    let initial_len = employee.bindings.len();
    employee.bindings.retain(|b| b.id != binding_id);
    
    if employee.bindings.len() == initial_len {
        anyhow::bail!("Binding not found");
    }
    
    employee.updated_at = Utc::now();
    
    let updated = employee.clone();
    set_state(state).await?;
    
    Ok(updated)
}
