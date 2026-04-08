'use client';

import { GalaxyMode, useGalaxyStore } from '../store/useGalaxyStore';

const galaxyModes: GalaxyMode[] = ['compact', 'spiral', 'ring', 'exploded'];

export default function UIOverlay() {
  const speed = useGalaxyStore((state) => state.speed);
  const setSpeed = useGalaxyStore((state) => state.setSpeed);
  const isRotationPaused = useGalaxyStore((state) => state.isRotationPaused);
  const toggleRotationPaused = useGalaxyStore((state) => state.toggleRotationPaused);
  const bloomIntensity = useGalaxyStore((state) => state.bloomIntensity);
  const setBloomIntensity = useGalaxyStore((state) => state.setBloomIntensity);
  const particleCount = useGalaxyStore((state) => state.particleCount);
  const mode = useGalaxyStore((state) => state.mode);
  const setMode = useGalaxyStore((state) => state.setMode);
  const isTracking = useGalaxyStore((state) => state.isTracking);
  const currentGesture = useGalaxyStore((state) => state.currentGesture);
  const pinchStrength = useGalaxyStore((state) => state.pinchStrength);
  const handOpenness = useGalaxyStore((state) => state.handOpenness);
  const handPosition = useGalaxyStore((state) => state.handPosition);
  const rawHandPosition = useGalaxyStore((state) => state.rawHandPosition);

  return (
    <div className="absolute right-0 top-0 bottom-0 w-80 p-6 flex flex-col justify-between z-40 bg-black/40 backdrop-blur-md border-l border-white/10 text-white font-mono text-sm">
      
      <div>
        <h1 className="text-2xl font-bold mb-1 text-blue-400">GALAXY SIM</h1>
        <p className="text-xs text-slate-400 mb-8 border-b border-white/10 pb-4">Gesture-Controlled Particle Engine</p>

        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-300">Simulation Speed</span>
              <span className="text-blue-400">{speed.toFixed(1)}x</span>
            </div>
            <input 
              type="range" 
              min="0.1" max="3" step="0.1" 
              value={speed}
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
              className="w-full accent-blue-500"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-300">Rotation</span>
              <span className="text-blue-400">{isRotationPaused ? 'Paused' : 'Running'}</span>
            </div>
            <button
              onClick={toggleRotationPaused}
              className={`w-full rounded-lg border px-3 py-2 text-xs uppercase tracking-[0.24em] transition-colors ${
                isRotationPaused
                  ? 'border-amber-400/60 bg-amber-400/10 text-amber-200'
                  : 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200'
              }`}
            >
              {isRotationPaused ? 'Resume Rotation' : 'Stop Rotation'}
            </button>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-300">Bloom Intensity</span>
              <span className="text-blue-400">{bloomIntensity.toFixed(1)}</span>
            </div>
            <input 
              type="range" 
              min="0" max="3" step="0.1" 
              value={bloomIntensity}
              onChange={(e) => setBloomIntensity(parseFloat(e.target.value))}
              className="w-full accent-blue-500"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-300">Galaxy Mode</span>
              <span className="text-blue-400 uppercase">{mode}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {galaxyModes.map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`py-2 text-xs border uppercase tracking-wider transition-colors ${mode === m ? 'border-blue-500 bg-blue-500/20 text-blue-200' : 'border-white/10 hover:bg-white/5'}`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-white/10 bg-black/30 p-4">
            <div className="text-xs uppercase tracking-[0.28em] text-slate-400">Gesture Mapping</div>
            <div className="text-xs text-slate-300">Open palm starts at spiral, and after compact it opens into exploded.</div>
            <div className="text-xs text-slate-300">Closed fist always returns the galaxy to compact.</div>
            <div className="text-xs text-slate-300">The OK hand sign switches to ring, then open palm returns it to spiral.</div>
          </div>
        </div>
      </div>

      <div className="space-y-4 pt-6 border-t border-white/10">
        <div className="flex items-center justify-between">
          <span className="text-slate-300">Particle Count</span>
          <span className="text-blue-400 font-bold">{particleCount.toLocaleString('en-US')}</span>
        </div>

        <div className="bg-black/50 p-4 rounded-lg border border-white/5">
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-3 h-3 rounded-full ${isTracking ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            <span className="uppercase text-xs tracking-widest">{isTracking ? 'Hand Detected' : 'No Signal'}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Gesture</span>
            <span className="text-white font-bold">{currentGesture}</span>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-white/10 bg-black/30 p-4">
          <div className="flex justify-between text-[11px] uppercase tracking-[0.24em] text-slate-400">
            <span>Raw X</span>
            <span>{rawHandPosition[0].toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-[11px] uppercase tracking-[0.24em] text-slate-400">
            <span>Raw Y</span>
            <span>{rawHandPosition[1].toFixed(2)}</span>
          </div>

          <div className="flex justify-between text-[11px] uppercase tracking-[0.24em] text-slate-400">
            <span>Hand X</span>
            <span>{handPosition[0].toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-[11px] uppercase tracking-[0.24em] text-slate-400">
            <span>Hand Y</span>
            <span>{handPosition[1].toFixed(2)}</span>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[11px] uppercase tracking-[0.24em] text-slate-400">
              <span>Pinch</span>
              <span>{Math.round(pinchStrength * 100)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-blue-400 transition-[width] duration-150"
                style={{ width: `${Math.round(pinchStrength * 100)}%` }}
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[11px] uppercase tracking-[0.24em] text-slate-400">
              <span>Open Palm</span>
              <span>{Math.round(handOpenness * 100)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-emerald-400 transition-[width] duration-150"
                style={{ width: `${Math.round(handOpenness * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>
      
    </div>
  );
}
