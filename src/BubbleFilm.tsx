import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { DoubleSide, ShaderMaterial } from "three";

const vertexShader = `
varying vec3 vNormal;
varying vec3 vWorldPosition;
varying vec3 vLocalPosition;

void main() {
  vLocalPosition = position;
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

const fragmentShader = `
uniform float uTime;

varying vec3 vNormal;
varying vec3 vWorldPosition;
varying vec3 vLocalPosition;

void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(cameraPosition - vWorldPosition);

  float facing = abs(dot(N, V));
  float fresnel = pow(1.0 - facing, 2.8);

  // Flowing soap-film interference bands.
  float wave =
      sin(vLocalPosition.y * 8.0 +
          vLocalPosition.x * 3.5 +
          uTime * 0.35) * 0.5 + 0.5;

  float wave2 =
      sin(vLocalPosition.x * 7.0 -
          vLocalPosition.z * 5.0 -
          uTime * 0.23) * 0.5 + 0.5;

  vec3 cyan = vec3(0.35, 0.92, 1.0);
  vec3 pink = vec3(1.0, 0.52, 0.86);
  vec3 violet = vec3(0.68, 0.62, 1.0);
  vec3 gold = vec3(1.0, 0.91, 0.55);

  vec3 rainbow = mix(cyan, pink, wave);
  rainbow = mix(rainbow, violet, wave2 * 0.45);
  rainbow = mix(rainbow, gold, wave * wave2 * 0.2);

  // A sharp specular reflection from an imaginary softbox.
  vec3 lightDir = normalize(vec3(-0.45, 0.8, 1.0));
  vec3 halfDir = normalize(lightDir + V);
  float specular = pow(max(dot(N, halfDir), 0.0), 90.0);

  // Secondary, broader reflection.
  vec3 lightDir2 = normalize(vec3(0.7, -0.3, 0.8));
  vec3 halfDir2 = normalize(lightDir2 + V);
  float specular2 = pow(max(dot(N, halfDir2), 0.0), 45.0);

  vec3 color =
      rainbow * (0.35 + fresnel * 0.65) +
      vec3(1.0) * specular * 1.5 +
      cyan * specular2 * 0.65;

  float alpha =
      0.07 +
      fresnel * 0.55 +
      specular * 0.4 +
      specular2 * 0.15;

  gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.85));
}
`;

export default function BubbleFilm() {
  const material = useRef<ShaderMaterial>(null);

  useFrame(({ clock }) => {
    if (material.current) {
      material.current.uniforms.uTime.value = clock.getElapsedTime();
    }
  });

  return (
    <shaderMaterial
      ref={material}
      vertexShader={vertexShader}
      fragmentShader={fragmentShader}
      uniforms={{ uTime: { value: 0 } }}
      transparent
      depthWrite={false}
      side={DoubleSide}
    />
  );
}
