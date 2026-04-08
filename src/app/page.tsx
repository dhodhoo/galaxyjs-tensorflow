'use client';

import dynamic from 'next/dynamic';
import UIOverlay from '../components/UIOverlay';

const GalaxyScene = dynamic(() => import('../components/GalaxyScene'), { ssr: false });
const HandTracker = dynamic(() => import('../components/HandTracker'), { ssr: false });

export default function Home() {
  return (
    <main className="relative w-screen h-screen overflow-hidden text-white">
      {/* 3D WebGL Canvas */}
      <GalaxyScene />
      
      {/* Hidden Webcam Processor */}
      <HandTracker />
      
      {/* Glassmorphism Controls */}
      <UIOverlay />
      
      {/* Fallback info for permission */}
      <div className="absolute bottom-4 left-4 text-xs text-white/50 z-50">
        Drag to orbit the camera, use open palm to widen the accretion disk, and close your fist to collapse it inward.
      </div>
    </main>
  );
}
