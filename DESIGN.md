# DESIGN — Malesan

## 1. Concept

**Cold obsidian that heats up when the user acts.**

The interface is dark, quiet and dormant until a generation starts — then amber light blooms
out of the active element. Heat maps to activity.

This is the signature. **Spend the boldness here and keep everything else quiet.**

### What not to do

Do **not** use heavy 3D scenes or WebGL models. They contradict the "fast and smooth"
requirement. Depth comes from:

- layered shadows
- a warm ambient glow behind active surfaces
- subtle parallax
- CSS 3D transforms

At most one lightweight ambient WebGL accent, and only if it costs nothing perceptible on a
mid-range Android device.

---

## 2. Color tokens

The base black is **warm-tinted**, not blue-black — a cool black under an amber accent reads
as a clash.

| Token | Hex | Use |
|---|---|---|
| `obsidian` | `#0B0A09` | App background |
| `surface` | `#16130F` | Cards, panels |
| `surface-raised` | `#1F1A14` | Elevated / hover |
| `border` | `#2A241D` | Hairline dividers |
| `ember` | `#FF8A3D` | Primary accent |
| `ember-lo` | `#FFB067` | Hover, highlight |
| `ember-deep` | `#C2521A` | Pressed, glow shadow |
| `text` | `#F5F0EA` | Primary text |
| `muted` | `#8A8178` | Secondary text |
| `success` | `#6FCF97` | Confirmations only |
| `danger` | `#E5544B` | Destructive only |

**Amber is for action and heat.** Never use it for decoration or on non-interactive elements.
If everything glows, nothing does.

`success` and `danger` are for their stated purpose only — they are not part of the palette.

---

## 3. Typography

| Role | Family | Notes |
|---|---|---|
| Display | **Archivo** | Weights 600–800, tight negative tracking. Industrial, engineered. |
| Body | **Plus Jakarta Sans** | Chosen deliberately — Jakarta's own typeface, for an Indonesian product. See `DECISIONS.md`. |
| Data / labels / credits | **Geist Mono** | Numbers and system labels only. |

Set a real type scale. Display sizes get **tighter tracking as they grow**.

Geist Mono is for numerals and system labels — credit balances, timestamps, quota readouts,
key IDs. It is not a body font and must not leak into prose.

---

## 4. Motion

| Motion | Spec |
|---|---|
| Standard transition | 180ms, `cubic-bezier(0.22, 1, 0.36, 1)` |
| Entrances | 240ms with 8px upward translate |
| Ember glow bloom on generation start | 400ms ease-out |

**`prefers-reduced-motion`** — disable translate and glow animation, keep opacity fades.
This is part of the quality floor, not an enhancement.

---

## 5. Perceived speed — the most important decision on this page

**Stream AI output token by token.**

A four-second generation that streams feels instant; the same generation behind a spinner
feels broken. Skeletons for structure, streaming for text.

This single decision does more for the "premium" feel than any visual effect. If a tradeoff
ever forces a choice between a visual flourish and streaming, streaming wins.

---

## 6. Copy voice

Casual, warm, a little funny. Premium execution underneath. The contrast is the point.

| Context | Copy |
|---|---|
| Loading | `Lagi mikirin buat lo...` |
| Empty state | `Belum ada apa-apa. Ya udah, gue yang mulai.` |
| Primary CTA | `Males mikir. Kasih ide.` |
| Zero credits | `Credit abis. Besok refill jam 00:00, atau top up biar gak nunggu.` |

**Rules for all copy:**
- sentence case
- active voice
- no corporate filler
- never apologise for an error — an error says **what broke and what to do**
- an empty state is an invitation, not a mood

Never let copy imply the product makes low-effort or low-quality content. The user is lazy
about the *thinking*, not the craft.

---

## 7. Quality floor — unannounced, always required

- responsive down to **360px**
- visible keyboard focus states
- `prefers-reduced-motion` respected
- all interactive elements reachable by keyboard

These are not features to be scheduled. They ship with every component.

---

## 8. Language

UI is bilingual with an **ID/EN toggle**. AI output language is a **separate** per-user
Creator DNA setting, defaulting to Indonesian. Do not wire them to the same state.
