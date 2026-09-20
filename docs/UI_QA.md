# ScholarPortal Responsive UI & Color QA

## Responsive behavior

The application shell and admin area are designed mobile-first and use Tailwind breakpoints consistently.

- **320–639 px (phones):** full desktop navigation is hidden; authenticated navigation opens as a drawer; brand/account controls remain compact; admin resource navigation becomes a horizontal scroller; admin data tables become stacked cards; forms use one column; modal editors are viewport constrained.
- **640–767 px (large phones/small tablets):** controls can wrap naturally; two-column layouts begin only where the content remains readable.
- **768–1023 px (tablets):** public top navigation is available; admin records use scroll-safe tables; core content grids expand without fixed widths.
- **1024–1279 px (desktop):** authenticated sidebar is persistent; multi-column application/profile layouts activate.
- **1280 px and above:** admin navigation becomes sticky at the left and high-density dashboard layouts use the available width.

Global horizontal page overflow is disabled. Wide tables/Kanban-style content own their horizontal scroll region instead of widening the document.

## Visual system

ScholarPortal uses a restrained semantic palette:

| Role | Light | Dark | Usage |
| --- | --- | --- | --- |
| Primary | `#4f46e5` | `#818cf8` | Main actions, active navigation, links |
| Primary hover | `#4338ca` | `#a5b4fc` | Action hover/focus |
| Accent | `#0e7490` | `#22d3ee` | Secondary emphasis, intelligence/automation |
| Success | `#047857` | `#34d399` | Verified/success states |
| Warning | `#b45309` | `#fbbf24` | Review/attention states |
| Danger | `#be123c` | `#fb7185` | Destructive/error states |
| Text | `#0f172a` | `#f8fafc` | Primary copy |
| Muted | `#64748b` | `#94a3b8` | Secondary copy |

Representative foreground/background contrast ratios checked during the audit:

- Indigo primary on white: **6.29:1**
- Indigo hover on white: **7.90:1**
- Cyan accent on white: **5.36:1**
- Emerald success on white: **5.48:1**
- Amber warning on white: **5.02:1**
- Rose danger on white: **6.29:1**
- Slate body text on white: **17.85:1**
- Slate muted text on white: **4.76:1**
- Dark-mode indigo on slate-900: **5.98:1**
- Dark-mode cyan on slate-900: **9.88:1**

These representative pairs meet WCAG AA's 4.5:1 normal-text threshold. Component-specific combinations must still preserve these semantic roles when future screens are added.

## Runtime QA note

Source-level responsive and syntax checks pass for the delivered implementation, including the narrow counselor-invitation card and admin card/table split. A final rendered browser matrix must still be run after `npm ci` on the deployment/CI platform because the packaging environment could not fetch the platform-correct Vite/Oxlint native dependencies. Use tests T86–T93 in `docs/TESTING.md`.
