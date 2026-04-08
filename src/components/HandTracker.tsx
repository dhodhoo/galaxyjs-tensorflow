'use client';

import { useEffect, useRef } from 'react';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import type {
  HandDetector,
  Keypoint,
  MediaPipeHandsMediaPipeModelConfig,
  MediaPipeHandsTfjsModelConfig,
} from '@tensorflow-models/hand-pose-detection';
import { GestureState, useGalaxyStore } from '../store/useGalaxyStore';
import { classifyGesture, getHandBoundsCenter, getHandCenter, getHandOpenness, getPinchStrength, lerp, safeNumber } from '../lib/gestureUtils';

const CAMERA_WIDTH = 640;
const CAMERA_HEIGHT = 480;
type HandPoseDetectionModule = typeof import('@tensorflow-models/hand-pose-detection');

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function sanitizeUnitValue(value: number, fallback = 0): number {
  return clamp(safeNumber(value, fallback), -1, 1);
}

function sanitizeRatio(value: number, fallback = 0): number {
  return clamp(safeNumber(value, fallback), 0, 1);
}

function applyDeadZone(value: number, deadZone = 0.12): number {
  const safeValue = sanitizeUnitValue(value, 0);
  const magnitude = Math.abs(safeValue);
  if (magnitude <= deadZone) {
    return 0;
  }

  const normalized = (magnitude - deadZone) / (1 - deadZone);
  return Math.sign(safeValue) * Math.pow(normalized, 0.85);
}

