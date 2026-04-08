'use client';

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
        
        <ambientLight intensity={0.3} />
        <directionalLight position={[18, 14, 12]} intensity={1.35} color="#c9d9ff" />
        <directionalLight position={[-12, -6, -10]} intensity={0.45} color="#3d5c8c" />
        
        <GalaxyParticles />

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
