import { useConfigStore } from '../store/useConfigStore';
import { fmtLen, fromInches, toInches } from '../ui/units';
import {
  COMMON_TAPS,
  MOUNT_DEFAULTS,
  SPEAKER_PRESETS,
  USE_CASES,
  type SpeakerMount,
  type SpeakerUnit,
  type UseCase,
} from './speakerMath';

/** A "?" badge that reveals a spec-sheet explanation on hover/focus. */
function InfoDot({ children }: { children: React.ReactNode }) {
  return (
    <span className="infodot" tabIndex={0} role="note">
      ?<span className="infodot-pop">{children}</span>
    </span>
  );
}

function Row({
  label,
  info,
  children,
}: {
  label: string;
  info?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="row">
      <span className="row-label">
        {label}
        {info && <InfoDot>{info}</InfoDot>}
      </span>
      <span className="row-control">{children}</span>
    </label>
  );
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

const MOUNTS: { id: SpeakerMount; label: string }[] = [
  { id: 'ceiling', label: 'Ceiling' },
  { id: 'wall', label: 'Wall' },
];

const USE_CASE_IDS: UseCase[] = ['speech', 'music', 'pa'];

const MAX_SPEAKERS = 6;

export function SpeakerControls() {
  const s = useConfigStore();
  const units = s.units;
  const metric = units === 'metric';
  const sel = Math.min(s.speakerSel, s.speakers.length - 1);
  const spk = s.speakers[sel];

  // Edit the selected unit immutably.
  function updateSel(patch: Partial<SpeakerUnit>) {
    s.set(
      'speakers',
      s.speakers.map((u, i) => (i === sel ? { ...u, ...patch } : u)),
    );
  }

  function addSpeaker() {
    if (s.speakers.length >= MAX_SPEAKERS) return;
    // Clone the selected unit, nudged sideways so it's visible and not stacked.
    const clone: SpeakerUnit = { ...spk, xIn: spk.xIn + 48 };
    s.set('speakers', [...s.speakers, clone]);
    s.set('speakerSel', s.speakers.length);
  }

  function removeSpeaker() {
    if (s.speakers.length <= 1) return;
    s.set('speakers', s.speakers.filter((_, i) => i !== sel));
    s.set('speakerSel', Math.max(0, sel - 1));
  }

  function applyPreset(i: number) {
    const p = SPEAKER_PRESETS[i];
    if (!p) return;
    const d = MOUNT_DEFAULTS[p.mount];
    updateSel({
      sensitivity: p.sensitivity,
      powerW: p.powerW,
      hCovDeg: p.hCovDeg,
      vCovDeg: p.vCovDeg,
      mount: p.mount,
      mountAffIn: d.mountAffIn,
      pitchDeg: d.pitchDeg,
    });
  }

  function applyMount(mount: SpeakerMount) {
    const d = MOUNT_DEFAULTS[mount];
    updateSel({ mount, mountAffIn: d.mountAffIn, pitchDeg: d.pitchDeg });
  }

  const heightMax = metric ? 730 : 288;
  const heightStep = metric ? 2 : 1;
  const fwdMax = metric ? 1220 : 480;
  const sideMax = metric ? 610 : 240;
  const posStep = metric ? 5 : 2;

  return (
    <div className="panel">
      <h2>Speakers</h2>

      <Row label="Unit">
        <span className="seg sm wrap">
          {s.speakers.map((_, i) => (
            <button key={i} className={i === sel ? 'on' : ''} onClick={() => s.set('speakerSel', i)}>
              #{i + 1}
            </button>
          ))}
          {s.speakers.length < MAX_SPEAKERS && (
            <button onClick={addSpeaker} title="Add a speaker">
              +
            </button>
          )}
        </span>
      </Row>
      {s.speakers.length > 1 && (
        <button className="link-btn" onClick={removeSpeaker}>
          Remove #{sel + 1}
        </button>
      )}

      <Row label="Model preset">
        <select value="" onChange={(e) => applyPreset(Number(e.target.value))}>
          <option value="">Choose…</option>
          {SPEAKER_PRESETS.map((p, i) => (
            <option key={p.label} value={i}>
              {p.label}
            </option>
          ))}
        </select>
      </Row>

      <Row
        label="Sensitivity"
        info={
          <>
            Spec sheet → <b>“Sensitivity”</b> (dB, 1 W / 1 m). The QSC AD-P6T lists{' '}
            <b>88 dB</b>. It’s how loud one watt is at 1 m on-axis — higher = more
            efficient. Use the figure straight off the sheet.
          </>
        }
      >
        <span className="num-entry">
          <input type="number" step={1} min={70} max={110} value={spk.sensitivity}
            onChange={(e) => updateSel({ sensitivity: Number(e.target.value) })} />
          <span className="unit">dB</span>
        </span>
      </Row>

      <Row
        label="Max SPL"
        info={
          <>
            Spec sheet → <b>“Maximum SPL (Continuous)”</b>. AD-P6T = <b>106 dB</b>.
            The loudest it can sustain — this tool never lets the level exceed it, so
            it’s the ceiling on “how loud can it get.”
          </>
        }
      >
        <span className="num-entry">
          <input type="number" step={1} min={80} max={140} value={spk.maxSplDb}
            onChange={(e) => updateSel({ maxSplDb: Number(e.target.value) })} />
          <span className="unit">dB</span>
        </span>
      </Row>

      <Row
        label="Drive / tap"
        info={
          <>
            How hard you drive it. On a <b>70 V / 100 V</b> line this is your{' '}
            <b>transformer tap</b> — the AD-P6T offers 60 / 30 / 15 / 7.5 W. Higher
            tap = louder, up to the Max SPL ceiling. On a low-Z amp, use the watts
            you’ll actually send (not the power-handling max).
          </>
        }
      >
        <span className="num-entry">
          <input type="number" step={0.5} min={0.1} value={spk.powerW}
            onChange={(e) => updateSel({ powerW: Math.max(0.1, Number(e.target.value)) })} />
          <span className="unit">W</span>
        </span>
      </Row>
      <Row label="70V tap">
        <span className="seg sm wrap">
          {COMMON_TAPS.map((w) => (
            <button key={w} className={spk.powerW === w ? 'on' : ''} onClick={() => updateSel({ powerW: w })}>
              {w}W
            </button>
          ))}
        </span>
      </Row>

      <Row
        label="Coverage H × V"
        info={
          <>
            Spec sheet → <b>“Coverage Angle”</b>. AD-P6T = <b>135° conical</b> (same
            H and V). It’s the −6 dB beamwidth: sound rolls off toward those angles.
            Narrower throws farther and more evenly; wider covers more area but fades
            sooner.
          </>
        }
      >
        <span className="aspect">
          <input type="number" min={10} max={360} value={spk.hCovDeg}
            onChange={(e) => updateSel({ hCovDeg: Number(e.target.value) })} />
          <span>×</span>
          <input type="number" min={10} max={360} value={spk.vCovDeg}
            onChange={(e) => updateSel({ vCovDeg: Number(e.target.value) })} />
        </span>
      </Row>
      <p className="hint">
        On-axis SPL @ 1 m = sensitivity + 10·log10(W), capped at Max SPL. A conical
        spec (like 135°) means H = V.
      </p>

      <h2>Mount &amp; aim</h2>
      <Row label="Mount">
        <span className="seg sm">
          {MOUNTS.map((m) => (
            <button key={m.id} className={spk.mount === m.id ? 'on' : ''} onClick={() => applyMount(m.id)}>
              {m.label}
            </button>
          ))}
        </span>
      </Row>
      <div className="field">
        <div className="field-head">
          <span className="row-label">{spk.mount === 'ceiling' ? 'Ceiling height' : 'Mount height'}</span>
          <span className="num-readout">{fmtLen(spk.mountAffIn, units)}</span>
        </div>
        <input className="slider" type="range" min={0} max={heightMax} step={heightStep}
          value={round(fromInches(spk.mountAffIn, units))}
          onChange={(e) => updateSel({ mountAffIn: toInches(Number(e.target.value), units) })} />
      </div>
      <div className="field">
        <div className="field-head">
          <span className="row-label">Tilt (pitch)</span>
          <span className="num-readout">{spk.pitchDeg}°</span>
        </div>
        <input className="slider" type="range" min={-90} max={90} step={1} value={spk.pitchDeg}
          onChange={(e) => updateSel({ pitchDeg: Number(e.target.value) })} />
        <p className="hint">0° = level · −90° = straight down · +90° = up.</p>
      </div>
      <div className="field">
        <div className="field-head">
          <span className="row-label">Pan (yaw)</span>
          <span className="num-readout">{spk.yawDeg}°</span>
        </div>
        <input className="slider" type="range" min={-180} max={180} step={1} value={spk.yawDeg}
          onChange={(e) => updateSel({ yawDeg: Number(e.target.value) })} />
      </div>

      <h2>Position</h2>
      <div className="field">
        <div className="field-head">
          <span className="row-label">Forward</span>
          <span className="num-readout">{fmtLen(spk.zIn, units)}</span>
        </div>
        <input className="slider" type="range" min={0} max={fwdMax} step={posStep}
          value={round(fromInches(spk.zIn, units))}
          onChange={(e) => updateSel({ zIn: toInches(Number(e.target.value), units) })} />
      </div>
      <div className="field">
        <div className="field-head">
          <span className="row-label">Side</span>
          <span className="num-readout">{fmtLen(spk.xIn, units)}</span>
        </div>
        <input className="slider" type="range" min={-sideMax} max={sideMax} step={posStep}
          value={round(fromInches(spk.xIn, units))}
          onChange={(e) => updateSel({ xIn: toInches(Number(e.target.value), units) })} />
      </div>

      <h2>Amplifier</h2>
      <Row
        label="Amp power"
        info={
          <>
            Spec sheet → <b>“Recommended Amplifier Power”</b> (AD-P6T = <b>120 W</b>).
            The watts available on this 70 V/100 V line (or amp channel). The total
            of every speaker’s tap should stay under ~80% of it for headroom. For a
            multichannel amp, enter the total feeding these speakers.
          </>
        }
      >
        <span className="num-entry">
          <input type="number" step={10} min={1} value={s.speakerAmpW}
            onChange={(e) => s.set('speakerAmpW', Math.max(1, Number(e.target.value)))} />
          <span className="unit">W</span>
        </span>
      </Row>
      <p className="hint">
        {s.speakers.length} {s.speakers.length === 1 ? 'speaker' : 'speakers'} draw{' '}
        {s.speakers.reduce((sum, u) => sum + u.powerW, 0)} W of taps — see “Amp load”
        in the readout for budget headroom.
      </p>

      <h2>Listening scenario</h2>
      <Row label="Programme">
        <span className="seg sm wrap">
          {USE_CASE_IDS.map((id) => (
            <button key={id} className={s.speakerUseCase === id ? 'on' : ''}
              onClick={() => s.set('speakerUseCase', id)}>
              {USE_CASES[id].label.split(' ')[0]}
            </button>
          ))}
        </span>
      </Row>
      <p className="hint">{USE_CASES[s.speakerUseCase].blurb}</p>

      <Row label="Read level as">
        <span className="seg sm">
          <button className={s.speakerWeighting === 'dba' ? 'on' : ''} onClick={() => s.set('speakerWeighting', 'dba')}>
            dBA
          </button>
          <button className={s.speakerWeighting === 'flat' ? 'on' : ''} onClick={() => s.set('speakerWeighting', 'flat')}>
            Flat dB
          </button>
        </span>
      </Row>
      <p className="hint">
        dBA matches a meter set to “A” and the target band; flat dB SPL is the raw
        level. Verdict always uses dBA.
      </p>

      <div className="field">
        <div className="field-head">
          <span className="row-label">Ear height</span>
          <span className="num-readout">{fmtLen(s.speakerEarHeight, units)}</span>
        </div>
        <input className="slider" type="range" min={metric ? 60 : 24} max={metric ? 180 : 72} step={1}
          value={round(fromInches(s.speakerEarHeight, units))}
          onChange={(e) => s.set('speakerEarHeight', toInches(Number(e.target.value), units))} />
        <p className="hint">Standing ≈ 60″, seated ≈ 48″ — the height of the coverage plane.</p>
      </div>

      <div className="field">
        <div className="field-head">
          <span className="row-label">
            Ambient noise floor
            <InfoDot>
              How loud the room is with no programme — HVAC, crowd, traffic. The
              verdict needs the speakers to beat it by ~
              {USE_CASES[s.speakerUseCase].targetSnr} dB, so a louder room raises the
              bar and can turn “comfortable” into “not loud enough.”
            </InfoDot>
          </span>
          <span className="num-readout">{s.speakerNoiseFloor} dBA</span>
        </div>
        <input className="slider" type="range" min={25} max={90} step={1} value={s.speakerNoiseFloor}
          onChange={(e) => s.set('speakerNoiseFloor', Number(e.target.value))} />
        <p className="hint">
          Quiet gallery ≈ 40 · busy retail ≈ 60 · crowd / café ≈ 70 dBA. This
          scenario wants ~{USE_CASES[s.speakerUseCase].targetSnr} dB over it.
        </p>
      </div>

      <h2>Listener</h2>
      <div className="field">
        <div className="field-head">
          <span className="row-label">Forward</span>
          <span className="num-readout">{fmtLen(s.speakerListenerZ, units)}</span>
        </div>
        <input className="slider" type="range" min={0} max={fwdMax} step={posStep}
          value={round(fromInches(s.speakerListenerZ, units))}
          onChange={(e) => s.set('speakerListenerZ', toInches(Number(e.target.value), units))} />
      </div>
      <div className="field">
        <div className="field-head">
          <span className="row-label">Side</span>
          <span className="num-readout">{fmtLen(s.speakerListenerX, units)}</span>
        </div>
        <input className="slider" type="range" min={-sideMax} max={sideMax} step={posStep}
          value={round(fromInches(s.speakerListenerX, units))}
          onChange={(e) => s.set('speakerListenerX', toInches(Number(e.target.value), units))} />
      </div>

      <h2>Coverage map</h2>
      <Row label="Show">
        <span className="seg sm">
          <button className={s.speakerCoverageView === 'spl' ? 'on' : ''} onClick={() => s.set('speakerCoverageView', 'spl')}>
            dB SPL
          </button>
          <button className={s.speakerCoverageView === 'uniformity' ? 'on' : ''} onClick={() => s.set('speakerCoverageView', 'uniformity')}>
            Uniformity
          </button>
        </span>
      </Row>

      <label className="check">
        <input type="checkbox" checked={s.speakerShowField}
          onChange={(e) => s.set('speakerShowField', e.target.checked)} />
        Show ear-height coverage plane
      </label>
      <label className="check">
        <input type="checkbox" checked={s.speakerShowMeasurements}
          onChange={(e) => s.set('speakerShowMeasurements', e.target.checked)} />
        Show measurements
      </label>
    </div>
  );
}
