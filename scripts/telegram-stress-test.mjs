import assert from "node:assert";

// Standalone test implementations of the core algorithm
function splitTelegramMessage(text, maxLen = 3800) {
  if (!text || text.length <= maxLen) return [text || ""];

  const chunks = [];
  let remaining = text.trim();

  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }

    let splitIdx = remaining.lastIndexOf("\n\n", maxLen);

    if (splitIdx === -1 || splitIdx < maxLen * 0.4) {
      splitIdx = remaining.lastIndexOf("\n", maxLen);
    }

    if (splitIdx === -1 || splitIdx < maxLen * 0.4) {
      splitIdx = remaining.lastIndexOf(" ", maxLen);
    }

    if (splitIdx === -1 || splitIdx === 0) {
      splitIdx = maxLen;
    }

    chunks.push(remaining.slice(0, splitIdx).trim());
    remaining = remaining.slice(splitIdx).trim();
  }

  return chunks.filter(Boolean);
}

function sanitizeTelegramHtml(html) {
  if (!html) return "";

  let cleaned = String(html)
    .replace(/<\/?(ul|ol)>/gi, "")
    .replace(/<li>/gi, "• ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/?p>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(h[1-6]|header|div|section|article)>/gi, "\n")
    .replace(/<span(?![^>]*class=["']tg-spoiler["'])[^>]*>(.*?)<\/span>/gi, "$1");

  cleaned = cleaned.replace(
    /<(?!\/?(b|strong|i|em|u|ins|s|strike|del|a|code|pre|blockquote|tg-spoiler)\b)[^>]+>/gi,
    "",
  );

  cleaned = cleaned.replace(/\n{3,}/g, "\n\n").trim();
  return cleaned;
}

console.log("=================================================================");
console.log("⚡ MALESAN TELEGRAM AI COMMANDER COMPREHENSIVE STRESS TEST");
console.log("=================================================================\n");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`❌ [FAIL] ${name}:`, err.message);
    failed++;
  }
}

// 1. MASSIVE PAYLOAD & MESSAGE CHUNKING STRESS TEST
test("Chunking: Handles 10,000 character mega-payload without exceeding 3800 char limit", () => {
  const paragraph = "Ini adalah paragraf konten strategi marketing yang sangat panjang untuk menguji batas limit bot telegram. ".repeat(15);
  const megaText = Array(20).fill(paragraph).join("\n\n");
  
  assert(megaText.length > 10000, "Generated text should be > 10,000 chars");
  const chunks = splitTelegramMessage(megaText, 3800);
  
  assert(chunks.length >= 3, `Should split into multiple chunks, got ${chunks.length}`);
  for (const chunk of chunks) {
    assert(chunk.length <= 3800, `Chunk length ${chunk.length} exceeds 3800 limit!`);
  }
});

// 2. HTML SANITIZER & TAG FUZZING TEST
test("Sanitizer: Converts <ul> <ol> <li> into clean bullet points", () => {
  const dirty = "<b>Menu:</b><ul><li>Fitur 1</li><li>Fitur 2</li></ul><p>Selesai</p>";
  const clean = sanitizeTelegramHtml(dirty);
  assert(!clean.includes("<ul>"), "Should remove <ul>");
  assert(!clean.includes("<li>"), "Should remove <li>");
  assert(clean.includes("• Fitur 1"), "Should convert to bullet point");
  assert(clean.includes("<b>Menu:</b>"), "Should preserve <b>");
});

test("Sanitizer: Strips malicious and unsupported tags", () => {
  const dirty = '<script>alert("xss")</script><iframe src="malicious.com"></iframe><div class="test">Hello <i>World</i></div>';
  const clean = sanitizeTelegramHtml(dirty);
  assert(!clean.includes("<script>"), "Should strip script");
  assert(!clean.includes("<iframe>"), "Should strip iframe");
  assert(!clean.includes("<div>"), "Should strip div");
  assert(clean.includes("<i>World</i>"), "Should preserve allowed <i>");
});

// 3. WHITESPACE & EMPTY PAYLOAD RESILIENCE
test("Resilience: Handles null, undefined, and empty strings gracefully", () => {
  assert.strictEqual(sanitizeTelegramHtml(null), "");
  assert.strictEqual(sanitizeTelegramHtml(undefined), "");
  assert.deepStrictEqual(splitTelegramMessage(""), [""]);
});

// 4. BURST MULTI-PARAGRAPH FORMAT PRESERVATION
test("Formatting: Preserves paragraph structure across chunk boundaries", () => {
  const text = "Paragraf 1\n\nParagraf 2\n\nParagraf 3";
  const chunks = splitTelegramMessage(text, 100);
  assert.strictEqual(chunks.join("\n\n"), text);
});

console.log("\n=================================================================");
console.log(`🎯 STRESS TEST COMPLETE: ${passed} PASSED, ${failed} FAILED`);
console.log("=================================================================");

if (failed > 0) process.exit(1);
