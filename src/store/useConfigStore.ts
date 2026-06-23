import { create } from 'zustand';
import { DEFAULT_TABLE_HEIGHT, type PersonaId, type Strictness } from '../ergonomics/constants';
import { sizeFromDiagonal, verdict, type Verdict } from '../ergonomics/engine';

export type Units = 'us' | 'metric';
export type Mode = 'touch' | 'view';
export type ResMode = 'pixels' | 'pitch';
export type CameraView = 'orbit' | 'first-person';
export type StageView = '3d' | '2d';
export type AppTab = 'placement' | 'dvled' | 'projection' | 'table';
export type LedShape = 'square' | 'circle';
export type MountType = 'wall' | 'stand';
export type PinMode = 'distance' | 'width';
export type SurfaceView = 'heatmap' | 'content';

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
  showReach: boolean;
  strictness: Strictness;
  contentUrl: string | null;

  // --- dvLED preview ---
  dvledDistance: number; // in (eye-to-wall for the preview tab)
  dvledFov: number; // deg, horizontal field of view shown
  fillFactor: number; // 0–1, LED emitter coverage of its cell
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
  projAspectW: number;
  projAspectH: number;
  projResW: number; // native projector pixels
  projResH: number;
  projAmbientFc: number; // ambient light on the surface, foot-candles
  projLensAff: number; // in, lens height above floor
  projImageCenterAff: number; // in, vertical centre of image on the wall
  projSurfaceView: SurfaceView; // heatmap or projected content

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
  showReach: true,
  strictness: 'realistic',
  contentUrl: null,

  dvledDistance: 120, // 10 ft
  dvledFov: 40,
  fillFactor: 0.55,
  ledShape: 'circle',
  dvledShowScale: true,
  dvledScalePersona: 'adult',

  projThrowRatio: 1.5,
  projDistance: 180, // 15 ft → 10 ft wide image
  projWidth: 120, // 10 ft, kept in sync with distance via throw ratio
  projPin: 'distance',
  projLumens: 4000,
  projectorCount: 1,
  projAspectW: 16,
  projAspectH: 9,
  projResW: 1920,
  projResH: 1200,
  projAmbientFc: 5,
  projLensAff: 90, // 7.5 ft, level with the image centre (clean rectangle)
  projImageCenterAff: 90,
  projSurfaceView: 'heatmap',

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
