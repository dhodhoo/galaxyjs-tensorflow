import { create } from 'zustand';

export type GalaxyMode = 'compact' | 'spiral' | 'ring' | 'exploded';
export type GestureState = 'None' | 'Tracking' | 'Open Palm' | 'OK' | 'Closed Fist';

interface GalaxyState {
  mode: GalaxyMode;
  setMode: (mode: GalaxyMode) => void;
  targetZoom: number;
  setTargetZoom: (zoom: number) => void;
  targetRotation: [number, number, number];
  setTargetRotation: (rotation: [number, number, number]) => void;
  targetOffset: [number, number, number];
  setTargetOffset: (offset: [number, number, number]) => void;
  particleCount: number;
  setParticleCount: (count: number) => void;
  isTracking: boolean;
  setIsTracking: (isTracking: boolean) => void;
  currentGesture: GestureState;
  setCurrentGesture: (gesture: GestureState) => void;
  pinchStrength: number;
  handOpenness: number;
  handPosition: [number, number];
  rawHandPosition: [number, number];
  setGestureMetrics: (metrics: { pinchStrength: number; handOpenness: number }) => void;
  setHandPosition: (position: [number, number]) => void;
  setRawHandPosition: (position: [number, number]) => void;
  speed: number;
  setSpeed: (speed: number) => void;
  isRotationPaused: boolean;
  setIsRotationPaused: (isRotationPaused: boolean) => void;
  toggleRotationPaused: () => void;
  bloomIntensity: number;
  setBloomIntensity: (intensity: number) => void;
}

export const useGalaxyStore = create<GalaxyState>((set) => ({
  mode: 'spiral',
  setMode: (mode) => set({ mode }),
  targetZoom: 50,
  setTargetZoom: (targetZoom) => set({ targetZoom }),
  targetRotation: [0, 0, 0],
  setTargetRotation: (targetRotation) => set({ targetRotation }),
  targetOffset: [0, 0, 0],
  setTargetOffset: (targetOffset) => set({ targetOffset }),
  particleCount: 50000,
  setParticleCount: (particleCount) => set({ particleCount }),
  isTracking: false,
  setIsTracking: (isTracking) => set({ isTracking }),
  currentGesture: 'None',
  setCurrentGesture: (currentGesture) => set({ currentGesture }),
  pinchStrength: 0,
  handOpenness: 0,
  handPosition: [0, 0],
  rawHandPosition: [0, 0],
  setGestureMetrics: ({ pinchStrength, handOpenness }) => set({ pinchStrength, handOpenness }),
  setHandPosition: (handPosition) => set({ handPosition }),
  setRawHandPosition: (rawHandPosition) => set({ rawHandPosition }),
  speed: 1.0,
  setSpeed: (speed) => set({ speed }),
  isRotationPaused: false,
  setIsRotationPaused: (isRotationPaused) => set({ isRotationPaused }),
  toggleRotationPaused: () => set((state) => ({ isRotationPaused: !state.isRotationPaused })),
  bloomIntensity: 1.5,
  setBloomIntensity: (bloomIntensity) => set({ bloomIntensity }),
}));
