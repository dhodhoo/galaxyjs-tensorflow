'use client';

import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import GalaxyParticles from './GalaxyParticles';
import { useGalaxyStore } from '../store/useGalaxyStore';

export default function GalaxyScene() {
  const bloomIntensity = useGalaxyStore((state) => state.bloomIntensity);

  return (
    <div className="absolute inset-0 z-0">
      <Canvas
        camera={{ position: [0, 40, 60], fov: 60 }}
        dpr={[1, 2]} // Optimize pixel ratio
      >
        <color attach="background" args={['#000000']} />
        <fog attach="fog" args={['#020409', 65, 160]} />

        <ambientLight intensity={0.22} />
        <directionalLight position={[18, 14, 12]} intensity={1.2} color="#ffe0b3" />
        <directionalLight position={[-12, -6, -10]} intensity={0.4} color="#4a7bb8" />
        <pointLight position={[0, 0, 0]} intensity={18} distance={90} color="#ff8e3c" />
        <pointLight position={[0, 8, 0]} intensity={8} distance={70} color="#5dc7ff" />

        <GalaxyParticles />

        <OrbitControls
          enableDamping
          enablePan={false}
          target={[0, 0, 0]}
        />

        <EffectComposer>
          <Bloom
            luminanceThreshold={0.2}
            luminanceSmoothing={0.9}
            intensity={bloomIntensity}
          />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
