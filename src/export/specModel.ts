// Spec-sheet model + Markdown serialization (no React). Turns the current config
// into a proposal-ready document — the inputs PLUS the computed verdicts each tab
// already shows on screen. The numbers come from the exact same engine functions
// the live panels call, wired with the same arguments, so the sheet can't drift
// from what the user sees.

import { PERSONAS } from '../ergonomics/constants';
import { sizeFromDiagonal } from '../ergonomics/engine';
import { dvledMetrics } from '../dvled/optics';
import {
  projectionMetrics,
  BAND_LABEL as PROJ_BAND_LABEL,
  BAND_TONE as PROJ_BAND_TONE,
} from '../projection/projectionMath';
import {
  bodyCoverage,
  BAND_LABEL as SENSOR_BAND_LABEL,
  BAND_TONE as SENSOR_BAND_TONE,
  type SensorParams,
} from '../sensor/sensorMath';
import { listenerVerdict, makeBasis, USE_CASES } from '../speaker/speakerMath';
import { type AppTab, type ConfigState } from '../store/useConfigStore';
import { fmtDist, fmtLen } from '../ui/units';

export type Tone = 'good' | 'caution' | 'bad';

export type SpecRow = [label: string, value: string];
export interface SpecSection {
  id: AppTab;
  title: string;
  rows: SpecRow[];
  verdict?: { text: string; tone: Tone };
}
export interface SpecModel {
  title: string;
  savedAt: string;
  unitsLabel: string;
  sections: SpecSection[];
}

const TAB_TITLE: Record<AppTab, string> = {
  placement: 'Monitor Placement',
  table: 'Table Monitor',
  dvled: 'LED Display',
  projection: 'Projection',
  sensor: 'Sensor Coverage',
  speaker: 'Speaker SPL',
};

export const VLEVEL: Record<Tone, string> = { good: 'GOOD', caution: 'CAUTION', bad: 'NEEDS WORK' };
const PERCEIVED_TONE: Record<string, Tone> = {
  pixelated: 'bad',
  soft: 'caution',
  clean: 'good',
  retina: 'good',
};
const PERCEIVED_TEXT: Record<string, string> = {
  pixelated: 'Pixels clearly visible',
  soft: 'Pixels faintly visible',
  clean: 'Looks clean',
  retina: 'Pixel-perfect (retina)',
};

const round = (n: number) => (Number.isFinite(n) ? Math.round(n).toLocaleString() : '—');
const round1 = (n: number) => (Number.isFinite(n) ? n.toFixed(1) : '—');
const pct = (frac: number) => `${Math.round(frac * 100)}%`;

/** Build the full per-tab spec model from live state. Each section's verdict is
 *  computed by the same function the on-screen panel uses. */
