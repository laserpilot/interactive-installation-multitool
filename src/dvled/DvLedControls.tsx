import { useConfigStore } from '../store/useConfigStore';
import { ContentUpload } from '../ui/ContentUpload';
import { fmtDist, fromInches, lenUnit, toInches } from '../ui/units';

// LED-wall presets — diagonal in inches + a typical fine/coarse pitch.
const PRESETS: { label: string; diagonal: number; aspectW: number; aspectH: number; pitch: number }[] = [
  { label: 'Retail header — 8 ft, P1.5', diagonal: 110, aspectW: 16, aspectH: 9, pitch: 1.5 },
  { label: 'Lobby wall — 12 ft, P2.5', diagonal: 165, aspectW: 16, aspectH: 9, pitch: 2.5 },
  { label: 'Stage backdrop — 24 ft, P3.9', diagonal: 330, aspectW: 16, aspectH: 9, pitch: 3.9 },
  { label: 'Arena board — 40 ft, P6', diagonal: 550, aspectW: 16, aspectH: 9, pitch: 6 },
];

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="row">
      <span className="row-label">{label}</span>
      <span className="row-control">{children}</span>
    </label>
  );
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

export function DvLedControls() {
  const s = useConfigStore();
  const units = s.units;
  const u = lenUnit(units);
  const metric = units === 'metric';

  // Distance slider bounds, in the active unit. 1–80 ft (≈0.3–24 m).
  const distMin = metric ? 30 : 12;
  const distMax = metric ? 2400 : 960;
  const distVal = round(fromInches(s.dvledDistance, units));

  return (
    <div className="panel">
      <h2>LED wall</h2>

      <Row label="Preset">
        <select
          value=""
          onChange={(e) => {
            const p = PRESETS[Number(e.target.value)];
            if (!p) return;
            s.set('diagonal', p.diagonal);
            s.set('aspectW', p.aspectW);
            s.set('aspectH', p.aspectH);
            s.set('resMode', 'pitch');
            s.set('pitchMm', p.pitch);
          }}
        >
          <option value="">Choose…</option>
          {PRESETS.map((p, i) => (
            <option key={p.label} value={i}>
              {p.label}
            </option>
          ))}
        </select>
      </Row>

      <Row label={`Diagonal (${u})`}>
        <input
          type="number"
          min={1}
          value={round(fromInches(s.diagonal, units))}
          onChange={(e) => s.set('diagonal', toInches(Number(e.target.value), units))}
        />
      </Row>

      <Row label="Aspect">
        <span className="aspect">
          <input
            type="number"
            min={1}
            value={s.aspectW}
            onChange={(e) => s.set('aspectW', Number(e.target.value))}
          />
          <span>:</span>
          <input
            type="number"
            min={1}
            value={s.aspectH}
            onChange={(e) => s.set('aspectH', Number(e.target.value))}
          />
        </span>
      </Row>

      <Row label="Pixel pitch (mm)">
        <input
          type="number"
          step={0.1}
          min={0.4}
          value={s.pitchMm}
          onChange={(e) => {
            s.set('resMode', 'pitch');
            s.set('pitchMm', Number(e.target.value));
          }}
        />
      </Row>

      <h2>Your viewpoint</h2>

      <div className="field">
        <div className="field-head">
          <span className="row-label">Viewing distance</span>
          <span className="num-readout">{fmtDist(s.dvledDistance, units)}</span>
        </div>
        <input
          className="slider"
          type="range"
          min={distMin}
          max={distMax}
          step={metric ? 5 : 2}
          value={distVal}
          onChange={(e) => s.set('dvledDistance', toInches(Number(e.target.value), units))}
        />
      </div>

      <div className="field">
        <div className="field-head">
          <span className="row-label">Field of view</span>
          <span className="num-readout">{s.dvledFov}°</span>
        </div>
        <input
          className="slider"
          type="range"
          min={15}
          max={90}
          step={1}
          value={s.dvledFov}
          onChange={(e) => s.set('dvledFov', Number(e.target.value))}
        />
        <p className="hint">How wide a cone of the wall the frame represents (~40° ≈ a relaxed, eyes-forward gaze).</p>
      </div>

      <h2>Panel look</h2>

      <div className="field">
        <div className="field-head">
          <span className="row-label">Fill factor</span>
          <span className="num-readout">{Math.round(s.fillFactor * 100)}%</span>
        </div>
        <input
          className="slider"
          type="range"
          min={0.1}
          max={0.95}
          step={0.05}
          value={s.fillFactor}
          onChange={(e) => s.set('fillFactor', Number(e.target.value))}
        />
        <p className="hint">How much of each pixel the emitter covers. Lower = wider black grid (stronger screen-door up close).</p>
      </div>

      <Row label="LED shape">
        <span className="seg">
          <button
            className={s.ledShape === 'circle' ? 'on' : ''}
            onClick={() => s.set('ledShape', 'circle')}
          >
            Round
          </button>
          <button
            className={s.ledShape === 'square' ? 'on' : ''}
            onClick={() => s.set('ledShape', 'square')}
          >
            Square
          </button>
        </span>
      </Row>

      <h2>Content</h2>
      <ContentUpload />
    </div>
  );
}
