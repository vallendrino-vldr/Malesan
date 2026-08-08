"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Saved voices and the closing CTA — the two settings that change how every
 * future generation sounds.
 *
 * Every action RETURNS its outcome instead of throwing. A `throw` inside a
 * server action reaches production as an opaque digest, so a message written
 * for the owner ("link-nya belum kebaca") would arrive on screen as "an error
 * occurred" and teach them nothing. Anything the user is meant to read comes
 * back as { ok: false, error }.
 */
type ActionResult = { ok: true } | { ok: false; error: string };

const NAME_MAX = 60;
const VOICE_MAX = 2000;
const LABEL_MAX = 60;

const NO_SESSION = "Sesi lo abis. Masuk lagi dulu ya.";
const GONE = "Suara itu udah gak ada di daftar lo. Refresh halamannya.";
const WRITE_FAILED = "Gagal kesimpen ke server. Coba lagi sebentar lagi.";

/**
 * Duplicate-default is the one constraint a user can hit by racing themselves
 * (two tabs, both pressing "jadiin default"). 23505 is that partial unique
 * index talking; a raw Postgres string must never reach the screen.
 */
function friendly(code: string | undefined): string {
  return code === "23505" ? "Udah ada suara lain yang jadi default. Refresh dulu." : WRITE_FAILED;
}

function cleanName(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const value = raw.trim().replace(/\s+/g, " ");
  if (!value) return { ok: false, error: "Kasih nama dulu, biar gampang dibedain nanti." };
  if (value.length > NAME_MAX) return { ok: false, error: `Namanya kepanjangan. Maksimal ${NAME_MAX} karakter.` };
  return { ok: true, value };
}

function cleanVoice(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const value = raw.trim();
  if (!value) return { ok: false, error: "Tulis dulu gaya nulisnya kayak gimana." };
  if (value.length > VOICE_MAX) return { ok: false, error: `Kepanjangan. Maksimal ${VOICE_MAX} karakter.` };
  return { ok: true, value };
}

export async function createPersona(name: string, voice: string): Promise<ActionResult> {
  const n = cleanName(name);
  if (!n.ok) return n;
  const v = cleanVoice(voice);
  if (!v.ok) return v;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: NO_SESSION };

  // The first voice someone writes becomes their default, because a picker with
  // nothing preselected quietly generates in the old voice and looks broken.
  // Nothing is seeded for them — this only fires once they have written one.
  const { count, error: countError } = await supabase
    .from("personas")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if (countError) return { ok: false, error: WRITE_FAILED };

  const { error } = await supabase
    .from("personas")
    .insert({ user_id: user.id, name: n.value, voice: v.value, is_default: (count ?? 0) === 0 })
    .select("id")
    .single();

  if (error) return { ok: false, error: friendly(error.code) };

  revalidatePath("/app/profile");
  return { ok: true };
}

export async function updatePersona(id: string, name: string, voice: string): Promise<ActionResult> {
  const n = cleanName(name);
  if (!n.ok) return n;
  const v = cleanVoice(voice);
  if (!v.ok) return v;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: NO_SESSION };

  // .select() + maybeSingle: an update that matched no rows is not an error to
  // PostgREST, so without reading the row back "saved" would be a guess.
  const { data, error } = await supabase
    .from("personas")
    .update({ name: n.value, voice: v.value, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: friendly(error.code) };
  if (!data) return { ok: false, error: GONE };

  revalidatePath("/app/profile");
  return { ok: true };
}

export async function deletePersona(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: NO_SESSION };

  const { data, error } = await supabase
    .from("personas")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: WRITE_FAILED };
  if (!data) return { ok: false, error: GONE };

  revalidatePath("/app/profile");
  return { ok: true };
}

/**
 * Exactly one default per creator, enforced by a partial unique index.
 *
 * So the old default has to be cleared BEFORE the new one is set — flipping the
 * new row first hits the index and fails. Two statements rather than one
 * transaction: PostgREST has no transaction across calls, and the failure mode
 * of a half-finished switch is "no default for a moment", which the picker
 * handles by preselecting nothing. Losing the wrong row is not possible here.
 */
export async function setDefaultPersona(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: NO_SESSION };

  const { error: clearError } = await supabase
    .from("personas")
    .update({ is_default: false, updated_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("is_default", true)
    .neq("id", id)
    .select("id");

  if (clearError) return { ok: false, error: WRITE_FAILED };

  const { data, error } = await supabase
    .from("personas")
    .update({ is_default: true, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: friendly(error.code) };
  if (!data) return { ok: false, error: GONE };

  revalidatePath("/app/profile");
  return { ok: true };
}

/**
 * Anything that is not http/https is rejected outright — `javascript:` and
 * `data:` are the reason this is a whitelist and not a blacklist. The scheme is
 * only guessed when the user typed none at all ("tokogue.com"), so a hostile
 * scheme is never rescued into a working link.
 */
function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (!parsed.hostname.includes(".")) return null; // "https://tokogue" resolves nowhere

  return parsed.toString();
}

export async function saveCta(url: string, label: string, enabled: boolean): Promise<ActionResult> {
  const rawUrl = url.trim();
  const cleanLabel = label.trim().replace(/\s+/g, " ");

  if (cleanLabel.length > LABEL_MAX) {
    return { ok: false, error: `Sebutannya kepanjangan. Maksimal ${LABEL_MAX} karakter.` };
  }

  const normalized = rawUrl ? normalizeUrl(rawUrl) : null;
  if (rawUrl && !normalized) {
    return { ok: false, error: "Link-nya belum kebaca. Tulis alamat lengkapnya, misal https://tokogue.com." };
  }
  if (enabled && !normalized) {
    return { ok: false, error: "Isi link-nya dulu sebelum ajakannya dinyalain." };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: NO_SESSION };

  // Upsert, because a creator who skipped onboarding has no creator_dna row yet
  // and an .update() would silently match nothing.
  const { data, error } = await supabase
    .from("creator_dna")
    .upsert(
      {
        user_id: user.id,
        cta_url: normalized,
        cta_label: cleanLabel || null,
        cta_enabled: enabled,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )
    .select("user_id")
    .maybeSingle();

  if (error) return { ok: false, error: WRITE_FAILED };
  if (!data) return { ok: false, error: WRITE_FAILED };

  revalidatePath("/app/profile");
  return { ok: true };
}
