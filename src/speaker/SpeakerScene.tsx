import { Canvas } from '@react-three/fiber';
import { Billboard, Grid, Line, OrbitControls, PerspectiveCamera, Text } from '@react-three/drei';
import { useMemo } from 'react';
import { useConfigStore } from '../store/useConfigStore';
import { fmtDist } from '../ui/units';
import { CoveragePlane } from './CoveragePlane';
import { SpeakerCone } from './SpeakerCone';
import {
  coneRays,
  coverageField,
  dbaFromFlat,
  ftFromIn,
  inFromFt,
  listenerVerdict,
  makeBasis,
  POWER_LABEL,
  POWER_TONE,
  powerBudget,
  splColor,
  splGradientCss,
  uniformityGradientCss,
  USE_CASES,
} from './speakerMath';

function Lights() {
  return (
    <>
      <ambientLight intensity={0.55} />
      <hemisphereLight args={['#ffffff', '#aab2bd', 1.5]} />
      <directionalLight position={[6, 14, 9]} intensity={1.2} />
      <directionalLight position={[-8, 8, 6]} intensity={0.5} />
    </>
  );
}

function Floor() {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[300, 300]} />
        <meshStandardMaterial color="#b9c0c9" />
      </mesh>
      <Grid
        args={[120, 120]}
        cellSize={1}
        cellColor="#9aa3ae"
        sectionSize={5}
        sectionColor="#6f7a87"
        infiniteGrid
        fadeDistance={90}
        position={[0, 0.002, 0]}
      />
    </>
  );
}

const LINE = '#10202e';
type V3 = [number, number, number];
const midpt = (a: V3, b: V3): V3 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];

function DimLine({ a, b, label }: { a: V3; b: V3; label: string }) {
  const m = midpt(a, b);
  return (
    <group>
      <Line points={[a, b]} color={LINE} lineWidth={1.5} transparent opacity={0.8} />
      <Billboard position={[m[0], m[1] + 0.25, m[2]]}>
        <Text fontSize={0.34} color={LINE} outlineWidth={0.015} outlineColor="#ffffff" anchorX="center" anchorY="middle">
          {label}
        </Text>
      </Billboard>
    </group>
  );
}

/** A simple standing listener at the listening position, tinted by the verdict
 *  tone, with a floating level label at head height. */
function Listener({ x, z, earFt, color, label }: { x: number; z: number; earFt: number; color: string; label: string }) {
  const bodyH = earFt * 0.62;
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, earFt * 0.5, 0]}>
        <cylinderGeometry args={[0.28, 0.34, bodyH, 16]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, earFt * 0.5 + bodyH / 2 + 0.32, 0]}>
        <sphereGeometry args={[0.3, 18, 18]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* ground ring marking the spot */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.45, 0.62, 28]} />
        <meshBasicMaterial color={color} transparent opacity={0.85} side={2} toneMapped={false} />
      </mesh>
      <Billboard position={[0, earFt + 1.0, 0]}>
        <Text fontSize={0.5} color={LINE} outlineWidth={0.02} outlineColor="#ffffff" anchorX="center" anchorY="middle">
          {label}
        </Text>
      </Billboard>
    </group>
  );
}

const INTELLIGIBLE_LABEL: Record<string, string> = {
  good: 'clear',
  fair: 'usable',
  poor: 'struggles',
};

