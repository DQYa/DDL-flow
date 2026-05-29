# DDL Flow UI Generation Memory

Use this memory when generating, extending, or refactoring UI for DDL Flow or a similar deadline/task planning product.

## Product Shape

- App type: focused DDL/task planning workspace with AI-assisted task parsing, project grouping, deadline timeline, calendar navigation, and mobile task capture.
- UX tone: clean, calm, efficient, slightly premium. It should feel like a daily productivity cockpit rather than a marketing page.
- Primary user goal: quickly see what is due, understand urgency, paste natural-language notices into AI parsing, and jump between day tasks, projects, and timeline.

## Visual System

- Keep the existing soft glass UI language:
  - App background uses a very light blue-gray base with subtle radial highlights.
  - Panels use translucent white, blur, thin white borders, and soft shadow.
  - Prefer `ui-panel`, `ui-field`, `ui-chip`, and `ui-chip-selected` patterns before inventing new surface styles.
- Core colors:
  - Background: `#F5F7FB`
  - Card/panel: white or translucent white
  - Primary blue: `#3577F0`
  - Primary dark: `#1D5FD0`
  - Success green: `#16A34A`
  - Warning yellow: `#D9A514`
  - Danger red: `#E05252`
  - Text: `#172033`
  - Secondary text: `#647084`
  - Muted text: `#9AA5B5`
- Use blue as the action and selection color. Use green/yellow/red only for status, priority, and feedback.
- Keep shadows soft and layered, not harsh. Hover cards can lift by `translateY(-1px/-2px)` with stronger shadow.
- Border radius in this project is intentionally generous:
  - Main panels/cards: about `18px-20px`
  - Buttons/fields: about `14px-16px`
  - Pills/chips/FAB: `999px`
- Typography should be dense and readable:
  - Avoid hero-scale type inside the app.
  - Use compact headings around `14px-25px` depending on hierarchy.
  - Keep letter spacing at `0` unless matching an existing local rule.

## Desktop Layout

- Desktop shell is a full viewport app with no body scroll:
  - `h-screen`, `overflow-hidden`
  - Fixed-height header around `56px`
  - Main area is a two-column grid with tight gaps and padding.
- Main grid:
  - Left column: `minmax(260px, 22%)`
  - Right column: remaining width
  - Gap/padding: compact, around `8px`
- Left column split vertically:
  - Top half: calendar module
  - Bottom half: AI parsing input module
  - Both use `flex-1 min-h-0` so panels fit the viewport.
- Right column:
  - Top half: selected day tasks or project detail, scrollable inside a `ui-panel`.
  - Bottom half: timeline area plus optional horizontal project card strip.
- Keep desktop density high:
  - Avoid landing-page sections, oversized empty states, or big decorative hero layouts.
  - Prefer visible task data, calendar, timeline, project progress, and direct actions.
- For horizontal project/task strips:
  - Use fixed-width compact cards, `overflow-x-auto`, and truncation.
  - Include category chips, progress bars, nearest urgency color, and concise stats.

## Mobile Layout

- Mobile is a separate app view displayed below `768px`; desktop shell is hidden.
- Mobile page scrolls vertically and uses safe-area-aware spacing:
  - `.mobile-app` has top padding for fixed header and bottom padding for FAB/sheets.
- Mobile header:
  - Fixed at top, translucent/glass, height around `64px`.
  - Contains app name, email/count summary, API status, and account button.
- Mobile navigation:
  - Sticky horizontal tabs below header.
  - Tabs are pill buttons with ellipsis for long project names.
  - Include at least Today, All, and project tabs.
- Mobile task list:
  - Vertical card stack with `14px` gap.
  - Cards are translucent white, rounded around `20px`, min height around `132px`.
  - Each card shows title, priority pill, deadline/relative time, category/project/location/status tags.
  - Completed cards reduce opacity and strike title.
- Mobile create/detail/account flows:
  - Use bottom sheets, not centered desktop modals.
  - Sheet has a handle, rounded top corners around `30px`, max height around `85vh`, internal scroll.
  - Use spring-style entrance via Framer Motion when possible.
- Mobile FAB:
  - Fixed bottom-right, `58px` circular, primary blue, large plus.

## Interaction Patterns

- Use Framer Motion for lightweight tap/hover/sheet transitions:
  - Card tap: scale around `0.985`
  - Button active: scale around `0.96-0.98`
  - Bottom sheet: animate from `y: 100%` to `0`
- Keep interactions direct:
  - Calendar date selection switches central view to day tasks.
  - Project click switches central view to project detail.
  - AI parse opens confirmation/create modal.
  - Mobile task click opens detail sheet.
- AI API status should be visible:
  - Configured state uses primary blue.
  - Missing state uses red/orange warning dot and fallback warning copy.

## Component Rules

- Prefer editing or extending existing components:
  - `App.tsx` for desktop shell composition
  - `MobileAppView.tsx` for mobile-only UX
  - `AIBottomBar.tsx` for AI parsing entry
  - `CalendarModule.tsx`, `TimelineModule.tsx`, `DayTasksView.tsx`, `ProjectDetailView.tsx` for core workspace surfaces
  - modal components for create/detail/edit/settings flows
- Preserve `min-h-0`, `overflow-hidden`, and internal scroll containers in desktop panes. Removing these usually causes viewport overflow.
- Use `overflow-wrap: anywhere`, truncation, or max widths for task titles, emails, project names, categories, and locations.
- Form fields should use translucent backgrounds, rounded corners, focus rings, and `font-size: 16px` on mobile to avoid iOS zoom.
- Feedback messages:
  - Success: green-tinted panel
  - Error: red-tinted panel
  - Warning/fallback: orange/yellow-tinted panel

## Responsive Rules

- Breakpoint: `max-width: 768px`.
- Desktop:
  - No document scrolling.
  - Individual panels own their scroll.
  - Use compact grids/flex panes that fit one viewport.
- Mobile:
  - Document scroll enabled.
  - Desktop shell hidden.
  - Mobile-specific headers, tabs, cards, FAB, and bottom sheets shown.
- Always verify long Chinese text, emails, and task names do not overflow cards/buttons.

## Implementation Preferences

- Styling is mostly Tailwind utility classes plus `src/index.css` design tokens and global component classes.
- Add reusable CSS classes when a visual pattern repeats across mobile/desktop.
- Keep business logic separate from visual polish. Do not refactor storage/auth/AI parsing when only changing layout.
- Do not add a landing page. The first screen should remain the usable DDL workspace.
- Avoid one-note purple/blue gradient dominance. Gradients can appear in create modal accents or action buttons, but the overall app should remain light blue-gray/white with semantic accents.
- If future UI generation creates a similar productivity app, start from:
  - full-viewport desktop workspace
  - dense two-column dashboard
  - mobile-first card list plus bottom sheets
  - glass panels, compact typography, high data visibility
  - AI input as a persistent, obvious capture surface

## Known Caveat

- Some existing Chinese UI strings appear mojibake/garbled in source files. When touching visible copy, preserve intent and consider fixing encoding/copy carefully in the touched area only.
