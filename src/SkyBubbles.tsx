import BubbleFilm from "./BubbleFilm";
import { BOARD_SIZE } from "./edenModels";
import { useFrame } from "@react-three/fiber";
import { memo, useMemo, useRef } from "react";
import {
  AdditiveBlending,
  BackSide,
  Group,
  MeshBasicMaterial,
  SphereGeometry,
} from "three";

type Bubble = {
  x: number;
  y: number;
  z: number;
  radius: number;
  speed: number;
  driftX: number;
  driftZ: number;
  sway: number;
  phase: number;
  lifetime: number;
  delay: number;
};

const COUNT = 30;
const MIN_HEIGHT = 7;

// Match the terrarium footprint from App.tsx.
// TANK_WIDTH = BOARD_SIZE + 2.2
const HALF_TANK = (BOARD_SIZE + 2.2) / 2;
const GLASS_CLEARANCE = 0.25;

// Reflect a bubble off the inner glass boundaries.
// Reflection preserves movement rather than freezing at the wall.
function reflectWithinBounds(
  value: number,
  halfExtent: number,
  radius: number
): number {
  const limit = Math.max(0, halfExtent - radius - GLASS_CLEARANCE);
  if (limit === 0) return 0;

  const span = limit * 2;
  const period = span * 2;
  const wrapped = ((value + limit) % period + period) % period;

  return wrapped <= span
    ? -limit + wrapped
    : limit - (wrapped - span);
}

const HEIGHT_RANGE = 15;
const SPHERE = new SphereGeometry(1, 32, 24);

