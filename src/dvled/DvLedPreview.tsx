import { useCallback, useEffect, useMemo, useState } from 'react';
import { PERSONAS } from '../ergonomics/constants';
import { sizeFromDiagonal } from '../ergonomics/engine';
import { makeTestPatternCanvas } from '../scene/testPattern';
import { useConfigStore } from '../store/useConfigStore';
import { fmtDist } from '../ui/units';
import { DvLedCanvas } from './DvLedCanvas';
import { ScaleOverlay } from './ScaleOverlay';
import { dvledMetrics, mToIn, pitchFillFraction, type Perceived } from './optics';

/** Human-friendly height label, e.g. 5'9" or 175 cm. */
function fmtHeight(inches: number, metric: boolean): string {
  if (metric) return `${Math.round(inches * 2.54)} cm`;
  const ft = Math.floor(inches / 12);
  const inch = Math.round(inches - ft * 12);
  return `${ft}'${inch}"`;
}

const PERCEIVED_LABEL: Record<Perceived, { text: string; tone: string }> = {
  pixelated: { text: 'Pixels clearly visible', tone: 'bad' },
  soft: { text: 'Pixels faintly visible', tone: 'caution' },
  clean: { text: 'Looks clean', tone: 'good' },
  retina: { text: 'Pixel-perfect (retina)', tone: 'good' },
};

export function DvLedPreview() {
  const s = useConfigStore();
  const units = s.units;

  const size = useMemo(
    () => sizeFromDiagonal(s.diagonal, s.aspectW, s.aspectH),
    [s.diagonal, s.aspectW, s.aspectH],
  );
  const m = useMemo(
    () => dvledMetrics(size.width, size.height, s.pitchMm, s.dvledDistance, s.dvledFov),
    [size.width, size.height, s.pitchMm, s.dvledDistance, s.dvledFov],
  );

  // Content source: uploaded image, or the procedural test pattern.
  const [source, setSource] = useState<TexImageSource | null>(null);
  useEffect(() => {
    if (s.contentUrl) {
      const img = new Image();
      img.onload = () => setSource(img);
      img.src = s.contentUrl;
      return;
    }
    setSource(makeTestPatternCanvas(s.aspectW, s.aspectH, s.diagonal));
  }, [s.contentUrl, s.aspectW, s.aspectH, s.diagonal]);

  const tone = PERCEIVED_LABEL[m.perceived];

  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });
  const onCanvasResize = useCallback((w: number, h: number) => {
    setCanvasSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
  }, []);

  const persona = PERSONAS[s.dvledScalePersona];
  const effectiveFill = s.dvledLockFill ? pitchFillFraction(s.pitchMm) : s.fillFactor;

  return (
    <div className="dvled-stage">
      <div className="dvled-frame">
        <DvLedCanvas
          source={source}
          cols={m.nativeCols}
          rows={m.nativeRows}
          wallFillFraction={m.wallFillFraction}
          fillFactor={effectiveFill}
          shape={s.ledShape}
          aspect={size.width / size.height}
          onResize={onCanvasResize}
        />
        {s.dvledShowScale && canvasSize.w > 0 && (
          <div
            className="dvled-overlay"
            style={{ width: canvasSize.w, height: canvasSize.h }}
          >
            <ScaleOverlay
              cssW={canvasSize.w}
              cssH={canvasSize.h}
              viewSpanWidthIn={m.viewSpanWidthIn}
              wallFillFraction={m.wallFillFraction}
              statureIn={persona.statureHeight}
              eyeHeightIn={persona.eyeHeight}
              figureLabel={fmtHeight(persona.statureHeight, units === 'metric')}
              seated={persona.seated}
              metric={units === 'metric'}
            />
          </div>
        )}
      </div>

      <div className="dvled-readout">
        <div className={`dvled-verdict ${tone.tone}`}>
          <span className="dvled-dot" />
          {tone.text}
          <span className="dvled-sub">at {fmtDist(s.dvledDistance, units)}</span>
        </div>
        <dl className="dvled-metrics">
          <div>
            <dt>Panel size (W × H)</dt>
            <dd>
              {fmtDist(size.width, units)} × {fmtDist(size.height, units)}
            </dd>
          </div>
          <div>
            <dt>Native resolution</dt>
            <dd>
              {Math.round(m.nativeCols).toLocaleString()} ×{' '}
              {Math.round(m.nativeRows).toLocaleString()}
            </dd>
          </div>
          <div>
            <dt>Sharpness</dt>
            <dd>{m.ppd === Infinity ? '∞' : Math.round(m.ppd)} px/°</dd>
          </div>
          <div>
            <dt>Clean from</dt>
            <dd>{fmtDist(mToIn(m.minCleanDistanceM), units)}</dd>
          </div>
          <div>
            <dt>Pixel-free from</dt>
            <dd>{fmtDist(mToIn(m.retinaDistanceM), units)}</dd>
          </div>
        </dl>
        <p className="dvled-note">
          {m.fillsFrame
            ? `You're inside the wall — this frame shows ~${Math.round(
                m.cellsAcrossView,
              ).toLocaleString()} of its ${Math.round(
                m.nativeCols,
              ).toLocaleString()} columns across a ${s.dvledFov}° gaze.`
            : `The whole wall now sits inside your ${s.dvledFov}° field of view.`}{' '}
          You're at {fmtDist(s.dvledDistance, units)}; it reads clean from{' '}
          {fmtDist(mToIn(m.minCleanDistanceM), units)} back.
        </p>
      </div>
    </div>
  );
}
