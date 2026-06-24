import { useConfigStore } from '../store/useConfigStore';
import { ContentUpload } from '../ui/ContentUpload';
import { fmtDist, fmtLen, fromInches, toInches } from '../ui/units';
import { distanceFromWidth, widthFromDistance } from './projectionMath';

// Projector / lens presets — common throw ratios and lumen classes.
const PRESETS: {
  label: string;
  throw: number;
  lumens: number;
  resW: number;
  resH: number;
}[] = [
  { label: 'Short-throw, 1080p — 0.5 / 4k lm', throw: 0.5, lumens: 4000, resW: 1920, resH: 1080 },
  { label: 'Standard, 1080p — 1.5 / 5k lm', throw: 1.5, lumens: 5000, resW: 1920, resH: 1080 },
  { label: 'Install 4K — 1.2 / 10k lm', throw: 1.2, lumens: 10000, resW: 3840, resH: 2160 },
  { label: 'Long-throw event — 2.5 / 20k lm', throw: 2.5, lumens: 20000, resW: 1920, resH: 1200 },
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

export function ProjectionControls() {
  const s = useConfigStore();
  const units = s.units;
  const metric = units === 'metric';

  // Keep distance and width two ends of one number: editing either (or the
  // throw ratio) recomputes the other so the store never drifts.
  function setDistance(distIn: number) {
    s.set('projDistance', distIn);
    s.set('projWidth', widthFromDistance(distIn, s.projThrowRatio));
  }
  function setWidth(widthIn: number) {
    s.set('projWidth', widthIn);
    s.set('projDistance', distanceFromWidth(widthIn, s.projThrowRatio));
  }
  function setThrow(tr: number) {
    s.set('projThrowRatio', tr);
    if (s.projPin === 'width') {
      s.set('projDistance', distanceFromWidth(s.projWidth, tr));
    } else {
      s.set('projWidth', widthFromDistance(s.projDistance, tr));
    }
  }

  // Aspect ↔ resolution lock. When locked, editing the resolution rewrites the
  // aspect to its gcd-reduced ratio; editing the aspect keeps the pixel width and
  // recomputes the pixel height so the two never drift apart.
  function deriveAspectFromRes(w: number, h: number) {
    const g = gcd(w, h) || 1;
    s.set('projAspectW', Math.round(w / g));
    s.set('projAspectH', Math.round(h / g));
  }
  function setAspect(w: number, h: number) {
    s.set('projAspectW', w);
    s.set('projAspectH', h);
    if (s.projResLock && w > 0 && h > 0) {
      s.set('projResH', Math.round(s.projResW * (h / w)));
    }
  }
  function setResW(w: number) {
    s.set('projResW', w);
    if (s.projResLock && w > 0 && s.projResH > 0) deriveAspectFromRes(w, s.projResH);
  }
  function setResH(h: number) {
    s.set('projResH', h);
    if (s.projResLock && h > 0 && s.projResW > 0) deriveAspectFromRes(s.projResW, h);
  }

  // Slider bounds in the active unit. Distance 1–60 ft; width 2–40 ft.
  const distMin = metric ? 30 : 12;
  const distMax = metric ? 1800 : 720;
  const widthMin = metric ? 60 : 24;
  const widthMax = metric ? 1200 : 480;
  const step = metric ? 5 : 2;

  // Manual entry for distance/width works in the user's big unit (ft or m), not
  // raw inches, so typing an exact size is natural.
  const bigUnit = metric ? 'm' : 'ft';
  const bigVal = (inches: number) =>
    metric ? Math.round(inches * 2.54) / 100 : Math.round((inches / 12) * 100) / 100;
  const bigToIn = (v: number) => (metric ? (v * 100) / 2.54 : v * 12);

  const distVal = round(fromInches(s.projDistance, units));
  const widthVal = round(fromInches(s.projWidth, units));
  const pinDistance = s.projPin === 'distance';

  return (
    <div className="panel">
      <h2>Projector</h2>

      <Row label="Preset">
        <select
          value=""
          onChange={(e) => {
            const p = PRESETS[Number(e.target.value)];
            if (!p) return;
            s.set('projLumens', p.lumens);
            s.set('projResW', p.resW);
            s.set('projResH', p.resH);
            if (s.projResLock) deriveAspectFromRes(p.resW, p.resH);
            setThrow(p.throw);
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

      <Row label="Throw ratio">
        <input
          type="number"
          step={0.05}
          min={0.2}
          value={s.projThrowRatio}
          onChange={(e) => setThrow(Number(e.target.value))}
        />
      </Row>

      <Row label="Lumens (each)">
        <input
          type="number"
          step={250}
          min={100}
          value={s.projLumens}
          onChange={(e) => s.set('projLumens', Number(e.target.value))}
        />
      </Row>

      <Row label="Stacked units">
        <span className="seg sm">
          {[1, 2, 3, 4].map((n) => (
            <button
              key={n}
              className={s.projectorCount === n ? 'on' : ''}
              onClick={() => s.set('projectorCount', n)}
            >
              {n}×
            </button>
          ))}
        </span>
      </Row>

      {s.projectorCount > 1 && (
        <>
          <Row label="Stack efficiency">
            <span className="num-entry">
              <input
                type="number"
                step={1}
                min={0}
                max={100}
                value={Math.round(s.projStackEff * 100)}
                onChange={(e) =>
                  s.set('projStackEff', Math.min(1, Math.max(0, Number(e.target.value) / 100)))
                }
              />
              <span className="unit">%</span>
            </span>
          </Row>
          <p className="hint">
            Lumens each added unit really contributes — real stacks lose ~10% to
            alignment, so 2× ≈ 1.9×, not 2×.
          </p>
        </>
      )}

      <Row label="Blended array">
        <span className="seg sm">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              className={s.projArrayCount === n ? 'on' : ''}
              onClick={() => s.set('projArrayCount', n)}
            >
              {n === 1 ? 'Off' : `${n}×`}
            </button>
          ))}
        </span>
      </Row>

      {s.projArrayCount > 1 && (
        <>
          <div className="field">
            <div className="field-head">
              <span className="row-label">Overlap</span>
              <span className="num-readout">{s.projArrayOverlapPct}%</span>
            </div>
            <input
              className="slider"
              type="range"
              min={0}
              max={50}
              step={1}
              value={s.projArrayOverlapPct}
              onChange={(e) => s.set('projArrayOverlapPct', Number(e.target.value))}
            />
          </div>
          <p className="hint">
            Projectors side by side, each overlapping its neighbour. Total width ={' '}
            {s.projArrayCount}× one image minus the overlaps; the seams run ~2× bright
            until an edge-blend curve tapers them.
          </p>
        </>
      )}

      <Row label="Aspect">
        <span className="aspect">
          <input
            type="number"
            min={1}
            value={s.projAspectW}
            onChange={(e) => setAspect(Number(e.target.value), s.projAspectH)}
          />
          <span>:</span>
          <input
            type="number"
            min={1}
            value={s.projAspectH}
            onChange={(e) => setAspect(s.projAspectW, Number(e.target.value))}
          />
        </span>
      </Row>

      <Row label="Resolution">
        <span className="res">
          <input
            type="number"
            min={1}
            value={s.projResW}
            onChange={(e) => setResW(Number(e.target.value))}
          />
          <span>×</span>
          <input
            type="number"
            min={1}
            value={s.projResH}
            onChange={(e) => setResH(Number(e.target.value))}
          />
        </span>
      </Row>

      <Row label="Link aspect ↔ res">
        <span className="seg sm">
          <button
            className={s.projResLock ? 'on' : ''}
            onClick={() => s.set('projResLock', true)}
          >
            Locked
          </button>
          <button
            className={!s.projResLock ? 'on' : ''}
            onClick={() => s.set('projResLock', false)}
          >
            Free
          </button>
        </span>
      </Row>

      <h2>Geometry</h2>

      <Row label="Drive by">
        <span className="seg sm">
          <button
            className={pinDistance ? 'on' : ''}
            onClick={() => s.set('projPin', 'distance')}
          >
            Distance
          </button>
          <button
            className={!pinDistance ? 'on' : ''}
            onClick={() => s.set('projPin', 'width')}
          >
            Width
          </button>
        </span>
      </Row>

      {pinDistance ? (
        <>
          <div className="field">
            <div className="field-head">
              <span className="row-label">Throw distance</span>
              <span className="num-entry">
                <input
                  type="number"
                  step={0.1}
                  min={0}
                  value={bigVal(s.projDistance)}
                  onChange={(e) => setDistance(bigToIn(Number(e.target.value)))}
                />
                <span className="unit">{bigUnit}</span>
              </span>
            </div>
            <input
              className="slider"
              type="range"
              min={distMin}
              max={distMax}
              step={step}
              value={distVal}
              onChange={(e) => setDistance(toInches(Number(e.target.value), units))}
            />
          </div>
          <Row label="Image width">
            <span className="num-readout">{fmtDist(s.projWidth, units)}</span>
          </Row>
        </>
      ) : (
        <>
          <div className="field">
            <div className="field-head">
              <span className="row-label">Image width</span>
              <span className="num-entry">
                <input
                  type="number"
                  step={0.1}
                  min={0}
                  value={bigVal(s.projWidth)}
                  onChange={(e) => setWidth(bigToIn(Number(e.target.value)))}
                />
                <span className="unit">{bigUnit}</span>
              </span>
            </div>
            <input
              className="slider"
              type="range"
              min={widthMin}
              max={widthMax}
              step={step}
              value={widthVal}
              onChange={(e) => setWidth(toInches(Number(e.target.value), units))}
            />
          </div>
          <Row label="Throw distance">
            <span className="num-readout">{fmtDist(s.projDistance, units)}</span>
          </Row>
        </>
      )}
      <p className="hint">
        Throw ratio links width and distance — pin one, the other follows.
      </p>

      <div className="field">
        <div className="field-head">
          <span className="row-label">Lens height</span>
          <span className="num-readout">{fmtLen(s.projLensAff, units)}</span>
        </div>
        <input
          className="slider"
          type="range"
          min={0}
          max={metric ? 420 : 168}
          step={metric ? 2 : 1}
          value={round(fromInches(s.projLensAff, units))}
          onChange={(e) => s.set('projLensAff', toInches(Number(e.target.value), units))}
        />
      </div>

      <Row label="Lens origin">
        <span className="seg sm">
          <button
            className={s.projLensOrigin === 'center' ? 'on' : ''}
            onClick={() => s.set('projLensOrigin', 'center')}
          >
            Centre
          </button>
          <button
            className={s.projLensOrigin === 'top' ? 'on' : ''}
            onClick={() => s.set('projLensOrigin', 'top')}
          >
            Top
          </button>
        </span>
      </Row>

      <div className="field">
        <div className="field-head">
          <span className="row-label">Vertical lens shift</span>
          <span className="num-readout">{s.projLensShiftPct > 0 ? '+' : ''}{s.projLensShiftPct}%</span>
        </div>
        <input
          className="slider"
          type="range"
          min={-130}
          max={130}
          step={5}
          value={s.projLensShiftPct}
          onChange={(e) => s.set('projLensShiftPct', Number(e.target.value))}
        />
        <p className="hint">
          Optical shift — moves the image up (+) or down (−) with no keystone.
          0% sits at the lens origin above.
        </p>
      </div>

      <div className="field">
        <div className="field-head">
          <span className="row-label">Tilt</span>
          <span className="num-readout">{s.projTiltDeg}°</span>
        </div>
        <input
          className="slider"
          type="range"
          min={-30}
          max={30}
          step={1}
          value={s.projTiltDeg}
          onChange={(e) => s.set('projTiltDeg', Number(e.target.value))}
        />
        <p className="hint">
          Physically tilting the projector — this is what bends the image into a
          keystone.
        </p>
      </div>

      <h2>Environment</h2>

      <div className="field">
        <div className="field-head">
          <span className="row-label">Ambient light</span>
          <span className="num-readout">{s.projAmbientFc} fc</span>
        </div>
        <input
          className="slider"
          type="range"
          min={0}
          max={100}
          step={1}
          value={s.projAmbientFc}
          onChange={(e) => s.set('projAmbientFc', Number(e.target.value))}
        />
        <p className="hint">
          Foot-candles of competing room light. The image needs to out-shine it.
        </p>
      </div>

      <h2>Surface</h2>

      <Row label="Screen gain">
        <span className="num-entry">
          <input
            type="number"
            step={0.1}
            min={0.1}
            value={s.projScreenGain}
            onChange={(e) => s.set('projScreenGain', Math.max(0.1, Number(e.target.value)))}
          />
          <span className="unit">×</span>
        </span>
      </Row>
      <p className="hint">
        Luminance (foot-Lamberts) = brightness (fc) × gain. 1.0 = matte white.
      </p>

      <Row label="Show">
        <span className="seg sm">
          <button
            className={s.projSurfaceView === 'heatmap' ? 'on' : ''}
            onClick={() => s.set('projSurfaceView', 'heatmap')}
          >
            Heatmap
          </button>
          <button
            className={s.projSurfaceView === 'content' ? 'on' : ''}
            onClick={() => s.set('projSurfaceView', 'content')}
          >
            Content
          </button>
        </span>
      </Row>

      {s.projSurfaceView === 'content' && <ContentUpload />}

      <label className="check">
        <input
          type="checkbox"
          checked={s.projShowFigure}
          onChange={(e) => s.set('projShowFigure', e.target.checked)}
        />
        Show person for scale
      </label>
    </div>
  );
}
