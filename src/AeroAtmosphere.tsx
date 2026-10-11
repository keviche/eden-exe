/**
 * Frutiger Aero atmospheric dome. Follows the camera so the gradient fills the
 * viewport at every orbit angle; unlike a flat background this has a horizon.
 * Only a small shader is used -- no HDRI, texture download or postprocessing.
 */
import { memo, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BackSide, Color, Mesh, ShaderMaterial } from "three";
import type { DayPhase } from "./simulation/worldDefaults";
import type { Weather } from "./simulation/types";

type SkyPalette = {
  zenith: string;
  middle: string;
  horizon: string;
  under: string;
  cloudiness: number;
  night: number;
};

function paletteFor(phase: DayPhase, weather: Weather["condition"]): SkyPalette {
  const cloudiness = weather === "rainy" ? 0.65 : weather === "cloudy" ? 0.43 : 0.15;
  if (phase === "night") return {
    zenith: "#10264f", middle: "#244b80", horizon: "#357e9e", under: "#102b4d",
    cloudiness: cloudiness * 0.6, night: 1,
  };
  if (phase === "sunset") return {
    zenith: "#2a84d6", middle: "#89cef3", horizon: "#ffe3b5", under: "#a5daf0",
    cloudiness, night: 0,
  };
  if (weather === "rainy") return {
    zenith: "#3a8cb7", middle: "#80cedc", horizon: "#d5f4ee", under: "#88c6d6",
    cloudiness, night: 0,
  };
  return {
    zenith: "#168de5", middle: "#30bbf5", horizon: "#d1fbff", under: "#74caec",
    cloudiness, night: 0,
  };
}

const skyVertex = /* glsl */ `
varying vec3 vSkyDirection;
void main() {
  // w=0 ignores the dome's camera-following translation.
  vSkyDirection = normalize((modelMatrix * vec4(position, 0.0)).xyz);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const skyFragment = /* glsl */ `
uniform vec3 uZenith;
uniform vec3 uMiddle;
uniform vec3 uHorizon;
uniform vec3 uUnder;
uniform float uTime;
uniform float uCloudiness;
uniform float uNight;
varying vec3 vSkyDirection;

float random2(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float softNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(random2(i), random2(i + vec2(1.0, 0.0)), f.x),
             mix(random2(i + vec2(0.0, 1.0)), random2(i + vec2(1.0, 1.0)), f.x), f.y);
}

void main() {
  vec3 d = normalize(vSkyDirection);
  float altitude = d.y;
  float upper = smoothstep(-0.09, 0.32, altitude);
  float zenith = smoothstep(0.12, 0.91, altitude);
  vec3 color = mix(uUnder, uHorizon, smoothstep(-0.87, -0.06, altitude));
  color = mix(color, uMiddle, upper);
  color = mix(color, uZenith, zenith);

  // Broad, airy cloud wisps live near the horizon, not on the city geometry.
  vec2 wind = vec2(d.x * 5.0 + uTime * 0.006, d.z * 4.0 - uTime * 0.002);
  float cloud = softNoise(wind * 1.7) * 0.63 + softNoise(wind * 3.9) * 0.37;
  float band = smoothstep(-0.19, 0.03, altitude) * (1.0 - smoothstep(0.18, 0.67, altitude));
  float cloudAmount = smoothstep(0.53, 0.78, cloud) * band * uCloudiness * 0.76;
  color = mix(color, vec3(0.91, 0.99, 1.0), cloudAmount);

  // A little extra cyan sunlight near the horizon is the Aero signature.
  float haze = exp(-pow((altitude + 0.045) * 6.2, 2.0));
  color += vec3(0.015, 0.082, 0.075) * haze * (1.0 - uNight);

  // Very sparse, tiny night stars; avoid a noisy starfield.
  vec2 starCell = floor(d.xz * 340.0 + d.y * 91.0);
  float star = step(0.9986, random2(starCell));
  float starMask = smoothstep(0.02, 0.36, altitude);
  color += vec3(0.43, 0.73, 0.94) * star * starMask * uNight * 0.65;

  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export default memo(function AeroAtmosphere({
  phase,
  weather,
}: {
  phase: DayPhase;
  weather: Weather["condition"];
}) {
  const dome = useRef<Mesh>(null);
  const material = useRef<ShaderMaterial>(null);
  const target = useMemo(() => paletteFor(phase, weather), [phase, weather]);
  const uniforms = useMemo(() => {
    const initial = paletteFor("day", "sunny");
    return {
      uZenith: { value: new Color(initial.zenith) },
      uMiddle: { value: new Color(initial.middle) },
      uHorizon: { value: new Color(initial.horizon) },
      uUnder: { value: new Color(initial.under) },
      uCloudiness: { value: initial.cloudiness },
      uNight: { value: initial.night },
      uTime: { value: 0 },
    };
  }, []);
  const targetColors = useMemo(() => ({
    zenith: new Color(target.zenith),
    middle: new Color(target.middle),
    horizon: new Color(target.horizon),
    under: new Color(target.under),
  }), [target]);

  useFrame(({ camera, clock }, delta) => {
    if (dome.current) dome.current.position.copy(camera.position);
    if (!material.current) return;
    const step = 1 - Math.exp(-Math.min(delta, 0.1) * 1.2);
    uniforms.uZenith.value.lerp(targetColors.zenith, step);
    uniforms.uMiddle.value.lerp(targetColors.middle, step);
    uniforms.uHorizon.value.lerp(targetColors.horizon, step);
    uniforms.uUnder.value.lerp(targetColors.under, step);
    uniforms.uCloudiness.value += (target.cloudiness - uniforms.uCloudiness.value) * step;
    uniforms.uNight.value += (target.night - uniforms.uNight.value) * step;
    uniforms.uTime.value = clock.getElapsedTime();
  });

  return (
    <mesh ref={dome} renderOrder={-1000} frustumCulled={false}>
      <sphereGeometry args={[120, 32, 20]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={skyVertex}
        fragmentShader={skyFragment}
        side={BackSide}
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
});
