"""Disposable-user browser regression for the first Malesan result.

Proves the product flow that a compile cannot cover: the first successful idea
stays on screen and can be copied and saved to Alur. By default its stream is
deterministic; `MALESAN_QA_LIVE_AI=1` also spends one real credit and verifies
the accounting rows. A second zero-credit user always proves the real server
guard before all test data is removed again.

Requires a built app running at MALESAN_QA_BASE (default http://127.0.0.1:3100)
and the normal local Supabase variables in .env.local. Secrets and auth cookies
are only passed in process memory and are never printed or written to disk.
"""

from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path

from playwright.sync_api import Page, sync_playwright


ROOT = Path(__file__).resolve().parents[1]
BASE = os.environ.get("MALESAN_QA_BASE", "http://127.0.0.1:3100").rstrip("/")
LIVE_AI = os.environ.get("MALESAN_QA_LIVE_AI") == "1"
SHOT_DIR = Path(
    os.environ.get(
        "MALESAN_QA_SHOTS",
        r"C:\Users\Administrator\.codex\visualizations\2026\08\22\01a029ad-1c4c-7c92-b725-305a1f09b0ca\malesan-first-result-qa",
    )
)


def load_env() -> dict[str, str]:
    values: dict[str, str] = {}
    for raw in (ROOT / ".env.local").read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def node_env(env: dict[str, str]) -> dict[str, str]:
    required = {
        "QA_SUPABASE_URL": env.get("NEXT_PUBLIC_SUPABASE_URL", ""),
        "QA_ANON_KEY": env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY", ""),
        "QA_SERVICE_KEY": env.get("SUPABASE_SERVICE_ROLE_KEY", ""),
    }
    if not all(required.values()):
        raise RuntimeError("Supabase QA env belum lengkap")
    child = os.environ.copy()
    child.update(required)
    return child


CREATE_SESSION = r"""
import { randomUUID } from 'node:crypto';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

const url = process.env.QA_SUPABASE_URL;
const anon = process.env.QA_ANON_KEY;
const serviceKey = process.env.QA_SERVICE_KEY;
const credits = Number(process.env.QA_START_CREDITS ?? '5');
const service = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const refillDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jakarta',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());
const adminHeaders = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
};
const email = `qa-first-result-${randomUUID()}@qa.malesan.my.id`;
const password = `${randomUUID()}-Qa9!`;
let userId = null;

try {
  const createdResponse = await fetch(`${url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ email, password, email_confirm: true }),
    signal: AbortSignal.timeout(15000),
  });
  if (!createdResponse.ok) throw new Error(`create HTTP ${createdResponse.status}`);
  const created = await createdResponse.json();
  userId = created.id;
  if (!userId) throw new Error('missing user id');

  let profileReady = false;
  for (let attempt = 0; attempt < 8; attempt++) {
    const updated = await service
      .from('profiles')
      .update({
        credits_free: credits,
        credits_paid: 0,
        is_pro: false,
        role: 'user',
        last_refill_date: refillDate,
      })
      .eq('id', userId)
      .select('id')
      .maybeSingle();
    if (updated.error) throw updated.error;
    if (updated.data) {
      profileReady = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!profileReady) throw new Error('profile trigger did not finish');

  const signedInResponse = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anon, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(15000),
  });
  if (!signedInResponse.ok) throw new Error(`sign-in HTTP ${signedInResponse.status}`);
  const session = await signedInResponse.json();
  if (!session.access_token || !session.refresh_token) throw new Error('incomplete session');

  const jar = new Map();
  const ssr = createServerClient(url, anon, {
    cookies: {
      getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
      setAll: (rows) => rows.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  const attached = await ssr.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  if (attached.error) throw attached.error;
  process.stdout.write(JSON.stringify({
    userId,
    cookies: [...jar.entries()].map(([name, value]) => ({ name, value })),
  }));
} catch (error) {
  if (userId) {
    await fetch(`${url}/auth/v1/admin/users/${userId}`, {
      method: 'DELETE',
      headers: adminHeaders,
    }).catch(() => null);
  }
  console.error(`Disposable QA user setup failed: ${error instanceof Error ? error.message : 'unknown'}`);
  process.exit(1);
}
"""


