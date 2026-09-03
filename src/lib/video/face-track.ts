export type FaceBox = { x: number; y: number; width: number; height: number; score: number };
export type FaceSample = { time: number; faces: readonly FaceBox[] };
export type CropKeyframe = { time: number; x: number; y: number; confidence: number };
export type TrackedCrop = { sx: number; sy: number; sw: number; sh: number };

const clamp = (value: number, min = 0, max = 1) => {
  const floor = Math.min(min, max);
  const ceil = Math.max(min, max);
  return Math.min(ceil, Math.max(floor, value));
};
const center = (face: FaceBox) => ({ x: clamp(face.x + face.width / 2), y: clamp(face.y + face.height / 2) });
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

export function buildCropTrajectory(samples: readonly FaceSample[]): CropKeyframe[] {
  const ordered = [...samples].filter((sample) => Number.isFinite(sample.time)).sort((a, b) => a.time - b.time);
  if (!ordered.length) return [];

  const result: CropKeyframe[] = [];
  
  // Find the initial dominant face to lock instantly on frame 0
  let initialFace: { x: number; y: number } | null = null;
  for (const s of ordered) {
    const valid = s.faces.filter((f) => f.score >= 0.25 && f.width > 0 && f.height > 0);
    if (valid.length > 0) {
      // Pick the largest/highest-confidence face
      const dominant = [...valid].sort((a, b) => (b.width * b.height * b.score) - (a.width * a.height * a.score))[0];
      initialFace = center(dominant);
      break;
    }
  }

  let tracked = initialFace ? { x: initialFace.x, y: clamp(initialFace.y, 0.35, 0.55) } : { x: 0.5, y: 0.45 };
  let confidence = initialFace ? 0.95 : 0;
  let missingSince: number | null = null;
  let lastSeenFace: { x: number; y: number } = { ...tracked };

  // Cinematic Deadband thresholds: eliminate all micro-jitters from speaking, breathing, and microphone occlusion
  const DEADBAND_X = 0.09;
  const DEADBAND_Y = 0.08;

  for (const sample of ordered) {
    const valid = sample.faces
      .filter((face) => face.score >= 0.25 && face.width > 0 && face.height > 0)
      .map((face) => ({
        ...center(face),
        score: face.score,
        area: face.width * face.height,
      }))
      .sort((a, b) => b.area * b.score - a.area * a.score);

    let target: { x: number; y: number; score: number } | null = null;

    if (valid.length === 1) {
      target = valid[0];
    } else if (valid.length > 1) {
      // If multiple faces are close to each other (e.g. 2 co-hosts sitting close), frame the group center
      if (distance(valid[0], valid[1]) < 0.28) {
        target = {
          x: (valid[0].x + valid[1].x) / 2,
          y: (valid[0].y + valid[1].y) / 2,
          score: Math.max(valid[0].score, valid[1].score),
        };
      } else {
        // Track the face nearest to currently tracked position (stickiness)
        const nearest = [...valid].sort((a, b) => distance(a, tracked) - distance(b, tracked))[0];
        target = nearest;
      }
    }

    if (target) {
      missingSince = null;
      lastSeenFace = { x: target.x, y: target.y };

      const dx = target.x - tracked.x;
      const dy = target.y - tracked.y;

      // Apply Deadband: only move camera if displacement exceeds threshold
      const effectiveDx = Math.abs(dx) > DEADBAND_X ? dx - Math.sign(dx) * DEADBAND_X : 0;
      const effectiveDy = Math.abs(dy) > DEADBAND_Y ? dy - Math.sign(dy) * DEADBAND_Y : 0;

      // Cinematic inertial dampening: velvety smooth glide like a high-end PTZ broadcast camera
      const moveDist = Math.hypot(effectiveDx, effectiveDy);
      const alpha = moveDist > 0.25 ? 0.22 : clamp(0.06 + target.score * 0.04, 0.06, 0.12);

      tracked = {
        x: clamp(tracked.x + effectiveDx * alpha, 0.15, 0.85),
        y: clamp(tracked.y + effectiveDy * alpha, 0.35, 0.55),
      };
      confidence = target.score;
    } else {
      // Face temporarily not detected (turned around, hand in front of face)
      missingSince ??= sample.time;
      const missingFor = sample.time - missingSince;

      // Hold last known face position for up to 2.0s before gentle drift
      if (missingFor > 2.0) {
        const driftAlpha = clamp((missingFor - 2.0) / 4.0, 0.02, 0.15);
        tracked = {
          x: tracked.x + (0.5 - tracked.x) * driftAlpha,
          y: tracked.y + (0.45 - tracked.y) * driftAlpha,
        };
      } else {
        // Hold steady near last known face
        tracked = { ...lastSeenFace };
      }
      confidence *= 0.90;
    }

    result.push({
      time: sample.time,
      x: clamp(tracked.x),
      y: clamp(tracked.y),
      confidence: clamp(confidence),
    });
  }

  return result;
}

export type SpeakerCluster = {
  id: number;
  centerX: number;
  centerY: number;
  sampleCount: number;
};

/**
 * Cluster detected faces across time into distinct physical speaker locations (1 to 5+ people).
 */
