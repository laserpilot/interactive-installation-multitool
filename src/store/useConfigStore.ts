import { create } from 'zustand';
import { DEFAULT_TABLE_HEIGHT, type PersonaId, type Strictness } from '../ergonomics/constants';
import { sizeFromDiagonal, verdict, type Verdict } from '../ergonomics/engine';
import { mToIn, type SensingMode, type SensorMount, type SensorTarget } from '../sensor/sensorMath';
import { MOUNT_DEFAULTS as SPK_MOUNT_DEFAULTS, type SpeakerUnit, type UseCase } from '../speaker/speakerMath';

export type Units = 'us' | 'metric';
export type Mode = 'touch' | 'view';
export type ResMode = 'pixels' | 'pitch';
export type CameraView = 'orbit' | 'first-person';
export type StageView = '3d' | '2d';
export type AppTab = 'placement' | 'dvled' | 'projection' | 'table' | 'sensor' | 'speaker';
export type SpeakerWeighting = 'dba' | 'flat';
export type CoverageView = 'spl' | 'uniformity';
export type LedShape = 'square' | 'circle';
export type MountType = 'wall' | 'stand';
export type PinMode = 'distance' | 'width';
export type SurfaceView = 'heatmap' | 'content';
export type LensOrigin = 'center' | 'top';

export interface ConfigState {
  // --- screen ---
  diagonal: number; // in
  aspectW: number;
  aspectH: number;
  mountBottom: number; // in AFF (bottom edge)
  mountType: MountType; // 'wall' flush, or 'stand'/podium
  tiltDeg: number; // back-tilt of the screen; 0 = vertical

  // --- table (horizontal touchscreen) ---
  tableHeight: number; // in AFF, surface height for the table tab
  tableBezel: number; // in, border/frame width around the screen (0–12)
  tableShowReach: boolean; // overlay the reach heatmap on the surface
  tableSeats: number; // figures standing around the table (1–6)

  // --- context ---
  mode: Mode;
  viewingDistance: number; // in (used in 'view' mode)
  personaId: PersonaId;

  // --- resolution ---
  resMode: ResMode;
  horizontalPixels: number;
  pitchMm: number;

  // --- ui ---
  units: Units;
  appTab: AppTab;
  stageView: StageView;
  cameraView: CameraView;
  fpFov: number; // deg, vertical FOV for the first-person camera
  showReach: boolean;
  strictness: Strictness;
  contentUrl: string | null;

  // --- LED Display preview ---
  dvledDistance: number; // in (eye-to-wall for the preview tab)
  dvledFov: number; // deg, horizontal field of view shown
  fillFactor: number; // 0–1, LED emitter coverage of its cell (manual override)
  dvledLockFill: boolean; // derive fill from pitch instead of the manual value
  ledShape: LedShape;
  dvledShowScale: boolean; // overlay a to-scale figure + scale bar
  dvledScalePersona: PersonaId; // which body the scale figure represents

  // --- projection ---
  projThrowRatio: number; // throw distance / image width
  projDistance: number; // in, lens-to-wall (perpendicular)
  projWidth: number; // in, projected image width (linked to distance via throw)
  projPin: PinMode; // which of distance/width the user drives
  projLumens: number; // single-projector rated lumens
  projectorCount: number; // stacking multiplier
  projStackEff: number; // 0–1, brightness kept per added stacked unit
  projArrayCount: number; // horizontal edge-blended array: projectors side by side
  projArrayOverlapPct: number; // % of one image width that neighbours overlap
  projAspectW: number;
  projAspectH: number;
  projResW: number; // native projector pixels
  projResH: number;
  projResLock: boolean; // keep aspect ratio and resolution in sync
  projAmbientFc: number; // ambient light on the surface, foot-candles
  projScreenGain: number; // screen gain — fL = fc × gain
  projLensAff: number; // in, lens height above floor
  projLensShiftPct: number; // vertical lens shift, % of half image height; +up/−down
  projLensOrigin: LensOrigin; // where 0% shift sits: lens centre, or top-aligned (periscope)
  projTiltDeg: number; // projector tilt; 0 = perpendicular, nonzero = keystone
  projShowFigure: boolean; // show a to-scale person for size reference
  projSurfaceView: SurfaceView; // heatmap or projected content

