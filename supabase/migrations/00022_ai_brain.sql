-- Migration: ai_brain
--
-- The Global AI Brain: one setting that decides which model serves the whole
-- product, with per-feature override for the cases that genuinely differ.
--
-- NO TABLE CHANGES. Two app_config rows, nothing else. That is possible because
-- of how routing already resolves: a feature with no row in ai_routes used to
-- mean "use the legacy Gemini path", and now means "follow the Brain" — with the
-- Brain itself falling back to the legacy path while it is unset. So an
-- ai_routes row stops meaning "this feature is configured" and starts meaning
-- "this feature is DIFFERENT from the rest", which is the only thing an owner
-- actually needs to see on a routing screen.
--
-- The practical consequence: switching the product from Gemini to DeepSeek is
-- one write to one row, not fifteen route edits.

insert into public.app_config (key, value, description) values
  (
    'ai_brain',
    '{"primary": null, "fallbacks": []}'::jsonb,
    'Otak AI utama: model yang dipakai SEMUA fitur yang gak dioverride. Isi primary sama fallbacks pakai id dari ai_models. Kosong = pakai jalur Gemini lama.'
  ),
  (
    'ai_admin_mode',
    '"simple"'::jsonb,
    'Tampilan panel AI: "simple" (cuma otak AI + biaya) atau "advanced" (gateway, model, routing, log).'
  )
on conflict (key) do nothing;
