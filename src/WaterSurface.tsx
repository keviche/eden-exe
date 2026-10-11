import { useFrame } from "@react-three/fiber";
import { memo, useRef } from "react";
import { DoubleSide, ShaderMaterial } from "three";

type WaterKind = "river" | "lake" | "pond";

const vertexShader = `
uniform float uTime;
uniform float uKind;

varying vec3 vWorldPosition;
varying vec2 vUv;
varying float vSurfaceSlope;

void main() {
  vec3 displaced = position;
  vec2 p = position.xz;

  float river = 1.0 - step(0.5, uKind);
  float speed = mix(0.32, 1.4, river);

  // Broad, smooth undulations.
  float wave1 = sin(
    p.y * 2.1 -
    uTime * speed +
    sin(p.x * 0.65) * 0.4
  );

  float wave2 = sin(
    p.y * 3.8 -
    uTime * speed * 1.15 +
    p.x * 1.1
  );

  // Subtle rounded divots, not sharp geometric shapes.
  float depression = sin(
    p.x * 1.4 +
    p.y * 1.8 -
    uTime * speed * 0.75
  );

  depression = -pow(
    max(0.0, depression),
    2.0
  );

  float amplitude = mix(0.025, 0.055, river);

  float displacement =
    wave1 * amplitude * 0.55 +
    wave2 * amplitude * 0.22 +
    depression * amplitude * 0.38;

  displaced.y += displacement;

  // Slight shading variation for surface depth.
  vSurfaceSlope = displacement / max(amplitude, 0.001);

  vUv = position.xz;

  vec4 worldPosition =
    modelMatrix * vec4(displaced, 1.0);

  vWorldPosition = worldPosition.xyz;

  gl_Position =
    projectionMatrix * viewMatrix * worldPosition;
}
`;

const fragmentShader = `
uniform float uTime;
uniform float uKind;

varying vec3 vWorldPosition;
varying vec2 vUv;
varying float vSurfaceSlope;

void main() {
  float t = uTime;

  // River moves faster; pond moves slowly.
  float isRiver = 1.0 - step(0.5, uKind);
  float speed = mix(0.18, 1.15, isRiver);

  vec2 p = vUv;

  // Smooth, broad movement instead of sharp shapes.
  float wave1 = sin(
    p.y * 3.2 -
    t * speed +
    sin(p.x * 0.8) * 0.35
  );

  float wave2 = sin(
    p.y * 5.5 -
    t * speed * 1.25 +
    p.x * 0.65
  );

  float wave3 = sin(
    p.x * 2.0 +
    p.y * 1.4 -
    t * speed * 0.55
  );

  // Low contrast keeps the surface smooth.
  float movement =
    wave1 * 0.055 +
    wave2 * 0.025 +
    wave3 * 0.015;

  vec3 deepWater = vec3(0.016, 0.36, 0.69);
  vec3 clearWater = vec3(0.05, 0.84, 0.85);

  float blend = clamp(
    0.58 + movement,
    0.0,
    1.0
  );

  vec3 color = mix(deepWater, clearWater, blend);

  // Very subtle moving sheen, without foam shapes.
  float sheen = sin(
    p.y * 4.0 -
    t * speed * 0.85 +
    p.x * 0.4
  );

  sheen = smoothstep(0.7, 1.0, sheen);

  color += vec3(0.12, 0.18, 0.19) * sheen * 0.11;

  // Gentle brightness variation across the surface.
  float softLight = sin(
    p.x * 0.35 +
    p.y * 0.45 +
    t * 0.12
  );

  color += vec3(0.015, 0.025, 0.025) * softLight;

  color += vec3(0.018, 0.035, 0.04) * vSurfaceSlope;

  // Soft caustic ribbons and sharp occasional glitter, no reflections render pass.
  float caustic = pow(max(0.0, sin(p.x * 3.7 + t * 0.45) *
    cos(p.y * 4.8 - t * 0.52)), 7.0);
  float specular = pow(max(0.0, sin(p.x * 9.3 + p.y * 3.2 + t * 0.7) *
    sin(p.y * 6.1 - p.x * 2.7 - t * 0.43)), 24.0);
  float viewRim = pow(1.0 - abs(dot(normalize(cameraPosition - vWorldPosition),
    vec3(0.0, 1.0, 0.0))), 3.0);
  color += vec3(0.09, 0.22, 0.2) * caustic * 0.28;
  color += vec3(0.66, 0.9, 1.0) * specular * 0.45;
  color += vec3(0.03, 0.11, 0.15) * viewRim * 0.32;

  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export default memo(function WaterSurface({
  kind
}: {
  kind: WaterKind;
}) {
  const material = useRef<ShaderMaterial>(null);

  useFrame(({ clock }) => {
    if (material.current) {
      material.current.uniforms.uTime.value =
        clock.getElapsedTime();
    }
  });

  return (
    <shaderMaterial
      ref={material}
      vertexShader={vertexShader}
      fragmentShader={fragmentShader}
      uniforms={{
        uTime: { value: 0 },
        uKind: {
          value:
            kind === "river" ? 0 :
            kind === "lake" ? 1 : 2
        }
      }}
      side={DoubleSide}
    />
  );
});
