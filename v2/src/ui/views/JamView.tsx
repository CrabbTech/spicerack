// JAM: instrument in hand. The chords shrink to a chart, the diagram gets the
// room, and the app listens. The big diagram belongs to one tool at a time:
// the Solo Lab (single-note lines) or the Triad Lab (three-note shapes).

import { useApp } from '../../state/AppContext';
import { ProgressionPanel } from '../ProgressionPanel';
import { SoloPanel } from '../SoloPanel';
import { TriadLab } from '../TriadLab';
import { FretDrills } from '../FretDrills';
import { ListenPanel } from '../ListenPanel';

export function JamView() {
  const { jamTool, setJamTool } = useApp();
  return (
    <main className="jam">
      <ProgressionPanel editing={false} />
      <div className="jam-split">
        <div className="jam-tool">
          <div className="seg tool-seg">
            <button className={jamTool === 'solo' ? 'seg-on' : ''} onClick={() => setJamTool('solo')}
              title="single-note lines: what every note means over each chord, drills, demo licks">🎯 SOLO LAB</button>
            <button className={jamTool === 'triads' ? 'seg-on' : ''} onClick={() => setJamTool('triads')}
              title="three-note shapes on three strings, voice-led through the changes">🔺 TRIAD LAB</button>
            <button className={jamTool === 'drills' ? 'seg-on' : ''} onClick={() => setJamTool('drills')}
              title="fretboard fluency: timed sprints on intervals, degrees, chord tones and note names">🧠 NECK DRILLS</button>
          </div>
          {jamTool === 'solo' ? <SoloPanel /> : jamTool === 'triads' ? <TriadLab /> : <FretDrills />}
        </div>
        <ListenPanel />
      </div>
    </main>
  );
}
