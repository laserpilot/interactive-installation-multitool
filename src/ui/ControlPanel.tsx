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

      <Row label={`Mount — bottom edge AFF (${u})`}>
        <input
          type="number"
          value={round(fromInches(s.mountBottom, units))}
          onChange={(e) => s.set('mountBottom', toInches(Number(e.target.value), units))}
        />
      </Row>
      <button className="ghost" onClick={s.applyRecommendedMount}>
        Use recommended mount height
      </button>

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

      <Row label="Viewer">
        <select
          value={s.personaId}
          onChange={(e) => s.set('personaId', e.target.value as PersonaId)}
        >
          {Object.values(PERSONAS).map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </Row>

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