VERIFY_USER = r"""
import { createClient } from '@supabase/supabase-js';
const service = createClient(process.env.QA_SUPABASE_URL, process.env.QA_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const userId = process.env.QA_USER_ID;
const expectedCredits = Number(process.env.QA_EXPECTED_CREDITS);
const mode = process.env.QA_EXPECT_MODE;
const [profile, ledger, generations, cards, usage] = await Promise.all([
  service.from('profiles').select('credits_free, credits_paid').eq('id', userId).single(),
  service.from('credit_ledger').select('delta, ref_id').eq('user_id', userId).lt('delta', 0),
  service.from('generations').select('id, credits_spent, model_used').eq('user_id', userId),
  service.from('pipeline_cards').select('id, generation_id, status').eq('user_id', userId),
  service.from('ai_usage_log').select('status, model_id, input_tokens, output_tokens, credits_charged').eq('user_id', userId),
]);
for (const result of [profile, ledger, generations, cards, usage]) {
  if (result.error) throw result.error;
}
const balance = Number(profile.data.credits_free) + Number(profile.data.credits_paid);
if (balance !== expectedCredits) throw new Error(`expected balance ${expectedCredits}, got ${balance}`);
if (mode === 'live') {
  const successful = usage.data.find((row) => row.status === 'ok');
  if (ledger.data.length !== 1) throw new Error(`expected one charge, got ${ledger.data.length}`);
  if (generations.data.length !== 1) throw new Error(`expected one generation, got ${generations.data.length}`);
  if (cards.data.length !== 1) throw new Error(`expected one Alur card, got ${cards.data.length}`);
  if (!successful) throw new Error('missing successful usage row');
  if (Number(successful.input_tokens) + Number(successful.output_tokens) <= 0) throw new Error('missing token usage');
  if (usage.data.reduce((sum, row) => sum + Number(row.credits_charged), 0) !== 1) {
    throw new Error('usage revenue is not exactly one credit');
  }
  process.stdout.write(JSON.stringify({
    creditsCharged: 1,
    modelUsed: successful.model_id,
    attempts: usage.data.length,
    tokens: Number(successful.input_tokens) + Number(successful.output_tokens),
    savedToAlur: true,
  }));
} else if (mode === 'mock') {
  if (ledger.data.length || generations.data.length || usage.data.length) {
    throw new Error('mocked UI request created billing rows');
  }
  if (cards.data.length !== 1) throw new Error(`expected one Alur card, got ${cards.data.length}`);
  process.stdout.write(JSON.stringify({ creditsCharged: 0, savedToAlur: true }));
} else {
  if (ledger.data.length || generations.data.length || cards.data.length || usage.data.length) {
    throw new Error('zero-credit request created billable rows');
  }
  process.stdout.write(JSON.stringify({ creditsCharged: 0, generated: false }));
}
"""


CLEANUP_USER = r"""
import { createClient } from '@supabase/supabase-js';
const url = process.env.QA_SUPABASE_URL;
const serviceKey = process.env.QA_SERVICE_KEY;
const userId = process.env.QA_USER_ID;
const service = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
for (const table of ['pipeline_cards', 'ai_usage_log', 'rate_limits', 'generations', 'credit_ledger']) {
  await service.from(table).delete().eq('user_id', userId);
}
await fetch(`${url}/auth/v1/admin/users/${userId}`, {
  method: 'DELETE',
  headers: {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
  },
  signal: AbortSignal.timeout(15000),
});
"""


def run_node(script: str, env: dict[str, str], timeout: int = 45) -> str:
    result = subprocess.run(
        ["node", "--input-type=module", "-e", script],
        cwd=ROOT,
        env=env,
        capture_output=True,
        text=True,
        check=False,
        timeout=timeout,
    )
    if result.returncode != 0:
        safe_error = result.stderr.strip().splitlines()[-1] if result.stderr.strip() else "unknown"
        raise RuntimeError(f"Node QA helper failed: {safe_error}")
    return result.stdout


def create_session(env: dict[str, str], credits: int) -> dict[str, object]:
    child = node_env(env)
    child["QA_START_CREDITS"] = str(credits)
    return json.loads(run_node(CREATE_SESSION, child))


def verify_user(
    env: dict[str, str], user_id: str, *, expected_credits: int, mode: str
) -> dict[str, object]:
    child = node_env(env)
    child.update(
        {
            "QA_USER_ID": user_id,
            "QA_EXPECTED_CREDITS": str(expected_credits),
            "QA_EXPECT_MODE": mode,
        }
    )
    return json.loads(run_node(VERIFY_USER, child))


