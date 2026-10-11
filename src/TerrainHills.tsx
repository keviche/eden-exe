import { useEffect, useMemo } from "react";
import { BufferGeometry, Float32BufferAttribute } from "three";
import { BOARD_SIZE } from "./edenModels";

type Hill = {
  x: number;
  z: number;
  radiusX: number;
  radiusZ: number;
  height: number;
  rotation: number;
};

function seededRandom(seed: number) {
  let state = seed >>> 0;

  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function smoothstep(a: number, b: number, value: number) {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function getWaterLayout(seed: number) {
  const random = seededRandom(seed);
  const range = (min: number, max: number) =>
    min + random() * (max - min);

  const edge = BOARD_SIZE * 0.46;

  const startX = range(-BOARD_SIZE * 0.17, BOARD_SIZE * 0.17);
  const endX = range(-BOARD_SIZE * 0.17, BOARD_SIZE * 0.17);
  const bend1 = range(-BOARD_SIZE * 0.13, BOARD_SIZE * 0.13);
  const bend2 = range(-BOARD_SIZE * 0.07, BOARD_SIZE * 0.07);
  const phase = range(0, Math.PI * 2);
  const width = range(0.42, 0.78);

  const riverPoint = (t: number) => {
    const rawX =
      startX * (1 - t) +
      endX * t +
      Math.sin(t * Math.PI * 2 + phase) * bend1 +
      Math.sin(t * Math.PI * 4 + phase * 0.6) * bend2;

    const w = width *
      (1 + 0.18 * Math.sin(t * Math.PI * 5 + phase));

    return {
      x: Math.max(-edge + w, Math.min(edge - w, rawX)),
      z: -edge + t * edge * 2,
      width: w
    };
  };

  // Consume the same random values used by WaterCourse
  // so the lake and pond locations match exactly.
  const lakeSide = random() < 0.5 ? -1 : 1;

  const lakeRadiusX = range(1.8, 3.1);
  const lakeRadiusZ = range(1.4, 2.5);
  const lakeX = lakeSide *
    range(BOARD_SIZE * 0.20, BOARD_SIZE * 0.29);
  const lakeZ = range(-BOARD_SIZE * 0.25, BOARD_SIZE * 0.25);

  const pondRadiusX = range(0.9, 1.65);
  const pondRadiusZ = range(0.75, 1.35);
  const pondX = -lakeSide *
    range(BOARD_SIZE * 0.20, BOARD_SIZE * 0.30);
  const pondZ = range(-BOARD_SIZE * 0.30, BOARD_SIZE * 0.30);

  return {
    riverPoint,
    lake: { x: lakeX, z: lakeZ, rx: lakeRadiusX, rz: lakeRadiusZ },
    pond: { x: pondX, z: pondZ, rx: pondRadiusX, rz: pondRadiusZ }
  };
}

export default function TerrainHills({
  seed,
  night
}: {
  seed: number;
  night: boolean;
}) {
  const terrain = useMemo(() => {
    const random = seededRandom(seed ^ 0x7a3f91);
    const range = (min: number, max: number) =>
      min + random() * (max - min);

    const water = getWaterLayout(seed);

    const hills: Hill[] = [];

    // Fewer hills, distributed across the terrain.
    const cells = [
      [-0.28, -0.27],
      [0.28, -0.27],
      [-0.28, 0],
      [0.28, 0],
      [-0.28, 0.27],
      [0.28, 0.27],
      [0, 0.34]
    ];

    for (const [cx, cz] of cells) {
      hills.push({
        x: cx * BOARD_SIZE + range(-1.5, 1.5),
        z: cz * BOARD_SIZE + range(-1.5, 1.5),
        radiusX: range(2.3, 4.2),
        radiusZ: range(2.0, 3.8),
        height: range(0.10, 0.28),
        rotation: range(0, Math.PI * 2)
      });
    }

    function distanceFromWater(x: number, z: number) {
      let riverDistance = Infinity;

      // Approximate the actual curved river centerline.
      for (let i = 0; i <= 100; i++) {
        const p = water.riverPoint(i / 100);
        const distance =
          Math.hypot(x - p.x, z - p.z) - p.width;

        riverDistance = Math.min(riverDistance, distance);
      }

      const ellipseDistance = (
        body: { x: number; z: number; rx: number; rz: number }
      ) => {
        const dx = (x - body.x) / body.rx;
        const dz = (z - body.z) / body.rz;

        return (
          (Math.sqrt(dx * dx + dz * dz) - 1) *
          Math.min(body.rx, body.rz)
        );
      };

      return Math.min(
        riverDistance,
        ellipseDistance(water.lake),
        ellipseDistance(water.pond)
      );
    }

    function heightAt(x: number, z: number) {
      let height = 0;

      for (const hill of hills) {
        const dx = x - hill.x;
        const dz = z - hill.z;

        const c = Math.cos(hill.rotation);
        const s = Math.sin(hill.rotation);

        const localX = dx * c + dz * s;
        const localZ = -dx * s + dz * c;

        const radius = Math.sqrt(
          (localX / hill.radiusX) ** 2 +
          (localZ / hill.radiusZ) ** 2
        );

        if (radius >= 1) continue;

        const falloff = Math.pow(
          Math.max(0, 1 - radius * radius),
          2.3
        );

        height += hill.height * falloff;
      }

      // Smoothly flatten the terrain approaching water.
      // This prevents hills from covering the water.
      const waterDistance = distanceFromWater(x, z);
      const shoreline = smoothstep(0.1, 1.6, waterDistance);

      return height * shoreline;
    }

    // One continuous surface rather than separate,
    // visibly raised green patches.
    const divisions = 130;
    const positions: number[] = [];
    const size = BOARD_SIZE * 0.96;

    for (let iz = 0; iz < divisions; iz++) {
      for (let ix = 0; ix < divisions; ix++) {
        const x0 = -size / 2 + ix / divisions * size;
        const x1 = -size / 2 + (ix + 1) / divisions * size;
        const z0 = -size / 2 + iz / divisions * size;
        const z1 = -size / 2 + (iz + 1) / divisions * size;

        const y00 = 0.012 + heightAt(x0, z0);
        const y10 = 0.012 + heightAt(x1, z0);
        const y01 = 0.012 + heightAt(x0, z1);
        const y11 = 0.012 + heightAt(x1, z1);

        positions.push(
          x0, y00, z0,
          x0, y01, z1,
          x1, y10, z0,

          x1, y10, z0,
          x0, y01, z1,
          x1, y11, z1
        );
      }
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new Float32BufferAttribute(positions, 3)
    );
    geometry.computeVertexNormals();

    return geometry;
  }, [seed]);

  useEffect(() => {
    return () => terrain.dispose();
  }, [terrain]);

  return (
    <mesh
      geometry={terrain}
      receiveShadow
      raycast={() => null}
    >
      <meshStandardMaterial
        color={night ? "#168451" : "#25c653"}
        roughness={0.92}
        metalness={0}
        side={2}
      />
    </mesh>
  );
}
