// The Solo Lab wired to the controller — full in Jam, compact under the
// melody workbench in Write.

import { useApp } from '../state/AppContext';
import { scaleTabText } from '../guitar/voicing';
import { BASS_STRING_NAMES } from '../bass/bass';
import { audio } from '../audio/engine';
import { qwertyBase } from '../input/qwerty';
import { SoloLab } from './SoloLab';

export function SoloPanel({ compact = false }: { compact?: boolean }) {
  const app = useApp();
  const { state, dispatch, realized, scaleData } = app;
  return (
    <SoloLab
      compact={compact}
      instrument={state.instrument}
      octaveShift={state.octaveShift}
      musicKey={app.liveKey}
      recs={app.recs}
      scaleIdx={app.scaleIdx}
      why={app.rec?.why}
      solo={app.liveSolo}
      realized={app.liveRealized}
      focusIdx={app.focusIdx}
      playing={state.playing}
      lens={compact ? 'map' : app.lens}
      demoOn={app.demoOn}
      both={app.both}
      jam={app.jam}
      leadMidi={app.leadMidi}
      tips={app.soloTips}
      copied={app.copied === 'scale'}
      positions={app.positions}
      position={app.position}
      onPosition={app.setPosition}
      heldMidis={app.held}
      labelMode={app.labelMode}
      onLabelMode={app.setLabelMode}
      qwertyBase={app.inputSource === 'qwerty' && app.baseSolo ? qwertyBase(app.baseSolo.range.lo) : undefined}
      lefty={app.lefty}
      onLefty={() => app.setLefty(!app.lefty)}
      onScale={(idx) => dispatch({ type: 'scale', idx })}
      onFocus={(idx) => app.setFocusId(idx === null ? null : realized[idx].slot.id)}
      onLens={app.setLens}
      onDemo={() => {
        app.setDemoOn(!app.demoOn);
        if (!app.demoOn && !state.playing) app.startPlayback();
      }}
      onReroll={() => app.setLickSeed((n) => n + 1)}
      onBoth={() => app.setBoth(!app.both)}
      onHearScale={app.playScale}
      onCopyTab={scaleData && (state.instrument === 'guitar' || state.instrument === 'bass')
        ? () => (state.instrument === 'guitar'
          ? app.copyText('scale', scaleTabText(`${scaleData.name} — position box`, scaleData.box))
          : app.copyText('scale', scaleTabText(`${scaleData.name} — position box (bass)`, scaleData.bassBox, BASS_STRING_NAMES)))
        : undefined}
      onNote={(midi, instrument, string) => {
        audio.note(midi, instrument);
        // in Write, with step entry armed, the fretboard is the pen
        if (compact && app.stepEntry) app.addStepNote(midi, string);
      }}
    />
  );
}
