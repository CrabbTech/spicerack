// JAM: instrument in hand. The chords shrink to a chart, the diagram gets the
// left page; the right one listens, and keeps the journal. The big diagram belongs
// to one tool at a time.

import { useApp } from '../../state/AppContext';
import { Spread } from '../Spread';
import { LessonBanner } from '../LessonBanner';
import { ProgressionPanel } from '../ProgressionPanel';
import { SoloPanel } from '../SoloPanel';
import { TriadLab } from '../TriadLab';
import { FretDrills } from '../FretDrills';
import { ListenPanel } from '../ListenPanel';
import { JournalPanel } from '../SidePanels';

export function JamView() {
  const { jamTool, setJamTool } = useApp();
  return (
    <Spread folio={3}
      left={
        <>
          <LessonBanner />
          <div className="col-left jam">
            <ProgressionPanel editing={false} />
            <div className="jam-tool">
              <div className="seg tool-seg">
                <button className={jamTool === 'solo' ? 'seg-on' : ''} onClick={() => setJamTool('solo')}>Solo lab</button>
                <button className={jamTool === 'triads' ? 'seg-on' : ''} onClick={() => setJamTool('triads')}>Triad lab</button>
                <button className={jamTool === 'drills' ? 'seg-on' : ''} onClick={() => setJamTool('drills')}>Neck drills</button>
              </div>
              {jamTool === 'solo' ? <SoloPanel /> : jamTool === 'triads' ? <TriadLab /> : <FretDrills />}
            </div>
          </div>
        </>
      }
      right={
        <div className="col-right">
          <ListenPanel />
          <JournalPanel />
        </div>
      }
    />
  );
}
