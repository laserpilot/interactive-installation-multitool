import { PERSONAS } from '../ergonomics/constants';
import { sizeFromDiagonal } from '../ergonomics/engine';
import { useConfigStore } from '../store/useConfigStore';
import { avatarLayout } from './avatarLayout';
import { Bone } from './Bone';
import { f } from './scale';

const SKIN = '#d9b08c';
const BODY = '#5b6b7a';

export function Avatar() {
  const { personaId, mode, viewingDistance, diagonal, aspectW, aspectH, mountBottom } =
    useConfigStore();
  const persona = PERSONAS[personaId];
  const size = sizeFromDiagonal(diagonal, aspectW, aspectH);
  const distance = mode === 'touch' ? persona.touchDistance : viewingDistance;
  const screenTop = mountBottom + size.height;

  const L = avatarLayout(persona, distance, mountBottom, screenTop);
  const z = L.z;

  const hipH = persona.seated ? 19 : 0.52 * persona.statureHeight;
  const shoulderH = persona.shoulderHeight;
  const handColor = L.touches ? SKIN : '#e06c6c';

  return (
    <group>
      {/* Head — eye at exact eyeHeight */}
      <mesh position={[0, f(persona.eyeHeight + 3.2), z]} castShadow>
        <sphereGeometry args={[f(4.2), 20, 20]} />
        <meshStandardMaterial color={SKIN} />
      </mesh>
      {/* Neck */}
      <Bone
        a={[0, f(shoulderH), z]}
        b={[0, f(persona.eyeHeight + 0.5), z]}
        radius={f(1.6)}
        color={SKIN}
      />
      {/* Torso */}
      <Bone a={[0, f(hipH), z]} b={[0, f(shoulderH), z]} radius={f(5)} color={BODY} />
      {/* Shoulders */}
      <Bone
        a={[-f(7), f(shoulderH), z]}
        b={[f(7), f(shoulderH), z]}
        radius={f(2.4)}
        color={BODY}
      />

      {/* Reaching arm (toward screen) */}
      <Bone a={L.shoulder} b={L.hand} radius={f(2)} color={BODY} />
      <mesh position={L.hand} castShadow>
        <sphereGeometry args={[f(1.8), 12, 12]} />
        <meshStandardMaterial color={handColor} />
      </mesh>

      {/* Resting arm */}
      <Bone
        a={[-f(7), f(shoulderH), z]}
        b={[-f(8), f(shoulderH - 0.34 * persona.statureHeight), z + f(1)]}
        radius={f(2)}
        color={BODY}
      />

      {persona.seated ? (
        <SeatedLegs z={z} hipH={hipH} />
      ) : (
        <StandingLegs z={z} hipH={hipH} />
      )}
    </group>
  );
}

function StandingLegs({ z, hipH }: { z: number; hipH: number }) {
  return (
    <>
      <Bone a={[-f(3.5), 0, z]} b={[-f(3.5), f(hipH), z]} radius={f(2.6)} color={BODY} />
      <Bone a={[f(3.5), 0, z]} b={[f(3.5), f(hipH), z]} radius={f(2.6)} color={BODY} />
    </>
  );
}

function SeatedLegs({ z, hipH }: { z: number; hipH: number }) {
  const knee = z - f(15);
  return (
    <>
      {/* thighs forward (toward wall, -z) */}
      <Bone a={[-f(4), f(hipH), z]} b={[-f(4), f(hipH), knee]} radius={f(2.6)} color={BODY} />
      <Bone a={[f(4), f(hipH), z]} b={[f(4), f(hipH), knee]} radius={f(2.6)} color={BODY} />
      {/* shins down */}
      <Bone a={[-f(4), f(hipH), knee]} b={[-f(4), f(5), knee]} radius={f(2.4)} color={BODY} />
      <Bone a={[f(4), f(hipH), knee]} b={[f(4), f(5), knee]} radius={f(2.4)} color={BODY} />
      {/* simple chair: seat + back + wheels */}
      <mesh position={[0, f(hipH - 2), z + f(1)]}>
        <boxGeometry args={[f(20), f(2), f(20)]} />
        <meshStandardMaterial color="#2b3440" />
      </mesh>
      <mesh position={[0, f(hipH + 9), z + f(10)]}>
        <boxGeometry args={[f(20), f(22), f(2)]} />
        <meshStandardMaterial color="#2b3440" />
      </mesh>
      {[-f(11), f(11)].map((x) => (
        <mesh key={x} position={[x, f(11), z + f(2)]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[f(11), f(1), 10, 24]} />
          <meshStandardMaterial color="#1a2026" />
        </mesh>
      ))}
    </>
  );
}
