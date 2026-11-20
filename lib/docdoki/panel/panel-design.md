# Panel Design — Unified Light & Dark Architecture

The Panel is a **project steering board** with one shared layout, typography, spacing, and shape system across **Light** and **Dark** themes (`Appearance` and `Language` controls in the bottom-right Floating Preferences Orb, persisted in `localStorage`, honoring `prefers-color-scheme` on first load, and selectable via `?theme=light|dark`):

- **Zero-shift theme architecture:** [panel.css](panel.css) and [board.css](board.css) define all geometry once using semantic CSS custom properties. Switching `Light ↔ Dark` changes only colors, elevation shadows/highlights, and status palettes—zero layout shift.
- **Light (`light`, Notion-inspired daylight):** Warm paper canvas (`#f6f5f4`), warm ivory sidebar (`#fbfbfa`), pure white surfaces, Notion Blue accent (`#0075de`), rose-crimson brand heart (`#e11d48`), quiet ghost utility chrome, and layered micro-shadows.
- **Dark (`dark`, Linear-inspired obsidian):** Deep obsidian canvas (`#08090a`), charcoal surface ladder (`#111214 → #16181b → #1c1e22`), hairline borders (`#23252a`), Linear lavender accent (`#5e6ad2`), coral-rose brand heart (`#f43f5e`), subtle top-edge pixel highlights, and zero drop shadows on dark.

## Primary workflow

**Switch project/unit via header tree → check Mission & Needs attention → filter or scan Areas / Dependency DAG → inspect Active Work or open a document → `</> Edit` or `Note to Agent` → Save & Copy compact unified diffs.**

## Layout and surfaces

- **Top bar (uniform `36px` controls, `24px` outer gutter):** Brand mark, hierarchical **Project & Unit Tree Switcher**, full-library search (`/`), primary `+ New` CTA, and `Changes` (with unsaved badge).
- **Floating Preferences Orb (bottom-right):** Unobtrusive `40px` circular button anchored above the status bar; opens an anchored **Preferences** popover for **Appearance** (`Light` / `Dark` with sun/moon icons) and **Language** (`English` / `中文`).
- **Sidebar (`252px`, collapsible Area folders):** `Dashboard`, `Active work` (with badge), `Northstar`, `Overview`, then `Specs` (grouped into collapsible Area folders when `>8` specs), collapsible `Active work`, `Notes`, and `Archive`.
- **Workspace sub-bar (fixed above `.workspace-body` scroll container, `24px` outer gutter):**
  - On **Dashboard:** Tabular-aligned status filter pills + `Areas | DAG` switch.
  - On **Documents:** Click-to-copy path + `</> Edit` and `Note to Agent`.
- **Dashboard:** Mission line + Needs attention bar (auto-collapsed when `>3` items or in DAG mode) + Child units grid + fluid auto-height Area cards or interactive `312×216` DAG canvas.
- **Active work view:** Structured cards for active streams (filtering out `done`/`completed`/`archived`/`cancelled` stages) with status badge, objective, current state bullets, linked spec pills, task counts, and `Open`.
- **Document view & Changes drawer:** Editorial reading surface with themed status metadata pills, `marked.js` rendering, plain-Markdown `</> Edit`, `Referenced by` backlinks, and deduplicated unified-diff handoff.
