import { useState } from 'react';
import { sizeFromDiagonal } from '../ergonomics/engine';
import { useConfigStore } from '../store/useConfigStore';
import { ContentUpload } from '../ui/ContentUpload';
import { fmtDist, fromInches, lenUnit, toInches } from '../ui/units';
import { emitterWidthForPitch, pitchFillFraction } from './optics';

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

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** Reduce a width:height (in any unit) to a tidy integer ratio, e.g. 2:1, 16:9.
 *  Each side is clamped to ≥1 so a sub-0.5 dimension can't round to a 0 aspect
 *  (which collapses the screen size and hangs the test-pattern generator). */
function reduceRatio(w: number, h: number): [number, number] {
  const a = Math.max(1, Math.round(w));
  const b = Math.max(1, Math.round(h));
  const g = gcd(a, b) || 1;
  return [a / g, b / g];
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

  // Size can be driven by the diagonal or by raw width × height.
  const [sizeMode, setSizeMode] = useState<'diagonal' | 'wh'>('diagonal');
  const wall = sizeFromDiagonal(s.diagonal, s.aspectW, s.aspectH);
  // Set physical size from width/height (in): store the diagonal + use the raw
  // dimensions as the aspect, so the ratio is exact.
  const setWH = (wIn: number, hIn: number) => {
    if (wIn <= 0 || hIn <= 0) return;
    s.set('diagonal', Math.hypot(wIn, hIn));
    const [aw, ah] = reduceRatio(wIn, hIn);
    s.set('aspectW', aw);
    s.set('aspectH', ah);
  };

  // Fill derived from the pitch (used when "Fill from pitch" is on).
  const lockedFill = pitchFillFraction(s.pitchMm);
  const emitterMm = emitterWidthForPitch(s.pitchMm);

  // Buildability: LED cabinets are almost always 0.5 m modules, so a wall whose
  // width or height doesn't land on a 0.5 m grid usually means custom panels,
  // masking, or black bars. Flag it and suggest the nearest standard build.
  const IN_PER_M = 39.3701;
  const MOD_M = 0.5;
  const wM = wall.width / IN_PER_M;
  const hM = wall.height / IN_PER_M;
  const nearestM = (m: number) => Math.round(m / MOD_M) * MOD_M;
  const offGridM = (m: number) => Math.abs(m - nearestM(m));
  const offGrid = wM > 0 && hM > 0 && (offGridM(wM) > 0.03 || offGridM(hM) > 0.03);

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

      <Row label="Size by">
        <span className="seg sm">
          <button
            className={sizeMode === 'diagonal' ? 'on' : ''}
            onClick={() => setSizeMode('diagonal')}
          >
            Diagonal
          </button>
          <button
            className={sizeMode === 'wh' ? 'on' : ''}
            onClick={() => setSizeMode('wh')}
          >
            W × H
          </button>
        </span>
      </Row>

      {sizeMode === 'diagonal' ? (
        <>
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
                value={round(s.aspectW)}
                onChange={(e) => s.set('aspectW', Number(e.target.value))}
              />
              <span>:</span>
              <input
                type="number"
                min={1}
                value={round(s.aspectH)}
                onChange={(e) => s.set('aspectH', Number(e.target.value))}
              />
            </span>
          </Row>
        </>
      ) : (
        <Row label={`Width × Height (${u})`}>
          <span className="aspect">
            <input
              type="number"
              min={1}
              style={{ width: 66 }}
              value={round(fromInches(wall.width, units))}
              onChange={(e) =>
                setWH(toInches(Number(e.target.value), units), wall.height)
              }
            />
            <span>×</span>
            <input
              type="number"
              min={1}
              style={{ width: 66 }}
              value={round(fromInches(wall.height, units))}
              onChange={(e) =>
                setWH(wall.width, toInches(Number(e.target.value), units))
              }
            />
          </span>
        </Row>
      )}

      {offGrid && (
        <p className="hint warn">
          ⚠ LED cabinets are usually 0.5 m modules. This wall (~{wM.toFixed(2)} × {hM.toFixed(2)} m)
          isn't on a 0.5 m grid — nearest standard build is {nearestM(wM).toFixed(1)} × {nearestM(hM).toFixed(1)} m.
          Off-grid sizes typically need custom panels, masking, or black bars — check the panel spec.
        </p>
      )}

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

      <label className="check">
        <input
          type="checkbox"
          checked={s.dvledLockFill}
          onChange={(e) => s.set('dvledLockFill', e.target.checked)}
        />
        Fill from pitch (realistic)
      </label>

      <div className="field">
        <div className="field-head">
          <span className="row-label">Fill factor</span>
          <span className="num-readout">
            {Math.round((s.dvledLockFill ? lockedFill : s.fillFactor) * 100)}%
          </span>
        </div>
        <input
          className="slider"
          type="range"
          min={0.1}
          max={0.95}
          step={0.05}
          disabled={s.dvledLockFill}
          value={s.dvledLockFill ? lockedFill : s.fillFactor}
          onChange={(e) => s.set('fillFactor', Number(e.target.value))}
        />
        <p className="hint">
          {s.dvledLockFill
            ? `Derived from the pitch — emitter ≈ ${emitterMm.toFixed(1)} mm in the ${s.pitchMm} mm cell. The diode grows slower than the pitch, so coarse pitches show more black gap. Brightness stays constant.`
            : 'How much of each pixel the emitter covers. Lower = wider black grid (stronger screen-door up close).'}
        </p>
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

      <h2>Scale reference</h2>
      <label className="check">
        <input
          type="checkbox"
          checked={s.dvledShowScale}
          onChange={(e) => s.set('dvledShowScale', e.target.checked)}
        />
        Show person + scale bar
      </label>

      <h2>Content</h2>
      <ContentUpload />
    </div>
  );
}