function randomGenerator(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function BubbleMesh({ bubble }: { bubble: Bubble }) {
  const group = useRef<Group>(null);
  const materials = useRef<MeshBasicMaterial[]>([]);

  useFrame(({ clock }) => {
    const object = group.current;
    if (!object) return;

    const t = clock.getElapsedTime();
    const elapsed = t + bubble.phase - bubble.delay;
    const cycle = ((elapsed % bubble.lifetime) + bubble.lifetime) % bubble.lifetime;

    // Each cycle begins near the bottom and travels up through the sky.
    const progress = cycle / bubble.lifetime;

    // Continuous X/Z drift plus overlapping waves creates a curved path.
    const x =
      bubble.x +
      bubble.driftX * cycle +
      Math.sin(cycle * 0.9 + bubble.phase) * bubble.sway +
      Math.sin(cycle * 0.37 + bubble.phase * 1.8) * bubble.sway * 0.45;

    const z =
      bubble.z +
      bubble.driftZ * cycle +
      Math.cos(cycle * 0.72 + bubble.phase) * bubble.sway * 0.65 +
      Math.sin(cycle * 0.43 + bubble.phase) * bubble.sway * 0.35;

    const y =
      MIN_HEIGHT +
      bubble.y +
      cycle * bubble.speed +
      Math.sin(cycle * 0.65 + bubble.phase) * 0.3;

    const safeX = reflectWithinBounds(x, HALF_TANK, bubble.radius);
    const safeZ = reflectWithinBounds(z, HALF_TANK, bubble.radius);

    object.position.set(safeX, y, safeZ);
    object.rotation.y = cycle * 0.16 + bubble.phase;
    object.rotation.z = Math.sin(cycle * 0.6 + bubble.phase) * 0.12;

    // Smoothly appear and disappear at the start/end of each cycle.
    const fadeIn = Math.min(1, progress / 0.12);
    const fadeOut = Math.min(1, (1 - progress) / 0.16);
    const opacity = Math.max(0, Math.min(fadeIn, fadeOut));

    object.scale.setScalar(Math.max(0.001, opacity));

    // Prevent picking bubbles with the mouse.
    object.visible = opacity > 0.01;
  });

  const r = bubble.radius;

  return (
    <group ref={group} position={[bubble.x, MIN_HEIGHT + bubble.y, bubble.z]}>
      {/* Iridescent, glossy soap-film shader */}
      <mesh geometry={SPHERE} scale={r} raycast={() => null}>
        <BubbleFilm />
      </mesh>

      {/* Cyan reflective rim */}
      <mesh geometry={SPHERE} scale={r * 1.012} raycast={() => null}>
        <meshBasicMaterial
          color="#69dfff"
          transparent
          opacity={0.22}
          side={BackSide}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>

      {/* Iridescent pink sheen */}
      <mesh
        geometry={SPHERE}
        position={[r * 0.09, -r * 0.12, 0]}
        scale={[r * 0.94, r * 0.94, r * 0.94]}
        raycast={() => null}
      >
        <meshBasicMaterial
          color="#ffc0ed"
          transparent
          opacity={0.055}
          depthWrite={false}
        />
      </mesh>

      {/* Strong white glossy reflection */}
      <mesh
        position={[-r * 0.3, r * 0.43, r * 0.78]}
        rotation={[0, 0, -0.5]}
        scale={[r * 0.15, r * 0.33, r * 0.025]}
        raycast={() => null}
      >
        <sphereGeometry args={[1, 16, 12]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.85}
          depthWrite={false}
        />
      </mesh>

      {/* Secondary reflection */}
      <mesh
        position={[r * 0.37, -r * 0.4, r * 0.7]}
        rotation={[0, 0, 0.65]}
        scale={[r * 0.08, r * 0.17, r * 0.025]}
        raycast={() => null}
      >
        <sphereGeometry args={[1, 12, 8]} />
        <meshBasicMaterial
          color="#c8ffff"
          transparent
          opacity={0.65}
          depthWrite={false}
        />
      </mesh>

      {/* Tiny sparkle */}
      <mesh
        position={[-r * 0.37, r * 0.56, r * 0.72]}
        scale={r * 0.055}
        raycast={() => null}
      >
        <sphereGeometry args={[1, 10, 8]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
    </group>
  );
}

export default memo(function SkyBubbles() {
  const bubbles = useMemo(() => {
    const random = randomGenerator(20261011);

    // Spread bubbles across a grid of regions, with random
    // positions inside each region to avoid visible patterns.
    const columns = 6;
    const rows = Math.ceil(COUNT / columns);

    const cells = Array.from(
      { length: columns * rows },
      (_, index) => index
    );

    // Shuffle the regions for a natural distribution.
    for (let i = cells.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [cells[i], cells[j]] = [cells[j], cells[i]];
    }

    return Array.from({ length: COUNT }, (_, index): Bubble => {
      const cell = cells[index];
      const column = cell % columns;
      const row = Math.floor(cell / columns);

      const sizeRoll = random();

      const radius =
        sizeRoll > 0.87
          ? 0.9 + random() * 0.65
          : 0.18 + random() * 0.52;

      const speed = 0.55 + random() * 0.85;
      const lifetime = HEIGHT_RANGE / speed;

      // Full available footprint, accounting for bubble radius.
      const availableX = Math.max(
        0,
        HALF_TANK - radius - GLASS_CLEARANCE
      );
      const availableZ = Math.max(
        0,
        HALF_TANK - radius - GLASS_CLEARANCE
      );

      // Distribute each bubble in its own region.
      const x =
        -availableX +
        ((column + 0.15 + random() * 0.7) / columns) *
          availableX * 2;

      const z =
        -availableZ +
        ((row + 0.15 + random() * 0.7) / rows) *
          availableZ * 2;

      return {
        x,
        y: random() * HEIGHT_RANGE,
        z,
        radius,
        speed,
        driftX: (random() - 0.5) * 0.75,
        driftZ: (random() - 0.5) * 0.65,
        sway: 0.35 + random() * 0.8,
        phase: random() * lifetime,
        lifetime,
        delay: random() * lifetime,
      };
    });
  }, []);

  return (
    <group>
      {bubbles.map((bubble, index) => (
        <BubbleMesh key={index} bubble={bubble} />
      ))}
    </group>
  );
});
