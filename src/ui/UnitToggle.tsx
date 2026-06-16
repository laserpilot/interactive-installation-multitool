import { useConfigStore } from '../store/useConfigStore';

export function UnitToggle() {
  const units = useConfigStore((s) => s.units);
  const set = useConfigStore((s) => s.set);
  return (
    <span className="seg">
      <button className={units === 'us' ? 'on' : ''} onClick={() => set('units', 'us')}>
        in / ft
      </button>
      <button
        className={units === 'metric' ? 'on' : ''}
        onClick={() => set('units', 'metric')}
      >
        cm / m
      </button>
    </span>
  );
}
