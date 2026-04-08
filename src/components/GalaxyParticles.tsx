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
    gl_PointSize = size * (320.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = `
  varying vec3 vColor;
  void main() {
    float d = distance(gl_PointCoord, vec2(0.5));
    if (d > 0.5) discard;

    float glow = 1.0 - smoothstep(0.02, 0.5, d);
    gl_FragColor = vec4(vColor, glow);
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
      const seedA = randomFromIndex(particleId, 11);
      const seedB = randomFromIndex(particleId, 12);
      const seedC = randomFromIndex(particleId, 13);
      let angle = seedA * Math.PI * 2;
      const radius = 6 + Math.pow(seedB, 1.2) * 26;
      angle += radius * 0.48 + Math.sin(radius * 0.22 + seedC * 4) * 0.65;
      const thickness = (seedC - 0.5) * (0.32 + radius * 0.032);
      const turbulence = (randomFromIndex(particleId, 15) - 0.5) * (1 + radius * 0.06);
      const radialOffset = turbulence * 0.45;
      x = Math.cos(angle) * (radius + radialOffset);
      y = thickness;
      z = Math.sin(angle) * (radius - radialOffset * 0.4);
    } else if (mode === 'ring') {
      const seedA = randomFromIndex(particleId, 11);
      const seedB = randomFromIndex(particleId, 12);
      const seedC = randomFromIndex(particleId, 13);
      let angle = seedA * Math.PI * 2;
      const radius = 11.5 + (seedB - 0.5) * 4.4;
      angle += Math.sin(seedC * Math.PI * 2) * 0.2;
      const thickness = (seedC - 0.5) * 0.28;
      const turbulence = (randomFromIndex(particleId, 16) - 0.5) * 0.35;
      const radialOffset = turbulence * 0.45;
      x = Math.cos(angle) * (radius + radialOffset);
      y = thickness;
      z = Math.sin(angle) * (radius - radialOffset * 0.4);
    } else {
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
  const photonRingRef = useRef<THREE.Mesh>(null);
  const diskRef = useRef<THREE.Mesh>(null);
  const outerDiskRef = useRef<THREE.Mesh>(null);
  const auraRef = useRef<THREE.Mesh>(null);
  const coreMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
  const photonRingMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const diskMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const outerDiskMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const auraMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const previousModeRef = useRef<GalaxyMode>('spiral');
  const burstPulseRef = useRef(0);

  const { positionsMap, initialPositions, colors, sizes } = useMemo(() => {
    const compact = generateShape('compact', particleCount);
    const spiral = generateShape('spiral', particleCount);
    const ring = generateShape('ring', particleCount);
    const exploded = generateShape('exploded', particleCount);

    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);

    const colorCore = new THREE.Color('#fff3d1');
    const colorHot = new THREE.Color('#ff9a3d');
    const colorEdge = new THREE.Color('#5dc7ff');

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      const heatMix = randomFromIndex(i + 1, 51);
      const outerMix = randomFromIndex(i + 1, 52);
      const mixedColor =
        heatMix < 0.7
          ? colorCore.clone().lerp(colorHot, heatMix / 0.7)
          : colorHot.clone().lerp(colorEdge, (heatMix - 0.7) / 0.3);

      colors[i3] = mixedColor.r;
      colors[i3 + 1] = mixedColor.g;
      colors[i3 + 2] = mixedColor.b;
      sizes[i] = 0.45 + outerMix * 1.8;
    }

    return {
      positionsMap: { compact, spiral, ring, exploded },
      initialPositions: new Float32Array(spiral),
      colors,
      sizes,
    };
  }, [particleCount]);

  useFrame((_, delta) => {
    if (
      !pointsRef.current ||
      !groupRef.current ||
      !coreRef.current ||
      !photonRingRef.current ||
      !diskRef.current ||
      !outerDiskRef.current ||
      !auraRef.current
    ) {
      return;
    }

    const {
      speed,
      targetRotation,
      targetZoom,
      targetOffset,
      mode,
      pinchStrength,
      isRotationPaused,
    } = useGalaxyStore.getState();
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
    const diskTilt =
      mode === 'compact' ? 0.42 :
      mode === 'ring' ? 1.16 :
      mode === 'exploded' ? 0.58 :
      1.08;

    if (mode !== previousModeRef.current) {
      if (mode === 'exploded') {
        burstPulseRef.current = 1;
      }
      previousModeRef.current = mode;
    }

    burstPulseRef.current = Math.max(0, burstPulseRef.current - delta * 1.7);
    const burstScale = 1 + burstPulseRef.current * 0.3;

    pointsRef.current.rotation.x = THREE.MathUtils.lerp(pointsRef.current.rotation.x, diskTilt, delta * 2.2);
    if (!isRotationPaused) {
      pointsRef.current.rotation.y += delta * (0.22 + safePinch * 0.28) * speed;
      pointsRef.current.rotation.z += delta * 0.03 * speed;
    }

    groupRef.current.rotation.x += (safeRotation[0] - groupRef.current.rotation.x) * delta * 7;
    groupRef.current.rotation.y += (safeRotation[1] - groupRef.current.rotation.y) * delta * 7;
    groupRef.current.rotation.z += (safeRotation[2] - groupRef.current.rotation.z) * delta * 4.5;

    groupRef.current.position.x = THREE.MathUtils.lerp(groupRef.current.position.x, safeOffset[0], delta * 4.6);
    groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, safeOffset[1], delta * 4.6);
    groupRef.current.position.z = THREE.MathUtils.lerp(groupRef.current.position.z, safeOffset[2], delta * 3.1);

    const scaleFactor = safeZoom / 50;
    groupRef.current.scale.setScalar(
      THREE.MathUtils.lerp(groupRef.current.scale.x, scaleFactor * burstScale, delta * 2.2),
    );

    const coreScaleTarget =
      mode === 'compact' ? 3.95 :
      mode === 'ring' ? 3.05 :
      mode === 'exploded' ? 3.15 :
      3.35;
    const photonRingScaleTarget =
      mode === 'compact' ? 4.25 :
      mode === 'ring' ? 5.2 :
      mode === 'exploded' ? 3.85 :
      4.75;
    const diskScaleTarget =
      mode === 'compact' ? 3.95 :
      mode === 'ring' ? 4.85 :
      mode === 'exploded' ? 3.45 :
      5.35;
    const outerDiskScaleTarget = diskScaleTarget * 1.22;
    const auraScaleTarget =
      mode === 'exploded' ? 3.2 :
      mode === 'compact' ? 3.9 :
      4.9;

    const nextCoreScale = THREE.MathUtils.lerp(coreRef.current.scale.x, coreScaleTarget, delta * 4);
    const nextPhotonRingScale = THREE.MathUtils.lerp(photonRingRef.current.scale.x, photonRingScaleTarget, delta * 3.3);
    const nextDiskScale = THREE.MathUtils.lerp(diskRef.current.scale.x, diskScaleTarget, delta * 3.1);
    const nextOuterDiskScale = THREE.MathUtils.lerp(outerDiskRef.current.scale.x, outerDiskScaleTarget, delta * 2.6);
    const nextAuraScale = THREE.MathUtils.lerp(auraRef.current.scale.x, auraScaleTarget, delta * 3.4);

    coreRef.current.scale.setScalar(nextCoreScale);
    photonRingRef.current.scale.set(nextPhotonRingScale, nextPhotonRingScale, nextPhotonRingScale);
    diskRef.current.scale.set(nextDiskScale, nextDiskScale * 0.78, nextDiskScale);
    outerDiskRef.current.scale.set(nextOuterDiskScale, nextOuterDiskScale, nextOuterDiskScale);
    auraRef.current.scale.set(nextAuraScale * 1.1, nextAuraScale, nextAuraScale * 1.1);

    if (!isRotationPaused) {
      photonRingRef.current.rotation.z += delta * 0.14;
      diskRef.current.rotation.z += delta * 0.22 * speed;
      outerDiskRef.current.rotation.z -= delta * 0.08 * speed;
      auraRef.current.rotation.y += delta * 0.05;
    }

    if (coreMaterialRef.current) {
      coreMaterialRef.current.emissive.lerp(new THREE.Color('#010204'), delta * 2.2);
    }

    if (photonRingMaterialRef.current) {
      const photonRingOpacityTarget =
        mode === 'ring' ? 0.95 :
        mode === 'compact' ? 0.7 :
        0.82 + burstPulseRef.current * 0.08;
      photonRingMaterialRef.current.opacity = THREE.MathUtils.lerp(
        photonRingMaterialRef.current.opacity,
        photonRingOpacityTarget,
        delta * 3,
      );
    }

    if (diskMaterialRef.current) {
      const diskOpacityTarget =
        mode === 'compact' ? 0.2 :
        mode === 'exploded' ? 0.12 :
        mode === 'ring' ? 0.48 :
        0.34;
      diskMaterialRef.current.opacity = THREE.MathUtils.lerp(diskMaterialRef.current.opacity, diskOpacityTarget, delta * 3);
      diskMaterialRef.current.color.lerp(
        mode === 'ring' ? new THREE.Color('#2a3038') : new THREE.Color('#1c2027'),
        delta * 2.5,
      );
    }

    if (outerDiskMaterialRef.current) {
      const outerOpacityTarget =
        mode === 'exploded' ? 0.12 + burstPulseRef.current * 0.18 :
        mode === 'compact' ? 0.1 :
        0.18;
      outerDiskMaterialRef.current.opacity = THREE.MathUtils.lerp(
        outerDiskMaterialRef.current.opacity,
        outerOpacityTarget,
        delta * 2.8,
      );
    }

    if (auraMaterialRef.current) {
      const auraOpacityTarget =
        mode === 'compact' ? 0.18 :
        mode === 'exploded' ? 0.24 :
        0.24;
      auraMaterialRef.current.opacity = THREE.MathUtils.lerp(auraMaterialRef.current.opacity, auraOpacityTarget, delta * 3);
    }

    const geometry = pointsRef.current.geometry as THREE.BufferGeometry;
    const positionsAttribute = geometry.attributes.position;
    const currentPos = positionsAttribute.array as Float32Array;
    const targetPos = positionsMap[mode];
    const lerpFactor = Math.min(delta * 4.8, 1);

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
      <mesh ref={auraRef}>
        <sphereGeometry args={[1, 48, 48]} />
        <meshBasicMaterial
          ref={auraMaterialRef}
          color="#15191f"
          transparent
          opacity={0.24}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={outerDiskRef} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.1, 3.85, 128]} />
        <meshBasicMaterial
          ref={outerDiskMaterialRef}
          color="#242a33"
          side={THREE.DoubleSide}
          transparent
          opacity={0.18}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={diskRef} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.75, 3.1, 128]} />
        <meshBasicMaterial
          ref={diskMaterialRef}
          color="#1c2027"
          side={THREE.DoubleSide}
          transparent
          opacity={0.34}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={photonRingRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.9, 0.16, 24, 160]} />
        <meshBasicMaterial
          ref={photonRingMaterialRef}
          color="#3a404a"
          transparent
          opacity={0.82}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={coreRef}>
        <sphereGeometry args={[2.2, 64, 64]} />
        <meshStandardMaterial
          ref={coreMaterialRef}
          color="#05070a"
          roughness={0.58}
          metalness={0.1}
          emissive="#010204"
          emissiveIntensity={0.08}
          depthWrite
          depthTest
        />
      </mesh>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[initialPositions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
          <bufferAttribute attach="attributes-size" args={[sizes, 1]} />
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
