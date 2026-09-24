// JAM: instrument in hand. The chords shrink to a chart, the diagram gets the
// room, and the app listens. The big diagram belongs to one tool at a time.

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
            <button className={jamTool === 'solo' ? 'seg-on' : ''} onClick={() => setJamTool('solo')}>Solo lab</button>
            <button className={jamTool === 'triads' ? 'seg-on' : ''} onClick={() => setJamTool('triads')}>Triad lab</button>
            <button className={jamTool === 'drills' ? 'seg-on' : ''} onClick={() => setJamTool('drills')}>Neck drills</button>
          </div>
          {jamTool === 'solo' ? <SoloPanel /> : jamTool === 'triads' ? <TriadLab /> : <FretDrills />}
        </div>
        <ListenPanel />
      </div>
    </main>
  );
}
