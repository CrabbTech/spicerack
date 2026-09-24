//! Quire's ears, in Rust. A port of `src/input/pitch.ts`: the YIN pitch
//! detector that turns one frame of samples into a frequency. The note
//! tracker that turns the wobbly stream into on/off events stays in the
//! webview, so the mic, the interface and the tests all share one set of ears.
//!
//! Why YIN and not an FFT peak: a plucked string's 2nd harmonic is often
//! louder than its fundamental, so the tallest spectral peak is an octave up.
//! YIN asks "after how many samples does the waveform repeat?", which is the
//! fundamental no matter which harmonic is loudest.

use serde::Serialize;

/// Below this the frame is room tone, not a note.
pub const RMS_FLOOR: f32 = 0.003;

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct PitchOptions {
    /// Just under a guitar's low E. The lag search never exceeds half the frame,
    /// so the real floor is max(min_freq, 2 × sample_rate / frame.len()).
    pub min_freq: f32,
    pub max_freq: f32,
    /// YIN threshold: a dip in the normalized difference must fall below this to count as a period.
    pub threshold: f32,
}

impl Default for PitchOptions {
    fn default() -> Self {
        Self { min_freq: 70.0, max_freq: 1400.0, threshold: 0.15 }
    }
}

impl PitchOptions {
    /// A bass needs a longer window (4096) and a lower floor to see its low E.
    pub const BASS: PitchOptions = PitchOptions { min_freq: 38.0, max_freq: 700.0, threshold: 0.15 };
}

#[derive(Clone, Copy, Debug, PartialEq, Serialize)]
pub struct Pitch {
    pub freq: f32,
    /// fractional midi note number (69 = A4 = 440 Hz)
    pub midi: f32,
    /// 0..1 — how periodic the frame is; below ~0.8 is usually noise or a chord
    pub clarity: f32,
    /// root-mean-square level of the frame, 0..1
    pub rms: f32,
}

/// Root-mean-square of a frame, capped at 1.
pub fn rms(frame: &[f32]) -> f32 {
    let energy: f64 = frame.iter().map(|x| (*x as f64) * (*x as f64)).sum();
    ((energy / frame.len().max(1) as f64).sqrt() as f32).min(1.0)
}

/// Owns the scratch buffer so a stream of frames never allocates.
#[derive(Default)]
pub struct Detector {
    cmnd: Vec<f64>,
}

impl Detector {
    pub fn new() -> Self {
        Self::default()
    }

