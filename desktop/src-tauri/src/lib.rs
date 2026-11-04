//! LumaForge native shell.
//!
//! The Tauri app owns the window and launches the Python processing engine as a
//! bundled **sidecar** executable (`lumaforge-backend`), talking to it over
//! `127.0.0.1`. In development the sidecar binary is absent, so startup simply
//! logs and continues — the dev script runs the backend with uvicorn instead,
//! and the frontend connects to it the same way.

use std::sync::Mutex;

use tauri::{Manager, RunEvent};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

/// Holds the sidecar handle so we can terminate it when the app exits.
struct BackendProcess(Mutex<Option<CommandChild>>);

fn start_backend(app: &tauri::AppHandle) {
    let sidecar = match app.shell().sidecar("lumaforge-backend") {
        Ok(cmd) => cmd,
        Err(e) => {
            // Expected in `tauri dev`: no bundled binary. Run the backend
            // separately (see scripts/dev.*). Not a fatal error.
            eprintln!("[lumaforge] backend sidecar unavailable (dev mode?): {e}");
            return;
        }
    };

    match sidecar
        .args(["--host", "127.0.0.1", "--port", "8756"])
        .spawn()
    {
        Ok((mut rx, child)) => {
            if let Some(state) = app.try_state::<BackendProcess>() {
                *state.0.lock().unwrap() = Some(child);
            }
            // Drain the sidecar's output so the pipe never blocks, and surface
            // logs to the parent console during development.
            tauri::async_runtime::spawn(async move {
                while let Some(event) = rx.recv().await {
                    match event {
                        CommandEvent::Stdout(bytes) | CommandEvent::Stderr(bytes) => {
                            if let Ok(line) = String::from_utf8(bytes) {
                                eprint!("[backend] {line}");
                            }
                        }
                        CommandEvent::Terminated(payload) => {
                            eprintln!("[lumaforge] backend exited: {:?}", payload.code);
                        }
                        _ => {}
                    }
                }
            });
        }
        Err(e) => eprintln!("[lumaforge] failed to launch backend sidecar: {e}"),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(BackendProcess(Mutex::new(None)))
        .setup(|app| {
            let handle = app.handle().clone();
            start_backend(&handle);
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building the LumaForge application")
        .run(|app_handle, event| {
            // Make sure the Python engine is stopped with the app.
            if let RunEvent::ExitRequested { .. } = &event {
                if let Some(state) = app_handle.try_state::<BackendProcess>() {
                    if let Some(child) = state.0.lock().unwrap().take() {
                        let _ = child.kill();
                    }
                }
            }
        });
}
