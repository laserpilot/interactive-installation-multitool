import { useEffect, useMemo, useState } from 'react';
import { sizeFromDiagonal } from '../ergonomics/engine';
import { makeTestPatternCanvas } from '../scene/testPattern';
import { useConfigStore } from '../store/useConfigStore';
import { fmtDist } from '../ui/units';
import { DvLedCanvas } from './DvLedCanvas';
import { dvledMetrics, inToM, type Perceived } from './optics';

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
  const distM = inToM(s.dvledDistance);

  return (
    <div className="dvled-stage">
      <div className="dvled-frame">
        <DvLedCanvas
          source={source}
          cols={m.nativeCols}
          rows={m.nativeRows}
          wallFillFraction={m.wallFillFraction}
          fillFactor={s.fillFactor}
          shape={s.ledShape}
          aspect={size.width / size.height}
        />
      </div>

      <div className="dvled-readout">
        <div className={`dvled-verdict ${tone.tone}`}>
          <span className="dvled-dot" />
          {tone.text}
          <span className="dvled-sub">at {fmtDist(s.dvledDistance, units)}</span>
        </div>
        <dl className="dvled-metrics">
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
            <dd>{m.minCleanDistanceM.toFixed(1)} m</dd>
          </div>
          <div>
            <dt>Pixel-free from</dt>
            <dd>{m.retinaDistanceM.toFixed(1)} m</dd>
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
          You're at {distM.toFixed(1)} m; it reads clean from{' '}
          {m.minCleanDistanceM.toFixed(1)} m back.
        </p>
      </div>
    </div>
  );
}