  // --- sensor coverage (camera / depth sensor) ---
  sensorMount: SensorMount; // ceiling / wall / floor
  sensorMountAff: number; // in, sensor height above floor (ceiling/wall height)
  sensorPitchDeg: number; // elevation aim: 0 level, −90 down, +90 up
  sensorYawDeg: number; // pan aim about vertical
  sensorHFov: number; // horizontal field of view, deg
  sensorVFov: number; // vertical field of view, deg
  sensorHwMax: number; // in, the sensor hardware max depth (reseeds mode windows)
  sensorMode: SensingMode; // sensing task — sets the confidence window
  sensorMinRange: number; // in, hard near cutoff (blind below)
  sensorConfNear: number; // in, near edge of the high-confidence sweet spot
  sensorConfFar: number; // in, far edge of the high-confidence sweet spot
  sensorMaxRange: number; // in, hard far cutoff (confidence reaches 0)
  sensorTarget: SensorTarget; // optional context wall to draw: floor or facing wall
  sensorWallDist: number; // in, distance to the facing wall (target='wall')
  sensorPersona: PersonaId; // which body the placed person represents
  sensorPersonX: number; // in, person's side offset from the sensor axis
  sensorPersonZ: number; // in, person's forward distance into the room
  sensorShowZone: boolean; // overlay the trackable floor zone
  sensorShowMeasurements: boolean; // overlay dimension lines + range labels

  // --- speaker SPL coverage ---
  speakers: SpeakerUnit[]; // placed units (1–6), each with its own mount + aim + model
  speakerSel: number; // index of the unit the controls edit
  speakerAmpW: number; // available amplifier / 70V-line power for the tap budget
  speakerUseCase: UseCase; // listening scenario — sets the comfortable band
  speakerWeighting: SpeakerWeighting; // display flat dB SPL or A-weighted dBA
  speakerEarHeight: number; // in, ear height of the listening plane
  speakerNoiseFloor: number; // dBA, ambient room noise floor (for SNR)
  speakerListenerX: number; // in, listening position side offset
  speakerListenerZ: number; // in, listening position forward distance
  speakerCoverageView: CoverageView; // heatmap shows absolute dB SPL or ±dB uniformity
  speakerShowField: boolean; // overlay the ear-height coverage plane
  speakerShowMeasurements: boolean; // overlay dimension lines + labels

  // --- actions ---
  set: <K extends keyof ConfigState>(key: K, value: ConfigState[K]) => void;
  setContent: (url: string | null) => void;
  applyRecommendedMount: () => void;
  getVerdict: () => Verdict;
}