def cleanup_user(env: dict[str, str], user_id: str) -> None:
    child = node_env(env)
    child["QA_USER_ID"] = user_id
    run_node(CLEANUP_USER, child)


def attach_session(context, session: dict[str, object]) -> None:
    context.add_cookies(
        [
            {"name": row["name"], "value": row["value"], "url": BASE}
            for row in session["cookies"]
        ]
    )


def ide_page(page: Page) -> None:
    response = page.goto(
        f"{BASE}/app?tab=studio&m=ide", wait_until="domcontentloaded", timeout=60_000
    )
    if not response or response.status >= 400:
        raise RuntimeError(f"Ide page failed with HTTP {response.status if response else 'none'}")
    page.get_by_role("heading", name="Ide Hari Ini").wait_for(timeout=20_000)


def install_mock_stream(page: Page) -> None:
    ideas = [
        {
            "title": "Kenapa konten sederhana justru lebih nempel",
            "angle": "Mulai dari masalah kecil yang sering dialami kreator.",
            "why_now": "Orang lagi capek lihat konten yang terlalu dibuat-buat.",
            "format": "Talking head",
            "est_duration": "45 detik",
            "difficulty": "Mudah",
            "platform": "tiktok_reels",
            "goal": "views",
            "opening": "Konten lo gak harus ribet buat bikin orang berhenti scroll.",
            "beats": ["Tunjukkan masalah", "Kasih contoh", "Tutup dengan ajakan"],
            "ready_copy": "Konten lo gak harus ribet buat bikin orang berhenti scroll. Mulai dari satu masalah yang mereka rasain hari ini, kasih contoh nyata, lalu tutup dengan satu ajakan yang gampang dilakukan.",
            "caption": "Sederhana bukan berarti biasa.",
            "hashtags": ["#kontenkreator", "#idekonten"],
        },
        {
            "title": "Satu kebiasaan yang bikin ide gak pernah habis",
            "angle": "Ubah komentar audiens jadi daftar ide.",
            "why_now": "Pertanyaan audiens adalah sinyal kebutuhan paling dekat.",
            "format": "Listicle",
            "est_duration": "40 detik",
            "difficulty": "Mudah",
            "platform": "tiktok_reels",
            "goal": "views",
            "opening": "Kalau ide lo sering habis, jangan buka aplikasi tren dulu.",
            "beats": ["Buka komentar", "Kelompokkan pertanyaan", "Pilih satu jawaban"],
            "ready_copy": "Kalau ide lo sering habis, buka komentar lama. Kelompokkan pertanyaan yang mirip, lalu jawab satu pertanyaan per video. Audiens lo sendiri udah ngasih kalender konten gratis.",
            "caption": "Jawaban terbaik sering ada di kolom komentar.",
            "hashtags": ["#belajarkonten", "#tipskreator"],
        },
        {
            "title": "Tes lima detik buat hook yang lebih kuat",
            "angle": "Nilai hook dari seberapa cepat manfaatnya kebaca.",
            "why_now": "Perhatian audiens makin pendek.",
            "format": "Tutorial singkat",
            "est_duration": "30 detik",
            "difficulty": "Mudah",
            "platform": "tiktok_reels",
            "goal": "views",
            "opening": "Baca hook lo lima detik. Kalau manfaatnya belum jelas, ulang.",
            "beats": ["Baca hook", "Cari manfaat", "Potong kata mubazir"],
            "ready_copy": "Baca hook lo selama lima detik. Kalau orang belum tahu mereka bakal dapat apa, potong pembuka dan sebut manfaatnya lebih cepat. Hook yang jelas ngalahin hook yang cuma terdengar pintar.",
            "caption": "Jelas dulu, baru kreatif.",
            "hashtags": ["#hookkonten", "#tiktoktips"],
        },
    ]
    frames = [
        {"status": "Lagi nyusun tiga ide yang paling pas..."},
        {"chunk": "{"},
        {"done": True, "generation": {"output": {"ideas": ideas}}},
    ]
    body = "".join(f"data: {json.dumps(frame, ensure_ascii=False)}\n\n" for frame in frames)
    page.route(
        "**/api/generate",
        lambda route: route.fulfill(
            status=200,
            headers={"Content-Type": "text/event-stream; charset=utf-8"},
            body=body,
        ),
    )