    /// Monophonic pitch of one frame, or `None` when nothing periodic is sounding.
    /// 2048 samples reaches a guitar's low E at 44.1/48 kHz; a bass needs 4096
    /// and `PitchOptions::BASS`.
    pub fn detect(&mut self, frame: &[f32], sample_rate: f32, opts: &PitchOptions) -> Option<Pitch> {
        let n = frame.len();
        let rms = rms(frame);
        if rms < RMS_FLOOR {
            return None;
        }

        // lags to search; one past each end is computed so every candidate has two neighbours
        let tau_min = ((sample_rate / opts.max_freq).floor() as usize).max(2);
        let tau_max = ((sample_rate / opts.min_freq).ceil() as usize + 1).min(n >> 1);
        if tau_max < tau_min + 2 {
            return None;
        }
        let w = n - tau_max;

        if self.cmnd.len() < tau_max + 1 {
            self.cmnd.resize(tau_max + 1, 0.0);
        }
        let cmnd = &mut self.cmnd;
        let threshold = opts.threshold as f64;

        // Difference function, normalized on the fly by its own cumulative mean.
        // The FIRST true local minimum under the threshold is the period — first
        // means shortest, so a clean tone can never come out an octave down — and
        // the search stops there, which makes high notes several times cheaper.
        let mut running = 0.0f64;
        let mut tau: Option<usize> = None;
        cmnd[0] = 1.0;
        for lag in 1..=tau_max {
            let sum: f64 = frame[..w].iter().zip(&frame[lag..lag + w]).map(|(a, b)| {
                let d = *a as f64 - *b as f64;
                d * d
            }).sum();
            running += sum;
            cmnd[lag] = if running > 0.0 { sum * lag as f64 / running } else { 1.0 };

            let t = lag - 1;
            if t >= tau_min && cmnd[t] < threshold && cmnd[t] <= cmnd[t - 1] && cmnd[t] < cmnd[lag] {
                tau = Some(t);
                break;
            }
        }
        let tau = tau?;

        // parabolic interpolation: the true period falls between samples
        let (a, b, c) = (cmnd[tau - 1], cmnd[tau], cmnd[tau + 1]);
        let curve = a - 2.0 * b + c;
        let shift = if curve > 0.0 { (0.5 * (a - c) / curve).clamp(-0.5, 0.5) } else { 0.0 };
        let depth = b - 0.25 * (a - c) * shift;

        let freq = sample_rate as f64 / (tau as f64 + shift);
        Some(Pitch {
            freq: freq as f32,
            midi: (69.0 + 12.0 * (freq / 440.0).log2()) as f32,
            clarity: (1.0 - depth).clamp(0.0, 1.0) as f32,
            rms,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::f32::consts::TAU;

    /// A tone with the given harmonic amplitudes (fundamental first), an
    /// exponential decay (1/s) and silence before `start` — the same signal
    /// the TypeScript tests use.
    fn tone(freq: f32, sr: f32, n: usize, amps: &[f32], decay: f32, start: usize) -> Vec<f32> {
        (0..n)
            .map(|i| {
                if i < start {
                    return 0.0;
                }
                let t = (i - start) as f32 / sr;
                let v: f32 = amps.iter().enumerate().map(|(k, a)| a * (TAU * freq * (k as f32 + 1.0) * t + k as f32 * 0.7).sin()).sum();
                v * (-decay * t).exp()
            })
            .collect()
    }

    /// a string where the 2nd harmonic out-shouts the fundamental
    const PLUCK: [f32; 4] = [0.3, 0.6, 0.35, 0.2];
    const GUITAR: [(&str, f32); 9] = [
        ("E2", 82.41), ("A2", 110.0), ("D3", 146.83), ("G3", 196.0), ("B3", 246.94),
        ("E4", 329.63), ("A4", 440.0), ("E5", 659.26), ("E6", 1318.5),
    ];

    fn midi_of(freq: f32) -> f32 {
        69.0 + 12.0 * (freq / 440.0).log2()
    }

    #[test]
    fn finds_sine_waves_across_the_guitars_range() {
        for sr in [44100.0, 48000.0] {
            let mut d = Detector::new();
            for (name, freq) in GUITAR {
                let p = d.detect(&tone(freq, sr, 2048, &[0.5], 0.0, 0), sr, &PitchOptions::default()).unwrap_or_else(|| panic!("{name} at {sr}"));
                assert!((p.midi - midi_of(freq)).abs() < 0.1, "{name} at {sr}: got midi {}", p.midi);
                assert!(p.clarity > 0.9, "clarity {}", p.clarity);
            }
        }
    }

    #[test]
    fn hears_the_fundamental_under_a_louder_second_harmonic() {
        for sr in [44100.0, 48000.0] {
            let mut d = Detector::new();
            for (name, freq) in GUITAR {
                let p = d.detect(&tone(freq, sr, 2048, &PLUCK, 0.0, 0), sr, &PitchOptions::default()).unwrap_or_else(|| panic!("{name} at {sr}"));
                assert!((p.midi - midi_of(freq)).abs() < 0.1, "{name} at {sr}: got midi {}", p.midi);
            }
        }
    }

    #[test]
    fn reaches_bass_e1_with_a_longer_frame_and_lower_floor() {
        let sr = 44100.0;
        let p = Detector::new().detect(&tone(41.2, sr, 4096, &[0.5], 0.0, 0), sr, &PitchOptions::BASS).expect("a note");
        assert!((p.freq - 41.2).abs() < 0.5, "got {}", p.freq);
        // the guitar settings cannot reach it
        assert!(Detector::new().detect(&tone(41.2, sr, 2048, &[0.5], 0.0, 0), sr, &PitchOptions::default()).is_none());
    }

    #[test]
    fn never_reports_an_octave_error_for_a_tone_that_starts_mid_frame() {
        let sr = 44100.0;
        let mut d = Detector::new();
        let mut heard = 0;
        for (name, freq) in GUITAR {
            for amps in [&[0.5f32][..], &PLUCK[..]] {
                for start in [128, 256, 512, 768, 1024, 1280, 1536, 1800] {
                    let Some(p) = d.detect(&tone(freq, sr, 2048, amps, 3.0, start), sr, &PitchOptions::default()) else { continue };
                    heard += 1;
                    assert!((p.midi - midi_of(freq)).abs() < 0.5, "{name} from {start}: got midi {}", p.midi);
                }
            }
        }
        assert!(heard > 0);
    }

    #[test]
    fn stays_quiet_for_silence_noise_and_whispers() {
        let sr = 44100.0;
        let mut d = Detector::new();
        assert!(d.detect(&vec![0.0; 2048], sr, &PitchOptions::default()).is_none());
        // the same fixed-seed noise as the TypeScript tests (Numerical Recipes LCG)
        let mut s = 7u32;
        let noise: Vec<f32> = (0..2048).map(|_| { s = s.wrapping_mul(1664525).wrapping_add(1013904223); (s as f32 / 4294967296.0 * 2.0 - 1.0) * 0.3 }).collect();
        assert!(d.detect(&noise, sr, &PitchOptions::default()).is_none());
        assert!(d.detect(&tone(220.0, sr, 2048, &[0.002], 0.0, 0), sr, &PitchOptions::default()).is_none());
        assert!(d.detect(&tone(220.0, sr, 2048, &[0.02], 0.0, 0), sr, &PitchOptions::default()).is_some());
        assert!(d.detect(&tone(50.0, sr, 2048, &[0.5], 0.0, 0), sr, &PitchOptions::default()).is_none());
    }

    #[test]
    fn reports_the_frame_level() {
        let sr = 48000.0;
        let p = Detector::new().detect(&tone(220.0, sr, 2048, &[0.5], 0.0, 0), sr, &PitchOptions::default()).expect("a note");
        assert!((p.rms - 0.5 / 2f32.sqrt()).abs() < 0.01);
        assert!((rms(&[0.5, -0.5, 0.5, -0.5]) - 0.5).abs() < 1e-6);
    }

    #[test]
    fn gives_the_same_answer_when_the_scratch_buffer_is_reused_across_frame_sizes() {
        let sr = 48000.0;
        let mut d = Detector::new();
        let big = d.detect(&tone(41.2, sr, 4096, &[0.5], 0.0, 0), sr, &PitchOptions::BASS).unwrap();
        let small = d.detect(&tone(440.0, sr, 2048, &[0.5], 0.0, 0), sr, &PitchOptions::default()).unwrap();
        let again = d.detect(&tone(41.2, sr, 4096, &[0.5], 0.0, 0), sr, &PitchOptions::BASS).unwrap();
        assert!((small.midi - 69.0).abs() < 0.1);
        assert_eq!(big, again);
    }
}
