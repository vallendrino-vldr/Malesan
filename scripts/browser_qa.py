"""Authenticated responsive smoke test. Reads local secrets without printing them."""

from __future__ import annotations

import os
import json
import re
import subprocess
from pathlib import Path
from urllib.parse import quote

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
SHOT_DIR = Path(
    os.environ.get(
        "MALESAN_QA_SHOTS",
        r"C:\Users\Administrator\.codex\visualizations\2026\08\22\01a029ad-1c4c-7c92-b725-305a1f09b0ca\malesan-final-qa",
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


def production_session_cookies(env: dict[str, str], base: str) -> list[dict[str, str]]:
    """Mint a normal Supabase session for the fixed QA admin, without a web backdoor.

    The short-lived access/refresh cookies only travel from a captured Node
    subprocess stdout into Playwright memory. They are never logged, written to
    disk, or exposed to application JavaScript.
    """

    required = {
        "QA_SUPABASE_URL": env.get("NEXT_PUBLIC_SUPABASE_URL", ""),
        "QA_ANON_KEY": env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY", ""),
        "QA_SERVICE_KEY": env.get("SUPABASE_SERVICE_ROLE_KEY", ""),
        "QA_ADMIN_EMAIL": env.get("DEV_LOGIN_EMAIL", ""),
    }
    if not all(required.values()):
        raise RuntimeError("Direct browser QA auth is not configured")

    node_script = r"""
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

const url = process.env.QA_SUPABASE_URL;
const anon = process.env.QA_ANON_KEY;
const service = createClient(url, process.env.QA_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const { data, error } = await service.auth.admin.generateLink({
  type: 'magiclink',
  email: process.env.QA_ADMIN_EMAIL,
});
if (error || !data?.properties?.hashed_token) process.exit(2);

const jar = new Map();
const ssr = createServerClient(url, anon, {
  cookies: {
    getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
    setAll: (rows) => rows.forEach(({ name, value }) => jar.set(name, value)),
  },
});
const verified = await ssr.auth.verifyOtp({
  type: 'magiclink',
  token_hash: data.properties.hashed_token,
});
if (verified.error || !verified.data.session) process.exit(3);
process.stdout.write(JSON.stringify([...jar.entries()].map(([name, value]) => ({ name, value }))));
"""
    child_env = os.environ.copy()
    child_env.update(required)
    result = subprocess.run(
        ["node", "--input-type=module", "-e", node_script],
        cwd=ROOT,
        env=child_env,
        capture_output=True,
        text=True,
        check=False,
        timeout=30,
    )
    if result.returncode != 0:
        raise RuntimeError("Could not mint the browser QA session")
    try:
        rows = json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        raise RuntimeError("Browser QA session returned an invalid cookie jar") from exc
    return [{"name": row["name"], "value": row["value"], "url": base} for row in rows]


def main() -> None:
    env = load_env()
    direct_auth = os.environ.get("MALESAN_QA_DIRECT_AUTH") == "1"
    secret = env.get("DEV_LOGIN_SECRET")
    if not direct_auth and not secret:
        raise RuntimeError("DEV_LOGIN_SECRET is not configured")

    # Next 16 rejects dev assets requested through a host that differs from the
    # dev server's canonical localhost origin. Using 127.0.0.1 made every page
    # look server-rendered while its JS chunks returned 403 — a QA setup failure,
    # not an application failure.
    base = os.environ.get("MALESAN_QA_BASE", "http://localhost:3000")
    browser_name = os.environ.get("MALESAN_QA_BROWSER", "chromium").lower()
    if browser_name not in {"chromium", "webkit", "firefox"}:
        raise RuntimeError(f"Unsupported QA browser: {browser_name}")
    SHOT_DIR.mkdir(parents=True, exist_ok=True)
    failures: list[str] = []
    console_errors: list[str] = []
    server_errors: list[str] = []

    routes = [
        "/",
        "/app",
        "/app?tab=studio&m=ide",
        "/app?tab=vibe",
        "/app?tab=pipeline",
        "/app?tab=profil",
        "/app?tab=studio&m=video",
        "/app/profile",
        "/app/onboarding",
        "/app/topup",
        "/admin",
        "/admin/ai",
        "/admin/stats",
        "/admin/ai/models",
        "/admin/ai/routing",
        "/admin/ai/biaya",
    ]
    # Android small phone, iPhone-class phone, phone landscape, tablet, laptop,
    # and wide desktop. Landscape is explicit because a portrait-only matrix
    # misses bottom-nav and short-viewport collisions.
    sizes = [
        (360, 800),
        (375, 812),
        (812, 375),
        (768, 1024),
        (1366, 768),
        (1920, 1080),
    ]

    with sync_playwright() as runner:
        browser = getattr(runner, browser_name).launch(headless=True)
        context = browser.new_context(
            viewport={"width": 1366, "height": 768},
            reduced_motion="reduce",
            locale="id-ID",
            timezone_id="Asia/Jakarta",
        )
        page = context.new_page()
        page.on(
            "console",
            lambda msg: console_errors.append(msg.text)
            if msg.type == "error" and "favicon" not in msg.text.lower()
            else None,
        )
        page.on("pageerror", lambda exc: console_errors.append(str(exc)))
        page.on(
            "response",
            lambda response: server_errors.append(f"{response.status} {response.url.split('?')[0]}")
            if response.status >= 500
            else None,
        )

        if direct_auth:
            context.add_cookies(production_session_cookies(env, base))
            response = page.goto(base + "/admin/ai", wait_until="domcontentloaded", timeout=60_000)
            if not response or response.status >= 400:
                raise RuntimeError("Production-session login failed")
        else:
            login = f"{base}/dev-masuk?key={quote(secret, safe='')}&next=/admin/ai"
            response = page.goto(login, wait_until="domcontentloaded", timeout=60_000)
            if not response or response.status >= 400:
                raise RuntimeError("Development login failed")
            page.wait_for_url("**/admin/ai", timeout=30_000)
        # The authenticated app keeps Supabase Realtime alive. Waiting for a
        # completely idle network can therefore time out after the page is
        # already rendered and interactive. Hydration gets a short deterministic
        # settle instead; individual assertions below wait for what they use.
        page.wait_for_timeout(750)

        ai_text = page.locator("body").inner_text()
        if "Otak AI" not in ai_text or "AI utama" not in ai_text:
            failures.append("AI Center does not expose the owner-first Brain summary")
        if "DeepSeek" not in ai_text:
            failures.append("Live primary Brain is not visibly DeepSeek")
        if "Setelan lanjutan" in ai_text and "API key" in ai_text:
            failures.append("Simple AI Center exposes API-key detail")

        for width, height in sizes:
            page.set_viewport_size({"width": width, "height": height})
            for route in routes:
                response = page.goto(base + route, wait_until="domcontentloaded", timeout=60_000)
                page.wait_for_timeout(250)
                if not response or response.status >= 400:
                    failures.append(f"{route} returned {response.status if response else 'no response'} at {width}px")
                    continue
                metrics = page.evaluate(
                    """() => ({
                      viewport: window.innerWidth,
                      body: document.body.scrollWidth,
                      root: document.documentElement.scrollWidth,
                      unnamedButtons: [...document.querySelectorAll('button')].filter((b) => {
                        const s = getComputedStyle(b);
                        if (s.display === 'none' || s.visibility === 'hidden') return false;
                        return !(b.innerText.trim() || b.getAttribute('aria-label') || b.title);
                      }).length,
                      imagesWithoutAlt: document.querySelectorAll('img:not([alt])').length,
                    })"""
                )
                overflow = max(metrics["body"], metrics["root"]) - metrics["viewport"]
                if overflow > 1:
                    failures.append(f"horizontal overflow {overflow}px on {route} at {width}px")
                if metrics["unnamedButtons"]:
                    failures.append(f"{metrics['unnamedButtons']} unnamed buttons on {route} at {width}px")
                if metrics["imagesWithoutAlt"]:
                    failures.append(f"image without alt on {route} at {width}px")

            if width in (360, 1366):
                page.goto(base + "/admin/ai", wait_until="domcontentloaded", timeout=60_000)
                page.screenshot(path=str(SHOT_DIR / f"ai-center-{width}.png"), full_page=True)

        page.set_viewport_size({"width": 360, "height": 800})
        page.goto(base + "/app?tab=studio&m=ide", wait_until="domcontentloaded", timeout=60_000)
        try:
            page.get_by_role("heading", name="Ide Hari Ini").wait_for(
                state="visible", timeout=20_000
            )
        except Exception:
            failures.append("Ide Hari Ini did not leave its loading state within 20s")
        ide_text = page.locator("body").inner_text()
        for expected in ("Mau posting di mana?", "Lagi ngejar apa?", "Profil konten"):
            # Profil konten only renders when the QA account has an additional
            # profile. The first two controls are unconditional.
            if expected == "Profil konten" and expected not in ide_text:
                continue
            if expected not in ide_text:
                failures.append(f"Ide Hari Ini missing {expected}")
        page.screenshot(path=str(SHOT_DIR / "ide-mobile.png"), full_page=True)

        page.set_viewport_size({"width": 812, "height": 375})
        page.goto(base + "/app?tab=studio&m=ide", wait_until="domcontentloaded", timeout=60_000)
        page.screenshot(path=str(SHOT_DIR / "ide-landscape.png"), full_page=True)

        page.set_viewport_size({"width": 360, "height": 800})
        page.goto(base + "/app?tab=profil", wait_until="domcontentloaded", timeout=60_000)
        page.screenshot(path=str(SHOT_DIR / "profile-mobile.png"), full_page=True)

        page.goto(base + "/app?tab=studio&m=video", wait_until="domcontentloaded", timeout=60_000)
        try:
            page.get_by_text("Tap buat pilih video (MP4)", exact=True).wait_for(
                state="visible", timeout=20_000
            )
        except Exception:
            failures.append("Video editor did not leave its loading state within 20s")
        video_text = page.locator("body").inner_text()
        for expected in ("Subtitle Otomatis", "Tap buat pilih video"):
            if expected not in video_text:
                failures.append(f"Video editor missing {expected}")
        page.screenshot(path=str(SHOT_DIR / "video-mobile.png"), full_page=True)

        fixture = os.environ.get("MALESAN_QA_VIDEO")
        if fixture:
            page.locator('input[type="file"]').set_input_files(fixture)
            page.get_by_role("button", name="Bikinin subtitle").click()
            page.get_by_text("Gaya subtitle").wait_for(state="visible", timeout=180_000)
            ready_text = page.locator("body").inner_text()
            for expected in ("TikTok", "Reels", "Shorts", "Animasi masuk"):
                if expected not in ready_text:
                    failures.append(f"Transcribed video editor missing {expected}")
            transcript = page.locator("textarea").first.input_value().strip()
            if len(transcript.split()) < 3:
                failures.append("Video transcription returned too little text")
            page.screenshot(path=str(SHOT_DIR / "video-ready-mobile.png"), full_page=True)

        page.goto(base + "/admin/stats", wait_until="domcontentloaded", timeout=60_000)
        stats_text = page.locator("body").inner_text()
        if "pemakaian Gemini" in stats_text or "price_in_per_mtok" in stats_text:
            failures.append("Admin statistics still expose legacy Gemini pricing")

        # WebKit reports aborted requests during the rapid viewport/navigation
        # matrix as CORS errors. Prove the authenticated server-action load on a
        # stable page instead of treating navigation cancellation as product
        # failure.
        page.goto(base + "/app/topup", wait_until="domcontentloaded", timeout=60_000)
        page.wait_for_timeout(1_000)
        if page.get_by_role("button").filter(has_text="kredit").count() == 0:
            failures.append("Top-up credit packs did not load")
        page.screenshot(path=str(SHOT_DIR / "topup-mobile.png"), full_page=True)

        page.goto(base + "/app", wait_until="domcontentloaded", timeout=60_000)
        # Make this assertion independent of an earlier run or a stored user
        # preference. The old test always expected "soft" after one click, so a
        # context that already started soft failed when the perfectly working
        # switch changed it back to dark.
        page.evaluate(
            """() => {
              localStorage.removeItem('malesan-theme');
              localStorage.removeItem('malesan-theme-toggle-seen');
              document.documentElement.removeAttribute('data-theme');
              document.documentElement.removeAttribute('data-theme-seen');
            }"""
        )
        page.reload(wait_until="domcontentloaded", timeout=60_000)
        switch = page.locator('button[role="switch"]:visible').first
        try:
            switch.wait_for(state="visible", timeout=20_000)
        except Exception:
            pass
        if switch.count():
            switch.click()
            page.wait_for_function("document.documentElement.dataset.theme === 'soft'")
            if page.locator("html").get_attribute("data-theme") != "soft":
                failures.append("Theme switch did not activate soft mode")
        else:
            failures.append("Theme switch is not reachable")

        page.get_by_role("link", name="Malesan").wait_for(state="visible", timeout=20_000)
        page.keyboard.press("Tab")
        try:
            page.wait_for_function("document.activeElement !== document.body", timeout=5_000)
        except Exception:
            failures.append("Keyboard focus never enters the app")

        page.goto(base + "/app", wait_until="domcontentloaded", timeout=60_000)
        page.wait_for_function(
            "navigator.serviceWorker && navigator.serviceWorker.getRegistration().then(Boolean)",
            timeout=15_000,
        )
        manifest = page.request.get(base + "/manifest.webmanifest")
        if not manifest.ok or manifest.json().get("display") != "standalone":
            failures.append("PWA manifest is not installable standalone")

        context.close()
        browser.close()

    # Ignore browser noise from third-party font/CDN failures; application and
    # hydration errors are never ignored.
    ignored_console = ("fonts.googleapis.com", "fonts.gstatic.com", "/_next/hmr")
    if browser_name == "firefox":
        # Supabase's Cloudflare edge may attach __cf_bm to the realtime
        # websocket response. Firefox refuses that third-party cookie for an
        # invalid domain and logs it as a JavaScript error; auth/realtime do not
        # use the cookie, and the same stable-page checks above still prove the
        # actual app connection.
        ignored_console += ("has been rejected for invalid domain",)
    if browser_name == "webkit":
        ignored_console += ("due to access control checks", "realtime/v1/websocket")
    def ignored_navigation_abort(item: str) -> bool:
        lower = item.lower()
        return (
            browser_name == "firefox"
            and "realtime/v1/websocket" in lower
            and "was interrupted while the page was loading" in lower
        )

    relevant_console = [
        item
        for item in console_errors
        if not any(token in item.lower() for token in ignored_console)
        and not ignored_navigation_abort(item)
    ]
    safe_console = [re.sub(r"(apikey=)[^&'\" ]+", r"\1[redacted]", item) for item in relevant_console]
    failures.extend(f"browser console: {item[:180]}" for item in safe_console)
    failures.extend(f"server response: {item}" for item in sorted(set(server_errors)))

    if failures:
        print("BROWSER_QA_FAIL")
        for item in sorted(set(failures)):
            print(f"- {item}")
        raise SystemExit(1)

    print(
        f"BROWSER_QA_PASS browser={browser_name} "
        f"routes={len(routes)} viewports={len(sizes)} screenshots={SHOT_DIR}"
    )


if __name__ == "__main__":
    main()
