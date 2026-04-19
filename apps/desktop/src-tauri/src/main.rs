#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[tauri::command]
fn desktop_shell_status() -> &'static str {
    "desktop-shell-ready"
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![desktop_shell_status])
        .run(tauri::generate_context!())
        .expect("failed to run CloudCode desktop shell");
}