export function SpeakerScene() {
  const s = useConfigStore();
  const units = s.units;
  const u = USE_CASES[s.speakerUseCase];
  const flat = s.speakerWeighting === 'flat';

  const bases = useMemo(() => s.speakers.map(makeBasis), [s.speakers]);
  const rays = useMemo(
    () => s.speakers.map((spk) => coneRays(spk, u.loDba)),
    [s.speakers, u],
  );
  const field = useMemo(
    () => coverageField(s.speakers, s.speakerEarHeight, u, 60),
    [s.speakers, s.speakerEarHeight, u],
  );

  const lx = ftFromIn(s.speakerListenerX);
  const lz = ftFromIn(s.speakerListenerZ);
  const earFt = ftFromIn(s.speakerEarHeight);

  const verdict = useMemo(
    () => listenerVerdict(bases, [lx, earFt, lz], u, s.speakerNoiseFloor),
    [bases, lx, earFt, lz, u, s.speakerNoiseFloor],
  );
  const tone = verdict.tone;

  // The number shown on the listener + readout respects the dB ↔ dBA toggle.
  const unit = flat ? 'dB' : 'dBA';
  const lvl = flat ? verdict.point.flat : verdict.point.dba;
  const lvlStr = Number.isFinite(lvl) ? `${Math.round(lvl)} ${unit}` : '—';
  const maxStr = Number.isFinite(verdict.point.maxDba) ? `${Math.round(verdict.point.maxDba)} dBA` : '—';
  const budget = powerBudget(s.speakers, s.speakerAmpW);
  const TONE_VAR: Record<'good' | 'caution' | 'bad', string> = {
    good: 'var(--good)',
    caution: 'var(--caution)',
    bad: 'var(--bad)',
  };
  const toneColor = splColor(verdict.point.dba, u);

  // Frame the cluster + plane.
  const maxMountY = Math.max(...s.speakers.map((spk) => ftFromIn(spk.mountAffIn)), 8);
  const half = field.sizeFt / 2;
  const cxF = field.minX + half;
  const czF = field.minZ + half;
  const camX = cxF - (half + 6);
  const camY = Math.max(maxMountY + 5, field.sizeFt * 0.8);
  const camZ = czF + half + 8;
  const target: V3 = [cxF, Math.max(2, earFt), czF];

  const fmtArea = (sqft: number) =>
    units === 'metric' ? `${(sqft * 0.092903).toFixed(1)} m²` : `${Math.round(sqft)} ft²`;

  return (
    <div className="proj-stage">
      <div className="proj-frame">
        <Canvas
          dpr={[1, 2]}
          style={{ background: 'linear-gradient(180deg,#dfe4ea 0%,#bcc4ce 55%,#9ca5b0 100%)' }}
        >
          <PerspectiveCamera makeDefault fov={45} position={[camX, camY, camZ]} />
          <OrbitControls target={target} maxPolarAngle={Math.PI / 2} />
          <Lights />
          <Floor />

          {s.speakerShowField && (
            <CoveragePlane field={field} view={s.speakerCoverageView} useCase={u} />
          )}

          {rays.map((r, i) => (
            <SpeakerCone key={i} rays={r} useCase={u} selected={i === s.speakerSel} />
          ))}

          <Listener x={lx} z={lz} earFt={earFt} color={toneColor} label={lvlStr} />

          {s.speakerShowMeasurements && (
            <>
              {/* selected speaker's height + slant to the listener */}
              {bases[s.speakerSel] && (
                <>
                  <DimLine
                    a={[bases[s.speakerSel].pos[0], 0, bases[s.speakerSel].pos[2]]}
                    b={bases[s.speakerSel].pos}
                    label={`${fmtDist(s.speakers[s.speakerSel].mountAffIn, units)} high`}
                  />
                  <DimLine
                    a={bases[s.speakerSel].pos}
                    b={[lx, earFt, lz]}
                    label={`${fmtDist(inFromFt(Math.hypot(lx - bases[s.speakerSel].pos[0], earFt - bases[s.speakerSel].pos[1], lz - bases[s.speakerSel].pos[2])), units)}`}
                  />
                </>
              )}
            </>
          )}
        </Canvas>
      </div>

      <div className="proj-readout">
        <div className="proj-top">
          <div className={`dvled-verdict ${tone}`}>
            <span className="dvled-dot" />
            {verdict.label}
            <span className="dvled-sub">{verdict.detail}</span>
          </div>
          <div className="proj-legend">
            <div
              className="proj-legend-bar"
              style={{
                background:
                  s.speakerCoverageView === 'uniformity'
                    ? uniformityGradientCss()
                    : splGradientCss(u),
              }}
            />
            <div className="proj-legend-ticks">
              {s.speakerCoverageView === 'uniformity' ? (
                <>
                  <span>0</span>
                  <span>±3</span>
                  <span>±6</span>
                  <span>±10 dB</span>
                </>
              ) : (
                <>
                  <span>{u.minDba}</span>
                  <span>{u.loDba}</span>
                  <span>{u.hiDba}</span>
                  <span>{u.maxDba}+ dBA</span>
                </>
              )}
            </div>
            <div className="proj-legend-caption">
              {s.speakerCoverageView === 'uniformity'
                ? 'Evenness — dB from the target level (±3 dB = even)'
                : `Level at ear height — ${u.label.toLowerCase()} band (quiet → loud)`}
            </div>
          </div>
        </div>

        {/* per-speaker contribution at the listener */}
        <div className="sensor-parts">
          {verdict.point.contributionsFlat.map((c, i) => (
            <span key={i} className="sensor-part contrib">
              <span
                className="sensor-part-dot"
                style={{ background: i === s.speakerSel ? '#0b65d8' : '#7a8694' }}
              />
              #{i + 1}: {Number.isFinite(c) ? `${Math.round(flat ? c : dbaFromFlat(c))} ${flat ? 'dB' : 'dBA'}` : '—'}
              {i === verdict.point.dominant ? ' ◂' : ''}
            </span>
          ))}
        </div>

        <dl className="dvled-metrics">
          <div>
            <dt>At the listener (set)</dt>
            <dd>{lvlStr}</dd>
          </div>
          <div>
            <dt>Loudest it can get</dt>
            <dd>
              {maxStr}
              {verdict.headroomDb >= 0.5 ? ` · +${Math.round(verdict.headroomDb)} dB spare` : ' · maxed'}
            </dd>
          </div>
          <div>
            <dt>Room needs</dt>
            <dd>
              {Math.round(verdict.requiredDba)} dBA ·{' '}
              {verdict.canReach ? (verdict.loudEnough ? 'met' : 'turn up') : 'cannot reach'}
            </dd>
          </div>
          <div>
            <dt>Over noise floor</dt>
            <dd>
              {Number.isFinite(verdict.snr) ? `+${Math.round(verdict.snr)} dB` : '—'} ·{' '}
              {INTELLIGIBLE_LABEL[verdict.intelligible]}
            </dd>
          </div>
          <div>
            <dt>Even coverage</dt>
            <dd>±{(field.spreadDb / 2).toFixed(1)} dB</dd>
          </div>
          <div>
            <dt>In-target area</dt>
            <dd>{fmtArea(field.goodAreaSqFt)}</dd>
          </div>
          <div>
            <dt>Amp load</dt>
            <dd style={{ color: TONE_VAR[POWER_TONE[budget.band]] }}>
              {budget.totalTapW}W / {budget.ampW}W · {Math.round(budget.loadPct)}%
              <span style={{ fontWeight: 500, fontSize: 11, color: 'var(--muted)' }}>
                {' '}{POWER_LABEL[budget.band]}
              </span>
            </dd>
          </div>
        </dl>
        <p className="dvled-note">
          Each speaker falls off 6 dB per distance doubling and rolls off toward its
          −6 dB coverage angle; overlapping units add by power (two equal ≈ +3 dB),
          and the level can’t exceed each box’s Max SPL. “Loud enough” compares the
          set level — and the most it could reach if cranked — against what this{' '}
          {Math.round(s.speakerNoiseFloor)} dBA room needs (~
          {Math.round(verdict.requiredDba)} dBA for {u.label.toLowerCase()}). Move
          the listener to spot-check a seat; the ear-height map shows the whole room.
        </p>
      </div>
    </div>
  );
}
