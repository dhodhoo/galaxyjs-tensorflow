import { Keypoint } from '@tensorflow-models/hand-pose-detection';
import { GestureState } from '../store/useGalaxyStore';

const WRIST = 0;
const THUMB_TIP = 4;
const INDEX_MCP = 5;
const INDEX_TIP = 8;
const MIDDLE_MCP = 9;
const MIDDLE_TIP = 12;
const RING_MCP = 13;
const RING_TIP = 16;
const PINKY_MCP = 17;
const PINKY_TIP = 20;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function safeNumber(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

export function calculateDistance(p1: Keypoint, p2: Keypoint): number {
  const dx = safeNumber(p1.x, 0) - safeNumber(p2.x, 0);
  const dy = safeNumber(p1.y, 0) - safeNumber(p2.y, 0);
  return Math.sqrt(dx * dx + dy * dy);
}

export function getHandCenter(keypoints: Keypoint[]): { x: number; y: number; z?: number } {
  // Use palm keypoints for a stable center (0: wrist, 5: index_mcp, 9: middle_mcp, 17: pinky_mcp)
  if (!keypoints || keypoints.length === 0) return { x: 320, y: 240 };

  const palmIndices = [WRIST, INDEX_MCP, MIDDLE_MCP, RING_MCP, PINKY_MCP];
  let sumX = 0;
  let sumY = 0;
  let validCount = 0;
  
  for (const idx of palmIndices) {
    const p = keypoints[idx];
    if (p && typeof p.x === 'number' && typeof p.y === 'number' && !isNaN(p.x) && !isNaN(p.y)) {
      sumX += p.x;
      sumY += p.y;
      validCount++;
    }
  }

  if (validCount === 0) return { x: 320, y: 240 };

  return { 
    x: sumX / validCount, 
    y: sumY / validCount 
  };
}

export function getHandBoundsCenter(keypoints: Keypoint[]): { x: number; y: number } {
  if (!keypoints || keypoints.length === 0) return { x: 320, y: 240 };

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const point of keypoints) {
    if (!point) continue;
    const x = safeNumber(point.x, NaN);
    const y = safeNumber(point.y, NaN);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }

  if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minY) || !Number.isFinite(maxY)) {
    return getHandCenter(keypoints);
  }

  return {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
  };
}

export function getPalmSize(keypoints: Keypoint[]): number {
  const wrist = keypoints[WRIST];
  const middleKnuckle = keypoints[MIDDLE_MCP];

  if (!wrist || !middleKnuckle || typeof wrist.x !== 'number' || typeof middleKnuckle.x !== 'number') {
    return 0;
  }

  return calculateDistance(wrist, middleKnuckle);
}

export function getPinchStrength(keypoints: Keypoint[]): number {
  const thumbTip = keypoints[THUMB_TIP];
  const indexTip = keypoints[INDEX_TIP];
  const palmSize = getPalmSize(keypoints);

  if (!thumbTip || !indexTip || palmSize === 0) return 0;

  const pinchDistance = calculateDistance(thumbTip, indexTip);
  return clamp(1 - (pinchDistance - palmSize * 0.35) / (palmSize * 1.1), 0, 1);
}

export function getHandOpenness(keypoints: Keypoint[]): number {
  const wrist = keypoints[WRIST];
  const palmSize = getPalmSize(keypoints);

  if (!wrist || palmSize === 0) return 0;

  const tipIndices = [INDEX_TIP, MIDDLE_TIP, RING_TIP, PINKY_TIP];
  const extensionSum = tipIndices.reduce((sum, index) => {
    const point = keypoints[index];
    if (!point) return sum;
    return sum + calculateDistance(wrist, point) / palmSize;
  }, 0);

  const averageExtension = extensionSum / tipIndices.length;
  return clamp(safeNumber((averageExtension - 1.15) / 0.9, 0), 0, 1);
}

function getFingerExtensionRatio(keypoints: Keypoint[], tipIndex: number): number {
  const wrist = keypoints[WRIST];
  const palmSize = getPalmSize(keypoints);
  const tip = keypoints[tipIndex];

  if (!wrist || !tip || palmSize === 0) {
    return 0;
  }

  return calculateDistance(wrist, tip) / palmSize;
}

function countExtendedFingers(keypoints: Keypoint[]): number {
  const tipIndices = [INDEX_TIP, MIDDLE_TIP, RING_TIP, PINKY_TIP];
  return tipIndices.filter((tipIndex) => getFingerExtensionRatio(keypoints, tipIndex) > 1.38).length;
}

export function isClosedFist(keypoints: Keypoint[]): boolean {
  const wrist = keypoints[WRIST];
  const palmSize = getPalmSize(keypoints);
  const openness = getHandOpenness(keypoints);
  const pinchStrength = getPinchStrength(keypoints);
  const extendedFingers = countExtendedFingers(keypoints);

  if (!wrist || palmSize === 0) return false;

  const tips = [keypoints[THUMB_TIP], keypoints[INDEX_TIP], keypoints[MIDDLE_TIP], keypoints[RING_TIP], keypoints[PINKY_TIP]];
  let maxDist = 0;

  for (const tip of tips) {
    if (tip && typeof tip.x === 'number') {
      const d = calculateDistance(wrist, tip);
      if (!isNaN(d) && d > maxDist) {
        maxDist = d;
      }
    }
  }

  return (
    maxDist <= palmSize * 1.58 &&
    openness < 0.5 &&
    pinchStrength < 0.82 &&
    extendedFingers <= 1
  );
}

export function isOpenPalm(keypoints: Keypoint[]): boolean {
  return getHandOpenness(keypoints) > 0.54 && getPinchStrength(keypoints) < 0.72;
}

export function isOkGesture(keypoints: Keypoint[]): boolean {
  const pinchStrength = getPinchStrength(keypoints);
  const openness = getHandOpenness(keypoints);
  const middleExtension = getFingerExtensionRatio(keypoints, MIDDLE_TIP);
  const ringExtension = getFingerExtensionRatio(keypoints, RING_TIP);
  const pinkyExtension = getFingerExtensionRatio(keypoints, PINKY_TIP);
  const extendedFingers = [middleExtension, ringExtension, pinkyExtension].filter(
    (extension) => extension > 1.45,
  ).length;

  return pinchStrength > 0.58 && openness > 0.28 && extendedFingers >= 2;
}

export function classifyGesture(keypoints: Keypoint[]): GestureState {
  if (!keypoints || keypoints.length === 0) return 'None';

  if (isClosedFist(keypoints)) {
    return 'Closed Fist';
  }

  if (isOkGesture(keypoints)) {
    return 'OK';
  }

  if (isOpenPalm(keypoints)) {
    return 'Open Palm';
  }

  return 'Tracking';
}

export function lerp(start: number, end: number, t: number): number {
  return start * (1 - t) + end * t;
}

export function smoothArray(current: number[], target: number[], t: number): number[] {
  return current.map((c, i) => lerp(c, target[i], t));
}
