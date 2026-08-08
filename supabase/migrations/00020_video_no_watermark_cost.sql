-- Extra credits to remove the malesan.my.id export watermark. Priced on its own
-- because the watermark is free advertising the product gives up when dropped.
-- getVideoNoWatermarkCost() falls back to 5, matching this seed.
insert into public.app_config (key, value)
values ('cost_no_watermark', '5'::jsonb)
on conflict (key) do nothing;
