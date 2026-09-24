//! MIDI in through CoreMIDI (midir): an OP-1 field, or any controller, over
//! USB — the desktop shell's WKWebView has no Web MIDI, so the app listens
//! natively and forwards note on/off to the webview.

use std::sync::mpsc::{self, Sender};
use std::sync::Mutex;
use std::thread::{self, JoinHandle};

use midir::{Ignore, MidiInput};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

pub const NOTE_EVENT: &str = "quire://midi";
pub const STATE_EVENT: &str = "quire://midi-state";

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MidiPort {
    pub id: String,
    pub name: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MidiNote {
    pub midi: u8,
    pub on: bool,
    pub velocity: f32,
    /// microseconds, on the port's own clock
    pub stamp: u64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase", tag = "kind")]
pub enum MidiState {
    Listening { port: String },
    Stopped,
    Error { message: String },
}

#[derive(Default)]
pub struct MidiEngine {
    worker: Option<(Sender<()>, JoinHandle<()>)>,
}

pub type Midi = Mutex<MidiEngine>;

fn input() -> Result<MidiInput, String> {
    let mut input = MidiInput::new("Quire").map_err(|e| e.to_string())?;
    input.ignore(Ignore::All);
    Ok(input)
}

pub fn list_ports() -> Result<Vec<MidiPort>, String> {
    let input = input()?;
    Ok(input
        .ports()
        .iter()
        .map(|p| {
            let name = input.port_name(p).unwrap_or_else(|_| "MIDI input".to_string());
            MidiPort { id: name.clone(), name }
        })
        .collect())
}

impl MidiEngine {
    /// Listen on the named port, or the first one there is.
    pub fn start(&mut self, app: AppHandle, port_id: Option<String>) -> Result<String, String> {
        self.stop();
        let input = input()?;
        let ports = input.ports();
        let port = match port_id.as_deref() {
            Some(id) => ports.iter().find(|p| input.port_name(p).ok().as_deref() == Some(id)).cloned(),
            None => ports.first().cloned(),
        }
        .ok_or_else(|| "no MIDI input found — plug the OP-1 in over USB".to_string())?;
        let name = input.port_name(&port).unwrap_or_else(|_| "MIDI input".to_string());
        let (tx, rx) = mpsc::channel::<()>();
        let (ready_tx, ready_rx) = mpsc::channel::<Result<(), String>>();
        let events = app.clone();
        let port_name = name.clone();
        let handle = thread::Builder::new()
            .name("quire-midi".into())
            .spawn(move || {
                // the connection lives on this thread, and closes when the thread is told to stop
                let connection = input.connect(
                    &port,
                    "quire-in",
                    move |stamp, message, _| {
                        if message.len() < 3 {
                            return;
                        }
                        let kind = message[0] & 0xf0;
                        let note = match kind {
                            0x90 if message[2] > 0 => Some((true, message[2] as f32 / 127.0)),
                            0x80 | 0x90 => Some((false, 0.0)),
                            _ => None,
                        };
                        if let Some((on, velocity)) = note {
                            let _ = events.emit(NOTE_EVENT, MidiNote { midi: message[1], on, velocity, stamp });
                        }
                    },
                    (),
                );
                match connection {
                    Ok(connection) => {
                        let _ = ready_tx.send(Ok(()));
                        let _ = app.emit(STATE_EVENT, MidiState::Listening { port: port_name });
                        let _ = rx.recv();
                        connection.close();
                        let _ = app.emit(STATE_EVENT, MidiState::Stopped);
                    }
                    Err(e) => {
                        let _ = app.emit(STATE_EVENT, MidiState::Error { message: e.to_string() });
                        let _ = ready_tx.send(Err(e.to_string()));
                    }
                }
            })
            .map_err(|e| e.to_string())?;
        match ready_rx.recv() {
            Ok(Ok(())) => {
                self.worker = Some((tx, handle));
                Ok(name)
            }
            Ok(Err(e)) => {
                let _ = handle.join();
                Err(e)
            }
            Err(_) => Err("the MIDI thread went away".to_string()),
        }
    }

    pub fn stop(&mut self) {
        if let Some((tx, handle)) = self.worker.take() {
            let _ = tx.send(());
            let _ = handle.join();
        }
    }
}
