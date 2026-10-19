# Material UI migration

## Contract

Replace general-purpose shadcn/Radix/Base UI controls with Material UI while
preserving the current working tree's behavior, layout, theme presets, fonts,
preferences and persistence. The starting point is the user's uncommitted UI,
not the older MUI implementation in HEAD. Keep G6, React Flow, Recharts and
specialized drag/resize behavior where appropriate.

## Baseline (2026-10-15)

- `npm run typecheck`: passed.
- `npm run build:embed`: passed.
- `npx playwright test migration.spec.ts --project=rsbuild --reporter=line`: passed.
- Source backup: `%TEMP%/liora-before-mui-20261015-215257.zip`.
- Baseline screenshots: `%TEMP%/liora-mui-visual-baseline`.
- Existing `mui-*.spec.ts` suites target the older UI. Keep their behavioral
  assertions but reconcile selectors with the actual current UI before using
  them to claim regression coverage.

## Required coverage

- Inputs: validation, labels, refs, focus, numeric/file input, multiline growth,
  IME composition, send shortcuts, disabled/read-only state.
- Layered UI: select/menu/popover inside dialog/drawer; outside click closes
  only the top layer; Escape, focus return, scroll lock, nested confirmation.
- Lists: sorting, filtering, pagination, selection/indeterminate state,
  bulk actions, expansion, drag/reorder, responsive columns.
- Navigation: deep links, sidebar collapse/mobile drawer, search keyboard
  shortcuts, tab activation and lazy content.
- Preferences: light/dark/system, all four presets, fonts, content width,
  navbar style, sidebar variants and collapse settings, reload persistence.
- Business: authentication, settings saves, model/agent/tool editors, task
  controls, approvals, evidence/report views, chats and SSE.
- Validate production embed and development proxy; check runtime errors,
  desktop/mobile overflow, screenshots and dependency/import inventory.

## Progress

- [x] Record and verify the current baseline.
- [ ] Material UI provider and theme integration.
- [ ] General controls and layout surfaces.
- [ ] Dialogs, drawers, selects, menus, tooltips and command search.
- [ ] Sidebar, tabs, combinational controls and notification system.
- [ ] Remove replaced runtime dependencies and old configuration.
- [ ] Type checking, production build, unit and browser regression suites.
- [ ] Visual and interaction audit against the baseline.

Completion requires every item above; intermediate builds are not completion.
