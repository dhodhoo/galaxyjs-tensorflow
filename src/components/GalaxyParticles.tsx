'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGalaxyStore, GalaxyMode } from '../store/useGalaxyStore';

const vertexShader = `
  attribute float size;
  varying vec3 vColor;
  void main() {
    vColor = color;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = `
  varying vec3 vColor;
  void main() {
    float d = distance(gl_PointCoord, vec2(0.5));
    if (d > 0.5) discard;

    float alpha = 1.0 - smoothstep(0.08, 0.5, d);
    gl_FragColor = vec4(vColor, alpha);
  }
`;

function randomFromIndex(index: number, seed: number): number {
  const value = Math.sin(index * 12.9898 + seed * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function generateShape(mode: GalaxyMode, count: number): Float32Array {
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const particleId = i + 1;
    let x = 0;
    let y = 0;
    let z = 0;

    if (mode === 'compact') {
      const radius = Math.pow(randomFromIndex(particleId, 11), 1.9) * 6.2;
      const theta = randomFromIndex(particleId, 12) * 2 * Math.PI;
      const phi = Math.acos(2 * randomFromIndex(particleId, 13) - 1);
      x = radius * Math.sin(phi) * Math.cos(theta) * 1.1;
      y = radius * Math.sin(phi) * Math.sin(theta) * 0.42;
      z = radius * Math.cos(phi) * 1.1;
    } else if (mode === 'spiral') {
      const bands = 3;
      const radius = 8 + Math.pow(randomFromIndex(particleId, 21), 0.82) * 20;
      const orbitAngle = randomFromIndex(particleId, 22) * Math.PI * 2;
      const bandOffset = ((i % bands) - 1) * 0.9;
      const wave = Math.sin(orbitAngle * 2 + radius * 0.45) * 1.3;
      const drift = (randomFromIndex(particleId, 23) - 0.5) * (1.8 + radius * 0.09);

      x = Math.cos(orbitAngle) * (radius + bandOffset + wave);
      y = (randomFromIndex(particleId, 24) - 0.5) * (0.22 + radius * 0.012);
      z = Math.sin(orbitAngle) * (radius + bandOffset) + drift;
    } else if (mode === 'ring') {
      const angle = randomFromIndex(particleId, 31) * Math.PI * 2;
      const bandMix = randomFromIndex(particleId, 32);
      const radius =
        bandMix < 0.42
          ? 9.8 + bandMix * 7
          : bandMix < 0.72
            ? 14.8 + (bandMix - 0.42) * 14
            : 20 + (bandMix - 0.72) * 18;

      x = Math.cos(angle) * radius + (randomFromIndex(particleId, 33) - 0.5) * 0.75;
      y = (randomFromIndex(particleId, 34) - 0.5) * 0.18;
      z = Math.sin(angle) * radius + (randomFromIndex(particleId, 35) - 0.5) * 0.75;
    } else if (mode === 'exploded') {
      const theta = randomFromIndex(particleId, 41) * Math.PI * 2;
      const phi = Math.acos(2 * randomFromIndex(particleId, 42) - 1);
      const radius = 24 + Math.pow(randomFromIndex(particleId, 43), 0.72) * 78;
      const jitter = 4 + randomFromIndex(particleId, 44) * 10;
      x = Math.sin(phi) * Math.cos(theta) * radius + (randomFromIndex(particleId, 45) - 0.5) * jitter;
      y = Math.cos(phi) * radius * 0.62 + (randomFromIndex(particleId, 46) - 0.5) * jitter;
      z = Math.sin(phi) * Math.sin(theta) * radius + (randomFromIndex(particleId, 47) - 0.5) * jitter;
    }

    positions[i3] = x;
    positions[i3 + 1] = y;
    positions[i3 + 2] = z;
  }

  return positions;
}

export default function GalaxyParticles() {
  const particleCount = useGalaxyStore((state) => state.particleCount);

  const pointsRef = useRef<THREE.Points>(null);
  const groupRef = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const atmosphereRef = useRef<THREE.Mesh>(null);
  const coreMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
  const haloMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const atmosphereMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const previousModeRef = useRef<GalaxyMode>('spiral');
  const burstPulseRef = useRef(0);

  const { positionsMap, initialPositions, colors, sizes } = useMemo(() => {
    const compact = generateShape('compact', particleCount);
    const spiral = generateShape('spiral', particleCount);
    const ring = generateShape('ring', particleCount);
    const exploded = generateShape('exploded', particleCount);

    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);

    const colorCore = new THREE.Color('#f4e9cc');
    const colorMid = new THREE.Color('#c9d8f0');
    const colorEdge = new THREE.Color('#7ea7df');

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      const ratio = randomFromIndex(i + 1, 51);
      const mixedColor =
        ratio < 0.62
          ? colorCore.clone().lerp(colorMid, ratio / 0.62)
          : colorMid.clone().lerp(colorEdge, (ratio - 0.62) / 0.38);

      colors[i3] = mixedColor.r;
      colors[i3 + 1] = mixedColor.g;
      colors[i3 + 2] = mixedColor.b;
      sizes[i] = 0.25 + randomFromIndex(i + 1, 52) * 1.6;
    }

    return {
      positionsMap: { compact, spiral, ring, exploded },
      initialPositions: new Float32Array(spiral),
      colors,
      sizes,
    };
  }, [particleCount]);

  useFrame((_, delta) => {
    if (!pointsRef.current || !groupRef.current || !coreRef.current || !haloRef.current || !atmosphereRef.current) {
      return;
    }

    const { speed, targetRotation, targetZoom, targetOffset, mode, pinchStrength, isRotationPaused } = useGalaxyStore.getState();
    const safeRotation: [number, number, number] = [
      finiteOr(targetRotation[0], 0),
      finiteOr(targetRotation[1], 0),
      finiteOr(targetRotation[2], 0),
    ];
    const safeOffset: [number, number, number] = [
      finiteOr(targetOffset[0], 0),
      finiteOr(targetOffset[1], 0),
      finiteOr(targetOffset[2], 0),
    ];
    const safeZoom = THREE.MathUtils.clamp(finiteOr(targetZoom, 50), 35, 90);
    const safePinch = THREE.MathUtils.clamp(finiteOr(pinchStrength, 0), 0, 1);
    const saturnTilt = mode === 'ring' ? 0.72 : mode === 'compact' ? 0.42 : 0.58;

    if (mode !== previousModeRef.current) {
      if (mode === 'exploded') {
        burstPulseRef.current = 1;
      }
      previousModeRef.current = mode;
    }

    burstPulseRef.current = Math.max(0, burstPulseRef.current - delta * 1.7);
    const burstScale = 1 + burstPulseRef.current * 0.3;

    pointsRef.current.rotation.x = THREE.MathUtils.lerp(pointsRef.current.rotation.x, saturnTilt, delta * 2.5);
    if (!isRotationPaused) {
      pointsRef.current.rotation.y += delta * (0.18 + safePinch * 0.24) * speed;
      pointsRef.current.rotation.z += delta * 0.03 * speed;
    }

    groupRef.current.rotation.x += (safeRotation[0] - groupRef.current.rotation.x) * delta * 7;
    groupRef.current.rotation.y += (safeRotation[1] - groupRef.current.rotation.y) * delta * 7;
    groupRef.current.rotation.z += (safeRotation[2] - groupRef.current.rotation.z) * delta * 5;

    groupRef.current.position.x = THREE.MathUtils.lerp(groupRef.current.position.x, safeOffset[0], delta * 4.6);
    groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, safeOffset[1], delta * 4.6);
    groupRef.current.position.z = THREE.MathUtils.lerp(groupRef.current.position.z, safeOffset[2], delta * 3.2);

    const scaleFactor = safeZoom / 50;
    groupRef.current.scale.set(
      THREE.MathUtils.lerp(groupRef.current.scale.x, scaleFactor * burstScale, delta * 2),
      THREE.MathUtils.lerp(groupRef.current.scale.y, scaleFactor * burstScale, delta * 2),
      THREE.MathUtils.lerp(groupRef.current.scale.z, scaleFactor * burstScale, delta * 2),
    );

    const coreScaleTarget =
      mode === 'compact' ? 3.35 :
      mode === 'exploded' ? 2.55 :
      mode === 'ring' ? 2.7 :
      2.95;
    const haloScaleTarget =
      mode === 'compact' ? 4.9 :
      mode === 'exploded' ? 4.3 :
      mode === 'ring' ? 4.2 :
      4.4;

    const nextCoreScale = THREE.MathUtils.lerp(coreRef.current.scale.x, coreScaleTarget, delta * 4.2);
    const nextHaloScale = THREE.MathUtils.lerp(haloRef.current.scale.x, haloScaleTarget, delta * 3.6);
    const nextAtmosphereScale = THREE.MathUtils.lerp(atmosphereRef.current.scale.x, coreScaleTarget * 1.1, delta * 4);

    coreRef.current.scale.set(nextCoreScale * 1.22, nextCoreScale * 0.98, nextCoreScale * 1.22);
    haloRef.current.scale.set(nextHaloScale, nextHaloScale * 0.78, nextHaloScale);
    atmosphereRef.current.scale.set(nextAtmosphereScale * 1.28, nextAtmosphereScale, nextAtmosphereScale * 1.28);
    coreRef.current.rotation.y += delta * 0.18;
    haloRef.current.rotation.y -= delta * 0.08;
    atmosphereRef.current.rotation.y += delta * 0.06;

    if (coreMaterialRef.current) {
      const coreOpacityTarget = mode === 'exploded' ? 0.97 : 0.92;
      coreMaterialRef.current.opacity = THREE.MathUtils.lerp(coreMaterialRef.current.opacity, coreOpacityTarget, delta * 3.5);
      coreMaterialRef.current.emissive.lerp(
        mode === 'compact'
          ? new THREE.Color('#0d1624')
          : mode === 'ring'
            ? new THREE.Color('#13243a')
            : mode === 'exploded'
              ? new THREE.Color('#1f2c45')
              : new THREE.Color('#101b2e'),
        delta * 2.8,
      );
    }

    if (haloMaterialRef.current) {
      const haloOpacityTarget =
        mode === 'exploded' ? 0.35 + burstPulseRef.current * 0.25 :
        mode === 'compact' ? 0.32 :
        0.26;
      haloMaterialRef.current.opacity = THREE.MathUtils.lerp(
        haloMaterialRef.current.opacity,
        haloOpacityTarget,
        delta * 3,
      );
    }

    if (atmosphereMaterialRef.current) {
      const atmosphereOpacityTarget =
        mode === 'compact' ? 0.18 :
        mode === 'exploded' ? 0.24 :
        mode === 'ring' ? 0.22 :
        0.2;
      atmosphereMaterialRef.current.opacity = THREE.MathUtils.lerp(
        atmosphereMaterialRef.current.opacity,
        atmosphereOpacityTarget,
        delta * 3,
      );
    }

    const geometry = pointsRef.current.geometry as THREE.BufferGeometry;
    const positionsAttribute = geometry.attributes.position;
    const currentPos = positionsAttribute.array as Float32Array;
    const targetPos = positionsMap[mode];
    const lerpFactor = Math.min(delta * 5, 1.0);

    let needsUpdate = false;
    for (let i = 0; i < currentPos.length; i++) {
      const diff = targetPos[i] - currentPos[i];
      if (Math.abs(diff) > 0.01) {
        currentPos[i] += diff * lerpFactor;
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      positionsAttribute.needsUpdate = true;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh ref={haloRef}>
        <sphereGeometry args={[1, 48, 48]} />
        <meshBasicMaterial
          ref={haloMaterialRef}
          color="#7fb7ff"
          transparent
          opacity={0.28}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={coreRef}>
        <sphereGeometry args={[1, 64, 64]} />
        <meshStandardMaterial
          ref={coreMaterialRef}
          color="#030509"
          transparent
          opacity={0.92}
          depthWrite={false}
          roughness={0.92}
          metalness={0.04}
          emissive="#111a29"
          emissiveIntensity={0.65}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={atmosphereRef}>
        <sphereGeometry args={[1, 48, 48]} />
        <meshBasicMaterial
          ref={atmosphereMaterialRef}
          color="#6f8fbf"
          transparent
          opacity={0.2}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[initialPositions, 3]}
          />
          <bufferAttribute
            attach="attributes-color"
            args={[colors, 3]}
          />
          <bufferAttribute
            attach="attributes-size"
            args={[sizes, 1]}
          />
        </bufferGeometry>
        <shaderMaterial
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          transparent
          vertexColors
        />
      </points>
    </group>
  );
}
