import { create } from 'zustand';
import type { PersonaId } from '../ergonomics/constants';
import { sizeFromDiagonal, verdict, type Verdict } from '../ergonomics/engine';

export type Units = 'us' | 'metric';
export type Mode = 'touch' | 'view';
export type ResMode = 'pixels' | 'pitch';
export type CameraView = 'orbit' | 'first-person';

export interface ConfigState {
  // --- screen ---
  diagonal: number; // in
  aspectW: number;
  aspectH: number;
  mountBottom: number; // in AFF (bottom edge)

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
  cameraView: CameraView;
  contentUrl: string | null;

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

  mode: 'touch',
  viewingDistance: 96,
  personaId: 'adult',

  resMode: 'pixels',
  horizontalPixels: 3840,
  pitchMm: 2.5,

  units: 'us',
  cameraView: 'orbit',
  contentUrl: null,

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
      mode: s.mode,
      viewingDistance: s.viewingDistance,
      personaId: s.personaId,
      horizontalPixels: s.resMode === 'pixels' ? s.horizontalPixels : undefined,
      pitchMm: s.resMode === 'pitch' ? s.pitchMm : undefined,
    });
  },
}));
