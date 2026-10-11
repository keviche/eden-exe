import { memo, useEffect, useMemo } from "react";
import {
  BufferGeometry,
  Float32BufferAttribute,
  Color,
  ConeGeometry,
  DodecahedronGeometry,
  SphereGeometry,
  MeshStandardMaterial,
  MeshBasicMaterial,
  InstancedMesh,
  Object3D
} from "three";
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

  const pondRadiusX = range(2.0, 3.8);
  const pondRadiusZ = range(1.7, 3.2);
  const pondX = -lakeSide *
    range(BOARD_SIZE * 0.20, BOARD_SIZE * 0.30);
  const pondZ = range(-BOARD_SIZE * 0.30, BOARD_SIZE * 0.30);

  return {
    riverPoint,
    lake: { x: lakeX, z: lakeZ, rx: lakeRadiusX, rz: lakeRadiusZ },
    pond: { x: pondX, z: pondZ, rx: pondRadiusX, rz: pondRadiusZ }
  };
}


type DetailInstance = {
  x: number;
  y: number;
  z: number;
  scale: number;
  rotation: number;
  color: Color;
};

function TerrainDetailInstances({
  instances,
  kind,
  night
}: {
  instances: DetailInstance[];
  kind: "grass" | "moss" | "stone" | "dew";
  night: boolean;
}) {
  const resources = useMemo(() => {
    const geometry =
      kind === "grass"
        ? new ConeGeometry(0.045, 0.24, 3)
        : kind === "moss"
          ? new SphereGeometry(0.13, 6, 4)
          : kind === "dew"
            ? new SphereGeometry(0.045, 8, 6)
            : new DodecahedronGeometry(0.12, 0);

    // White-cyan dew is unlit so it can sparkle under the sun without bloom.
    const material = kind === "dew"
      ? new MeshBasicMaterial({ color: night ? "#90c9e2" : "#edffff" })
      : new MeshStandardMaterial({
          color: night ? "#a0d4c4" : "#ffffff",
          roughness: kind === "grass" ? 0.73 : kind === "moss" ? 0.63 : 0.37,
          metalness: kind === "stone" ? 0.11 : 0.02,
          flatShading: kind === "stone"
        });

    const mesh = new InstancedMesh(
      geometry,
      material,
      Math.max(1, instances.length)
    );

    mesh.count = instances.length;
    mesh.frustumCulled = false;
    mesh.raycast = () => {};

    const dummy = new Object3D();

    instances.forEach((item, index) => {
      dummy.position.set(item.x, item.y, item.z);

      dummy.rotation.set(0, item.rotation, 0);

      if (kind === "grass") {
        // Cone is centered vertically. Its base rests on
        // the terrain, with only a small amount embedded.
        dummy.position.y += 0.105 * item.scale;

        dummy.scale.set(
          item.scale,
          item.scale,
          item.scale
        );
      } else if (kind === "moss") {
        // Flatten the sphere to create a low moss cushion.
        dummy.position.y += 0.012;

        dummy.scale.set(
          item.scale,
          0.22 * item.scale,
          item.scale
        );
      } else if (kind === "dew") {
        dummy.position.y += 0.13;
        dummy.scale.setScalar(item.scale);
      } else {
        // Pebbles sit partially embedded in the soil.
        dummy.position.y += 0.035 * item.scale;

        dummy.scale.set(
          item.scale,
          0.55 * item.scale,
          0.8 * item.scale
        );
      }

      dummy.updateMatrix();

      mesh.setMatrixAt(index, dummy.matrix);
      mesh.setColorAt(index, item.color);
    });

    mesh.instanceMatrix.needsUpdate = true;

    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }

    return { mesh, geometry, material };
  }, [instances, kind, night]);

  useEffect(() => {
    return () => {
      resources.mesh.dispose();
      resources.geometry.dispose();
      resources.material.dispose();
    };
  }, [resources]);

  return <primitive object={resources.mesh} />;
}

