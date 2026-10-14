
---
name: ui-component-builder
description: Use for anything users see: React Native components, Expo Router screens, styling, and design-system work.
---

# UI Component Builder

## Trigger
Any visible UI: components, screens, layout, styling, typography, icons, status/flag rendering, or design-system tokens.

## Required checks
1. Read `AGENTS.md` and the PRD sections/FRs for the screen or interaction.
2. Confirm current phase and gates before feature code. Do not create MVP-B or Phase 2/3 screens or placeholders in MVP-A.
3. Use React Native with Expo and TypeScript, Expo Router, and TanStack Query for server data. Do not add Redux or another global store.
4. Keep colors, spacing, and type sizes in `apps/mobile/src/theme.ts`; do not scatter inline styles. Give every interactive element an accessibility label.
5. Mobile talks only to the Rota API plus approved PostHog events; never call payment, email, or SMS providers from the app.

## Semantic-token discipline
- Use semantic design tokens for meaning (for example, foreground/background, surface, border, focus, success, warning, danger, and muted states) rather than raw palette values at component call sites.
- Keep token definitions centralized in `theme.ts` and use named semantic references consistently.
- If a needed semantic token is missing, do not use an inline color or silently invent a one-off value. Follow this gap-filling procedure:
  1. Search `theme.ts` and existing components for an equivalent token.
  2. Check the PRD and existing design conventions for intended meaning and contrast.
  3. If no equivalent exists, propose the token name, intended semantic meaning, light/dark values if the project supports both, and contrast/accessibility rationale.
  4. Ask for approval before adding it. After approval, add it centrally and test all affected states.
- Do not add a design-system dependency unless no locked tool covers the need; report any new dependency.

## Visible flags and status
- A status/flag must be visibly rendered and understandable to assistive technology. Never communicate status by color alone.
- Pair color with a text label and, where useful, an icon/shape; expose an accessibility label or role/announcement appropriate to the component.
- Apply this to draft shifts, unacknowledged changes, conflict warnings, uncovered shifts, and other explicitly specified statuses. Do not invent new statuses.

## 360px accessibility floor
- Layouts must remain usable at a 360 CSS-pixel/device-width viewport without horizontal scrolling for core tasks.
- Support text scaling, readable contrast, accessible touch targets, meaningful focus/reading order, and labels for interactive controls.
- Test the narrowest required layout at 360px and exercise long names, warning text, and status labels. Do not hide required information to make the layout fit.
- The 360px floor is a user-requested skill requirement; the supplied PRD/AGENTS do not specify this exact width.

## Tests and completion
Use Jest with `jest-expo` for mobile tests. Test semantic states and accessibility labels, not just snapshots. Run `npx expo export` and the required `npm run check` commands; report actual results. Follow the AGENTS.md task report and do not claim unrun checks passed.
