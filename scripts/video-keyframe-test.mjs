import assert from "node:assert/strict";
import { interpolateKeyframes, manualKeyframesToTrajectory } from "../src/lib/video/keyframe-engine.ts";

console.log("Testing Keyframe Engine...");

// Test 1: Empty keyframes return default values
const emptyResult = interpolateKeyframes([], 5, 0.5, 0.45, 1.0);
assert.equal(emptyResult.panX, 0.5);
assert.equal(emptyResult.zoom, 1.0);
console.log("✅ [PASS] Empty keyframes return default values");

// Test 2: Single keyframe returns that keyframe
const single = [{ id: "1", time: 10, panX: 0.2, panY: 0.45, zoom: 1.2 }];
const singleResult = interpolateKeyframes(single, 5);
assert.equal(singleResult.panX, 0.2);
assert.equal(singleResult.zoom, 1.2);
console.log("✅ [PASS] Single keyframe bounds respected");

// Test 3: Interpolation between two keyframes at midpoint
const pair = [
  { id: "1", time: 0, panX: 0.2, panY: 0.45, zoom: 1.0 },
  { id: "2", time: 10, panX: 0.8, panY: 0.45, zoom: 1.4 },
];
const midResult = interpolateKeyframes(pair, 5);
// Smoothstep midpoint between 0.2 and 0.8 is exactly 0.5
assert(Math.abs(midResult.panX - 0.5) < 0.001);
assert(Math.abs(midResult.zoom - 1.2) < 0.001);
console.log("✅ [PASS] Smoothstep interpolation calculates exact midpoints");

// Test 4: Trajectory generation
const trajectory = manualKeyframesToTrajectory(pair, 10, 1.0);
assert.equal(trajectory.length, 12); // t=0 to 11
assert.equal(trajectory[0].time, 0);
assert(Math.abs(trajectory[0].x - 0.2) < 0.01);
console.log("✅ [PASS] Trajectory generated smoothly across duration");

console.log("🎉 All Keyframe Engine tests passed!");
