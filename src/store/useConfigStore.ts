import { create } from 'zustand';
import type { PersonaId, Strictness } from '../ergonomics/constants';
import { sizeFromDiagonal, verdict, type Verdict } from '../ergonomics/engine';

export type Units = 'us' | 'metric';
export type Mode = 'touch' | 'view';
export type ResMode = 'pixels' | 'pitch';
export type CameraView = 'orbit' | 'first-person';
export type StageView = '3d' | '2d';
export type AppTab = 'placement' | 'dvled';
export type LedShape = 'square' | 'circle';
export type MountType = 'wall' | 'stand';

export interface ConfigState {
  // --- screen ---
  diagonal: number; // in
  aspectW: number;
  aspectH: number;
  mountBottom: number; // in AFF (bottom edge)
  mountType: MountType; // 'wall' flush, or 'stand'/podium
  tiltDeg: number; // back-tilt of the screen; 0 = vertical

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
