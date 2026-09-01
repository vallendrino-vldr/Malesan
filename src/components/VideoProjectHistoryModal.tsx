"use client";

import React, { useEffect, useState } from "react";
import { listVideoProjects, deleteVideoProject, clearAllVideoProjects, type VideoProject } from "@/lib/video/project-history";

interface VideoProjectHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProject: (project: VideoProject) => void;
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function VideoProjectHistoryModal({
  isOpen,
  onClose,
  onSelectProject,
}: VideoProjectHistoryModalProps) {
  const [projects, setProjects] = useState<VideoProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (isOpen) {
      listVideoProjects()
        .then((data) => {
          if (active) {
            setProjects(data);
            setLoading(false);
          }
        })
        .catch(() => {
          if (active) {
            setProjects([]);
            setLoading(false);
          }
        });
    }
    return () => {
      active = false;
    };
  }, [isOpen]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingId(id);
    await deleteVideoProject(id);
    setProjects((prev) => prev.filter((p) => p.id !== id));
    setDeletingId(null);
  };

  const handleClearAll = async () => {
    if (!window.confirm("Apakah kamu yakin ingin menghapus semua riwayat proyek video?")) return;
    await clearAllVideoProjects();
    setProjects([]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md max-h-[85vh] overflow-hidden rounded-3xl border border-ember/30 bg-obsidian p-4.5 sm:p-6 shadow-2xl ring-1 ring-white/10 flex flex-col space-y-4 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-xl bg-ember/20 text-ember border border-ember/30">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
            <div>
              <h3 className="font-display text-sm sm:text-base font-bold text-white tracking-wide leading-tight">
                Draf & Riwayat Proyek Video
              </h3>
              <p className="text-[11px] sm:text-xs text-mist mt-0.5">Progres edit tersimpan otomatis di perangkat kamu</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal"
            className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-white/5 text-mist hover:text-white hover:bg-white/10 transition-all cursor-pointer"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar max-h-[60vh]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-mist space-y-2">
              <span className="size-5 border-2 border-ember border-t-transparent rounded-full animate-spin" />
              <p className="text-xs">Memuat riwayat proyek...</p>
            </div>
          ) : projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-mist space-y-3">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-white/5 border border-white/10 text-ember">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
                </svg>
              </div>
              <div>
                <p className="font-bold text-white text-sm">Belum Ada Riwayat Proyek</p>
                <p className="text-xs text-mist max-w-xs mt-0.5">
                  Setiap kali kamu mengedit subtitle atau framing video, draf akan otomatis tersimpan di sini.
                </p>
              </div>
            </div>
          ) : (
            projects.map((project) => (
              <div
                key={project.id}
                onClick={() => {
                  onSelectProject(project);
                  onClose();
                }}
                className="group relative rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 hover:border-ember/40 hover:bg-white/[0.07] transition-all cursor-pointer space-y-2.5 shadow-xs"
              >
                {/* Row 1: Title & Action Buttons */}
                <div className="flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-ember/15 text-ember border border-ember/30">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                      </svg>
                    </div>
                    <h4 className="font-bold text-xs text-white truncate group-hover:text-ember transition-colors">
                      {project.title || "Video Proyek Tanpa Judul"}
                    </h4>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="flex h-7 items-center gap-1 px-2.5 rounded-lg bg-ember/20 text-ember font-bold text-[11px] border border-ember/30 group-hover:bg-ember group-hover:text-obsidian transition-all">
                      <span>Buka</span>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="size-2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                      </svg>
                    </span>
                    <button
                      type="button"
                      onClick={(e) => handleDelete(project.id, e)}
                      disabled={deletingId === project.id}
                      aria-label={`Hapus proyek ${project.title || "tanpa judul"}`}
                      className="flex size-7 items-center justify-center rounded-lg text-mist hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Row 2: Metadata Badges (Duration, Words, Date) */}
                <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-white/5 text-[11px] text-mist">
                  <div className="flex items-center gap-2 font-mono">
                    <span className="inline-flex items-center gap-1 text-ember font-semibold">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      <span>{formatDuration(project.durationSec)}</span>
                    </span>
                    <span>•</span>
                    <span className="inline-flex items-center gap-1 text-white/80">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3 text-mist">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
                      </svg>
                      <span>{project.words.length} Kata</span>
                    </span>
                  </div>

                  <span className="text-[10px] text-mist/80 shrink-0 font-medium">
                    {formatDate(project.updatedAt)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {projects.length > 0 && (
          <div className="flex items-center justify-between border-t border-white/10 pt-2.5">
            <button
              type="button"
              onClick={handleClearAll}
              className="h-8.5 flex items-center text-xs text-red-400 hover:text-red-300 font-semibold transition-colors cursor-pointer"
            >
              Hapus Semua Riwayat
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-8.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-xs text-white font-bold transition-all cursor-pointer"
            >
              Tutup
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
