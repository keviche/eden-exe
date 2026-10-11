import { memo, useEffect, useMemo } from "react";
import { AdditiveBlending, CanvasTexture, CatmullRomCurve3, EllipseCurve, SRGBColorSpace, TubeGeometry, Vector3 } from "three";
import { useWorldStore } from "./state/worldStore";
import { getDayPhase } from "./simulation/worldDefaults";

function RainbowBand({ radius, color, opacity }: {
  radius: number;
  color: string;
  opacity: number;
}) {
  const geometry = useMemo(() => {
    const curve = new EllipseCurve(0, 0, radius, radius, 0, Math.PI, false, 0);
    const path = new CatmullRomCurve3(curve.getPoints(96).map(point =>
      new Vector3(point.x, point.y, 0)));
    return new TubeGeometry(path, 96, 0.105, 5, false);
  }, [radius]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} raycast={() => null}>
    <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} toneMapped={false} />
  </mesh>;
}

function makeSunGlowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const center = 128;
    const glow = ctx.createRadialGradient(center, center, 4, center, center, 126);
    glow.addColorStop(0, "rgba(255,255,255,1)");
    glow.addColorStop(0.09, "rgba(255,251,215,.98)");
    glow.addColorStop(0.25, "rgba(255,233,152,.55)");
    glow.addColorStop(0.5, "rgba(155,236,255,.20)");
    glow.addColorStop(1, "rgba(125,218,255,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 256, 256);

    // Baked-in star rays: one sprite / draw call, not postprocessing bloom.
    ctx.save();
    ctx.translate(center, center);
    ctx.globalCompositeOperation = "screen";
    for (const [angle, width, alpha] of [
      [0, 13, 0.62], [Math.PI / 2, 13, 0.62],
      [Math.PI / 4, 5, 0.27], [-Math.PI / 4, 5, 0.27],
    ]) {
      ctx.save();
      ctx.rotate(angle);
      const ray = ctx.createLinearGradient(-115, 0, 115, 0);
      ray.addColorStop(0, "rgba(255,255,255,0)");
      ray.addColorStop(0.42, `rgba(255,251,217,${alpha * 0.25})`);
      ray.addColorStop(0.5, `rgba(255,255,255,${alpha})`);
      ray.addColorStop(0.58, `rgba(255,251,217,${alpha * 0.25})`);
      ray.addColorStop(1, "rgba(255,255,255,0)");
      // A soft diamond rather than sharp pixel-art lines.
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = ray;
      ctx.beginPath();
      ctx.moveTo(-118, 0);
      ctx.lineTo(0, -width);
      ctx.lineTo(118, 0);
      ctx.lineTo(0, width);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

export default memo(function TerrariumSky() {
  // Primitive selector prevents re-rendering the 3D sky on every clock tick.
  const phase = useWorldStore(state => getDayPhase(state.world.simulationTime));
  const condition = useWorldStore(state => state.world.weather.condition);
  const glareTexture = useMemo(() => makeSunGlowTexture(), []);
  useEffect(() => () => glareTexture.dispose(), [glareTexture]);
  const daylight = phase !== "night";
  const dim = condition === "rainy" ? 0.4 : condition === "cloudy" ? 0.64 : 1;

  return (
    <group>
      <group position={[0, 2.08, -13]} visible={daylight}>
        <RainbowBand radius={12} color="#ff8498" opacity={0.28 * dim} />
        <RainbowBand radius={11.72} color="#ffca83" opacity={0.27 * dim} />
        <RainbowBand radius={11.44} color="#fff3a4" opacity={0.26 * dim} />
        <RainbowBand radius={11.16} color="#88f6ad" opacity={0.28 * dim} />
        <RainbowBand radius={10.88} color="#80deff" opacity={0.32 * dim} />
        <RainbowBand radius={10.6} color="#d0b9ff" opacity={0.25 * dim} />
      </group>

      {/* The flare is camera-facing automatically, with a luminous sun at its center. */}
      <group position={[12, 15, -12]} visible={daylight}>
        <sprite scale={[12.4, 12.4, 1]} renderOrder={5}>
          <spriteMaterial
            map={glareTexture}
            color="#fff5da"
            opacity={0.84 * dim}
            transparent
            blending={AdditiveBlending}
            depthWrite={false}
            depthTest
            toneMapped={false}
          />
        </sprite>
        <mesh raycast={() => null}>
          <sphereGeometry args={[0.86, 24, 16]} />
          <meshBasicMaterial color="#fff9dd" toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
});
