# IBM design source

Use this reference only when modifying or auditing the visual language in `templates/ibm-carbon.css` or the design rule in `SKILL.md`. Normal rendering does not need it.

Source: https://github.com/VoltAgent/awesome-design-md/tree/main/design-md/ibm
Inspected commit: `ce17d6c67e43c4dbb19f9b4f9a775a1d004bed75` (2026-05-27)
License: MIT, Copyright (c) 2026 VoltAgent. The repository license requires the copyright and permission notice in substantial copies.

## Contract

The local reader design is a document-reading adaptation of the IBM design-md source, not a marketing-page clone.

| Token | Source value | Local rule |
|---|---|---|
| Primary accent | `#0f62fe` | `--brh-accent`; links, focus, target marks, generated-note rails. |
| Active blue | `#0043ce` | `--brh-accent-active`; hover/active link state. |
| Ink | `#161616` | `--brh-ink`, `--brh-body`, strong hairline. |
| Muted ink | `#525252` | `--brh-muted`; captions, rails, provenance. |
| Subtle ink | `#8c8c8c` | `--brh-muted-soft`; status text. |
| Canvas | `#ffffff` | page/article surface. |
| Surface 1 | `#f4f4f4` | page ground, inputs/code/table header/asset cards. |
| Hairline | `#e0e0e0` | borders and dividers. |
| Warning | `#f1c21b` | warning rail only. |
| Typography | IBM Plex Sans | primary family with Helvetica Neue, Arial, system fallbacks. |
| Body | 16px, 400, 1.50, 0.16px | keep close to source; avoid heavy tracking. |
| Display | weight 300 | `h1` and drop-cap treatments. |
| Geometry | square, 0px default | no rounded cards/buttons/containers. |
| Depth | no shadows | use surface changes and 1px hairlines. |
| Color discipline | one blue accent | do not add decorative colors; semantic colors only when the CSS actually renders status UI. |

## Adaptations

- The source describes IBM marketing pages. This skill renders long documents, papers, notes, and reports. Reading measure, rails, print behavior, source-boundary markers, and canonical/noncanonical states are local requirements.
- Do not introduce marketing chrome such as utility bars, top navigation, logo marquees, CTA banners, or dark footers unless a source document itself requires that structure.
- Keep source fidelity above aesthetic mimicry. The design source never authorizes rewriting canonical text, inventing captions, or hiding extraction uncertainty.

## Drift checks

Before changing the design language, verify:

- IBM Blue remains the only chromatic accent except real semantic status.
- Corners remain square and shadows absent.
- Display type remains light, not bold.
- Body copy keeps IBM Plex Sans and Carbon-like tracking.
- Surfaces remain white / `#f4f4f4` / charcoal with 1px hairlines.
- Any new component serves reading or auditability, not decoration.
