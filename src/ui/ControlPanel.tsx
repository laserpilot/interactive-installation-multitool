import { PERSONAS, type PersonaId } from '../ergonomics/constants';
import { useConfigStore } from '../store/useConfigStore';
import { fromInches, lenUnit, toInches } from './units';
import { ContentUpload } from './ContentUpload';

const PRESETS: { label: string; diagonal: number; aspectW: number; aspectH: number }[] = [
  { label: '32" portrait kiosk', diagonal: 32, aspectW: 9, aspectH: 16 },
  { label: '43" display', diagonal: 43, aspectW: 16, aspectH: 9 },
  { label: '55" 4K', diagonal: 55, aspectW: 16, aspectH: 9 },
  { label: '65" 4K', diagonal: 65, aspectW: 16, aspectH: 9 },
  { label: '86" 4K', diagonal: 86, aspectW: 16, aspectH: 9 },
  { label: '12 ft LED wall', diagonal: 165, aspectW: 16, aspectH: 9 },
];

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="row">
      <span className="row-label">{label}</span>
      <span className="row-control">{children}</span>
    </label>
  );
}

export function ControlPanel() {
  const s = useConfigStore();
  const units = s.units;
  const u = lenUnit(units);

  return (
    <div className="panel">
      <h2>Screen</h2>

      <Row label="Preset">
        <select
          value=""
          onChange={(e) => {
            const p = PRESETS[Number(e.target.value)];
            if (!p) return;
            s.set('diagonal', p.diagonal);
            s.set('aspectW', p.aspectW);
            s.set('aspectH', p.aspectH);
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

      <Row label="Orientation">
        <span className="seg">
          <button
            className={s.aspectW >= s.aspectH ? 'on' : ''}
            onClick={() => {
              if (s.aspectW < s.aspectH) {
                s.set('aspectW', s.aspectH);
                s.set('aspectH', s.aspectW);
              }
            }}
          >
            Landscape
          </button>
          <button
            className={s.aspectW < s.aspectH ? 'on' : ''}
            onClick={() => {
              if (s.aspectW > s.aspectH) {
                s.set('aspectW', s.aspectH);
                s.set('aspectH', s.aspectW);
              }
            }}
          >
            Portrait
          </button>
        </span>
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

      <div className="field">
        <div className="field-head">
          <span className="row-label">Mount — bottom edge AFF ({u})</span>
          <input
            className="num-sm"
            type="number"
            value={round(fromInches(s.mountBottom, units))}
            onChange={(e) => s.set('mountBottom', toInches(Number(e.target.value), units))}
          />
        </div>
        <input
          className="slider"
          type="range"
          min={0}
          max={units === 'metric' ? 244 : 96}
          step={units === 'metric' ? 1 : 0.5}
          value={round(fromInches(s.mountBottom, units))}
          onChange={(e) => s.set('mountBottom', toInches(Number(e.target.value), units))}
        />
      </div>
      <button className="ghost" onClick={s.applyRecommendedMount}>
        Use recommended mount height
      </button>

      <Row label="Mount type">
        <span className="seg">
          <button
            className={s.mountType === 'wall' ? 'on' : ''}
            onClick={() => s.set('mountType', 'wall')}
          >
            Wall
          </button>
          <button
            className={s.mountType === 'stand' ? 'on' : ''}
            onClick={() => s.set('mountType', 'stand')}
          >
            Stand
          </button>
        </span>
      </Row>

      <div className="field">
        <div className="field-head">
          <span className="row-label">Tilt back (°)</span>
          <input
            className="num-sm"
            type="number"
            min={0}
            max={60}
            value={round(s.tiltDeg)}
            onChange={(e) => s.set('tiltDeg', Number(e.target.value))}
          />
        </div>
        <input
          className="slider"
          type="range"
          min={0}
          max={60}
          step={1}
          value={s.tiltDeg}
          onChange={(e) => s.set('tiltDeg', Number(e.target.value))}
        />
      </div>

      <h2>Context</h2>

      <Row label="Use mode">
        <span className="seg">
          <button
            className={s.mode === 'touch' ? 'on' : ''}
            onClick={() => s.set('mode', 'touch')}
          >
            Touch
          </button>
          <button
            className={s.mode === 'view' ? 'on' : ''}
            onClick={() => s.set('mode', 'view')}
          >
            View-only
          </button>
        </span>
      </Row>

      <div className="field">
        <span className="row-label">Viewer</span>
        <div className="persona-group">
          {Object.values(PERSONAS).map((p) => (
            <button
              key={p.id}
              className={s.personaId === p.id ? 'on' : ''}
              onClick={() => s.set('personaId', p.id as PersonaId)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <label className="check">
        <input
          type="checkbox"
          checked={s.showReach}
          onChange={(e) => s.set('showReach', e.target.checked)}
        />
        Show reach zone on screen
      </label>

      {s.mode === 'view' ? (
        <Row label={`Viewing distance (${u})`}>
          <input
            type="number"
            value={round(fromInches(s.viewingDistance, units))}
            onChange={(e) =>
              s.set('viewingDistance', toInches(Number(e.target.value), units))
            }
          />
        </Row>
      ) : (
        <p className="hint">
          Touch mode fixes the viewer at arm's length — the distance a body is
          forced to when reaching the glass.
        </p>
      )}

      {s.cameraView === 'first-person' && (
        <div className="field">
          <div className="field-head">
            <span className="row-label">Field of view (°)</span>
            <input
              className="num-sm"
              type="number"
              min={40}
              max={100}
              value={Math.round(s.fpFov)}
              onChange={(e) => s.set('fpFov', clampFov(Number(e.target.value)))}
            />
          </div>
          <input
            className="slider"
            type="range"
            min={40}
            max={100}
            step={1}
            value={s.fpFov}
            onChange={(e) => s.set('fpFov', Number(e.target.value))}
          />
          <p className="hint">
            Vertical FOV of the “from their eyes” view. ~60° matches the comfortable
            focal cone; widen to feel more peripheral fill (edges distort past ~90°).
          </p>
        </div>
      )}

      <h2>Resolution</h2>
      <Row label="Specify by">
        <span className="seg">
          <button
            className={s.resMode === 'pixels' ? 'on' : ''}
            onClick={() => s.set('resMode', 'pixels')}
          >
            Pixels
          </button>
          <button
            className={s.resMode === 'pitch' ? 'on' : ''}
            onClick={() => s.set('resMode', 'pitch')}
          >
            LED pitch
          </button>
        </span>
      </Row>

      {s.resMode === 'pixels' ? (
        <Row label="Horizontal pixels">
          <input
            type="number"
            value={s.horizontalPixels}
            onChange={(e) => s.set('horizontalPixels', Number(e.target.value))}
          />
        </Row>
      ) : (
        <Row label="Pixel pitch (mm)">
          <input
            type="number"
            step={0.1}
            value={s.pitchMm}
            onChange={(e) => s.set('pitchMm', Number(e.target.value))}
          />
        </Row>
      )}

      <h2>Content</h2>
      <ContentUpload />
    </div>
  );
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

function clampFov(n: number): number {
  return Math.min(100, Math.max(40, n));
}
