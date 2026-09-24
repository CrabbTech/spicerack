//! The interface as an instrument input. One thread owns the Core Audio (cpal)
//! input stream for the chosen device and channel, keeps a rolling window of
//! samples, and every hop runs the pitch detector on it — then tells the
//! webview what it heard. Nothing heavy happens in the audio callback: it only
//! de-interleaves the wanted channel and hands the chunk over.
//!
//! macOS lets several apps read the same input at once, so Quire can listen to
//! the guitar straight from the interface while an amp sim reads it too.

use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::Mutex;
use std::thread::{self, JoinHandle};

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{FromSample, Sample, SampleFormat, StreamConfig};
use quire_dsp::{Detector, PitchOptions};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

/// Samples between two looks at the window: ~10.7 ms at 48 kHz.
const HOP: usize = 512;
/// One event every second hop keeps the bridge at ~47 messages a second.
const EMIT_EVERY: usize = 2;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioDevice {
    pub id: String,
    pub name: String,
    pub channels: u16,
    pub sample_rate: u32,
    pub is_default: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioStarted {
    pub device: String,
    pub sample_rate: u32,
    pub channels: u16,
    /// analysis window, in samples
    pub window: usize,
    pub hop: usize,
}

/// What the ears heard in one hop. `midi` is `None` when nothing periodic is sounding.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioFrame {
    pub freq: Option<f32>,
    pub midi: Option<f32>,
    pub clarity: f32,
    /// level of the whole analysis window
    pub rms: f32,
    /// level of just this hop — quick enough for a meter
    pub level: f32,
    /// seconds of audio since the stream started
    pub t: f64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase", tag = "kind")]
pub enum AudioState {
    Running { device: String },
    Stopped,
    Error { message: String },
}

pub const FRAME_EVENT: &str = "quire://audio";
pub const STATE_EVENT: &str = "quire://audio-state";

enum Msg {
    Samples(Vec<f32>),
    Failed(String),
    Stop,
}

#[derive(Default)]
pub struct AudioEngine {
    worker: Option<(Sender<Msg>, JoinHandle<()>)>,
}

/// The engine, shared with the commands.
pub type Audio = Mutex<AudioEngine>;

/// Which input channel to listen to: one of them, or all of them mixed down.
#[derive(Clone, Copy, Debug)]
pub enum Pick {
    Channel(u16),
    Mix,
}

impl Pick {
    pub fn from_index(channel: i32) -> Pick {
        if channel < 0 { Pick::Mix } else { Pick::Channel(channel as u16) }
    }
}

fn name_of(device: &cpal::Device) -> String {
    device.name().unwrap_or_else(|_| "unknown input".to_string())
}

pub fn list_devices() -> Result<Vec<AudioDevice>, String> {
    let host = cpal::default_host();
    let default_name = host.default_input_device().and_then(|d| d.name().ok());
    let mut out = Vec::new();
    for device in host.input_devices().map_err(|e| e.to_string())? {
        let Ok(config) = device.default_input_config() else { continue };
        let name = name_of(&device);
        out.push(AudioDevice {
            is_default: default_name.as_deref() == Some(name.as_str()),
            id: name.clone(),
            name,
            channels: config.channels(),
            sample_rate: config.sample_rate().0,
        });
    }
    Ok(out)
}

fn find_device(host: &cpal::Host, id: Option<&str>) -> Result<cpal::Device, String> {
    if let Some(id) = id {
        for device in host.input_devices().map_err(|e| e.to_string())? {
            if device.name().ok().as_deref() == Some(id) {
                return Ok(device);
            }
        }
    }
    host.default_input_device().ok_or_else(|| "no audio input device".to_string())
}

/// Interleaved frames in, the wanted channel out, as f32.
fn mono<T: Sample>(data: &[T], channels: usize, pick: Pick) -> Vec<f32>
where
    f32: FromSample<T>,
{
    let frames = data.len() / channels.max(1);
    let mut out = Vec::with_capacity(frames);
    for frame in data.chunks_exact(channels.max(1)) {
        let v = match pick {
            Pick::Channel(c) => frame.get(c as usize).map(|s| f32::from_sample(*s)).unwrap_or(0.0),
            Pick::Mix => frame.iter().map(|s| f32::from_sample(*s)).sum::<f32>() / channels as f32,
        };
        out.push(v);
    }
    out
}

fn build_stream(device: &cpal::Device, config: &cpal::SupportedStreamConfig, pick: Pick, tx: Sender<Msg>) -> Result<cpal::Stream, String> {
    let channels = config.channels() as usize;
    let stream_config: StreamConfig = config.config();
    let err_tx = tx.clone();
    let on_error = move |e: cpal::StreamError| {
        let _ = err_tx.send(Msg::Failed(e.to_string()));
    };
    let stream = match config.sample_format() {
        SampleFormat::F32 => device.build_input_stream(&stream_config, move |data: &[f32], _| { let _ = tx.send(Msg::Samples(mono(data, channels, pick))); }, on_error, None),
        SampleFormat::I16 => device.build_input_stream(&stream_config, move |data: &[i16], _| { let _ = tx.send(Msg::Samples(mono(data, channels, pick))); }, on_error, None),
        SampleFormat::U16 => device.build_input_stream(&stream_config, move |data: &[u16], _| { let _ = tx.send(Msg::Samples(mono(data, channels, pick))); }, on_error, None),
        SampleFormat::I32 => device.build_input_stream(&stream_config, move |data: &[i32], _| { let _ = tx.send(Msg::Samples(mono(data, channels, pick))); }, on_error, None),
        other => return Err(format!("unsupported sample format {other:?}")),
    };
    stream.map_err(|e| e.to_string())
}

/// The analysis loop: a rolling window, looked at every hop, until Stop.
fn analyse(app: AppHandle, rx: Receiver<Msg>, sample_rate: f32, low: bool, device: String) {
    let window = if low { 4096 } else { 2048 };
    let opts = if low { PitchOptions::BASS } else { PitchOptions::default() };
    let mut detector = Detector::new();
    let mut ring: Vec<f32> = Vec::with_capacity(window * 2);
    let mut frame = vec![0.0f32; window];
    let mut since_hop = 0usize;
    let mut until_emit = EMIT_EVERY;
    let mut total = 0u64;
    let _ = app.emit(STATE_EVENT, AudioState::Running { device: device.clone() });
    for msg in rx {
        match msg {
            Msg::Stop => break,
            Msg::Failed(message) => {
                let _ = app.emit(STATE_EVENT, AudioState::Error { message });
                break;
            }
            Msg::Samples(chunk) => {
                total += chunk.len() as u64;
                since_hop += chunk.len();
                ring.extend_from_slice(&chunk);
                if ring.len() > window * 2 {
                    let drop = ring.len() - window;
                    ring.drain(..drop);
                }
                if since_hop < HOP || ring.len() < window {
                    continue;
                }
                since_hop = 0;
                until_emit -= 1;
                if until_emit > 0 {
                    continue;
                }
                until_emit = EMIT_EVERY;
                frame.copy_from_slice(&ring[ring.len() - window..]);
                let level = quire_dsp::rms(&ring[ring.len() - HOP..]);
                let heard = detector.detect(&frame, sample_rate, &opts);
                let out = AudioFrame {
                    freq: heard.map(|p| p.freq),
                    midi: heard.map(|p| p.midi),
                    clarity: heard.map(|p| p.clarity).unwrap_or(0.0),
                    rms: heard.map(|p| p.rms).unwrap_or_else(|| quire_dsp::rms(&frame)),
                    level,
                    t: total as f64 / sample_rate as f64,
                };
                let _ = app.emit(FRAME_EVENT, out);
            }
        }
    }
    let _ = app.emit(STATE_EVENT, AudioState::Stopped);
}

impl AudioEngine {
    /// Open the device (or the default one) and start listening. Any earlier stream is closed first.
    pub fn start(&mut self, app: AppHandle, device_id: Option<String>, pick: Pick, low: bool) -> Result<AudioStarted, String> {
        self.stop();
        let host = cpal::default_host();
        let device = find_device(&host, device_id.as_deref())?;
        let config = device.default_input_config().map_err(|e| e.to_string())?;
        let name = name_of(&device);
        let sample_rate = config.sample_rate().0;
        let channels = config.channels();
        let window = if low { 4096 } else { 2048 };
        let (tx, rx) = mpsc::channel::<Msg>();
        // the thread owns the stream: cpal streams need not be Sync, and this way one thread does all the talking
        let stream = build_stream(&device, &config, pick, tx.clone())?;
        stream.play().map_err(|e| e.to_string())?;
        let thread_name = name.clone();
        let handle = thread::Builder::new()
            .name("quire-ears".into())
            .spawn(move || {
                let _keep = stream;
                analyse(app, rx, sample_rate as f32, low, thread_name);
            })
            .map_err(|e| e.to_string())?;
        self.worker = Some((tx, handle));
        Ok(AudioStarted { device: name, sample_rate, channels, window, hop: HOP })
    }

    pub fn stop(&mut self) {
        if let Some((tx, handle)) = self.worker.take() {
            let _ = tx.send(Msg::Stop);
            let _ = handle.join();
        }
    }
}
