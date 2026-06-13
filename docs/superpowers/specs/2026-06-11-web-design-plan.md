# rfjs Web Playground — Design Plan ("The Seam")

**Status:** proposed — pending user sign-off (Phase 1, Task 7 stop gate)
**Date:** 2026-06-11
**Scope:** visual design direction for `apps/web` + `@rfjs/web-ui`. No code changes in
this document; design tokens land in `@rfjs/web-ui`'s Tailwind v4 `@theme` block
(`packages/web-ui/src/styles/globals.css`) **during Phase 2, after user sign-off**,
replacing the placeholder `--font-sans`/`--font-mono` noted in the Phase 1 plan.

> Synthesis note: three independent proposals were evaluated ("Data Terminal",
> "The Seam", "GRATICULE"). **The Seam** won on subject-matter fit and
> implementability; this plan grafts in the strongest ideas from the other two —
> GRATICULE's stateful trace (dashed = stale, broken = error) and two-family type
> discipline, and Data Terminal's status-bar microcopy and anti-pattern list.
> This supersedes the placeholder palette sketched in the Phase 1 plan's Task 7
> Step 1 (the three-accent JSON-syntax palette) while keeping all of its
> structural decisions.

---

## 1. Concept

Every `@rfjs/*` package does one gesture: take data in one shape, return it in
another (`object-utils` flattens, `data-transform` coerces, `data-filter`
selects, `mongo-query`/`jsonb-query` compile filters into queries). The site
makes **left becomes right** the organizing principle:

- Exactly **two accent hues**: a cool one for *input* (`intake`) and a warm one
  for *output* (`yield`). Data going in is always cool; data coming out is
  always warm. The gradient between them is the brand.
- The chrome (nav, headers, cards, footer) is near-monochrome graphite. Color
  appears only where data flows, so when an accent shows up it *means* something.
- The signature element — **the Seam** — is the literal line where input turns
  into output, recurring at every scale: full-size between playground panes,
  miniature as card underlines, nav indicators, and section dividers.

This is deliberately **not** the syntax-highlighting-rainbow direction
(key-purple / string-teal / number-amber): three semantic accents dilute the
transformation story; two directional ones tell it. The code panes themselves
may syntax-highlight — the *brand* does not.

## 2. Palette (named hex, dark-mode-first)

Six named tokens. Muted/secondary text is `signal` at 65% opacity rather than a
seventh token. All text tokens verified ≥ 4.5:1 (WCAG AA, normal text) against
both background tokens.

### Dark (default)

| Token | Hex | Usage | Contrast on `bedrock` / `slab` |
|---|---|---|---|
| `bedrock` | `#11151C` | Page background — cool deep graphite, not pure black | — |
| `slab` | `#1B212C` | Panels, cards, editor surfaces, sidebar | — |
| `signal` | `#E2E8F1` | Primary text; 65% opacity = muted text | 14.85 / 13.11 |
| `intake` | `#6E9BD6` | Input side: input-pane borders, "before" snippets, links, focus ring | 6.38 / 5.63 |
| `yield` | `#E8B04B` | Output side: output-pane accents, "after" snippets, primary CTA | 9.36 / 8.26 |
| `fault` | `#EF6F6C` | Errors, invalid input states, destructive actions | 6.24 / 5.51 |

**The Seam gradient** is `linear-gradient(to right, intake, yield)` — the only
place the two hues meet. Reserved for transformation moments, never decoration.

### Light mode (same token names, lightness shift only)

| Token | Hex (light) | Contrast on `#F4F6F9` |
|---|---|---|
| `bedrock` | `#F4F6F9` | — |
| `slab` | `#FFFFFF` (1px `#E1E6EE` border) | — |
| `signal` | `#1C232E` | 14.59 |
| `intake` | `#2E6CB8` | 4.91 |
| `yield` | `#8F6310` | 4.90 |
| `fault` | `#C2362F` | 5.02 |

The accents shift in lightness, not hue, so the cool-in / warm-out grammar
survives the theme switch. Implemented as CSS custom properties under Tailwind
v4 `@theme`, with a `.light`/`.dark` class override and `prefers-color-scheme`
default. shadcn component variables (background/foreground/primary/etc.) map
onto these six tokens so stock components inherit the system.

## 3. Typography

