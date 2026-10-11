import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { DoubleSide, ShaderMaterial } from "three";

type WaterKind = "river" | "lake" | "pond";

const vertexShader = `
varying vec3 vWorldPosition;
varying vec3 vLocalPosition;

void main() {
  vLocalPosition = position;
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

const fragmentShader = `
uniform float uTime;
uniform float uKind;

varying vec3 vWorldPosition;
varying vec3 vLocalPosition;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);

  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

void main() {
  vec2 p = vLocalPosition.xz;
  float t = uTime;

  float river = 1.0 - step(0.5, uKind);

  // River flows consistently along its length.
  // Lakes and ponds have slower multidirectional movement.
  vec2 flow = mix(
    vec2(
      sin(t * 0.12) * 0.10,
      t * 0.12
    ),
    vec2(
      0.12 * sin(t * 0.2),
      -t * 0.55
    ),
    river
  );

  vec2 uv = p + flow;

  float largeWave =
    sin(uv.x * 2.8 + uv.y * 1.6 + t * 0.4) * 0.5 + 0.5;

  float smallWave =
    sin(uv.x * 8.0 - uv.y * 4.0 + t * 0.9) * 0.5 + 0.5;

  float detail = noise(uv * 5.5 + t * 0.08);

  float ripple =
    largeWave * 0.45 +
    smallWave * 0.3 +
    detail * 0.25;

  vec3 deepBlue = vec3(0.025, 0.42, 0.56);
  vec3 turquoise = vec3(0.035, 0.73, 0.82);
  vec3 brightCyan = vec3(0.28, 0.93, 0.97);

  vec3 color = mix(deepBlue, turquoise, ripple);
  color = mix(
    color,
    brightCyan,
    pow(smallWave, 5.0) * 0.22
  );

  // Moving highlights simulate reflections on water.
  float highlight =
    pow(
      max(
        0.0,
        sin(uv.x * 12.0 + uv.y * 4.0 + t * 1.3)
      ),
      18.0
    );

  color += vec3(0.32, 0.48, 0.52) * highlight * 0.35;

  // Small, bright streaks resemble river surface foam.
  float foam =
    pow(
      max(
        0.0,
        sin(uv.x * 5.0 - uv.y * 11.0 + t * 2.2)
      ),
      20.0
    );

  color += vec3(0.55, 0.9, 0.95) * foam * river * 0.11;

  gl_FragColor = vec4(color, 1.0);
}
`;

export default function WaterSurface({
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
}
