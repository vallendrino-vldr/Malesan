"use client";

import type { PipelineCard } from "./supabase/database.types";

/**
 * Request notification permission from the browser.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return false;
  }
  if (Notification.permission === "granted") return true;
  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }
  return false;
}

/**
 * Check cards scheduled for today and alert when their time has arrived.
 */
export function checkScheduleReminders(cards: PipelineCard[]) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const currentHours = String(now.getHours()).padStart(2, "0");
  const currentMinutes = String(now.getMinutes()).padStart(2, "0");
  const currentTimeStr = `${currentHours}:${currentMinutes}`;

  const notifiedKey = `malesan_notified_${todayStr}`;
  let notifiedIds: string[] = [];
  try {
    notifiedIds = JSON.parse(localStorage.getItem(notifiedKey) || "[]");
  } catch {
    notifiedIds = [];
  }

  for (const card of cards) {
    if (card.status === "posted") continue;
    if (card.scheduled_date !== todayStr) continue;
    if (!card.scheduled_time) continue;

    // If card time matches current time (or within target slot) and not notified yet today
    if (card.scheduled_time === currentTimeStr && !notifiedIds.includes(card.id)) {
      try {
        new Notification("⏰ Waktunya Posting Konten! (Malesan)", {
          body: `Konten "${card.title}" dijadwalkan tayang jam ${card.scheduled_time} WIB. Buka Malesan untuk eksekusi naskahnya!`,
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          tag: `post-reminder-${card.id}`,
        });
        notifiedIds.push(card.id);
        localStorage.setItem(notifiedKey, JSON.stringify(notifiedIds));
      } catch (err) {
        console.error("Failed to show notification", err);
      }
    }
  }
}