export function buildSpecModel(s: ConfigState): SpecModel {
  const u = s.units;
  const size = sizeFromDiagonal(s.diagonal, s.aspectW, s.aspectH);

  // --- Monitor Placement ---
  const v = s.getVerdict();
  const placement: SpecSection = {
    id: 'placement',
    title: TAB_TITLE.placement,
    rows: [
      ['Screen', `${Math.round(s.diagonal)}"  ${s.aspectW}:${s.aspectH}`],
      ['Active area (W × H)', `${fmtLen(size.width, u)} × ${fmtLen(size.height, u)}`],
      ['Mounting', s.mountType === 'stand' ? 'Stand / podium' : 'Wall'],
      ['Mount height (bottom)', fmtLen(s.mountBottom, u)],
      ['Tilt', `${Math.round(s.tiltDeg)}°`],
      ['Use', s.mode === 'touch' ? 'Touch (arm’s length)' : 'View only'],
      ['Viewing distance', s.mode === 'touch' ? '—' : fmtDist(s.viewingDistance, u)],
      ['Viewer', PERSONAS[s.personaId].label],
      [
        'Resolution',
        s.resMode === 'pixels' ? `${s.horizontalPixels.toLocaleString()} px wide` : `${s.pitchMm} mm pitch`,
      ],
      ['Recommended mount', fmtLen(v.recommendedMountBottom, u)],
    ],
    verdict: { text: `${VLEVEL[v.level]} — ${Math.round(v.horizontalAngle)}° horizontal FOV`, tone: v.level },
  };

  // --- Table Monitor (inputs only; analysis is the on-screen reach map) ---
  const table: SpecSection = {
    id: 'table',
    title: TAB_TITLE.table,
    rows: [
      ['Screen', `${Math.round(s.diagonal)}"  ${s.aspectW}:${s.aspectH}`],
      ['Surface height', fmtLen(s.tableHeight, u)],
      ['Bezel / frame', fmtLen(s.tableBezel, u)],
      ['People around table', String(s.tableSeats)],
      ['Reach overlay', s.tableShowReach ? 'On' : 'Off'],
    ],
  };

  // --- LED Display ---
  const led = dvledMetrics(size.width, size.height, s.pitchMm, s.dvledDistance, s.dvledFov);
  const dvled: SpecSection = {
    id: 'dvled',
    title: TAB_TITLE.dvled,
    rows: [
      ['Wall', `${Math.round(s.diagonal)}"  ${s.aspectW}:${s.aspectH}`],
      ['Pixel pitch', `${s.pitchMm} mm`],
      ['Native resolution', `${round(led.nativeCols)} × ${round(led.nativeRows)}`],
      ['Viewer distance', fmtDist(s.dvledDistance, u)],
      ['Field of view', `${Math.round(s.dvledFov)}°`],
      ['Pixels per degree', round(led.ppd)],
      ['LED shape', s.ledShape],
    ],
    verdict: { text: PERCEIVED_TEXT[led.perceived], tone: PERCEIVED_TONE[led.perceived] },
  };

  // --- Projection ---
  const pm = projectionMetrics({
    throwRatio: s.projThrowRatio,
    distanceIn: s.projDistance,
    aspectW: s.projAspectW,
    aspectH: s.projAspectH,
    lumens: s.projLumens,
    projectorCount: s.projectorCount,
    stackEff: s.projStackEff,
    resW: s.projResW,
    resH: s.projResH,
    ambientFc: s.projAmbientFc,
    screenGain: s.projScreenGain,
  });
  const projection: SpecSection = {
    id: 'projection',
    title: TAB_TITLE.projection,
    rows: [
      ['Throw ratio', `${round1(s.projThrowRatio)}:1`],
      ['Lens distance', fmtDist(s.projDistance, u)],
      ['Image (W × H)', `${fmtDist(pm.widthIn, u)} × ${fmtDist(pm.heightIn, u)}`],
      ['Aspect', `${s.projAspectW}:${s.projAspectH}`],
      ['Projectors', s.projectorCount > 1 ? `${s.projectorCount} stacked` : '1'],
      ['Rated / effective lumens', `${round(s.projLumens)} / ${round(pm.effectiveLumens)} lm`],
      ['Ambient light', `${round(s.projAmbientFc)} fc`],
      ['Screen gain', round1(s.projScreenGain)],
      ['Surface luminance', `${round1(pm.footLamberts)} fL`],
      ['Contrast vs ambient', Number.isFinite(pm.contrastRatio) ? `${round(pm.contrastRatio)}:1` : '∞'],
      ['Native resolution', `${s.projResW} × ${s.projResH}`],
    ],
    verdict: { text: PROJ_BAND_LABEL[pm.band], tone: PROJ_BAND_TONE[pm.band] },
  };

  // --- Sensor Coverage ---
  const sensorPersona = PERSONAS[s.sensorPersona];
  const sensorParams: SensorParams = {
    mount: s.sensorMount,
    mountAffIn: s.sensorMountAff,
    pitchDeg: s.sensorPitchDeg,
    yawDeg: s.sensorYawDeg,
    hFovDeg: s.sensorHFov,
    vFovDeg: s.sensorVFov,
    minRangeIn: s.sensorMinRange,
    confNearIn: s.sensorConfNear,
    confFarIn: s.sensorConfFar,
    maxRangeIn: s.sensorMaxRange,
  };
  const cover = bodyCoverage(sensorParams, sensorPersona, s.sensorPersonX / 12, s.sensorPersonZ / 12);
  const sensor: SpecSection = {
    id: 'sensor',
    title: TAB_TITLE.sensor,
    rows: [
      ['Mount', `${s.sensorMount} @ ${fmtLen(s.sensorMountAff, u)}`],
      ['Aim (pitch / yaw)', `${Math.round(s.sensorPitchDeg)}° / ${Math.round(s.sensorYawDeg)}°`],
      ['Field of view (H × V)', `${Math.round(s.sensorHFov)}° × ${Math.round(s.sensorVFov)}°`],
      ['Sensing mode', s.sensorMode],
      ['Confidence window', `${fmtDist(s.sensorConfNear, u)} – ${fmtDist(s.sensorConfFar, u)}`],
      ['Range (min – max)', `${fmtDist(s.sensorMinRange, u)} – ${fmtDist(s.sensorMaxRange, u)}`],
      ['Test subject', `${sensorPersona.label} @ (${fmtDist(s.sensorPersonX, u)}, ${fmtDist(s.sensorPersonZ, u)})`],
      ['Core keypoints in frame', pct(cover.fracCoreInFov)],
    ],
    verdict: { text: SENSOR_BAND_LABEL[cover.band], tone: SENSOR_BAND_TONE[cover.band] },
  };

  // --- Speaker SPL ---
  const uc = USE_CASES[s.speakerUseCase];
  const bases = s.speakers.map(makeBasis);
  const lv = listenerVerdict(
    bases,
    [s.speakerListenerX / 12, s.speakerEarHeight / 12, s.speakerListenerZ / 12],
    uc,
    s.speakerNoiseFloor,
  );
  const lvl = s.speakerWeighting === 'flat' ? lv.point.flat : lv.point.dba;
  const speaker: SpecSection = {
    id: 'speaker',
    title: TAB_TITLE.speaker,
    rows: [
      ['Speakers', String(s.speakers.length)],
      ['Use case', uc.label],
      ['Amplifier power', `${round(s.speakerAmpW)} W`],
      ['Ear / listening height', fmtLen(s.speakerEarHeight, u)],
      ['Ambient noise floor', `${round(s.speakerNoiseFloor)} dBA`],
      ['Listener position', `(${fmtDist(s.speakerListenerX, u)}, ${fmtDist(s.speakerListenerZ, u)})`],
      ['SPL at listener', Number.isFinite(lvl) ? `${round(lvl)} ${s.speakerWeighting === 'flat' ? 'dB' : 'dBA'}` : '—'],
      ['Signal-to-noise', `${round(lv.snr)} dB (${lv.intelligible})`],
      ['Headroom to max', `${round(lv.headroomDb)} dB`],
    ],
    verdict: { text: lv.label, tone: lv.tone },
  };

  return {
    title: 'Interactive Installation Multitool — Spec Sheet',
    savedAt: new Date().toLocaleString(),
    unitsLabel: u === 'metric' ? 'Metric' : 'US / Imperial',
    sections: [placement, table, dvled, projection, sensor, speaker],
  };
}

/** Plain-Markdown rendering for a `.md` download. */
export function toMarkdown(model: SpecModel): string {
  const lines: string[] = [
    `# ${model.title}`,
    '',
    `*Generated ${model.savedAt} · Units: ${model.unitsLabel}*`,
    '',
  ];
  for (const sec of model.sections) {
    lines.push(`## ${sec.title}`, '');
    if (sec.verdict) lines.push(`**${VLEVEL[sec.verdict.tone]} — ${sec.verdict.text}**`, '');
    lines.push('| Field | Value |', '| --- | --- |');
    for (const [label, value] of sec.rows) lines.push(`| ${label} | ${value} |`);
    lines.push('');
  }
  return lines.join('\n');
}
