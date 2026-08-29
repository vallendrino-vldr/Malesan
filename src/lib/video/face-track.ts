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

export function cropFocusAt(trajectory: readonly CropKeyframe[], time: number): CropKeyframe {
  if (!trajectory.length) return { time, x: 0.5, y: 0.45, confidence: 0 };
  if (time <= trajectory[0].time) return trajectory[0];
  if (time >= trajectory[trajectory.length - 1].time) return trajectory[trajectory.length - 1];
  let low = 0, high = trajectory.length - 1;
  while (high - low > 1) { const mid = (low + high) >> 1; if (trajectory[mid].time <= time) low = mid; else high = mid; }
  const a = trajectory[low], b = trajectory[high];
  const mix = (time - a.time) / Math.max(0.001, b.time - a.time);
  return { time, x: a.x + (b.x - a.x) * mix, y: a.y + (b.y - a.y) * mix, confidence: a.confidence + (b.confidence - a.confidence) * mix };
}

export function trackedCoverCrop(sourceWidth: number, sourceHeight: number, targetWidth: number, targetHeight: number, focus: CropKeyframe): TrackedCrop {
  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = targetWidth / targetHeight;
  const base = sourceRatio > targetRatio
    ? { sx: 0, sy: 0, sw: sourceHeight * targetRatio, sh: sourceHeight }
    : { sx: 0, sy: 0, sw: sourceWidth, sh: sourceWidth / targetRatio };
  return { ...base, sx: clamp(focus.x * sourceWidth - base.sw / 2, 0, sourceWidth - base.sw), sy: clamp(focus.y * sourceHeight - base.sh / 2, 0, sourceHeight - base.sh) };
}