export const useConfigStore = create<ConfigState>((set, get) => ({
  diagonal: 65,
  aspectW: 16,
  aspectH: 9,
  mountBottom: 24,
  mountType: 'wall',
  tiltDeg: 0,

  tableHeight: DEFAULT_TABLE_HEIGHT,
  tableBezel: 1.5,
  tableShowReach: true,
  tableSeats: 1,

  mode: 'touch',
  viewingDistance: 96,
  personaId: 'adult',

  resMode: 'pixels',
  horizontalPixels: 3840,
  pitchMm: 2.5,

  units: 'us',
  appTab: 'placement',
  stageView: '3d',
  cameraView: 'orbit',
  fpFov: 60,
  showReach: true,
  strictness: 'realistic',
  contentUrl: null,

  dvledDistance: 120, // 10 ft
  dvledFov: 40,
  fillFactor: 0.55,
  dvledLockFill: true,
  ledShape: 'circle',
  dvledShowScale: true,
  dvledScalePersona: 'adult',

  projThrowRatio: 1.5,
  projDistance: 180, // 15 ft → 10 ft wide image
  projWidth: 120, // 10 ft, kept in sync with distance via throw ratio
  projPin: 'distance',
  projLumens: 4000,
  projectorCount: 1,
  projStackEff: 0.9, // each added stacked unit contributes ~90% of its lumens
  projArrayCount: 1, // single image until widened into an array
  projArrayOverlapPct: 20, // typical edge-blend overlap
  projAspectW: 16,
  projAspectH: 9,
  projResW: 1920,
  projResH: 1080, // 16:9, consistent with the aspect default
  projResLock: true,
  projAmbientFc: 5,
  projScreenGain: 1.0,
  projLensAff: 90, // 7.5 ft
  projLensShiftPct: 0, // image centred on the lens axis
  projLensOrigin: 'center',
  projTiltDeg: 0, // perpendicular → no keystone
  projShowFigure: true,
  projSurfaceView: 'heatmap',

  // Azure Kinect (NFOV) on a 9 ft ceiling aimed straight down, skeletal tracking.
  sensorMount: 'ceiling',
  sensorMountAff: 108, // 9 ft
  sensorPitchDeg: -90,
  sensorYawDeg: 0,
  sensorHFov: 75,
  sensorVFov: 65,
  sensorHwMax: mToIn(3.86), // Azure NFOV hardware depth max
  sensorMode: 'skeletal',
  sensorMinRange: mToIn(0.5), // skeletal window seeded from the mode
  sensorConfNear: mToIn(1.2),
  sensorConfFar: mToIn(3.5),
  sensorMaxRange: mToIn(3.86),
  sensorTarget: 'floor',
  sensorWallDist: 240, // 20 ft
  sensorPersona: 'adult',
  sensorPersonX: 0,
  sensorPersonZ: 24, // 2 ft forward of the sensor axis
  sensorShowZone: true,
  sensorShowMeasurements: true,

  // Two 8" ceiling speakers (9 ft, firing down) straddling a centred listener, so
  // the overlap-in-the-middle case reads on load. Speech/paging scenario.
  speakers: [
    { mount: 'ceiling', xIn: -42, zIn: 72, mountAffIn: SPK_MOUNT_DEFAULTS.ceiling.mountAffIn,
      yawDeg: 0, pitchDeg: -90, hCovDeg: 90, vCovDeg: 90, sensitivity: 89, powerW: 1, maxSplDb: 110 },
    { mount: 'ceiling', xIn: 42, zIn: 72, mountAffIn: SPK_MOUNT_DEFAULTS.ceiling.mountAffIn,
      yawDeg: 0, pitchDeg: -90, hCovDeg: 90, vCovDeg: 90, sensitivity: 89, powerW: 1, maxSplDb: 110 },
  ],
  speakerSel: 0,
  speakerAmpW: 120, // a typical small 70V amp (matches the AD-P6T recommendation)
  speakerUseCase: 'speech',
  speakerWeighting: 'dba',
  speakerEarHeight: 60, // standing ear height
  speakerNoiseFloor: 50, // typical occupied-room ambient, dBA
  speakerListenerX: 0,
  speakerListenerZ: 72,
  speakerCoverageView: 'spl',
  speakerShowField: true,
  speakerShowMeasurements: true,

  set: (key, value) => set({ [key]: value } as Partial<ConfigState>),
  setContent: (url) => set({ contentUrl: url }),

  applyRecommendedMount: () => {
    const v = get().getVerdict();
    set({ mountBottom: Math.round(v.recommendedMountBottom * 10) / 10 });
  },

  getVerdict: () => {
    const s = get();
    return verdict({
      size: sizeFromDiagonal(s.diagonal, s.aspectW, s.aspectH),
      mountBottom: s.mountBottom,
      tiltDeg: s.tiltDeg,
      mode: s.mode,
      viewingDistance: s.viewingDistance,
      personaId: s.personaId,
      horizontalPixels: s.resMode === 'pixels' ? s.horizontalPixels : undefined,
      pitchMm: s.resMode === 'pitch' ? s.pitchMm : undefined,
      strictness: s.strictness,
    });
  },
}));