def main() -> None:
    env = load_env()
    SHOT_DIR.mkdir(parents=True, exist_ok=True)
    success_user: str | None = None
    zero_user: str | None = None

    try:
        with sync_playwright() as runner:
            browser = runner.chromium.launch(headless=True)

            success = create_session(env, 5)
            success_user = str(success["userId"])
            context = browser.new_context(
                viewport={"width": 375, "height": 812},
                reduced_motion="reduce",
                locale="id-ID",
                timezone_id="Asia/Jakarta",
                permissions=["clipboard-read", "clipboard-write"],
                # A production service worker can answer before Playwright's
                # deterministic /api/generate route sees the request. PWA
                # behavior has its own browser matrix; this regression owns the
                # product flow and therefore blocks workers in this context.
                service_workers="block",
            )
            attach_session(context, success)
            page = context.new_page()
            if not LIVE_AI:
                install_mock_stream(page)
            ide_page(page)

            call_to_action = page.get_by_role("button", name="Kasih 3 ide · 1 kredit")
            call_to_action.wait_for(state="visible", timeout=15_000)
            box = call_to_action.bounding_box()
            if not box or box["y"] + box["height"] > 812:
                raise RuntimeError("Tombol ide pertama masih di luar viewport")
            call_to_action.click()

            result_label = page.get_by_text("Konten siap posting").first
            try:
                result_label.wait_for(state="visible", timeout=70_000)
            except Exception as exc:
                visible_error = page.locator("p.text-danger:visible").first
                detail = visible_error.inner_text() if visible_error.count() else "hasil tidak muncul"
                raise RuntimeError(f"Generate browser gagal: {detail}") from exc

            page.wait_for_timeout(5_000)
            if "/onboarding" in page.url:
                raise RuntimeError("Hasil pertama masih dialihkan ke onboarding")
            if "tab=studio" not in page.url or "m=ide" not in page.url:
                raise RuntimeError(f"URL hasil pertama berubah ke {page.url}")

            page.get_by_role("button", name="Salin konten").first.click()
            page.get_by_role("button", name="Udah tersalin").first.wait_for(timeout=10_000)
            page.get_by_role("button", name="Simpan ke Alur").first.click()
            page.get_by_role("button", name="Udah masuk Alur").first.wait_for(timeout=20_000)
            page.screenshot(path=str(SHOT_DIR / "first-result.png"), full_page=True)

            page.get_by_role("button", name="Alur", exact=True).click()
            page.locator("[data-card-id]").first.wait_for(state="visible", timeout=20_000)
            page.screenshot(path=str(SHOT_DIR / "saved-in-alur.png"), full_page=True)
            context.close()

            success_db = verify_user(
                env,
                success_user,
                expected_credits=4 if LIVE_AI else 5,
                mode="live" if LIVE_AI else "mock",
            )

            zero = create_session(env, 0)
            zero_user = str(zero["userId"])
            zero_context = browser.new_context(
                viewport={"width": 375, "height": 812},
                reduced_motion="reduce",
                locale="id-ID",
                timezone_id="Asia/Jakarta",
                service_workers="block",
            )
            attach_session(zero_context, zero)
            zero_page = zero_context.new_page()
            ide_page(zero_page)
            zero_page.get_by_role("button", name="Kasih 3 ide · 1 kredit").click()
            zero_page.get_by_text("Kredit lo abis", exact=False).wait_for(timeout=20_000)
            zero_page.screenshot(path=str(SHOT_DIR / "zero-credit.png"), full_page=True)
            zero_context.close()

            zero_db = verify_user(env, zero_user, expected_credits=0, mode="zero")
            browser.close()

        print(
            json.dumps(
                {
                    "verdict": "PASS",
                    "firstResultStayedVisible": True,
                    "copyWorked": True,
                    "aiMode": "live" if LIVE_AI else "deterministic-stream",
                    **success_db,
                    "zeroCreditGuard": zero_db,
                    "screenshots": str(SHOT_DIR),
                },
                ensure_ascii=False,
            )
        )
    finally:
        if success_user:
            cleanup_user(env, success_user)
        if zero_user:
            cleanup_user(env, zero_user)


if __name__ == "__main__":
    main()
