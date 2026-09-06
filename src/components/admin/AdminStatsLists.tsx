"use client";

import React, { useState } from "react";

export type UserActivity = {
  user_id: string;
  email: string;
  display_name: string | null;
  role: string;
  is_pro: boolean;
  is_banned: boolean;
  credits_total: number;
  generations: number;
  credits_spent: number;
  modules_used: string[] | null;
  last_active: string | null;
  joined: string;
};

export function AdminStatsUserList({
  activity,
  moduleNames,
}: {
  activity: UserActivity[];
  moduleNames: Record<string, string>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const displayed = isOpen ? activity : activity.slice(0, 3);

  if (activity.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-hairline px-4 py-6 text-center text-xs text-muted">
        Belum ada user.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {displayed.map((u) => (
        <div key={u.user_id} className="surface-card rounded-xl p-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">
                {u.display_name || u.email}
              </p>
              <p className="truncate text-micro text-muted">{u.email}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-mono text-sm text-ember">{u.generations}</p>
              <p className="eyebrow text-muted">generate</p>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {u.role === "admin" && (
              <span className="rounded bg-ember/15 px-2 py-0.5 text-micro text-ember">
                Admin
              </span>
            )}
            {u.is_banned && (
              <span className="rounded bg-danger/10 px-2 py-0.5 text-micro text-danger">
                Banned
              </span>
            )}
            <span
              className={`rounded px-2 py-0.5 text-micro ${
                u.is_pro ? "bg-success/10 text-success" : "bg-surface-raised text-muted"
              }`}
            >
              {u.is_pro ? "Pro" : "Free"}
            </span>
            {(u.modules_used ?? []).map((m) => (
              <span
                key={m}
                className="rounded bg-obsidian px-2 py-0.5 text-micro text-muted"
              >
                {moduleNames[m] ?? m}
              </span>
            ))}
          </div>

          <p className="mt-2 flex flex-wrap gap-x-3 text-micro text-muted">
            <span>
              Kredit kepakai:{" "}
              <span className="font-mono text-ink">{u.credits_spent}</span>
            </span>
            <span>
              Sisa: <span className="font-mono text-ink">{u.credits_total}</span>
            </span>
            <span>
              Terakhir aktif:{" "}
              <span className="text-ink">
                {u.last_active
                  ? new Date(u.last_active).toLocaleString("id-ID", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "belum pernah"}
              </span>
            </span>
          </p>
        </div>
      ))}

      {activity.length > 3 && (
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="cursor-pointer w-full py-2.5 text-center text-xs font-semibold text-ember hover:text-ember-lo bg-surface border border-hairline rounded-xl transition-colors flex items-center justify-center gap-1.5"
        >
          <span>{isOpen ? "Ciutkan Daftar User" : `Buka Semua (${activity.length} User) ↓`}</span>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`size-3.5 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      )}
    </div>
  );
}

export function AdminStatsModuleList({
  modules,
  maxModule,
  moduleNames,
}: {
  modules: [string, number][];
  maxModule: number;
  moduleNames: Record<string, string>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const displayed = isOpen ? modules : modules.slice(0, 5);

  if (modules.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-hairline px-4 py-6 text-center text-xs text-muted">
        Belum ada aktivitas.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {displayed.map(([mod, n]) => (
        <div key={mod} className="surface-card rounded-xl p-3">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-semibold text-ink">
              {moduleNames[mod] ?? mod}
            </p>
            <p className="font-mono text-xs text-muted">
              {n} <span className="text-micro">({Math.round((n / maxModule) * 100)}%)</span>
            </p>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-obsidian">
            <div
              className="h-full bg-ember rounded-full"
              style={{ width: `${Math.max(3, (n / maxModule) * 100)}%` }}
            />
          </div>
        </div>
      ))}

      {modules.length > 5 && (
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="cursor-pointer w-full py-2 text-center text-xs font-semibold text-ember hover:text-ember-lo bg-surface border border-hairline rounded-xl transition-colors flex items-center justify-center gap-1.5"
        >
          <span>{isOpen ? "Ciutkan Modul" : `Buka Semua (${modules.length} Modul) ↓`}</span>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`size-3.5 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      )}
    </div>
  );
}
