# DDL Flow Claude Code Memory

Use this project memory when working on DDL Flow UI, layout, styling, and similar generated task-planning apps.

Primary detailed memory:

- `.agents/memories/ui-layout-generation-memory.md`

## UI Generation Summary

- DDL Flow is a focused DDL/task planning workspace with AI-assisted task parsing, project grouping, deadline timeline, calendar navigation, and mobile task capture.
- Keep the UX calm, clean, efficient, and slightly premium. It should feel like a productivity cockpit, not a marketing page.
- Preserve the soft glass visual system: light blue-gray background, translucent white panels, blur, thin white borders, soft shadows, and semantic status colors.
- Prefer existing shared styles before adding new ones: `ui-panel`, `ui-field`, `ui-chip`, `ui-chip-selected`, and the CSS tokens in `src/index.css`.
- Use primary blue `#3577F0` for actions and selections. Use green/yellow/red for success, warning/medium urgency, and danger/high urgency.

## Desktop Layout

- Desktop is a full-viewport app with no body scroll.
- Keep the fixed header around `56px`.
- Main workspace uses a compact two-column grid:
  - Left column: `minmax(260px, 22%)`
  - Right column: remaining width
  - Tight gap/padding around `8px`
- Left column is vertically split:
  - Top half: calendar
  - Bottom half: AI parsing input
- Right column:
  - Top half: day tasks or project detail in a scrollable `ui-panel`
  - Bottom half: timeline plus optional horizontal project cards
- Preserve `min-h-0`, `overflow-hidden`, and internal scroll containers in desktop panes.

## Mobile Layout

- Mobile view is separate below `768px`; hide desktop shell and show `.mobile-app`.
- Use a fixed translucent header, sticky horizontal tabs, vertical task cards, bottom sheets, and a bottom-right primary FAB.
- Mobile task cards should show title, priority, deadline/relative time, category/project/location/status tags.
- Mobile modals should generally be bottom sheets with a handle, rounded top corners, max height around `85vh`, internal scroll, and Framer Motion entrance.
- Use `font-size: 16px` on mobile inputs/buttons to avoid mobile browser zoom.

## Interaction And Implementation

- Use Framer Motion for lightweight hover/tap/sheet transitions.
- AI API status should remain visible in both desktop and mobile.
- Avoid landing pages, oversized hero sections, and decorative-only layouts. The first screen should stay the usable DDL workspace.
- Keep business logic separate from UI polish. Do not refactor auth, storage, or AI parsing when only changing layout.
- Watch for long Chinese text, emails, project names, and task titles. Use truncation, max widths, or `overflow-wrap: anywhere`.
- Some existing Chinese strings appear mojibake/garbled in source files. When editing visible copy, preserve intent and only fix encoding/copy carefully in the touched area.
