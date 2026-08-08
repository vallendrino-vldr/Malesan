-- Migration: video_auto_cc_cost
-- The video Auto-CC module (client-side ffmpeg.wasm burn-in + Groq Whisper
-- word-level transcription) charges per MINUTE of audio, because the cost driver
-- is audio length, not request count. Seeded so the owner retunes it in the
-- admin panel without a deploy; getVideoCostPerMin() falls back to 2 when the
-- row is missing, so this default and the code default agree.
--
-- No table: the video never touches the server (only extracted audio does, and
-- only in transit to Groq), so there is no job to persist. If a history/analytics
-- need appears later, add a table then rather than speculatively now.
insert into public.app_config (key, value)
values ('cost_video_per_min', '2'::jsonb)
on conflict (key) do nothing;