export default function HandTracker() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | undefined>(undefined);
  const detectorRef = useRef<HandDetector | null>(null);
  const handPoseDetectionRef = useRef<HandPoseDetectionModule | null>(null);
  const smoothedInputRef = useRef({
    x: 0,
    y: 0,
    pinch: 0,
    openness: 0,
  });
  const stableGestureRef = useRef<GestureState>('None');
  const appliedGestureRef = useRef<GestureState>('None');
  const candidateGestureRef = useRef<GestureState>('None');
  const candidateFramesRef = useRef(0);

  useEffect(() => {
    let active = true;
    const videoElement = videoRef.current;

    if (!videoElement) {
      return;
    }

    const liveVideo = videoElement;
    const overlayCanvas = canvasRef.current;

    function drawDebugOverlay(
      keypoints: Keypoint[] = [],
      center?: { x: number; y: number },
    ) {
      if (!overlayCanvas) return;

      const ctx = overlayCanvas.getContext('2d');
      if (!ctx) return;

      const width = overlayCanvas.width;
      const height = overlayCanvas.height;
      ctx.clearRect(0, 0, width, height);

      if (!keypoints.length) return;

      const scaleX = width / (liveVideo.videoWidth || CAMERA_WIDTH);
      const scaleY = height / (liveVideo.videoHeight || CAMERA_HEIGHT);

      ctx.fillStyle = 'rgba(79, 172, 254, 0.95)';
      for (const point of keypoints) {
        const x = safeNumber(point.x, NaN);
        const y = safeNumber(point.y, NaN);
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

        ctx.beginPath();
        ctx.arc(x * scaleX, y * scaleY, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      if (center) {
        ctx.fillStyle = 'rgba(34, 197, 94, 0.95)';
        ctx.beginPath();
        ctx.arc(center.x * scaleX, center.y * scaleY, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    async function setupCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: CAMERA_WIDTH, height: CAMERA_HEIGHT, facingMode: 'user' },
        });
        liveVideo.srcObject = stream;
        await new Promise((resolve) => {
          liveVideo.onloadedmetadata = () => {
            resolve(null);
          };
        });
        await liveVideo.play();
      } catch (e) {
        console.error('Camera access denied:', e);
      }
    }

    async function initDetector() {
      if (!handPoseDetectionRef.current) {
        handPoseDetectionRef.current = await import(
          '@tensorflow-models/hand-pose-detection/dist/index.js'
        ) as HandPoseDetectionModule;
      }

      const handPoseDetection = handPoseDetectionRef.current;
      const model = handPoseDetection.SupportedModels.MediaPipeHands;
      try {
        const detectorConfig: MediaPipeHandsMediaPipeModelConfig = {
          runtime: 'mediapipe',
          modelType: 'full',
          maxHands: 1,
          solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/hands',
        };

        detectorRef.current = await handPoseDetection.createDetector(model, detectorConfig);
      } catch (mediapipeError) {
        console.warn('MediaPipe runtime failed, falling back to tfjs detector.', mediapipeError);
        await tf.ready();
        if (tf.getBackend() !== 'webgl') {
          await tf.setBackend('webgl');
        }

        const detectorConfig: MediaPipeHandsTfjsModelConfig = {
          runtime: 'tfjs',
          modelType: 'full',
          maxHands: 1,
        };

        detectorRef.current = await handPoseDetection.createDetector(model, detectorConfig);
      }
    }

    function stabilizeGesture(nextGesture: GestureState) {
      if (nextGesture === stableGestureRef.current) {
        candidateGestureRef.current = nextGesture;
        candidateFramesRef.current = 0;
        return stableGestureRef.current;
      }

      if (candidateGestureRef.current !== nextGesture) {
        candidateGestureRef.current = nextGesture;
        candidateFramesRef.current = 1;
        return stableGestureRef.current;
      }

      candidateFramesRef.current += 1;
      if (candidateFramesRef.current >= 2) {
        stableGestureRef.current = nextGesture;
        candidateFramesRef.current = 0;
      }

      return stableGestureRef.current;
    }

    function resolveNextMode(
      currentMode: typeof useGalaxyStore.getState extends () => infer T
        ? T extends { mode: infer M }
          ? M
          : never
        : never,
      previousGesture: GestureState,
      nextGesture: GestureState,
    ) {
      if (nextGesture === 'Closed Fist') {
        return 'compact' as const;
      }

      if (nextGesture === 'OK') {
        return 'ring' as const;
      }

      if (nextGesture === 'Open Palm') {
        if (previousGesture === 'Closed Fist' || currentMode === 'compact') {
          return 'exploded' as const;
        }

        if (previousGesture === 'OK' || currentMode === 'ring') {
          return 'spiral' as const;
        }

        if (currentMode === 'exploded') {
          return 'exploded' as const;
        }

        return 'spiral' as const;
      }

      return currentMode;
    }

    async function detect() {
      if (!detectorRef.current || !active) return;

      if (liveVideo.readyState >= 2) {
        try {
          const hands = await detectorRef.current.estimateHands(liveVideo, {
            flipHorizontal: true,
          });

          if (hands.length > 0) {
            const hand = hands[0];
            const keypoints = hand.keypoints;
            const palmCenter = getHandCenter(keypoints);
            const boundsCenter = getHandBoundsCenter(keypoints);
            const center = {
              x: lerp(boundsCenter.x, palmCenter.x, 0.35),
              y: lerp(boundsCenter.y, palmCenter.y, 0.35),
            };
            drawDebugOverlay(keypoints, center);

            const videoWidth = liveVideo.videoWidth || CAMERA_WIDTH;
            const videoHeight = liveVideo.videoHeight || CAMERA_HEIGHT;

            const rawX = sanitizeUnitValue((safeNumber(center.x, videoWidth / 2) / videoWidth) * 2 - 1);
            const rawY = sanitizeUnitValue(-((safeNumber(center.y, videoHeight / 2) / videoHeight) * 2 - 1));
            const nextX = applyDeadZone(rawX, 0.08);
            const nextY = applyDeadZone(rawY, 0.08);
            const nextPinch = sanitizeRatio(getPinchStrength(keypoints));
            const nextOpenness = sanitizeRatio(getHandOpenness(keypoints));

            smoothedInputRef.current.x = lerp(smoothedInputRef.current.x, nextX, 0.34);
            smoothedInputRef.current.y = lerp(smoothedInputRef.current.y, nextY, 0.34);
            smoothedInputRef.current.pinch = lerp(smoothedInputRef.current.pinch, nextPinch, 0.3);
            smoothedInputRef.current.openness = lerp(smoothedInputRef.current.openness, nextOpenness, 0.26);

            const gesture = stabilizeGesture(classifyGesture(keypoints));
            const currentState = useGalaxyStore.getState();
            let nextMode = currentState.mode;
            const previousGesture = appliedGestureRef.current;

            if (gesture === 'Closed Fist') {
              nextMode = 'compact';
              appliedGestureRef.current = 'Closed Fist';
            } else if (gesture === 'OK') {
              nextMode = 'ring';
              appliedGestureRef.current = 'OK';
            } else if (gesture === 'Open Palm' && gesture !== previousGesture) {
              nextMode = resolveNextMode(currentState.mode, previousGesture, gesture);
              appliedGestureRef.current = gesture;
            } else if (gesture === 'None') {
              appliedGestureRef.current = 'None';
            }

            let nextZoom = 50;
            if (nextMode === 'compact') {
              nextZoom = 72;
            } else if (nextMode === 'exploded') {
              nextZoom = 42;
            } else if (nextMode === 'ring') {
              nextZoom = 58 + smoothedInputRef.current.pinch * 10;
            } else {
              nextZoom = 48 + smoothedInputRef.current.openness * 10;
            }

            useGalaxyStore.setState({
              isTracking: true,
              currentGesture: gesture,
              mode: nextMode,
              targetRotation: [
                sanitizeUnitValue(smoothedInputRef.current.y) * 0.95,
                sanitizeUnitValue(smoothedInputRef.current.x) * 1.45,
                sanitizeUnitValue(smoothedInputRef.current.x) * 0.16,
              ],
              targetOffset: [
                sanitizeUnitValue(smoothedInputRef.current.x) * 4.2,
                sanitizeUnitValue(smoothedInputRef.current.y) * 2.8,
                sanitizeRatio(smoothedInputRef.current.pinch) * 1.4,
              ],
              targetZoom: safeNumber(nextZoom, 50),
              pinchStrength: sanitizeRatio(smoothedInputRef.current.pinch),
              handOpenness: sanitizeRatio(smoothedInputRef.current.openness),
              handPosition: [
                sanitizeUnitValue(smoothedInputRef.current.x),
                sanitizeUnitValue(smoothedInputRef.current.y),
              ],
              rawHandPosition: [rawX, rawY],
            });
          } else {
            drawDebugOverlay();
            stableGestureRef.current = 'None';
            appliedGestureRef.current = 'None';
            candidateGestureRef.current = 'None';
            candidateFramesRef.current = 0;
            smoothedInputRef.current = {
              x: lerp(smoothedInputRef.current.x, 0, 0.25),
              y: lerp(smoothedInputRef.current.y, 0, 0.25),
              pinch: lerp(smoothedInputRef.current.pinch, 0, 0.3),
              openness: lerp(smoothedInputRef.current.openness, 0, 0.3),
            };

            useGalaxyStore.setState({
              isTracking: false,
              currentGesture: 'None',
              mode: 'spiral',
              targetRotation: [0, 0, 0],
              targetOffset: [0, 0, 0],
              targetZoom: 50,
              pinchStrength: 0,
              handOpenness: 0,
              handPosition: [0, 0],
              rawHandPosition: [0, 0],
            });
          }
        } catch (err) {
          console.error(err);
        }
      }

      requestRef.current = requestAnimationFrame(detect);
    }

    async function start() {
      await setupCamera();
      await initDetector();
      detect();
    }

    start();

    return () => {
      active = false;
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      detectorRef.current?.dispose();
      if (liveVideo.srcObject) {
        const stream = liveVideo.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <>
      <video
        ref={videoRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '160px',
          height: '120px',
          transform: 'scaleX(-1)', // mirror
          opacity: 0.8,
          borderRadius: '8px',
          border: '2px solid rgba(255,255,255,0.1)',
          zIndex: 50,
          pointerEvents: 'none',
          objectFit: 'cover',
          marginLeft: '16px',
          marginTop: '16px',
        }}
        playsInline
        muted
      />
      <canvas
        ref={canvasRef}
        width={160}
        height={120}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '160px',
          height: '120px',
          zIndex: 51,
          pointerEvents: 'none',
          marginLeft: '16px',
          marginTop: '16px',
        }}
      />
    </>
  );
}
