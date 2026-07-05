use std::sync::Mutex;
use std::time::Duration;

use tauri::Manager;
use tauri_plugin_sql::{Migration, MigrationKind};

/// Pet hitbox in logical (CSS) pixels, relative to the pet window.
/// The frontend keeps this in sync every time the pet moves inside the
/// window or a UI overlay (menu / bubble) opens. A background thread
/// polls the global cursor and toggles click-through so that only the
/// pet itself intercepts the mouse — the rest of the window lets
/// clicks fall through to the desktop.
#[derive(Clone, Default)]
struct Hitbox {
    x: f64,
    y: f64,
    w: f64,
    h: f64,
    /// true while a menu/bubble is open or a drag is active:
    /// the whole window stays interactive and the poller backs off.
    full: bool,
    /// set once the frontend has reported at least one hitbox
    ready: bool,
}

struct HitState(Mutex<Hitbox>);

#[tauri::command]
fn update_hitbox(state: tauri::State<'_, HitState>, x: f64, y: f64, w: f64, h: f64, full: bool) {
    let mut hb = state.0.lock().unwrap();
    *hb = Hitbox { x, y, w, h, full, ready: true };
}

#[derive(serde::Serialize)]
struct ActiveWin {
    title: String,
    x: f64,
    y: f64,
    w: f64,
    h: f64,
}

/// Privacy note: we only read the active window's TITLE and geometry.
/// No screenshots, no content, nothing leaves the machine.
#[tauri::command]
fn get_active_window_info() -> Option<ActiveWin> {
    match active_win_pos_rs::get_active_window() {
        Ok(win) => {
            if win.process_id == std::process::id() as u64 {
                return None;
            }
            Some(ActiveWin {
                title: win.title,
                x: win.position.x,
                y: win.position.y,
                w: win.position.width,
                h: win.position.height,
            })
        }
        Err(_) => None,
    }
}

#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

/// 系统空闲秒数(挂机计时防刷:≥30 分钟无键鼠输入暂停累计)
#[tauri::command]
fn get_idle_seconds() -> u64 {
    user_idle::UserIdle::get_time()
        .map(|t| t.as_seconds())
        .unwrap_or(0)
}

#[derive(serde::Deserialize, serde::Serialize)]
struct ChatMsg {
    role: String,
    content: String,
}

/// LLM 代理:前端只传消息,HTTP 由 Rust 发起(规避 WebView CORS,Key 不经过页面网络层)。
/// 兼容 OpenAI Chat Completions 格式;`url` 为 API base(如 https://api.openai.com/v1)
/// 或完整 /chat/completions 端点。
#[tauri::command]
async fn llm_chat(
    url: String,
    key: String,
    model: String,
    messages: Vec<ChatMsg>,
    temperature: Option<f32>,
) -> Result<String, String> {
    let endpoint = if url.trim_end_matches('/').ends_with("/chat/completions") {
        url.trim_end_matches('/').to_string()
    } else {
        format!("{}/chat/completions", url.trim_end_matches('/'))
    };
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|e| e.to_string())?;
    let body = serde_json::json!({
        "model": model,
        "messages": messages,
        "temperature": temperature.unwrap_or(0.8),
        "max_tokens": 300,
    });
    let resp = client
        .post(&endpoint)
        .bearer_auth(key)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("network: {e}"))?;
    let status = resp.status();
    let json: serde_json::Value = resp.json().await.map_err(|e| format!("parse: {e}"))?;
    if !status.is_success() {
        return Err(format!("api {status}: {}", json));
    }
    json["choices"][0]["message"]["content"]
        .as_str()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "empty response".to_string())
}

fn hit_test_loop(app: tauri::AppHandle) {
    let mut last_ignore: Option<bool> = None;
    loop {
        std::thread::sleep(Duration::from_millis(60));
        let Some(win) = app.get_webview_window("pet") else {
            continue;
        };
        let hb = {
            let state = app.state::<HitState>();
            let guard = state.0.lock().unwrap();
            guard.clone()
        };
        if !hb.ready {
            continue;
        }
        // While a drag or overlay is active the frontend owns the window;
        // never toggle mid-interaction or we would break pointer capture.
        if hb.full {
            if last_ignore != Some(false) {
                let _ = win.set_ignore_cursor_events(false);
                last_ignore = Some(false);
            }
            continue;
        }
        let ignore = match (app.cursor_position(), win.outer_position(), win.scale_factor()) {
            (Ok(cursor), Ok(pos), Ok(scale)) => {
                let lx = (cursor.x - pos.x as f64) / scale;
                let ly = (cursor.y - pos.y as f64) / scale;
                !(lx >= hb.x && lx <= hb.x + hb.w && ly >= hb.y && ly <= hb.y + hb.h)
            }
            _ => false,
        };
        if last_ignore != Some(ignore) {
            let _ = win.set_ignore_cursor_events(ignore);
            last_ignore = Some(ignore);
        }
    }
}

pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "init schema",
            sql: include_str!("../migrations/001_init.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "add UR pity counters",
            sql: "ALTER TABLE gacha_state ADD COLUMN pity_ur INTEGER NOT NULL DEFAULT 0;\n\
                  ALTER TABLE gacha_log ADD COLUMN pity_ur_after INTEGER NOT NULL DEFAULT 0;",
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:stardust.db", migrations)
                .build(),
        )
        .manage(HitState(Mutex::new(Hitbox::default())))
        .invoke_handler(tauri::generate_handler![
            update_hitbox,
            get_active_window_info,
            quit_app,
            get_idle_seconds,
            llm_chat
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            std::thread::spawn(move || hit_test_loop(handle));
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
