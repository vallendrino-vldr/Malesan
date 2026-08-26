"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  getTutorialRewardStatus,
  claimTutorialBonusAction,
  type TutorialRewardStatus,
} from "@/app/actions/tutorial";
import Link from "next/link";

interface TutorialVideoPlayerProps {
  videoSrc?: string;
  captionsSrc?: string;
  onRewardClaimed?: (newBalance: number) => void;
  className?: string;
  autoPlay?: boolean;
}

export function TutorialVideoPlayer({
  videoSrc = "/tutorial/tutorial-demo.mp4",
  captionsSrc,
  onRewardClaimed,
  className = "",
  autoPlay = false,
}: TutorialVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  // Anti-Cheat tracking state
  const [maxReachedTime, setMaxReachedTime] = useState(0);
  const [actualWatchSeconds, setActualWatchSeconds] = useState(0);
  const [hasCompletedWatch, setHasCompletedWatch] = useState(false);

  // Reward status state
  const [rewardStatus, setRewardStatus] = useState<TutorialRewardStatus>({
    isLoggedIn: false,
    hasClaimed: false,
  });
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimMessage, setClaimMessage] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [justClaimed, setJustClaimed] = useState(false);

  // Load reward status from server
  useEffect(() => {
    getTutorialRewardStatus()
      .then((status) => {
        setRewardStatus(status);
        if (status.hasClaimed) {
          setHasCompletedWatch(true);
        }
      })
      .catch(() => {});
  }, []);

  // Format seconds to mm:ss
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  // Play/Pause toggle
  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(() => {});
    }
  }, [isPlaying]);

  // Video Time Update & Anti-Skip tracking
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const curr = videoRef.current.currentTime;
    const dur = videoRef.current.duration || 1;

    setCurrentTime(curr);

    // Track max reached point without forward leaps
    if (curr > maxReachedTime) {
      // If jump is small (continuous playback <= 1.5s delta), update maxReachedTime
      if (curr - maxReachedTime < 2) {
        setMaxReachedTime(curr);
      }
    }

    // Accumulate real watched seconds
    setActualWatchSeconds((prev) => prev + 0.25);

    // Check completion (90%+ of video watched)
    if (!hasCompletedWatch && dur > 5) {
      if (curr >= dur * 0.90 || maxReachedTime >= dur * 0.90) {
        setHasCompletedWatch(true);
      }
    }
  };

  // Prevent forward seeking past maxReachedTime
  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const targetTime = (clickX / rect.width) * duration;

    // Allow seeking backwards or up to maxReachedTime + 1s
    if (targetTime <= maxReachedTime + 1) {
      videoRef.current.currentTime = targetTime;
      setCurrentTime(targetTime);
    } else {
      // Snap to maxReachedTime and show notification
      videoRef.current.currentTime = maxReachedTime;
      setCurrentTime(maxReachedTime);
    }
  };

  // Claim bonus credits
  const handleClaimBonus = async () => {
    if (isClaiming || rewardStatus.hasClaimed || justClaimed) return;
    setIsClaiming(true);
    setClaimError(null);

    try {
      const result = await claimTutorialBonusAction(
        Math.max(actualWatchSeconds, maxReachedTime),
        duration || 60,
      );

      if (result.success) {
        setJustClaimed(true);
        setClaimMessage(result.message);
        setRewardStatus((prev) => ({ ...prev, hasClaimed: true }));
        if (onRewardClaimed) onRewardClaimed(result.newBalance);
      } else {
        if (result.alreadyClaimed) {
          setRewardStatus((prev) => ({ ...prev, hasClaimed: true }));
        }
        setClaimError(result.error);
      }
    } catch {
      setClaimError("Terjadi kendala jaringan. Silakan coba lagi.");
    } finally {
      setIsClaiming(false);
    }
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const maxReachedPercent = duration > 0 ? (maxReachedTime / duration) * 100 : 0;

  return (
    <div className={`relative flex flex-col overflow-hidden rounded-2xl border border-white/[0.12] bg-[#0c0c0e] shadow-xl ${className}`}>
      {/* Top Incentive Status Bar */}
      <div className="flex items-center justify-between border-b border-white/[0.08] bg-surface-raised/80 px-4 py-2.5 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <span className="flex size-2 rounded-full bg-ember animate-pulse" />
          <span className="font-display text-xs font-semibold text-ink">
            Video Tutorial Malesan
          </span>
        </div>

        {/* Reward Status Chip */}
        {rewardStatus.hasClaimed || justClaimed ? (
          <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-micro font-bold text-emerald-400">
            <svg viewBox="0 0 20 20" fill="currentColor" className="size-3.5">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            +10 Kredit Sudah Diklaim
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 rounded-full border border-ember/40 bg-ember/15 px-3 py-1 text-micro font-bold text-ember">
            <span>🎁</span>
            <span>Tonton Selesai: +10 Kredit Gratis</span>
          </div>
        )}
      </div>

      {/* Video Viewport Container */}
      <div className="relative aspect-video w-full bg-black">
        <video
          ref={videoRef}
          src={videoSrc}
          playsInline
          preload="metadata"
          autoPlay={autoPlay}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={(e) => {
            const dur = e.currentTarget.duration;
            setDuration(dur);
          }}
          onClick={togglePlay}
          className="size-full object-contain cursor-pointer"
        >
          {captionsSrc && (
            <track
              kind="captions"
              src={captionsSrc}
              srcLang="id"
              label="Bahasa Indonesia"
              default
            />
          )}
        </video>

        {/* Center Play Overlay when Paused */}
        {!isPlaying && (
          <div
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px] transition-all cursor-pointer hover:bg-black/30"
          >
            <div className="flex size-16 items-center justify-center rounded-full border border-ember/60 bg-ember/90 text-obsidian shadow-lg transition-transform hover:scale-105 active:scale-95">
              <svg viewBox="0 0 24 24" fill="currentColor" className="size-7 translate-x-0.5">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        )}

        {/* Bottom Floating Control Bar */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3 pt-6">
          {/* Anti-Skip Progress Track */}
          <div
            onClick={handleSeek}
            className="group relative h-2 w-full cursor-pointer rounded-full bg-white/20 transition-all hover:h-3"
            title="Tonton secara berurutan untuk klaim hadiah"
          >
            {/* Allowed max watch zone (dim ember) */}
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-ember/30"
              style={{ width: `${maxReachedPercent}%` }}
            />
            {/* Current playback head (bright ember) */}
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-ember shadow-xs shadow-ember/50 transition-[width] duration-100"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Controls & Time Display */}
          <div className="mt-2 flex items-center justify-between text-xs text-white">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={togglePlay}
                className="flex size-7 items-center justify-center rounded-lg hover:bg-white/10"
                aria-label={isPlaying ? "Jeda" : "Putar"}
              >
                {isPlaying ? (
                  <svg viewBox="0 0 24 24" fill="currentColor" className="size-4">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="currentColor" className="size-4">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>

              {/* Volume */}
              <button
                type="button"
                onClick={() => {
                  if (!videoRef.current) return;
                  const newMuted = !isMuted;
                  videoRef.current.muted = newMuted;
                  setIsMuted(newMuted);
                }}
                className="flex size-7 items-center justify-center rounded-lg hover:bg-white/10"
                aria-label="Mute"
              >
                {isMuted ? (
                  <svg viewBox="0 0 24 24" fill="currentColor" className="size-4 text-muted">
                    <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="currentColor" className="size-4">
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                  </svg>
                )}
              </button>

              <span className="font-mono text-micro text-white/80">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            {/* Anti-Skip Badge */}
            <span className="font-display text-[10px] text-white/60">
              {hasCompletedWatch ? "100% Selesai" : `Progress: ${Math.round(maxReachedPercent)}%`}
            </span>
          </div>
        </div>
      </div>

      {/* Reward Claim Banner (Displays when user watched 90%+) */}
      {hasCompletedWatch && !rewardStatus.hasClaimed && !justClaimed && (
        <div className="border-t border-ember/40 bg-gradient-to-r from-ember/20 via-amber-500/10 to-ember/20 p-4 animate-fadeIn">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-ember text-xl text-obsidian shadow-sm">
                🎉
              </span>
              <div>
                <h4 className="font-display text-sm font-bold text-ink">
                  Keren! Video Tutorial Selesai Ditonton
                </h4>
                <p className="text-xs text-muted">
                  Klaim hadiah 10 kredit gratis lo sekarang untuk mulai bikin konten!
                </p>
              </div>
            </div>

            {rewardStatus.isLoggedIn ? (
              <button
                type="button"
                onClick={handleClaimBonus}
                disabled={isClaiming}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-ember px-5 py-2.5 font-display text-xs font-bold text-obsidian shadow-xs transition-all hover:bg-ember-lo active:scale-[0.98] cursor-pointer disabled:opacity-50"
              >
                {isClaiming ? (
                  <>
                    <span className="size-3.5 rounded-full border-2 border-obsidian/30 border-t-obsidian animate-spin" />
                    Mengklaim...
                  </>
                ) : (
                  <>
                    <span>🎁</span>
                    <span>Klaim +10 Kredit</span>
                  </>
                )}
              </button>
            ) : (
              <Link
                href="/masuk"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-ember px-5 py-2.5 font-display text-xs font-bold text-obsidian shadow-xs transition-all hover:bg-ember-lo active:scale-[0.98] cursor-pointer"
              >
                <span>Masuk & Ambil 10 Kredit ➔</span>
              </Link>
            )}
          </div>

          {claimError && (
            <p className="mt-2 text-center text-xs font-semibold text-rose-400">
              {claimError}
            </p>
          )}
        </div>
      )}

      {/* Success Notification */}
      {justClaimed && (
        <div className="border-t border-emerald-500/30 bg-emerald-950/40 p-4 text-center">
          <p className="font-display text-xs font-bold text-emerald-400">
            {claimMessage || "🎉 Selamat! 10 Kredit Gratis berhasil masuk ke saldo akun lo!"}
          </p>
        </div>
      )}
    </div>
  );
}
