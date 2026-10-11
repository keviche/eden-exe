import { memo, useMemo } from "react";
import * as THREE from "three";

function RainbowBand({
  radius,
  color,
  opacity,
}: {
  radius: number;
  color: string;
  opacity: number;
}) {
  const geometry = useMemo(() => {
    const curve = new THREE.EllipseCurve(
      0,
      0,
      radius,
      radius,
      0,
      Math.PI,
      false,
      0
    );

    const points = curve.getPoints(100);

    const path = new THREE.CatmullRomCurve3(
      points.map(
        point => new THREE.Vector3(point.x, point.y, 0)
      )
    );

    return new THREE.TubeGeometry(
      path,
      100,
      0.13,
      6,
      false
    );
  }, [radius]);

  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

export default memo(function TerrariumSky() {
  return (
    <group position={[0, 0, 0]}>
      {/* Rainbow positioned behind the city */}
      <group position={[0, 4.5, -13]}>
        <RainbowBand radius={12} color="#ff6b6b" opacity={0.65} />
        <RainbowBand radius={11.7} color="#ffb56b" opacity={0.65} />
        <RainbowBand radius={11.4} color="#ffe66d" opacity={0.65} />
        <RainbowBand radius={11.1} color="#7cdb88" opacity={0.65} />
        <RainbowBand radius={10.8} color="#73c8ff" opacity={0.65} />
        <RainbowBand radius={10.5} color="#b49bff" opacity={0.65} />
      </group>

      {/* Sun positioned in upper corner of terrarium */}
      <group position={[12, 15, -12]}>
        {/* Sun glow */}
        <mesh>
          <sphereGeometry args={[2.4, 32, 32]} />
          <meshBasicMaterial
            color="#ffeaa0"
            transparent
            opacity={0.13}
            depthWrite={false}
          />
        </mesh>

        {/* Sun body */}
        <mesh>
          <sphereGeometry args={[1.1, 32, 32]} />
          <meshBasicMaterial
            color="#fff3b0"
            toneMapped={false}
          />
        </mesh>

        {/* Sunlight illuminating the environment */}
        <directionalLight
          color="#fff2c5"
          intensity={1.5}
          position={[0, 0, 0]}
        />
      </group>
    </group>
  );
});
