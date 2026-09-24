//! The desktop shell: a native window around the journal, with the things a
//! web page cannot do — read the audio interface straight from Core Audio,
//! listen to CoreMIDI, put a menu in the menu bar, save a file where asked.

mod audio;
mod menu;
mod midi;

use std::fs;

use tauri::{AppHandle, Manager, State};

use audio::{Audio, AudioDevice, AudioEngine, AudioStarted, Pick};
use midi::{Midi, MidiEngine, MidiPort};

/// Write bytes to a user-chosen path (path comes from the save dialog).
#[tauri::command]
fn save_file(path: String, data: Vec<u8>) -> Result<(), String> {
    fs::write(&path, data).map_err(|e| format!("could not write {path}: {e}"))
}

#[tauri::command]
fn audio_devices() -> Result<Vec<AudioDevice>, String> {
    audio::list_devices()
}

/// Start listening on a device and channel (`channel` -1 mixes every channel down). `low` widens the ears for a bass.
#[tauri::command]
fn audio_start(app: AppHandle, audio: State<'_, Audio>, device: Option<String>, channel: i32, low: bool) -> Result<AudioStarted, String> {
    let mut engine = audio.lock().map_err(|_| "audio engine is busy".to_string())?;
    engine.start(app, device, Pick::from_index(channel), low)
}

#[tauri::command]
fn audio_stop(audio: State<'_, Audio>) -> Result<(), String> {
    let mut engine = audio.lock().map_err(|_| "audio engine is busy".to_string())?;
    engine.stop();
    Ok(())
}

#[tauri::command]
fn midi_ports() -> Result<Vec<MidiPort>, String> {
    midi::list_ports()
}

#[tauri::command]
fn midi_start(app: AppHandle, midi: State<'_, Midi>, port: Option<String>) -> Result<String, String> {
    let mut engine = midi.lock().map_err(|_| "midi engine is busy".to_string())?;
    engine.start(app, port)
}

#[tauri::command]
fn midi_stop(midi: State<'_, Midi>) -> Result<(), String> {
    let mut engine = midi.lock().map_err(|_| "midi engine is busy".to_string())?;
    engine.stop();
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(Audio::new(AudioEngine::default()))
        .manage(Midi::new(MidiEngine::default()))
        .menu(menu::build)
        .on_menu_event(|app, event| menu::forward(app, event.id().0.as_str()))
        .setup(|app| {
            #[cfg(desktop)]
            app.handle().plugin(tauri_plugin_window_state::Builder::default().build())?;
            Ok(())
        })
        .on_window_event(|window, event| {
            // the ears and the MIDI port close with the window, not with the process
            if let tauri::WindowEvent::Destroyed = event {
                if let Some(audio) = window.try_state::<Audio>() {
                    if let Ok(mut engine) = audio.lock() {
                        engine.stop();
                    }
                }
                if let Some(midi) = window.try_state::<Midi>() {
                    if let Ok(mut engine) = midi.lock() {
                        engine.stop();
                    }
                }
            }
        })
        .invoke_handler(tauri::generate_handler![save_file, audio_devices, audio_start, audio_stop, midi_ports, midi_start, midi_stop])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
