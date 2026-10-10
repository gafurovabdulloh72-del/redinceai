"use client";

import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Float, Lightformer, MeshTransmissionMaterial, RoundedBox } from "@react-three/drei";
import * as THREE from "three";

/**
 * Liquid Glass 3D sahna: haqiqiy sinish (transmission) materialli suzuvchi shisha shakllar.
 * Canvas shaffof bo'lgani uchun transmission buferiga alohida pastel "fon" teksturasi beramiz —
 * aks holda shisha qora ko'rinadi.
 */

const GLASS = {
  samples: 6,
  resolution: 512,
  transmission: 1,
  thickness: 0.8,
  roughness: 0.07,
  ior: 1.3,
  chromaticAberration: 0.06,
  anisotropy: 0.15,
  distortion: 0.2,
  distortionScale: 0.35,
  temporalDistortion: 0.1,
  clearcoat: 1,
  clearcoatRoughness: 0.1,
  attenuationDistance: 3,
  envMapIntensity: 1.2,
} as const;

/** Sahifa fonidagi gradient bloblarga o'xshash tekstura (transmission uchun) */
function makeBackdrop(dark: boolean) {
  const size = 256;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = dark ? "#0c0e18" : "#f1f2fa";
  ctx.fillRect(0, 0, size, size);
  const blobs = dark
    ? [["#2b4fd8", 60, 70], ["#7a35d6", 190, 60], ["#c93478", 110, 190], ["#d9752c", 220, 210], ["#1c8fb8", 30, 200]]
    : [["#6f9bff", 60, 70], ["#c08bff", 190, 60], ["#ff8fbf", 110, 190], ["#ffbe80", 220, 210], ["#7fe3ff", 30, 200]];
  for (const [color, x, y] of blobs as [string, number, number][]) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, 120);
    g.addColorStop(0, color);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.mapping = THREE.EquirectangularReflectionMapping;
  return tex;
}

function Shapes({ dark }: { dark: boolean }) {
  const group = useRef<THREE.Group>(null);
  const { pointer } = useThree();
  const backdrop = useMemo(() => makeBackdrop(dark), [dark]);

  useFrame((_, dt) => {
    if (!group.current) return;
    group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, pointer.x * 0.3, 2.5, dt);
    group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, -pointer.y * 0.2, 2.5, dt);
  });

  const tintA = dark ? "#cfe0ff" : "#ffffff";
  const tintB = dark ? "#e6d4ff" : "#faf6ff";
  const mat = { ...GLASS, background: backdrop };

  return (
    <group ref={group} scale={0.72} position={[0.25, 0, 0]}>
      {/* Markaziy torus-knot */}
      <Float speed={1.4} rotationIntensity={0.7} floatIntensity={1.1}>
        <mesh position={[0.5, 0.1, 0]}>
          <torusKnotGeometry args={[0.9, 0.3, 220, 36, 2, 3]} />
          <MeshTransmissionMaterial {...mat} color={tintA} attenuationColor="#cfe0ff" />
        </mesh>
      </Float>

      {/* Chap yuqoridagi shisha kub */}
      <Float speed={1.1} rotationIntensity={1} floatIntensity={1.4}>
        <RoundedBox args={[1.1, 1.1, 1.1]} radius={0.26} smoothness={6} position={[-1.5, 1.5, -0.8]} rotation={[0.4, 0.6, 0.1]}>
          <MeshTransmissionMaterial {...mat} color={tintB} attenuationColor="#e9d5ff" thickness={1.1} />
        </RoundedBox>
      </Float>

      {/* O'ng pastdagi shar */}
      <Float speed={1.7} rotationIntensity={0.3} floatIntensity={1.6}>
        <mesh position={[2.1, -1.2, -0.4]} scale={0.75}>
          <icosahedronGeometry args={[1, 24]} />
          <MeshTransmissionMaterial {...mat} color={tintA} attenuationColor="#c8f1ff" ior={1.4} thickness={1.3} />
        </mesh>
      </Float>

      {/* Mayda kapsula va halqa */}
      <Float speed={2} rotationIntensity={1.2} floatIntensity={2}>
        <mesh position={[-1.3, -1.7, 0.3]} rotation={[0.3, 0.2, 1.1]} scale={0.5}>
          <capsuleGeometry args={[0.4, 1.1, 8, 24]} />
          <MeshTransmissionMaterial {...mat} color={tintB} attenuationColor="#ffd9e9" />
        </mesh>
      </Float>
      <Float speed={1.3} rotationIntensity={1.5} floatIntensity={1.2}>
        <mesh position={[1.9, 1.9, -1]} rotation={[1.2, 0.3, 0]} scale={0.55}>
          <torusGeometry args={[0.9, 0.22, 24, 64]} />
          <MeshTransmissionMaterial {...mat} color={tintA} attenuationColor="#ffe6c9" />
        </mesh>
      </Float>
    </group>
  );
}

/** Rangli yorug'lik manbalari — shisha yuzasidagi aks va ranglar shundan */
function Lights({ dark }: { dark: boolean }) {
  const i = dark ? 2.4 : 3.4;
  return (
    <>
      <ambientLight intensity={dark ? 0.5 : 0.9} />
      <directionalLight position={[4, 6, 5]} intensity={dark ? 0.8 : 1.2} color="#ffffff" />
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={i} color="#8db4ff" position={[-5, 3, -4]} scale={[6, 4, 1]} />
        <Lightformer form="rect" intensity={i} color="#d1a3ff" position={[5, 2, -4]} scale={[6, 4, 1]} />
        <Lightformer form="circle" intensity={i * 0.9} color="#ffb0cc" position={[0, -4, -3]} scale={[5, 5, 1]} />
        <Lightformer form="circle" intensity={i * 0.7} color="#ffd1a3" position={[4, -2, 3]} scale={[3, 3, 1]} />
        <Lightformer form="rect" intensity={i * 1.4} color="#ffffff" position={[0, 5, 2]} scale={[8, 2, 1]} />
        <Lightformer form="circle" intensity={i * 0.6} color="#a6ecff" position={[-4, -1, 3]} scale={[3, 3, 1]} />
      </Environment>
    </>
  );
}

function Rig() {
  const { camera } = useThree();
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    camera.position.y = Math.sin(t * 0.25) * 0.15;
    camera.lookAt(0, 0, 0);
  });
  return null;
}

export default function HeroScene({ dark = false }: { dark?: boolean }) {
  const dpr = useMemo<[number, number]>(() => [1, 1.6], []);
  return (
    <Canvas
      dpr={dpr}
      camera={{ position: [0, 0, 7.5], fov: 38 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping }}
      style={{ background: "transparent" }}
    >
      <Suspense fallback={null}>
        <Lights dark={dark} />
        <Shapes dark={dark} />
        <Rig />
      </Suspense>
    </Canvas>
  );
}