export function detectSpeakerClusters(samples: readonly FaceSample[]): SpeakerCluster[] {
  const allFaces: { x: number; y: number; score: number }[] = [];
  for (const s of samples) {
    for (const f of s.faces) {
      if (f.score >= 0.30 && f.width > 0 && f.height > 0) {
        allFaces.push({ ...center(f), score: f.score });
      }
    }
  }

  if (!allFaces.length) return [];

  // Group into spatial clusters by X coordinate
  const clusters: { faces: { x: number; y: number; score: number }[] }[] = [];
  for (const face of allFaces) {
    let added = false;
    for (const cluster of clusters) {
      const avgX = cluster.faces.reduce((sum, f) => sum + f.x, 0) / cluster.faces.length;
      if (Math.abs(face.x - avgX) <= 0.14) {
        cluster.faces.push(face);
        added = true;
        break;
      }
    }
    if (!added) {
      clusters.push({ faces: [face] });
    }
  }

  // Filter out noisy single-frame false detections (need at least 2 samples)
  const validClusters = clusters.filter((c) => c.faces.length >= 2 || clusters.length === 1);

  return (validClusters.length > 0 ? validClusters : clusters)
    .map((c, i) => {
      const avgX = c.faces.reduce((sum, f) => sum + f.x, 0) / c.faces.length;
      const avgY = c.faces.reduce((sum, f) => sum + f.y, 0) / c.faces.length;
      return {
        id: i,
        centerX: clamp(avgX, 0.18, 0.82),
        centerY: clamp(avgY, 0.30, 0.60),
        sampleCount: c.faces.length,
      };
    })
    .sort((a, b) => a.centerX - b.centerX);
}

/**
 * Build a dynamic podcast speaker trajectory that auto-cuts/pans across 2+ distinct speakers.
 * If only 1 speaker cluster exists, locks steadily on that single speaker!
 */
export function buildPodcastSpeakerTrajectory(
  samples: readonly FaceSample[],
  duration: number = 60
): CropKeyframe[] {
  const ordered = [...samples].filter((s) => Number.isFinite(s.time)).sort((a, b) => a.time - b.time);
  const detectedClusters = detectSpeakerClusters(ordered);

  // If only 1 speaker or no clusters, delegate to continuous single-speaker face tracking
  if (detectedClusters.length <= 1) {
    return buildCropTrajectory(samples);
  }

  const clusters: SpeakerCluster[] = detectedClusters;
  const maxTime = Math.max(duration, ordered.length > 0 ? ordered[ordered.length - 1].time : 60);
  const result: CropKeyframe[] = [];

  let currentClusterIdx = 0;
  let t = 0;

  while (t <= maxTime + 2) {
    const activeCluster = clusters[currentClusterIdx % clusters.length];
    const shotDuration = 3.5 + ((currentClusterIdx * 1.5) % 2.0); // Variable TV pacing (3.5s - 5.5s)
    const transitionDuration = 0.35; // Cinematic camera glide
    const shotEnd = t + shotDuration;

    // Start of transition to speaker
    result.push({
      time: Number(t.toFixed(2)),
      x: activeCluster.centerX,
      y: activeCluster.centerY,
      confidence: 0.95,
    });

    // Hold shot steadily on the speaker until shotEnd
    result.push({
      time: Number(Math.max(t + transitionDuration, shotEnd - 0.05).toFixed(2)),
      x: activeCluster.centerX,
      y: activeCluster.centerY,
      confidence: 0.95,
    });

    t = shotEnd;
    currentClusterIdx += 1;
  }

  return result.sort((a, b) => a.time - b.time);
}

export function cropFocusAt(trajectory: readonly CropKeyframe[], time: number): CropKeyframe {
  if (!trajectory.length) return { time, x: 0.5, y: 0.45, confidence: 0 };
  if (time <= trajectory[0].time) return trajectory[0];
  if (time >= trajectory[trajectory.length - 1].time) return trajectory[trajectory.length - 1];
  let low = 0, high = trajectory.length - 1;
  while (high - low > 1) { const mid = (low + high) >> 1; if (trajectory[mid].time <= time) low = mid; else high = mid; }
  const a = trajectory[low], b = trajectory[high];
  const delta = Math.max(0.001, b.time - a.time);
  const rawMix = clamp((time - a.time) / delta, 0, 1);
  // Smoothstep S-curve for cinematic camera pan
  const mix = rawMix * rawMix * (3 - 2 * rawMix);
  return {
    time,
    x: a.x + (b.x - a.x) * mix,
    y: a.y + (b.y - a.y) * mix,
    confidence: a.confidence + (b.confidence - a.confidence) * mix,
  };
}

export function trackedCoverCrop(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  focus: CropKeyframe,
  zoom: number = 1.0,
): TrackedCrop {
  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = targetWidth / targetHeight;
  const safeZoom = Math.max(1.0, Math.min(2.0, zoom));
  const base = sourceRatio > targetRatio
    ? { sx: 0, sy: 0, sw: (sourceHeight * targetRatio) / safeZoom, sh: sourceHeight / safeZoom }
    : { sx: 0, sy: 0, sw: sourceWidth / safeZoom, sh: (sourceWidth / targetRatio) / safeZoom };
  return {
    sx: clamp(focus.x * sourceWidth - base.sw / 2, 0, sourceWidth - base.sw),
    sy: clamp(focus.y * sourceHeight - base.sh / 2, 0, sourceHeight - base.sh),
    sw: base.sw,
    sh: base.sh,
  };
}
