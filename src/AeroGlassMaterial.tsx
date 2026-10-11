/** A lightweight Fresnel / thin-film shader for the curved aquarium walls. */
import { memo, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { DoubleSide, ShaderMaterial } from "three";

const vertexShader = /* glsl */ `
varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

const fragmentShader = /* glsl */ `
uniform float uTime;
uniform float uNight;
varying vec3 vWorldPosition;
varying vec3 vWorldNormal;

void main() {
  vec3 normal = normalize(vWorldNormal);
  vec3 view = normalize(cameraPosition - vWorldPosition);
  float facing = abs(dot(normal, view));
  float rim = pow(1.0 - facing, 3.0);

  // Pastel soap-film interference appears only at oblique viewing angles.
  float film = 0.5 + 0.5 * sin(vWorldPosition.y * 0.63 +
    vWorldPosition.x * 0.17 + facing * 9.0 + uTime * 0.11);
  vec3 aqua = vec3(0.23, 0.91, 0.98);
  vec3 lilac = vec3(0.86, 0.66, 0.98);
  vec3 color = mix(aqua, lilac, film * 0.48 * rim);

  // Crisp, narrow reflection bands glide across the curved corners as camera moves.
  vec3 highlightDir = normalize(vec3(-0.35, 0.83, 0.44));
  float reflection = pow(max(dot(reflect(-highlightDir, normal), view), 0.0), 65.0);
  vec3 highlightDir2 = normalize(vec3(0.84, 0.27, 0.45));
  float reflection2 = pow(max(dot(reflect(-highlightDir2, normal), view), 0.0), 105.0);
  float glint = reflection * 0.42 + reflection2 * 0.32;

  color = mix(color, vec3(1.0, 1.0, 0.99), clamp(glint * 1.6, 0.0, 1.0));
  color = mix(color, vec3(0.35, 0.61, 0.82), uNight * 0.30);
  float alpha = 0.016 + rim * (0.32 + uNight * 0.06) + glint * 0.42;

  gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.54));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export default memo(function AeroGlassMaterial({ night }: { night: boolean }) {
  const material = useRef<ShaderMaterial>(null);
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uNight: { value: night ? 1 : 0 },
  }), []); // Same uniform objects stay attached to the GPU material.

  useFrame(({ clock }, delta) => {
    if (!material.current) return;
    uniforms.uTime.value = clock.getElapsedTime();
    uniforms.uNight.value += ((night ? 1 : 0) - uniforms.uNight.value) *
      (1 - Math.exp(-Math.min(delta, 0.1) * 1.5));
  });

  return <shaderMaterial
    ref={material}
    vertexShader={vertexShader}
    fragmentShader={fragmentShader}
    uniforms={uniforms}
    side={DoubleSide}
    transparent
    depthWrite={false}
    toneMapped={false}
  />;
});
