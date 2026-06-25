import { Line, Text } from '@react-three/drei';
import { PERSONAS } from '../ergonomics/constants';
import { sizeFromDiagonal } from '../ergonomics/engine';
import { useConfigStore } from '../store/useConfigStore';
import { fmtDist, fmtLen } from '../ui/units';
import { f } from './scale';

const LINE = '#1d2733';
const EYE = '#c77d11';

type P = [number, number, number];

/** Flat label that sticks to the wall (faces +z), readable from the front. */
function WallLabel({
  position,
  text,
  color = '#10202e',
  anchorX = 'center',
}: {
  position: P;
  text: string;
  color?: string;
  anchorX?: 'center' | 'left' | 'right';
}) {
  return (
    <Text
      position={position}
      fontSize={0.32}
      color={color}
      outlineWidth={0.04}
      outlineColor="#ffffff"
      outlineOpacity={0.95}
      anchorX={anchorX}
      anchorY="middle"
      renderOrder={10}
    >
      {text}
    </Text>
  );
}

/** Vertical dimension from floor to `topY` at lateral offset x, label flat on wall. */
function VDim({ x, topY, label }: { x: number; topY: number; label: string }) {
  const tick = 0.18;
  return (
    <group>
      <Line points={[[x, 0, 0], [x, topY, 0]]} color={LINE} lineWidth={2} />
      <Line points={[[x - tick, 0, 0], [x + tick, 0, 0]]} color={LINE} lineWidth={2} />
      <Line points={[[x - tick, topY, 0], [x + tick, topY, 0]]} color={LINE} lineWidth={2} />
      <WallLabel position={[x - 0.14, topY / 2, 0.06]} text={label} anchorX="right" />
    </group>
  );
}

export function Measurements() {
  const { diagonal, aspectW, aspectH, mountBottom, mode, viewingDistance, personaId, units } =
    useConfigStore();
  const size = sizeFromDiagonal(diagonal, aspectW, aspectH);
  const persona = PERSONAS[personaId];
  const distance = mode === 'touch' ? persona.touchDistance : viewingDistance;

  const w = f(size.width);
  const screenTopY = f(mountBottom + size.height);
  const screenBottomY = f(mountBottom);
  const eyeY = f(persona.eyeHeight);

  const xBottom = -(w / 2) - 0.7;
  const xTop = -(w / 2) - 1.7;
  const eyeSpan = w / 2 + 2;

  // viewing-distance dimension along the ground on the right
  const xG = w / 2 + 0.7;
  const dz = f(distance);
  const gtick = 0.18;

  return (
    <group>
      {/* height to bottom and to top of screen */}
      <VDim x={xBottom} topY={screenBottomY} label={`bottom ${fmtLen(mountBottom, units)}`} />
      <VDim x={xTop} topY={screenTopY} label={`top ${fmtLen(mountBottom + size.height, units)}`} />

      {/* eye-level line across the wall */}
      <Line points={[[-eyeSpan, eyeY, 0.01], [eyeSpan, eyeY, 0.01]]} color={EYE} lineWidth={2} dashed dashSize={0.25} gapSize={0.12} />
      <WallLabel
        position={[eyeSpan + 0.15, eyeY, 0.06]}
        text={`eye level ${fmtLen(persona.eyeHeight, units)}`}
        color={EYE}
        anchorX="left"
      />

      {/* viewing distance on the floor (label lies flat, facing up) */}
      <Line points={[[xG, 0.02, 0], [xG, 0.02, dz]]} color={LINE} lineWidth={2} />
      <Line points={[[xG, 0.02 - gtick, 0], [xG, 0.02 + gtick, 0]]} color={LINE} lineWidth={2} />
      <Line points={[[xG, 0.02 - gtick, dz], [xG, 0.02 + gtick, dz]]} color={LINE} lineWidth={2} />
      <Text
        position={[xG + 0.35, 0.03, dz / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.32}
        color="#10202e"
        outlineWidth={0.04}
        outlineColor="#ffffff"
        outlineOpacity={0.95}
        anchorX="center"
        anchorY="middle"
        renderOrder={10}
      >
        {fmtDist(distance, units)}
      </Text>
    </group>
  );
}
