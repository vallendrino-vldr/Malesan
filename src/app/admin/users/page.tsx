"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  banUser,
  unbanUser,
  adjustCredits,
  setProStatus,
  setAdminRole,
  deleteUser,
} from "@/app/actions/admin";
import { LiveRefresh } from "@/components/LiveRefresh";

/**
 * User control.
 *
 * The previous version drove every destructive action through `prompt()`,
 * `confirm()` and `alert()`. Those are the browser's own dialogs: unstyleable,
 * ignorable by the browser, blocked outright in some mobile contexts, and they
 * look nothing like the product. Banning someone and injecting credits ran
 * through a chain of three of them with no way to review before committing.
 *
 * It also rendered one wide table inside `overflow-x-auto`, so on a phone the
 * actions column sat off-screen — the controls existed and could not be
 * reached. And it still carried `divide-zinc-800`, a cool grey on a warm
 * palette, which DESIGN.md rules out.
 *
 * Now: cards on phones, a table from `md` up, and one bottom sheet that shows
 * the whole user and every action with its consequence spelled out.
 */

type Profile = {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  role: string;
  is_pro: boolean;
  is_banned: boolean;
  ban_reason: string | null;
  credits_free: number;
  credits_paid: number;
  created_at: string;
};

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

export default function AdminUsersPage() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Profile | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    let query = supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (search.trim()) query = query.ilike("email", `%${search.trim()}%`);
    const { data } = await query;
    setUsers((data as Profile[]) ?? []);
    setLoading(false);
  }, [search]);

  useEffect(() => {
    const t = setTimeout(fetchUsers, 250); // debounce the search field
    return () => clearTimeout(t);
  }, [fetchUsers]);

  const refresh = async () => {
    await fetchUsers();
    setSelected(null);
  };

  return (
    <div className="space-y-4">
      <LiveRefresh tables={["profiles"]} label="Data user berubah" />

      <header>
        <h1 className="font-display text-xl font-bold text-ink">User</h1>
        <p className="mt-1 text-sm text-muted">
          Tap satu user buat atur kredit, status, dan akses.
        </p>
      </header>

      <input
        type="search"
        placeholder="Cari email..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label="Cari user berdasarkan email"
        className="w-full rounded-xl border border-hairline bg-surface px-4 py-3 text-sm text-ink placeholder:text-muted focus:border-ember focus:outline-none focus:ring-1 focus:ring-ember"
      />

      {loading ? (
        <div className="space-y-2" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl border border-hairline bg-surface/60" />
          ))}
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-xl border border-dashed border-hairline px-4 py-10 text-center">
          <p className="text-sm text-muted">
            {search ? `Gak ada user yang cocok sama “${search}”.` : "Belum ada user."}
          </p>
        </div>
      ) : (
        <>
          {/* phones */}
          <div className="space-y-2 md:hidden">
            {users.map((u) => (
              <button
                key={u.id}
                onClick={() => setSelected(u)}
                className="surface-card flex w-full cursor-pointer items-center gap-3 rounded-xl p-3 text-left transition-colors duration-[var(--duration-standard)] ease-heat hover:border-ember/30"
              >
                <Avatar user={u} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">
                    {u.display_name || u.email}
                  </p>
                  <p className="truncate text-micro text-muted">{u.email}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    <Badges u={u} />
                  </div>
                </div>
                <span className="shrink-0 text-right">
                  <span className="block font-mono text-sm text-ember">
                    {u.credits_free + u.credits_paid}
                  </span>
                  <span className="eyebrow text-muted">kredit</span>
                </span>
              </button>
            ))}
          </div>

          {/* md and up */}
          <div className="hidden overflow-hidden rounded-2xl border border-hairline bg-surface md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-hairline bg-obsidian text-muted">
                <tr>
                  <th className="px-5 py-3 font-medium">User</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Kredit</th>
                  <th className="px-5 py-3 font-medium">Gabung</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {users.map((u) => (
                  <tr
                    key={u.id}
                    onClick={() => setSelected(u)}
                    className="cursor-pointer text-ink transition-colors hover:bg-surface-raised/50"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar user={u} />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{u.display_name || "—"}</p>
                          <p className="truncate text-micro text-muted">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        <Badges u={u} />
                      </div>
                    </td>
                    <td className="px-5 py-3 font-mono text-ember">
                      {u.credits_free + u.credits_paid}
                    </td>
                    <td className="px-5 py-3 text-muted">{fmtDate(u.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {selected && (
        <UserSheet user={selected} onClose={() => setSelected(null)} onDone={refresh} />
      )}
    </div>
  );
}

function Avatar({ user }: { user: Profile }) {
  const [imgError, setImgError] = useState(false);
  const initial = (user.display_name || user.email || "?").charAt(0).toUpperCase();

  return (
    <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full border border-hairline/80 bg-surface-raised shadow-xs">
      {user.avatar_url && !imgError ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={user.avatar_url}
          alt=""
          className="size-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <span className="font-display text-xs font-bold text-muted">
          {initial}
        </span>
      )}
    </span>
  );
}

function Badges({ u }: { u: Profile }) {
  return (
    <>
      {u.is_banned && (
        <span className="rounded bg-danger/10 px-2 py-0.5 text-micro text-danger">Banned</span>
      )}
      {u.role === "admin" && (
        <span className="rounded bg-ember/15 px-2 py-0.5 text-micro text-ember">Admin</span>
      )}
      <span
        className={`rounded px-2 py-0.5 text-micro ${
          u.is_pro ? "bg-success/10 text-success" : "bg-surface-raised text-muted"
        }`}
      >
        {u.is_pro ? "Pro" : "Free"}
      </span>
    </>
  );
}

/** One sheet for the whole user. Every action states what it does before it runs. */
function UserSheet({
  user,
  onClose,
  onDone,
}: {
  user: Profile;
  onClose: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [creditMode, setCreditMode] = useState<"add" | "deduct">("add");
  const [amount, setAmount] = useState("");
  const [bucket, setBucket] = useState<"free" | "paid">("paid");
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState<"ban" | "delete" | null>(null);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError("");
    try {
      await fn();
      onDone();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Gagal.");
      setBusy("");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-obsidian/70 backdrop-blur-sm md:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={`Atur ${user.email}`}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88dvh] w-full overflow-y-auto overscroll-contain rounded-t-2xl border border-hairline bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:max-w-lg md:rounded-2xl"
      >
        <div className="flex items-start gap-3">
          <Avatar user={user} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display font-bold text-ink">
              {user.display_name || "Tanpa nama"}
            </p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="cursor-pointer rounded-full border border-hairline px-2.5 py-1 text-xs text-muted hover:text-ink"
          >
            Tutup
          </button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Stat label="Free" value={user.credits_free} />
          <Stat label="Paid" value={user.credits_paid} />
          <Stat label="Gabung" value={fmtDate(user.created_at)} small />
        </div>

        {user.is_banned && user.ban_reason && (
          <p className="mt-3 rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-xs text-danger">
            Dibanned: {user.ban_reason}
          </p>
        )}

        {error && (
          <p className="mt-3 rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-xs text-danger">
            {error}
          </p>
        )}

        {/* ---- credits (tambah / kurang) ---- */}
        <Section title="Atur Saldo Kredit">
          <p className="mb-3 text-micro leading-relaxed text-muted">
            Lo bisa nambah atau ngurangin kredit user. Setiap aksi tercatat otomatis di kas & audit log.
          </p>

          {/* Mode Switcher: Tambah vs Kurangi */}
          <div className="mb-3 flex rounded-xl border border-hairline bg-obsidian p-1">
            <button
              type="button"
              onClick={() => setCreditMode("add")}
              className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition-all cursor-pointer ${
                creditMode === "add"
                  ? "bg-success/20 text-success shadow-xs"
                  : "text-muted hover:text-ink"
              }`}
            >
              + Tambah Kredit
            </button>
            <button
              type="button"
              onClick={() => setCreditMode("deduct")}
              className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition-all cursor-pointer ${
                creditMode === "deduct"
                  ? "bg-danger/20 text-danger shadow-xs"
                  : "text-muted hover:text-ink"
              }`}
            >
              − Kurangi Kredit
            </button>
          </div>

          <div className="flex gap-2">
            <input
              type="number"
              min={1}
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Jumlah"
              aria-label="Jumlah kredit"
              className="w-28 rounded-lg border border-hairline bg-obsidian px-3 py-2 text-sm text-ink focus:border-ember focus:outline-none"
            />
            <div className="flex overflow-hidden rounded-lg border border-hairline">
              {(["paid", "free"] as const).map((b) => (
                <button
                  key={b}
                  onClick={() => setBucket(b)}
                  className={`cursor-pointer px-3 py-2 text-xs font-semibold transition-colors ${
                    bucket === b ? "bg-ember/15 text-ember" : "text-muted hover:text-ink"
                  }`}
                >
                  {b === "paid" ? `Paid (${user.credits_paid})` : `Free (${user.credits_free})`}
                </button>
              ))}
            </div>
          </div>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={creditMode === "add" ? "Alasan penambahan..." : "Alasan pengurangan..."}
            aria-label="Alasan"
            className="mt-2 w-full rounded-lg border border-hairline bg-obsidian px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-ember focus:outline-none"
          />
          <Action
            label={
              creditMode === "add"
                ? `Tambahkan ${amount || "…"} kredit ${bucket}`
                : `Kurangi ${amount || "…"} kredit ${bucket}`
            }
            busy={busy === "adjust_credit"}
            disabled={!amount || Number(amount) <= 0 || !reason.trim()}
            onClick={() =>
              run("adjust_credit", () =>
                adjustCredits(user.id, creditMode, Number(amount), bucket, reason.trim()),
              )
            }
          />
        </Section>

        {/* ---- tier ---- */}
        <Section title="Tier">
          <p className="mb-2 text-micro leading-relaxed text-muted">
            Pro pakai model yang lebih kuat dan pool kuota terpisah.
          </p>
          <Action
            label={user.is_pro ? "Turunin ke Free" : "Naikin ke Pro"}
            busy={busy === "pro"}
            onClick={() => run("pro", () => setProStatus(user.id, !user.is_pro))}
          />
        </Section>

        {/* ---- access ---- */}
        <Section title="Akses">
          <Action
            label={user.role === "admin" ? "Cabut akses admin" : "Jadiin admin"}
            busy={busy === "role"}
            onClick={() => run("role", () => setAdminRole(user.id, user.role !== "admin"))}
          />

          {user.is_banned ? (
            <Action
              label="Buka ban"
              busy={busy === "unban"}
              onClick={() => run("unban", () => unbanUser(user.id))}
            />
          ) : confirming === "ban" ? (
            <ConfirmRow
              text="Ban user ini? Dia langsung gak bisa generate apa-apa."
              danger
              busy={busy === "ban"}
              disabled={!reason.trim()}
              hint={!reason.trim() ? "Isi alasannya dulu di kolom atas." : undefined}
              onCancel={() => setConfirming(null)}
              onConfirm={() => run("ban", () => banUser(user.id, reason.trim()))}
            />
          ) : (
            <Action label="Ban user" danger onClick={() => setConfirming("ban")} />
          )}
        </Section>

        {/* ---- delete ---- */}
        <Section title="Zona bahaya">
          {confirming === "delete" ? (
            <ConfirmRow
              text={`Hapus ${user.email} permanen? Semua data dia ikut kehapus dan gak bisa dibalikin.`}
              danger
              busy={busy === "delete"}
              onCancel={() => setConfirming(null)}
              onConfirm={() => run("delete", () => deleteUser(user.id))}
            />
          ) : (
            <Action label="Hapus user permanen" danger onClick={() => setConfirming("delete")} />
          )}
        </Section>
      </div>
    </div>
  );
}

function Stat({ label, value, small }: { label: string; value: string | number; small?: boolean }) {
  return (
    <div className="rounded-lg border border-hairline bg-obsidian px-2 py-2">
      <p className={`font-mono text-ink ${small ? "text-micro" : "text-base"}`}>{value}</p>
      <p className="eyebrow mt-0.5 text-muted">{label}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 border-t border-hairline pt-4">
      <h3 className="eyebrow mb-2 text-muted">{title}</h3>
      {children}
    </section>
  );
}

function Action({
  label,
  onClick,
  busy,
  danger,
  disabled,
}: {
  label: string;
  onClick: () => void;
  busy?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy || disabled}
      className={`mt-2 w-full cursor-pointer rounded-lg border px-3 py-2.5 text-xs font-bold transition-colors duration-[var(--duration-standard)] ease-heat disabled:cursor-not-allowed disabled:opacity-45 ${
        danger
          ? "border-danger/30 bg-danger/10 text-danger hover:bg-danger/20"
          : "border-hairline bg-surface-raised text-ink hover:border-ember/40 hover:text-ember-lo"
      }`}
    >
      {busy ? "Bentar..." : label}
    </button>
  );
}

/** Confirmation lives inline, in the sheet, in plain language — not in a native dialog. */
function ConfirmRow({
  text,
  onConfirm,
  onCancel,
  busy,
  danger,
  disabled,
  hint,
}: {
  text: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
  danger?: boolean;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <div
      className={`mt-2 rounded-lg border p-3 ${
        danger ? "border-danger/30 bg-danger/5" : "border-hairline bg-obsidian"
      }`}
    >
      <p className="text-xs leading-relaxed text-ink">{text}</p>
      {hint && <p className="mt-1 text-micro text-muted">{hint}</p>}
      <div className="mt-3 flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 cursor-pointer rounded-lg border border-hairline px-3 py-2 text-xs font-semibold text-muted hover:text-ink"
        >
          Batal
        </button>
        <button
          onClick={onConfirm}
          disabled={busy || disabled}
          className="flex-1 cursor-pointer rounded-lg bg-danger px-3 py-2 text-xs font-bold text-obsidian disabled:cursor-not-allowed disabled:opacity-45"
        >
          {busy ? "Bentar..." : "Ya, lanjut"}
        </button>
      </div>
    </div>
  );
}
