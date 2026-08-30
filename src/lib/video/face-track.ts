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
  const result: CropKeyframe[] = [];
  let tracked = { x: 0.5, y: 0.45 };
  let confidence = 0;
  let missingSince: number | null = null;
  let switchCandidate: { x: number; y: number; count: number } | null = null;
  for (const sample of ordered) {
    const valid = sample.faces
      .filter((face) => face.score >= 0.45 && face.width > 0 && face.height > 0)
      .map((face) => ({ ...center(face), score: face.score, area: face.width * face.height }))
      .sort((a, b) => b.area * b.score - a.area * a.score);
    let target = valid[0] ?? null;
    if (valid.length > 1 && distance(valid[0], valid[1]) < 0.32) {
      target = { x: (valid[0].x + valid[1].x) / 2, y: (valid[0].y + valid[1].y) / 2, score: Math.max(valid[0].score, valid[1].score), area: valid[0].area + valid[1].area };
    } else if (valid.length > 1) {
      const nearest = [...valid].sort((a, b) => distance(a, tracked) - distance(b, tracked))[0];
      const challenger = valid[0];
      if (distance(nearest, tracked) < 0.18 || nearest === challenger) target = nearest;
      else {
        const candidate = switchCandidate;
        const previousCount: number = candidate && distance(candidate, challenger) < 0.08 ? candidate.count : 0;
        switchCandidate = { x: challenger.x, y: challenger.y, count: previousCount + 1 };
        target = switchCandidate.count >= 3 ? challenger : nearest;
      }
    }
    if (target) {
      missingSince = null;
      const alpha = clamp(0.12 + target.score * 0.16, 0.18, 0.3);
      tracked = { x: tracked.x + clamp(target.x - tracked.x, -0.12, 0.12) * alpha, y: tracked.y + clamp(target.y - tracked.y, -0.1, 0.1) * alpha };
      confidence = target.score;
    } else {
      missingSince ??= sample.time;
      const missingFor = sample.time - missingSince;
      if (missingFor > 1.2) {
        const alpha = clamp((missingFor - 1.2) / 3, 0.03, 0.18);
        tracked = { x: tracked.x + (0.5 - tracked.x) * alpha, y: tracked.y + (0.45 - tracked.y) * alpha };
      }
      confidence *= 0.85;
    }
    result.push({ time: sample.time, x: clamp(tracked.x), y: clamp(tracked.y), confidence: clamp(confidence) });
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
      if (f.score >= 0.25 && f.width > 0 && f.height > 0) {
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
      if (Math.abs(face.x - avgX) <= 0.11) {
        cluster.faces.push(face);
        added = true;
        break;
      }
    }
    if (!added) {
      clusters.push({ faces: [face] });
    }
  }

  return clusters
    .map((c, i) => {
      const avgX = c.faces.reduce((sum, f) => sum + f.x, 0) / c.faces.length;
      const avgY = c.faces.reduce((sum, f) => sum + f.y, 0) / c.faces.length;
      return {
        id: i,
        centerX: clamp(avgX, 0.15, 0.85),
        centerY: clamp(avgY, 0.25, 0.65),
        sampleCount: c.faces.length,
      };
    })
    .sort((a, b) => a.centerX - b.centerX);
}

/**
 * Build a dynamic podcast speaker trajectory that auto-cuts/pans across 1, 2, 3, 4, or 5+ speakers.
 * Each speaker shot is held stable for 3.2s - 4.5s with snappy 0.25s cinematic transitions.
 */
export function buildPodcastSpeakerTrajectory(
  samples: readonly FaceSample[],
  duration: number = 60
): CropKeyframe[] {
  const ordered = [...samples].filter((s) => Number.isFinite(s.time)).sort((a, b) => a.time - b.time);
  const detectedClusters = detectSpeakerClusters(ordered);

  // Fallback speaker positions if face detection is sparse
  const clusters: SpeakerCluster[] = detectedClusters.length > 0
    ? detectedClusters
    : [
        { id: 0, centerX: 0.22, centerY: 0.42, sampleCount: 10 },
        { id: 1, centerX: 0.78, centerY: 0.42, sampleCount: 10 },
      ];

  const maxTime = Math.max(duration, ordered.length > 0 ? ordered[ordered.length - 1].time : 60);
  const result: CropKeyframe[] = [];

  let currentClusterIdx = 0;
  let t = 0;

  while (t <= maxTime + 2) {
    const activeCluster = clusters[currentClusterIdx % clusters.length];
    const shotDuration = 3.2 + ((currentClusterIdx * 1.3) % 1.6); // Natural variable TV pacing (3.2s - 4.8s)
    const transitionDuration = 0.25; // Snappy broadcast glide to the speaker
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

export function trackedCoverCrop(sourceWidth: number, sourceHeight: number, targetWidth: number, targetHeight: number, focus: CropKeyframe): TrackedCrop {
  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = targetWidth / targetHeight;
  const base = sourceRatio > targetRatio
    ? { sx: 0, sy: 0, sw: sourceHeight * targetRatio, sh: sourceHeight }
    : { sx: 0, sy: 0, sw: sourceWidth, sh: sourceWidth / targetRatio };
  return { ...base, sx: clamp(focus.x * sourceWidth - base.sw / 2, 0, sourceWidth - base.sw), sy: clamp(focus.y * sourceHeight - base.sh / 2, 0, sourceHeight - base.sh) };
}
