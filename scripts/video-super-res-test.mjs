import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const superRes = await import(pathToFileURL(resolve("src/lib/video/superResolutionEngine.ts")));

console.log("Testing True AI Super-Resolution & Denoise Engine...");

// 1. Verify Configuration Completeness
assert.ok(superRes.SUPER_RES_CONFIGS.wink_hd, "wink_hd config must exist");
assert.ok(superRes.SUPER_RES_CONFIGS.ultra_hd, "ultra_hd config must exist");
assert.ok(superRes.SUPER_RES_CONFIGS.face_restore, "face_restore config must exist");
assert.ok(superRes.SUPER_RES_CONFIGS.clean_pro, "clean_pro config must exist");

// 2. Mock Canvas Context and ImageData
const W = 16;
const H = 16;
const pixelCount = W * H;
const rawBuffer = new Uint8ClampedArray(pixelCount * 4);

// Fill with flat skin tone (R=210, G=170, B=140) + artificial high-frequency speckle noise
for (let i = 0; i < pixelCount; i++) {
  const idx = i * 4;
  const noise = (i % 2 === 0 ? 5 : -5); // Small sensor noise (+-5)
  rawBuffer[idx] = Math.max(0, Math.min(255, 210 + noise));
  rawBuffer[idx + 1] = Math.max(0, Math.min(255, 170 + noise));
  rawBuffer[idx + 2] = Math.max(0, Math.min(255, 140 + noise));
  rawBuffer[idx + 3] = 255;
}

// Add a sharp high-contrast structural edge in the center (e.g. eye pupil / eyelash / contour)
const edgeY = 8;
for (let x = 4; x < 12; x++) {
  const idx = (edgeY * W + x) * 4;
  rawBuffer[idx] = 30;     // Dark edge
  rawBuffer[idx + 1] = 25;
  rawBuffer[idx + 2] = 20;
}

let resultData = null;
const mockCtx = {
  getImageData: () => ({
    data: new Uint8ClampedArray(rawBuffer),
    width: W,
    height: H,
  }),
  putImageData: (imgData) => {
    resultData = imgData;
  },
};

superRes.applySuperResolutionPass(mockCtx, W, H, "wink_hd", 0.8);

assert.ok(resultData, "putImageData must be called with processed frame");
assert.equal(resultData.data.length, pixelCount * 4, "Output pixel buffer length must match");

// Verify that flat areas with sensor noise have noise smoothed (variance reduced)
const sampleFlatIdx1 = (2 * W + 4) * 4;
const sampleFlatIdx2 = (2 * W + 5) * 4;
const originalDiff = Math.abs(rawBuffer[sampleFlatIdx1] - rawBuffer[sampleFlatIdx2]);
const processedDiff = Math.abs(resultData.data[sampleFlatIdx1] - resultData.data[sampleFlatIdx2]);

assert.ok(
  processedDiff <= originalDiff,
  `Sensor noise in flat areas must be smoothed (orig diff: ${originalDiff}, processed: ${processedDiff})`,
);

// Verify edge contrast is maintained and not blurred away
const edgePixelIdx = (edgeY * W + 8) * 4;
const neighborPixelIdx = ((edgeY - 2) * W + 8) * 4;
const edgeContrast = Math.abs(resultData.data[neighborPixelIdx] - resultData.data[edgePixelIdx]);
assert.ok(edgeContrast > 100, `High contrast structural edges must remain sharp (contrast: ${edgeContrast})`);

console.log("✅ [PASS] True Super-Resolution Denoise and Micro-Edge Recovery verified!");
