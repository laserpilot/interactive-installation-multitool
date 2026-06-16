import type { Units } from '../store/useConfigStore';

const CM_PER_IN = 2.54;

/** Short length label (e.g. mount height). Input always inches. */
export function fmtLen(inches: number, units: Units): string {
  if (units === 'metric') return `${(inches * CM_PER_IN).toFixed(0)} cm`;
  return `${inches.toFixed(1)}"`;
}

/** Distance label, friendlier units for larger spans. Input always inches. */
export function fmtDist(inches: number, units: Units): string {
  if (units === 'metric') {
    const m = (inches * CM_PER_IN) / 100;
    return m >= 1 ? `${m.toFixed(2)} m` : `${(inches * CM_PER_IN).toFixed(0)} cm`;
  }
  if (inches >= 24) return `${(inches / 12).toFixed(1)} ft`;
  return `${inches.toFixed(0)}"`;
}

/** Convert a user-entered value in the active unit system back to inches. */
export function toInches(value: number, units: Units): number {
  return units === 'metric' ? value / CM_PER_IN : value;
}

/** Convert inches to the active unit system for display in an input. */
export function fromInches(inches: number, units: Units): number {
  return units === 'metric' ? inches * CM_PER_IN : inches;
}

export function lenUnit(units: Units): string {
  return units === 'metric' ? 'cm' : 'in';
}