export default memo(function TerrainHills({
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
        radiusX: range(4.5, 7.5),
        radiusZ: range(4.0, 7.0),
        height: range(0.35, 0.70),
        rotation: range(0, Math.PI * 2)
      });
    }

    const riverPoints = Array.from({ length: 101 }, (_, index) =>
      water.riverPoint(index / 100)
    );
    const riverStep = BOARD_SIZE * 0.92 / 100;
    const riverInfluence = 6;

    function distanceFromWater(x: number, z: number) {
      // Terrain shading and detail placement stop changing beyond five units
      // from water. Search a small z window around this point; the river's z
      // coordinate advances monotonically, so distant samples cannot matter.
      let riverDistance = riverInfluence;
      const first = Math.max(0, Math.ceil((z - riverInfluence + BOARD_SIZE * 0.46) / riverStep));
      const last = Math.min(100, Math.floor((z + riverInfluence + BOARD_SIZE * 0.46) / riverStep));

      for (let i = first; i <= last; i++) {
        const p = riverPoints[i]!;
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

        ellipseDistance(water.pond)
      );
    }

    function heightAt(x: number, z: number, knownWaterDistance?: number) {
      // Broad rolling terrain with no abrupt peaks.
      const broadRoll =
        Math.sin(x * 0.18 + seed * 0.17) *
        Math.cos(z * 0.16 - seed * 0.11) * 0.22;

      const secondaryRoll =
        Math.sin(x * 0.31 + z * 0.12 + seed * 0.23) *
        Math.cos(z * 0.27 - x * 0.10) * 0.10;

      // Smooth, shallow depressions.
      const divotField =
        Math.sin(x * 0.24 - z * 0.21 + seed * 0.09);

      const gentleDivots =
        -Math.pow(Math.max(0, divotField), 2) * 0.075;

      let height =
        broadRoll +
        secondaryRoll +
        gentleDivots;

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

        // Smoothly fades from the hill center to the ground.
        const falloff =
          Math.pow(Math.max(0, 1 - radius * radius), 2);

        height += hill.height * falloff;
      }

      // Preserve the water surface and create gentle banks.
      const waterDistance = knownWaterDistance ?? distanceFromWater(x, z);
      const shoreline = smoothstep(0.0, 2.4, waterDistance);

      // Slightly raise land around the water without
      // creating steep walls or sudden lumps.
      const bank =
        0.075 *
        (smoothstep(-0.2, 1.4, waterDistance) -
         smoothstep(1.4, 3.5, waterDistance));

      height = height * shoreline + bank;

      // Prevent terrain from disappearing beneath the
      // existing flat ground mesh.
      height = Math.max(0.008, height);

      // Smoothly fade elevation near the board edges.
      const half = BOARD_SIZE * 0.48;
      const edgeDistance = Math.min(
        half - Math.abs(x),
        half - Math.abs(z)
      );

      const edgeBlend = smoothstep(0.0, 2.5, edgeDistance);

      return height * edgeBlend;
    }

    // One continuous surface rather than separate,
    // visibly raised green patches.
    const divisions = 160;
    const positions: number[] = [];

    // Deterministic procedural terrain coloration.
    const colors: number[] = [];

    const fract = (value: number) =>
      value - Math.floor(value);

    const hash = (x: number, z: number) =>
      fract(
        Math.sin(x * 127.1 + z * 311.7 + seed * 0.013) *
        43758.5453
      );

    function noise(x: number, z: number) {
      const ix = Math.floor(x);
      const iz = Math.floor(z);
      const fx = x - ix;
      const fz = z - iz;

      const ux = fx * fx * (3 - 2 * fx);
      const uz = fz * fz * (3 - 2 * fz);

      const a = hash(ix, iz);
      const b = hash(ix + 1, iz);
      const c = hash(ix, iz + 1);
      const d = hash(ix + 1, iz + 1);

      return (
        a * (1 - ux) * (1 - uz) +
        b * ux * (1 - uz) +
        c * (1 - ux) * uz +
        d * ux * uz
      );
    }

    function terrainColor(
      x: number,
      z: number,
      waterDistance = distanceFromWater(x, z),
    ): [number, number, number] {
      const broad = noise(x * 0.35, z * 0.35);
      const medium = noise(x * 1.7, z * 1.7);
      const fine = noise(x * 7.0, z * 7.0);

      const variation =
        (broad - 0.5) * 0.18 +
        (medium - 0.5) * 0.13 +
        (fine - 0.5) * 0.045;
      const sunlightPatch = Math.sin(x * 0.29 + seed * 0.008) *
        Math.cos(z * 0.23 + 0.75) * 0.025;

      const wetness =
        1 - smoothstep(0.15, 1.65, waterDistance);

      const dx = heightAt(x + 0.12, z) -
                 heightAt(x - 0.12, z);

      const dz = heightAt(x, z + 0.12) -
                 heightAt(x, z - 0.12);

      const slope = Math.sqrt(dx * dx + dz * dz) / 0.24;

      const exposedSoil =
        smoothstep(0.25, 0.85, slope) * 0.55;

      // Electric spring greens, soft cyan in damp hollows, and lighter sun patches.
      let r = 0.17 + variation * 0.39 + sunlightPatch * 0.6;
      let g = 0.71 + variation * 0.74 + sunlightPatch;
      let b = 0.095 + variation * 0.31;

      // Shallow slopes still read as verdant: avoid muddy brown cliffs.
      r = r * (1 - exposedSoil) + 0.27 * exposedSoil;
      g = g * (1 - exposedSoil) + 0.49 * exposedSoil;
      b = b * (1 - exposedSoil) + 0.16 * exposedSoil;

      // Cyan-green shores echo the surrounding glass and turquoise water.
      const damp = wetness * 0.35;
      r = r * (1 - damp) + 0.09 * damp;
      g = g * (1 - damp) + 0.63 * damp;
      b = b * (1 - damp) + 0.28 * damp;

      return [
        Math.max(0, Math.min(1, r)),
        Math.max(0, Math.min(1, g)),
        Math.max(0, Math.min(1, b))
      ];
    }

    const size = BOARD_SIZE * 0.96;
    const samples: Array<{
      position: [number, number, number];
      color: [number, number, number];
    }> = [];

    // Each grid corner is shared by up to four cells. Compute its expensive
    // height and water-aware color once, then reuse it in the triangle soup.
    for (let iz = 0; iz <= divisions; iz++) {
      for (let ix = 0; ix <= divisions; ix++) {
        const x = -size / 2 + ix / divisions * size;
        const z = -size / 2 + iz / divisions * size;
        const waterDistance = distanceFromWater(x, z);
        samples.push({
          position: [x, 0.012 + heightAt(x, z, waterDistance), z],
          color: terrainColor(x, z, waterDistance),
        });
      }
    }

    const addSample = (sample: (typeof samples)[number]) => {
      positions.push(...sample.position);
      colors.push(...sample.color);
    };

    for (let iz = 0; iz < divisions; iz++) {
      for (let ix = 0; ix < divisions; ix++) {
        const topLeft = samples[iz * (divisions + 1) + ix]!;
        const topRight = samples[iz * (divisions + 1) + ix + 1]!;
        const bottomLeft = samples[(iz + 1) * (divisions + 1) + ix]!;
        const bottomRight = samples[(iz + 1) * (divisions + 1) + ix + 1]!;

        addSample(topLeft);
        addSample(bottomLeft);
        addSample(topRight);
        addSample(topRight);
        addSample(bottomLeft);
        addSample(bottomRight);

      }
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new Float32BufferAttribute(positions, 3)
    );

    geometry.setAttribute(
      "color",
      new Float32BufferAttribute(colors, 3)
    );

    // Recalculate normals after elevation displacement.
    geometry.computeVertexNormals();


    // EDEN_TERRAIN_DETAILS_V1
    // Procedural decorations follow the existing terrain height
    // and avoid river/pond water boundaries.

    const detailRandom = seededRandom(seed ^ 0x4e91c2);

    const grassPositions: Array<{
      x: number; y: number; z: number;
      scale: number; rotation: number; color: Color;
    }> = [];

    const mossPositions: Array<{
      x: number; y: number; z: number;
      scale: number; rotation: number; color: Color;
    }> = [];

    const stonePositions: Array<{
      x: number; y: number; z: number;
      scale: number; rotation: number; color: Color;
    }> = [];

    const dewPositions: Array<{
      x: number; y: number; z: number;
      scale: number; rotation: number; color: Color;
    }> = [];

    const terrainHalf = BOARD_SIZE * 0.48;

    const grassPalette = [
      "#7fec54",
      "#53d85c",
      "#9bfa64",
      "#31b866",
      "#b3fb7a"
    ];

    const mossPalette = [
      "#2caf69",
      "#50d987",
      "#7ee9a0",
      "#28bd7d"
    ];

    const stonePalette = [
      "#bbebe0",
      "#d3f5e9",
      "#82cabe",
      "#edfdf7"
    ];

    function pickColor(palette: string[]) {
      return new Color(
        palette[Math.floor(detailRandom() * palette.length)]
      );
    }

    function terrainSlope(x: number, z: number) {
      const step = 0.12;

      const dx =
        heightAt(x + step, z) -
        heightAt(x - step, z);

      const dz =
        heightAt(x, z + step) -
        heightAt(x, z - step);

      return Math.hypot(dx, dz) / (2 * step);
    }

    // Grass is deliberately excluded from the immediate
    // shoreline. Density fades in gradually farther inland.
    for (let i = 0; i < 2200; i++) {
      const x = (detailRandom() * 2 - 1) * terrainHalf;
      const z = (detailRandom() * 2 - 1) * terrainHalf;

      const waterDistance = distanceFromWater(x, z);

      // Keep the water surface and banks unobstructed.
      if (waterDistance < 0.65) continue;

      const shorelineFade = smoothstep(
        0.65,
        2.6,
        waterDistance
      );

      const edgeDistance = Math.min(
        terrainHalf - Math.abs(x),
        terrainHalf - Math.abs(z)
      );

      const edgeFade = smoothstep(
        0.2,
        1.5,
        edgeDistance
      );

      const slope = terrainSlope(x, z);
      const slopeFade = 1 - smoothstep(0.35, 0.9, slope);

      const density =
        shorelineFade * edgeFade * slopeFade * 0.76;

      if (detailRandom() > density) continue;

      const y = 0.012 + heightAt(x, z);

      grassPositions.push({
        x,
        y,
        z,
        scale: (0.65 + detailRandom() * 0.7) *
               (0.55 + shorelineFade * 0.45),
        rotation: detailRandom() * Math.PI * 2,
        color: pickColor(grassPalette)
      });
    }

    // Moss forms low, soft clusters near damp areas.
    // It stays close to the terrain surface.
    for (let i = 0; i < 550; i++) {
      const x = (detailRandom() * 2 - 1) * terrainHalf;
      const z = (detailRandom() * 2 - 1) * terrainHalf;

      const waterDistance = distanceFromWater(x, z);

      if (waterDistance < 0.38) continue;

      const shorelinePresence =
        1 - smoothstep(1.0, 5.0, waterDistance);

      const probability =
        0.18 + shorelinePresence * 0.55;

      if (detailRandom() > probability) continue;

      const edgeDistance = Math.min(
        terrainHalf - Math.abs(x),
        terrainHalf - Math.abs(z)
      );

      if (edgeDistance < 0.5) continue;

      const y = 0.012 + heightAt(x, z);

      mossPositions.push({
        x,
        y,
        z,
        scale: 0.55 + detailRandom() * 0.9,
        rotation: detailRandom() * Math.PI * 2,
        color: pickColor(mossPalette)
      });
    }

    // Small stones are scattered inland, never directly
    // across the river or pond.
    for (let i = 0; i < 300; i++) {
      const x = (detailRandom() * 2 - 1) * terrainHalf;
      const z = (detailRandom() * 2 - 1) * terrainHalf;

      const waterDistance = distanceFromWater(x, z);

      if (waterDistance < 0.5) continue;

      if (detailRandom() > 0.36) continue;

      const edgeDistance = Math.min(
        terrainHalf - Math.abs(x),
        terrainHalf - Math.abs(z)
      );

      if (edgeDistance < 0.6) continue;

      stonePositions.push({
        x,
        y: 0.012 + heightAt(x, z),
        z,
        scale: 0.45 + detailRandom() * 0.95,
        rotation: detailRandom() * Math.PI * 2,
        color: pickColor(stonePalette)
      });
    }

    // A few pearl-blue dew beads among the existing grass (no additional draw calls
    // per bead; all droplets share an instanced mesh and a small sphere geometry).
    for (let i = 0; i < 130; i++) {
      const x = (detailRandom() * 2 - 1) * terrainHalf;
      const z = (detailRandom() * 2 - 1) * terrainHalf;
      if (distanceFromWater(x, z) < 0.9 || terrainSlope(x, z) > 0.55) continue;
      dewPositions.push({
        x, y: 0.012 + heightAt(x, z), z,
        scale: 0.65 + detailRandom() * 1.25,
        rotation: 0,
        color: pickColor(["#ffffff", "#b8faff", "#eafffd", "#bcdfff"]),
      });
    }

    return {
      geometry,
      grassPositions,
      mossPositions,
      stonePositions,
      dewPositions
    };

  }, [seed]);

  useEffect(() => {
    return () => terrain.geometry.dispose();
  }, [terrain]);

  return (
    <>
    <mesh
      geometry={terrain.geometry}
      receiveShadow
      raycast={() => null}
    >
      <meshStandardMaterial
        color={night ? "#92bdb8" : "#ffffff"}
        vertexColors
        roughness={0.74}
        metalness={0.02}
        side={2}
      />
    </mesh>

    <TerrainDetailInstances
      instances={terrain.grassPositions}
      kind="grass"
      night={night}
    />

    <TerrainDetailInstances
      instances={terrain.mossPositions}
      kind="moss"
      night={night}
    />

    <TerrainDetailInstances
      instances={terrain.stonePositions}
      kind="stone"
      night={night}
    />

    <TerrainDetailInstances
      instances={terrain.dewPositions}
      kind="dew"
      night={night}
    />
    </>
  );
});
