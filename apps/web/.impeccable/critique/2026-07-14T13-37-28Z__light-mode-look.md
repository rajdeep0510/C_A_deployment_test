---
target: light mode look
total_score: 24
p0_count: 2
p1_count: 2
timestamp: 2026-07-14T13-37-28Z
slug: light-mode-look
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 2 | Active nav uses accent as text — signal exists but is illegible in light mode at ~2.3:1 contrast |
| 2 | Match System / Real World | 3 | Role labels clear; king symbol shared by Coach and Admin is a semantic mismatch |
| 3 | User Control and Freedom | 3 | Settings close button is 28px, below 44px touch target; theme toggle lacks text label |
| 4 | Consistency and Standards | 1 | Role colors hardcoded hex vs token system; interactive buttons white-on-white across header |
| 5 | Error Prevention | 3 | Solid; no light-mode regressions introduced |
| 6 | Recognition Rather Than Recall | 3 | Icons labelled; settings gear tooltip-only on desktop |
| 7 | Flexibility and Efficiency | 3 | Keyboard nav works; focus outline uses accent which fails contrast in light mode |
| 8 | Aesthetic and Minimalist Design | 1 | Light mode is sterile rather than minimal — flat, invisible elevation, no shadows |
| 9 | Error Recovery | 3 | Not substantially affected by theme |
| 10 | Help and Documentation | 2 | Theme toggle unlabelled on desktop; engine value badges illegible |
| **Total** | | **24/40** | **Acceptable — significant gaps before light mode can be primary experience** |

## Anti-Patterns Verdict
- AI slop: Generic dark-to-light Tailwind conversion. No chess/coaching personality.
- Detector (4 findings): side-stripe left border in MistakeCard.tsx:72 (absolute ban); layout-transition width in PuzzleRush.tsx:389 and TimedPuzzleBoard.tsx:109; overused-font Inter.
- Manual: globals.css:277-279 .input-field:focus uses rgba(255,255,255,...) with no light-mode guard — broken invisible focus ring in light mode.

## Priority Issues

**[P0] Accent color as foreground text fails WCAG AA everywhere in light mode**
All text uses of var(--accent-color): .nav-link.active, .bottom-nav-tab.active, .profile-role-badge, .engine-setting-value, .puzzle-mobile-tab.active. ~2.3-2.5:1 on light surfaces.
Fix: Introduce --accent-text token: #1dc189 in dark, #0d7a56 in light (~5.2:1 on white). Apply to all text-color uses of the accent.
Command: /impeccable colorize

**[P0] Role/academy badge colors in CoachHeader.tsx hardcoded, fail in light mode**
#6366f1 and #f59e0b on their own 0.09-opacity tint over white. Amber is ~2.1:1.
Fix: Use useTheme() to select dark/light text color per role, or CSS class overrides.
Command: /impeccable colorize

**[P1] .input-field:focus focus ring invisible in light mode**
globals.css:277-279: border rgba(255,255,255,0.52) and box-shadow rgba(255,255,255,0.1) — no light-mode guard. Confirmed by both assessments.
Fix: [data-theme="light"] .input-field:focus { border-color: var(--accent-color); box-shadow: 0 0 0 3px rgba(29,193,137,0.2); }
Command: /impeccable audit

**[P1] Header interactive elements (theme toggle, logout, settings) white-on-white**
All use background: var(--surface-1) = #ffffff inside a #ffffff header.
Fix: [data-theme="light"] overrides to background: var(--surface-2) on .theme-toggle, .btn-logout, .hamburger-btn.
Command: /impeccable adapt

**[P2] Card/component elevation imperceptible — needs shadows in light mode**
Tonal stack #f1f5f9 → #ffffff is only 6 lightness points. Body grid at rgba(0,0,0,0.03) is invisible.
Fix: box-shadow: 0 1px 3px rgba(0,0,0,0.07) on cards/header/drawer in light mode. Increase grid to rgba(0,0,0,0.06).
Command: /impeccable polish

**[P3] MistakeCard.tsx:72 side-stripe 4px left border — absolute ban**
Fix: Full border or tinted background.
Command: /impeccable polish

## Persona Red Flags
- Alex: Active nav at ~2.3:1, engine value badge unreadable, role badge at ~2.3:1
- Sam: No visible focus ring on inputs, theme toggle invisible, rgba tints collapse in High Contrast mode, ::selection unguarded

## Minor Observations
- ::selection needs [data-theme="light"] override
- body grid rgba-white values have no [data-theme="dark"] guard (relies on light override replacing background shorthand)