**Two families total** (grafted from GRATICULE's discipline), both via
`next/font/google` with `display: 'swap'` in `apps/web/app/layout.tsx`:

| Role | Face | Rationale |
|---|---|---|
| Display + body/UI | **Archivo** (variable; `wght` + `wdth` axes) | A grotesque built from signage lettering — wayfinding above machinery. The variable width axis gives a two-font look at one-font cost: compact `wdth` ~100 body text, wide `wdth` ~115–125 weight-600 headings. Dodges both Inter-default and serif-on-cream ruts. |
| Data / code | **JetBrains Mono** (400/500, ligatures off) | The only face that wears `intake`/`yield`. Disambiguated `0/O`, `1/l`, generous x-height — built for the JSON-in / JSON-out panes this site is made of. `font-variant-numeric: tabular-nums` for figures and status bars. |

Pairing logic: the mono is the star because **the content of this site is code,
not prose**; Archivo stays one temperature across display and body so chrome
never competes with data. Type scale stays tight (display 2–2.5rem max) —
restraint in type mirrors restraint in color.

```ts
// apps/web/app/layout.tsx (Phase 2)
import { Archivo, JetBrains_Mono } from 'next/font/google';
const archivo = Archivo({ subsets: ['latin'], axes: ['wdth'], variable: '--font-sans' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-mono' });
```

## 4. Signature Element — the Seam

A 2px rule on the `intake → yield` gradient with a small chevron junction node
at its midpoint carrying the operation name in a mono chip (e.g. `▸ flatten()`),
joining every input pane to its output pane. The Seam is **stateful** (grafted
from GRATICULE), so meaning never depends on motion:

- **Current:** solid line — displayed output corresponds to displayed input.
- **Stale:** the moment input is edited, the line goes **dashed** — a visible
  "needs re-evaluation" signal readable without color or motion.
- **On evaluation (the one earned animation):** a single ~350ms pulse — a short
  luminous segment travels along the Seam from input edge to output edge, the
  output pane's border ticks to `yield`, and the line settles solid. Once per
  evaluation; never looping, never idle.
- **On error:** the Seam breaks at the junction node, which flips to a
  dashed-border `ERR` chip in `fault`; the output pane annotates the failing
  line. The broken line *is* the error state.
- **`prefers-reduced-motion: reduce`:** zero translation. The Seam steps to
  full opacity for ~300ms (static state change) and the output border updates
  instantly; the dashed/solid/broken grammar alone carries full meaning.
- Either way, an `aria-live="polite"` region announces "Output updated" /
  "Evaluation failed", so the moment is perceivable without sight or motion.

**At small scale** the same gradient line is the active-nav indicator, the card
hover/focus underline, and the homepage section divider — the signature is
structural and present even when nothing animates. Ships in Phase 2 as one
reusable component (`<Seam state="current | stale | running | error">`) shared
by playgrounds and showcase cards. All other motion site-wide is capped at
150ms opacity/color transitions.

## 5. Layout Concept — "the bench"

Workbench, not magazine:

- **Global frame:** thin top header (wordmark, theme toggle, GitHub link);
  desktop (`lg`+) adds a slim left sidebar (`slab`) listing tools grouped by
  package — driven by the `@rfjs/web-core` registries — with the active item
  marked by a 2px miniature Seam. Sidebar collapses to a drawer below `lg`.
- **Tool/playground pages (`lg`+):** **40 / 60 split** — input pane left,
  output pane right, the Seam running vertically between them (the result is
  the point, so output gets the larger share). Below `lg`, panes stack
  input-above-output and the Seam rotates horizontal (cool → warm,
  top-to-bottom). Each pane gets a footer **status bar** in mono (grafted from
  Data Terminal): `OK · 0.42ms · 38 keys → 12 keys` — instrument detail that
  keeps the page feeling alive without animation.
- **Homepage hero:** not a tagline over a gradient mesh — a **live specimen**:
  a real `object-utils` flatten running on a small sample object, input left,
  output right, Seam between. The first thing a visitor sees is the product
  doing its job.
- **Package showcase:** card wall, 1 → 2 → 3 columns across breakpoints. Each
  card carries a one-line `before ▸ after` mono snippet (cool → warm) instead
  of an icon, plus a Seam underline on hover/focus. The cards are tiny
  transformations; the grid is the catalog of them.
- Max content width 1440px; 8px spacing grid; 1px borders and background steps
  (`bedrock`/`slab`) instead of drop shadows; corner radius small (≤ 4px).

## 6. Accessibility Baselines (non-negotiable)

- **Keyboard focus:** 2px `intake` focus ring with 2px offset on every
  interactive element (`:focus-visible`), visible in both themes; never
  `outline: none` without a replacement.
- **Reduced motion:** the Seam pulse and all transitions > 150ms gated behind
  `@media (prefers-reduced-motion: no-preference)` (motion is opt-in); every
  state change lands on a static, parseable end state. Nothing autoplays or
  loops regardless of preference.
- **Contrast:** every text token AA-verified (≥ 4.5:1) against both surfaces in
  both modes (tables in §2); accents used as text only at the verified values,
  never as tinted/transparent text; interactive boundaries ≥ 3:1.
- **Color is never the only channel:** Seam state is carried by line style
  (solid/dashed/broken) and the `ERR` chip text; status badges pair hue with
  text; errors pair `fault` with an inline message.
- **Screen readers:** output updates mirrored to an `aria-live="polite"`
  region; panes labeled "Input"/"Output", not just positioned; decorative Seam
  SVG `aria-hidden` with state conveyed via the live region and text.
- **Dark-mode-first with a real light mode:** both themes ship from the same
  six tokens with verified contrast — no light-mode afterthought.

## 7. What We Deliberately Do NOT Do

- **No syntax-highlighting rainbow** in the chrome — two directional accents.
- **No cream + serif + terracotta; no near-black + phosphor green** — the two
  AI-default ditches. Graphite, blue-in, amber-out.
- **No gradient meshes, glassmorphism, glows, 3D blobs** — the only gradient on
  the site is the Seam, and it always means "transformation happening here."
- **No scroll-jacking, parallax, looping or idle animation; no typewriter
  hero** — one earned pulse per evaluation, nothing else moves.
- **No fake window chrome** (macOS traffic-light dots on code blocks) and no
  drop-shadow elevation system — 1px rules and background steps only.
- **No docs-site/blog patterns** — no prose sidebars or article layouts; every
  page is a bench or a catalog of benches.

## 8. Phase 2 Landing Notes

After user sign-off:

1. The six tokens (both modes) replace the placeholder values in
   `packages/web-ui/src/styles/globals.css` under `@theme`, with the light
   theme as a class override; shadcn variables remapped onto them.
2. Fonts wired via `next/font/google` in `apps/web/app/layout.tsx`
   (`--font-sans` = Archivo, `--font-mono` = JetBrains Mono).
3. `<Seam>` implemented once in `@rfjs/web-ui` and consumed by the homepage
   live specimen, showcase cards, and the object-flatten vertical slice.
