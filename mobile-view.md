# Chess Advisor — Mobile View Plan

This document defines the complete design system and per-page mobile layout plan for the Chess Advisor platform. All breakpoints, tokens, and layout decisions are described here before a single line of responsive CSS is written.

---

## 1. Design System

### 1.1 Breakpoints

| Name     | Token         | Width      | Target device               |
|----------|---------------|------------|-----------------------------|
| `xs`     | `--bp-xs`     | `< 375px`  | Small phones (SE, Galaxy A) |
| `sm`     | `--bp-sm`     | `375px`    | Standard phones             |
| `md`     | `--bp-md`     | `640px`    | Large phones / small tablet |
| `lg`     | `--bp-lg`     | `768px`    | Tablet portrait             |
| `xl`     | `--bp-xl`     | `1024px`   | Tablet landscape / desktop  |
| `2xl`    | `--bp-2xl`    | `1280px`   | Wide desktop                |

Mobile-first: base styles target `< 640px`. Use `min-width` media queries to progressively enhance for larger screens.

---

### 1.2 Color Tokens

All tokens already exist in `globals.css`. No new color values are introduced — mobile views use the same semantic tokens.

#### Dark theme (default)
```
--bg-color:         #050505
--text-primary:     #f7f7f7
--text-secondary:   #a1a1aa
--accent-color:     #1dc189   (teal green — interactive elements)
--accent-hover:     #15a373
--success:          #10b981
--danger:           #ef4444
--warning:          #f59e0b
--glass-bg:         rgba(255,255,255,0.045)
--glass-border:     rgba(255,255,255,0.12)
--glass-shadow:     0 4px 30px rgba(0,0,0,0.6)
--surface-1:        rgba(255,255,255,0.045)
--surface-2:        rgba(255,255,255,0.08)
--border-subtle:    rgba(255,255,255,0.08)
--border-medium:    rgba(255,255,255,0.15)
--input-bg:         rgba(255,255,255,0.055)
```

#### Light theme (`[data-theme="light"]`)
```
--bg-color:         #f1f5f9
--text-primary:     #0f172a
--text-secondary:   #475569
--glass-bg:         rgba(255,255,255,0.7)
--glass-border:     rgba(0,0,0,0.08)
--card-bg:          rgba(255,255,255,0.9)
--input-bg:         rgba(255,255,255,0.9)
```

#### Move-quality badge colors (used across analysis pages)
```
Brilliant  (#48cae4)   !!
Great      (#90be6d)   !
Best       (#1dc189)   ✓
Excellent  (#52b788)   –
Good       (#a8dadc)   –
Book       (#8ecae6)   –
Inaccuracy (#f59e0b)   ?
Mistake    (#f4845f)   ??
Blunder    (#ef4444)   ???
Miss       (#e63946)   –
```

---

### 1.3 Typography

Fonts: **Inter** (body) and **Space Grotesk** (headings, numbers, brand).

| Role              | Family         | Weight | Mobile size | Desktop size |
|-------------------|----------------|--------|-------------|--------------|
| Brand / Logo      | Space Grotesk  | 700    | 1rem        | 1.12rem      |
| Hero title        | Space Grotesk  | 800    | 2.2rem      | clamp(2.8–5rem) |
| Section title     | Space Grotesk  | 800    | 1.6rem      | clamp(1.8–2.8rem) |
| Card title        | Space Grotesk  | 700    | 1rem        | 1rem         |
| Body default      | Inter          | 400    | 0.9rem      | 1rem         |
| Body small        | Inter          | 400    | 0.8rem      | 0.84rem      |
| Label / tag       | Inter          | 600–700| 0.7rem      | 0.72rem      |
| Stat number       | Space Grotesk  | 800    | 1.6rem      | 1.9–2.8rem   |
| Button            | Inter          | 600    | 0.875rem    | 0.85–0.92rem |
| Input             | Inter          | 400    | 1rem        | 15px         |
| Monospace (moves) | Courier New    | 800    | 0.85rem     | 0.9rem       |

Line height: `1.5` for body, `1.08–1.1` for hero/display headings, `1.65–1.7` for descriptive paragraphs.

---

### 1.4 Spacing Scale

Mobile uses a tighter scale. The base unit is 4px.

| Token           | Value  | Usage                              |
|-----------------|--------|------------------------------------|
| `--space-1`     | 4px    | Icon gaps, tight inline spacing    |
| `--space-2`     | 8px    | Badge padding, small gaps          |
| `--space-3`     | 12px   | Card inner gaps, list spacing      |
| `--space-4`     | 16px   | Standard padding, input padding    |
| `--space-5`     | 20px   | Section sub-gaps                   |
| `--space-6`     | 24px   | Card padding (mobile)              |
| `--space-8`     | 32px   | Section padding (mobile)           |
| `--space-10`    | 40px   | Section padding (tablet)           |
| `--space-12`    | 48px   | Container horizontal padding (desktop) |
| `--space-16`    | 64px   | Section vertical padding (desktop) |
| `--space-24`    | 96px   | Hero padding top (desktop)         |

Mobile `.container`: `padding: 0 16px` (vs desktop `0 48px`).
Mobile `.glass-card`: `padding: 16px` (vs desktop `24px`).
Mobile `.page-wrapper`: `padding-top: 64px` (header height shrinks on mobile).

---

### 1.5 Border Radius

Unchanged from globals — same tokens apply on mobile:

```
--radius-sm:  8px   (inputs, small chips, rows)
--radius-md:  12px  (cards, modals)
--radius-lg:  20px  (glass panels, large surfaces)
```

Pills (tags, badges): `border-radius: 99px`.

---

### 1.6 Elevation / Shadow

```
Level 0 (flat):    none
Level 1 (card):    0 2px 12px rgba(0,0,0,0.3)   — glass-card default
Level 2 (raised):  0 8px 28px rgba(0,0,0,0.4)   — hovered card
Level 3 (modal):   0 24px 64px rgba(0,0,0,0.6)  — overlays
Level 4 (nav):     0 1px 0 rgba(255,255,255,0.04) — header border-shadow
```

Backdrop blur stays at `blur(12px)` on all glass surfaces. On mobile, if the blur causes GPU jank, degrade to `blur(8px)`.

---

### 1.7 Motion / Animation

```
--transition:         all 0.3s cubic-bezier(0.4, 0, 0.2, 1)
--spring:             all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)
--fade-in:            fadeIn 0.5s ease-out forwards
--fade-in-fast:       fadeIn 0.25s ease-out forwards
```

On mobile, floating card animations (`boardFloat`, `float1/2/3`) are **disabled** (performance). Hover `translateY` states are not shown on touch — remove `transform` from `:hover` and add `:active` micro-press instead (`transform: scale(0.97)`).

---

### 1.8 Core Component Tokens

#### Header (mobile)
- Height: `60px` (desktop: `70px`)
- Contains: brand logo + name (left), hamburger icon (right)
- Nav links hidden; revealed via slide-in drawer
- Theme toggle moves inside drawer

#### Bottom Navigation Bar (NEW — mobile only)
- Height: `60px`, fixed to bottom, `z-index: 200`
- Safe-area padding: `padding-bottom: env(safe-area-inset-bottom)`
- Background: same as navbar (`rgba(5,5,5,0.88)` + `backdrop-filter: blur(18px)`)
- Border top: `1px solid rgba(255,255,255,0.08)`
- 4–5 icon tabs depending on role

#### Button sizes on mobile
```
btn-full:   width: 100%, padding: 13px 20px, font-size: 0.9rem
btn-normal: padding: 11px 20px, font-size: 0.875rem
btn-sm:     padding: 8px 14px,  font-size: 0.8rem
```
All buttons get minimum touch target of `44px` height.

#### Input fields on mobile
- `font-size: 1rem` (prevents iOS auto-zoom on focus — never go below 16px)
- `padding: 14px 16px`
- Icon prefix: `padding-left: 42px`

#### Cards on mobile
- `padding: 16px`
- `border-radius: 12px`
- No `hover` transform (touch devices)
- Active press: `transform: scale(0.99)`, `transition: 0.1s`

#### Tables on mobile
- Wrap in `overflow-x: auto; -webkit-overflow-scrolling: touch`
- Show horizontal scroll hint (gradient fade on right edge)
- Minimum column width enforced to prevent squishing

#### Modals on mobile
- Full-screen (`position: fixed; inset: 0`)
- Slide up from bottom with `transform: translateY` animation
- Top-right close button (`44×44px` tap target)
- Content scrollable inside modal body

#### Charts on mobile
- Recharts `ResponsiveContainer` with `width="100%"` already used
- Reduce font sizes on axes: `fontSize={10}`
- Pie charts: hide legend labels, show only on tap tooltip
- Radar charts: reduce `outerRadius` to `80px` on `< 400px` screens
- Bar charts: rotate X-axis labels 45° if more than 6 bars

---

### 1.9 Z-Index Scale

```
z-base:         0    (normal document flow)
z-raised:       10   (floating cards in hero)
z-sticky:       100  (sticky section headers)
z-header:       500  (top nav bar)
z-bottom-nav:   200  (bottom nav bar)
z-drawer:       600  (hamburger drawer overlay)
z-modal:        700  (full-screen modals)
z-tooltip:      800  (tooltips)
z-toast:        900  (notifications)
```

---

### 1.10 Iconography

Library: **Lucide React** (already in use). Size guide:
- Nav icons: `20px`
- Card icons: `18px`
- Button icons: `16px`
- Status indicators: `14px`

---

## 2. Navigation Architecture (Mobile)

### 2.1 Public / Unauthenticated (Landing, Login, Register)

**Top bar**: Logo + hamburger (≤ 768px). No bottom nav.

**Hamburger Drawer** (slides in from right, `width: 280px`):
```
[Brand logo + name]
─────────────────
Features
Analytics
How It Works
Roles
─────────────────
[Login button — full width]
[Sign Up button — full width, outlined]
─────────────────
[Theme toggle]
```

### 2.2 Authenticated Player

**Header**: Logo + username avatar (top right), no nav links.

**Bottom Navigation Bar** (5 tabs):
```
[ Dashboard ]  [ Puzzles ]  [ Analysis ]  [ Report ]  [ More ]
    ⊞              ♟           📊           📄          ···
```
"More" tab opens a bottom sheet with: Training Plan, Batch Analysis, Settings, Logout.

### 2.3 Authenticated Coach

**Header**: Logo + coach avatar.

**Bottom Navigation Bar** (4 tabs):
```
[ Players ]  [ Roster ]  [ Games ]  [ More ]
    👥           📋          ♟          ···
```

### 2.4 Admin

**Header**: Logo + "Admin" badge + avatar.

**Bottom Navigation Bar** (4 tabs):
```
[ Academies ]  [ All ]  [ Coaches ]  [ Players ]
```

---

## 3. Page-by-Page Mobile Layout

---

### 3.1 Landing Page (`/`)

**Viewport**: `< 640px` (phone).

#### Navbar (fixed top, 60px)
- Left: `♟ KnightVision` brand
- Right: Hamburger icon (3-line, 24px)
- No nav links visible

#### Hero Section (full-screen, `min-height: 100vh`)
Column-stacked layout (reversal of desktop 2-column grid):

```
┌─────────────────────────────┐
│  [top: 60px header offset]  │
│                             │
│  ● CHESS AI ADVISOR (badge) │
│                             │
│  Elevate Your              │
│  Chess Game                │
│  (hero title, 2.2rem)      │
│                             │
│  [animated chessboard]      │
│  (max-width: 280px, center) │
│  Floating cards: HIDDEN     │
│                             │
│  Description text           │
│  (centered, 0.9rem)         │
│                             │
│  [Get Started →]  ← full w  │
│  [Watch Demo]     ← full w  │
│                             │
│  ┌──────┐  ┌──────┐         │
│  │ 12K+ │  │ 98%  │  2×2   │
│  │Games │  │Accur.│  stat  │
│  ├──────┤  ├──────┤  grid  │
│  │  5   │  │ 3    │        │
│  │Modes │  │Roles │        │
│  └──────┘  └──────┘         │
└─────────────────────────────┘
```

- Chessboard appears **above** text content (order: -1 → 0, text is order 1)
- Both CTA buttons are full-width, stacked vertically
- Stats grid: 2×2 (already coded for `< 576px`)
- Floating info cards (`floatingCardMove`, `floatingCardOpening`): hidden on mobile
- `floatingCardAccuracy`: hidden on `< 576px`

#### Numbers Bar
4-stat grid collapses to **2×2 grid** on mobile (already partially coded):
```
┌──────────┬──────────┐
│  50,000+ │  99.2%   │
│  Moves   │  Engine  │
├──────────┼──────────┤
│   12K+   │   24hrs  │
│  Games   │  Support │
└──────────┴──────────┘
```

#### Features Section (Bento Grid → Single column)
3-column bento grid collapses to 1-column stack:
```
┌─────────────────────────────┐
│ [FEATURES tag]              │
│ Everything you need to...   │
│                             │
│ ┌─────────────────────────┐ │
│ │ 🎯  Game Analysis       │ │
│ │ Track accuracy, blunders│ │
│ │ [tag][tag][tag]         │ │
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ ♟   Puzzle Training     │ │
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ 📊  Reports             │ │
│ └─────────────────────────┘ │
│ ... (all 6 cards stacked)   │
└─────────────────────────────┘
```
`bentoCardWide` (`grid-column: span 2`) resets to `span 1`.

#### Analytics Section
2-column grid → 1-column stack:
```
┌─────────────────────────────┐
│ [ANALYTICS tag centered]    │
│ Deep insights...            │
│                             │
│ ┌─────────────────────────┐ │
│ │ ACCURACY BREAKDOWN      │ │
│ │ Opening  ████████ 94%   │ │
│ │ Middle   ██████   78%   │ │
│ │ Endgame  ███████  84%   │ │
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ TIME MANAGEMENT         │ │
│ │ Fast    ██████    72%   │ │
│ │ Normal  █████████ 91%   │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

#### Move Classification Section
2-column grid → 1-column stack (left text first, then table):
```
┌─────────────────────────────┐
│ Understand Every Move       │
│ (title, 1.8rem)             │
│                             │
│ Description...              │
│ [Analyze My Games →]        │
│                             │
│ ┌─────────────────────────┐ │
│ │ ● Brilliant   !!        │ │
│ │ ● Great Move  !         │ │
│ │ ● Best Move   ✓         │ │
│ │ ● Excellent   –         │ │
│ │ ... (all rows)          │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

#### How It Works Section
3-column grid → 1-column stack:
```
[①] Connect Platform
[②] Analyze Games
[③] Improve
```
Each step card is full-width, centered, `padding: 24px`.

#### Roles Section
2-column grid → 1-column stack:
```
┌─── Player Card ────────────┐
│ 👤 Player                  │
│ Description...             │
│ • Feature one              │
│ • Feature two              │
└────────────────────────────┘
┌─── Coach Card ─────────────┐
│ 🎓 Coach                   │
└────────────────────────────┘
```

#### CTA Section
Text centered. Both buttons stack vertically, full-width.

#### Footer
5-column footer grid collapses to **1-column** on `< 576px`:
```
┌─────────────────────────────┐
│ ♟ KnightVision              │
│ tagline...                  │
│ ● All systems operational   │
├─────────────────────────────┤
│ PRODUCT  (collapsed list)   │
│ PLATFORM                    │
│ RESOURCES                   │
│ COMPANY                     │
├─────────────────────────────┤
│ © 2024  [tw][gh][dc]        │
└─────────────────────────────┘
```
Footer link groups: optionally collapsible accordion on mobile (tap heading to expand).

---

### 3.2 Login Page (`/login`)

No header nav on auth pages. Centered glass card fills viewport.

```
┌─────────────────────────────┐  ← full viewport
│                             │
│         ♟ Logo              │
│      KnightVision           │
│                             │
│  ┌───────────────────────┐  │
│  │  Welcome back         │  │
│  │  Sign in to continue  │  │
│  │                       │  │
│  │  [👤 Username/Email ] │  │
│  │  [🔒 Password      👁]│  │
│  │                       │  │
│  │  [error message]      │  │
│  │                       │  │
│  │  [Sign In ──────────] │  │  ← full width btn
│  │                       │  │
│  │  Don't have account?  │  │
│  │  [Register]           │  │
│  └───────────────────────┘  │
│                             │
└─────────────────────────────┘
```

- Card: `width: calc(100% - 32px)`, `max-width: 400px`, centered
- No change from desktop form structure — already narrow enough
- Input `font-size: 1rem` (16px) to prevent iOS zoom
- Button: full width

---

### 3.3 Register Page (`/register`)

Multi-tab registration. On mobile the tab pills for Player / Coach / Academy sit in a scrollable horizontal row.

```
┌─────────────────────────────┐
│         ♟ Logo              │
│                             │
│  ┌───────────────────────┐  │
│  │  Create Account       │  │
│  │                       │  │
│  │  [Player][Coach][Aca] │  │  ← pill tabs, scroll if needed
│  │                       │  │
│  │  — Player fields —    │  │
│  │  [👤 Username       ] │  │
│  │  [📧 Email          ] │  │
│  │  [🔒 Password       ] │  │
│  │  [🔒 Confirm Pass.  ] │  │
│  │                       │  │
│  │  (Coach tab adds:)    │  │
│  │  [Academy dropdown  ▼]│  │
│  │  or [No academy]      │  │
│  │                       │  │
│  │  [Create Account ───] │  │  ← full width
│  │                       │  │
│  │  Already have account?│  │
│  │  [Login]              │  │
│  └───────────────────────┘  │
└─────────────────────────────┘
```

- Custom dropdown for coach academy selector: render as a native-style full-screen picker sheet on mobile or standard dropdown
- Tab switching is instant (no animation needed)

---

### 3.4 Onboarding Page (`/onboarding`)

```
┌─────────────────────────────┐
│  ♟ KnightVision   [avatar]  │  ← minimal header
│                             │
│  ┌───────────────────────┐  │
│  │  🚀 Let's get started │  │
│  │                       │  │
│  │  Platform             │  │
│  │  [● Chess.com]        │  │
│  │  [  Lichess   ]       │  │
│  │                       │  │
│  │  Games to Analyze     │  │
│  │  [  50              ] │  │
│  │                       │  │
│  │  [Fetch & Analyze ──] │  │  ← full width, accent color
│  └───────────────────────┘  │
└─────────────────────────────┘
```

---

### 3.5 Pending Page (`/pending`)

Centered, minimal. Same structure on all screen sizes, just padding adjusts.

```
┌─────────────────────────────┐
│                             │
│         ⏳                  │
│   Awaiting Approval         │
│                             │
│   Hi [PlayerName],          │
│   Your account is pending.  │
│                             │
│   Coach: [CoachName]        │
│                             │
│   Your username:            │
│  ┌─────────────────────┐    │
│  │ @username           │    │
│  └─────────────────────┘    │
│                             │
│   [Check Status]  [Cancel]  │  ← side-by-side or stacked
└─────────────────────────────┘
```

---

### 3.6 Player Dashboard (`/dashboard`)

This is the most content-dense page. Strategy: collapse grids aggressively, use horizontal scrolling for stat groups.

#### Header (60px, fixed top)
```
[♟ Logo]              [@username 👤]
```

#### Page top area (below header)
```
┌─────────────────────────────┐
│  Dashboard                  │
│  [▲ Rising] momentum badge  │
│                   [Batch →] │
└─────────────────────────────┘
```

#### Time Control Stats
Desktop: 4-column grid of glass-cards per time control, each expandable.
Mobile: Horizontal scroll row of compact stat chips:
```
┌──────────────────────────────────────────────→ scroll
│  [Blitz: 1842 ▴] [Rapid: 1756 ▾] [Bullet: 1921 ▴] ...
└─────────────────────────────────────────────────────
```
Tapping a chip expands a bottom sheet with the full glass-card stats for that time control:
```
┌─── Bottom Sheet ─────────────┐
│  Blitz Stats  [✕]            │
│                              │
│  Accuracy       78%          │
│  Win Rate       62%          │
│  Games         124           │
│  Blunder Rate  1.2 / game    │
│                              │
│  [Win] [Draw] [Loss]         │
│   62%   18%    20%           │
└──────────────────────────────┘
```

#### Win Rate by Color
Desktop: 2-column grid.
Mobile: 1-column stack:
```
┌─────────────────────────────┐
│  ⬜ As White                │
│  Win 65% · Draw 18% · L 17% │
│  ████████████░░░░░░         │
└─────────────────────────────┘
┌─────────────────────────────┐
│  ⬛ As Black                │
│  Win 55% · Draw 22% · L 23% │
└─────────────────────────────┘
```

#### Recent Games
Desktop: grid of GameCards, collapsible fetch panel.
Mobile: Fetch panel is a compact row:
```
┌─────────────────────────────┐
│  Recent Games               │
│  [Fetch more games ▼]       │
└─────────────────────────────┘
```
When expanded, fetch options appear inline (platform, count). Game cards stack in 1-column:
```
┌─────────────────────────────┐
│  vs. Magnus2000  ● Win      │
│  Sicilian Defense  •  Blitz │
│  Acc: 92%   2024-01-15      │
│  [View Analysis →]          │
└─────────────────────────────┘
┌─────────────────────────────┐
│  vs. Bobby1972   ● Loss     │
│  ...                        │
└─────────────────────────────┘
```

#### Bottom Navigation
`[ Dashboard ]  [ Puzzles ]  [ Analysis ]  [ Report ]  [ ··· ]`

---

### 3.7 Game Analysis Page (`/analysis/[filename]`)

The most complex page. Desktop has a wide chessboard + side panels. Mobile must stack everything.

#### Layout order (top to bottom on mobile):
```
┌─────────────────────────────┐
│  [← Back]  Game Analysis   │  ← header with back button
└─────────────────────────────┘

┌─────────────────────────────┐
│  [Black player + material]  │
│  ┌─────────────────────────┐│
│  │                         ││
│  │     CHESSBOARD          ││  ← full width, aspect-ratio: 1
│  │     (100% container)    ││
│  │                         ││
│  └─────────────────────────┘│
│  [White player + material]  │
│                             │
│  [← Prev]  e4 (move 12)  [Next →]  │  ← move controls
└─────────────────────────────┘

┌─────────────────────────────┐
│  EVALUATION                 │
│  [Line chart — 100% width]  │
└─────────────────────────────┘

┌─────────────────────────────┐
│  MOVE LIST                  │  ← horizontal scrollable pill list
│  1.e4  e5  2.Nf3  Nc6  ... │
│  (tap to jump to move)      │
└─────────────────────────────┘

┌─────────────────────────────┐
│  ANNOTATION                 │
│  Move: e4                   │
│  Classification: ✓ Best     │
│  Engine: +0.3 → Stockfish   │
│  Best line: Nf3, Bc4, ...   │
└─────────────────────────────┘

┌─────────────────────────────┐
│  TACTICAL PATTERNS          │
│  [Fork] [Pin] [Discovery]   │  ← horizontal chip scroll
└─────────────────────────────┘

┌─────────────────────────────┐
│  OPENING                    │
│  Ruy Lopez (Spanish Game)   │
│  ECO: C60                   │
└─────────────────────────────┘
```

- Chessboard: `width: 100%; aspect-ratio: 1` — fills the full width
- Prev/Next buttons: `48px` tap targets, full-width row below board
- Move list: horizontal scrolling pill row; active move highlighted in accent green
- Annotation panel: full-width card below move list
- No side-by-side layout on mobile

---

### 3.8 Puzzles Page (`/puzzles`)

Desktop: 2-column (board left, sidebar right).
Mobile: Single column, board on top.

#### Header / Mode selector
```
┌─────────────────────────────┐
│  Puzzles                    │
│  [Normal][Survival][Rush][⏱]│  ← scrollable horizontal tabs
└─────────────────────────────┘
```

#### Filters row (below mode tabs)
```
┌─────────────────────────────┐
│  Source: [Own ▼]  Phase: [All ▼] │  ← 2 compact dropdowns inline
└─────────────────────────────┘
```

#### Main area (stacked)
```
┌─────────────────────────────┐
│  [Chessboard — full width]  │  ← always top
│  aspect-ratio: 1            │
│                             │
│  White to move              │
│  [Hint] [Flip] [Skip]       │  ← action row below board
└─────────────────────────────┘

┌─────────────────────────────┐
│  SKILL RADAR                │  ← collapsed by default, tap to expand
│  [▼]  Tactical Profile      │
│  (Recharts RadarChart)      │
└─────────────────────────────┘

┌─────────────────────────────┐
│  SESSION STATS              │
│  Solved: 12  Streak: 5  ⏱8:22│
└─────────────────────────────┘

┌─────────────────────────────┐
│  [Normal Mode]  [Survival]  │  ← mode cards, 2-column grid
│  [Rush Mode]    [Timed]     │
└─────────────────────────────┘
```

#### Modals on mobile
- `TimeChallengeSetup`: slides up from bottom (full-screen)
- `SessionSummary`: slides up from bottom (full-screen), shows stats

---

### 3.9 Report Page (`/report`)

Data-heavy. Use section-by-section card stack with a sticky section TOC.

#### Sticky TOC (horizontal scroll row, top of page)
```
[Summary][Charts][Openings][Patterns][Benchmarks]   → scroll
```
Tapping jumps to that section anchor.

#### PDF Download button
Floats in bottom-right corner as a FAB (Floating Action Button):
```
         [📄 PDF]   ← fixed bottom-right, 56×56px, above bottom nav
```

#### Section layout (all sections stack 1-column):

**Charts row**
Desktop: phase radar + accuracy line side by side.
Mobile: Stack vertically, each chart `100%` width, `250px` height.

**Summary card**
Stat numbers in a **2×2 grid** within the card:
```
┌────────────┬────────────┐
│ Accuracy   │ Win Rate   │
│   82%      │   61%      │
├────────────┼────────────┤
│ Blunders   │ Momentum   │
│  0.8/game  │  ▲ Rising  │
└────────────┴────────────┘
```

**Move quality distribution**
Pie chart on top (centered, `220px` diameter), legend below in 3-column wrap grid:
```
         [Pie Chart]
● Brilliant   ● Great   ● Best
● Excellent   ● Good    ● Book
● Inaccuracy  ● Mistake ● Blunder
```

**Opening performance**
Two tables (as White / as Black) stack vertically. Each table is horizontally scrollable with visible scroll indicator.

**Pattern analysis**
`PatternGrid` tiles: 2-column grid on mobile (vs. wider grid on desktop).

**Time & mistake frequency**
Stat boxes in 2-column grid.

**Cohort benchmarks**
- Comparison cards: 1-column stack
- Bar chart: full-width, 200px height
- Percentile circle: centered, `100px` diameter

---

### 3.10 Batch Analysis Page (`/batch`)

#### Trigger panel (top)
```
┌─────────────────────────────┐
│  Batch Analysis             │
│  124 games ready            │
│  [🔄 Analyze All ─────────] │  ← full width button
│                             │
│  Status: ● Idle             │
└─────────────────────────────┘
```
Status has a pulsing dot. When running, show a progress message.

#### Results sections (1-column stack)

**Summary row**: 2×2 grid of stat boxes.

**Move quality distribution**: horizontal stacked bar chart, full width, labels below.

**Blunders & worst moves table**: horizontally scrollable, sticky first column (move number).

**Time pressure stats**: 2-column grid (Stat boxes), then phase time bar chart below.

**Opening repertoire table**: horizontally scrollable.

**Weak openings table**: horizontally scrollable; only show top 3 rows collapsed, "Show more" expands.

**Phase accuracy**: 3-column grid collapses to 1-column (each phase card stacks):
```
[Opening: 88%]
[Middlegame: 74%]
[Endgame: 81%]
```

**Past analyses list**: Card list (1-column), each entry shows date + game count + quick stats.

---

### 3.11 Training Plan Page (`/training-plan`)

Clean, low-data page. Layout adapts naturally.

```
┌─────────────────────────────┐
│  Training Plan              │
│  Based on your last 50 games│
└─────────────────────────────┘

┌─────────────────────────────┐
│  STUDY FOCUS (priority)     │
│  ┌──────────┐ ┌──────────┐  │
│  │ 🔴 High  │ │ 🟡 Med   │  │  ← 2-column priority grid
│  │ Tactics  │ │ Endgame  │  │
│  └──────────┘ └──────────┘  │
│  ┌──────────────────────┐   │
│  │ 🟢 Low — Openings    │   │  ← full width for low priority
│  └──────────────────────┘   │
└─────────────────────────────┘

┌─────────────────────────────┐
│  PUZZLE THEMES              │
│  ┌──────────┐ ┌──────────┐  │
│  │  Fork    │ │  Pin     │  │  ← 2-column theme grid
│  ├──────────┤ ├──────────┤  │
│  │Discovery │ │Skewer    │  │
│  └──────────┘ └──────────┘  │
└─────────────────────────────┘

┌─────────────────────────────┐
│  TIME ESTIMATE              │
│  Daily: ~25 min             │
│  Weekly: ~3 hrs             │
└─────────────────────────────┘
```

---

### 3.12 Coach Dashboard (`/coach/(app)/dashboard`)

#### Coach Header (60px)
```
[♟ Logo]   [Players Tab active]   [👤 Coach]
```

#### Tab navigation
Horizontal scrollable tab bar (below header, sticky):
```
[Players] [Roster] [Games] [Pending]   → scroll if needed
```

#### Players Tab
Desktop: Full sortable table.
Mobile: **Card list** — each player is a compact card:
```
┌─────────────────────────────┐
│  Magnus Carlsen   ▲ Rising  │
│  Acc: 94%  WR: 68%          │
│  Blunders: 0.3/g  TP: Low   │
│                    [View →] │
└─────────────────────────────┘
```
Sort control: a single dropdown at top of list:
```
Sort by: [Accuracy ▼]
```

#### Roster Tab
Same card list pattern with action buttons (Approve / Reject / Assign):
```
┌─────────────────────────────┐
│  @new_player  Pending       │
│  Joined: 2024-01-10         │
│  [Approve]        [Reject]  │
└─────────────────────────────┘
```

#### Games Tab
Player selector: full-width dropdown at top.
Platform toggle: [Chess.com] [Lichess] pills.
Games: 1-column card list (GameCard component, already responsive).

#### Pending Tab
Same as Roster tab pattern above.

---

### 3.13 Coach Academy Page (`/coach/(app)/academy`)

```
┌─────────────────────────────┐
│  My Academy                 │
│  Academy Name               │
│  12 players enrolled        │
└─────────────────────────────┘

┌─────────────────────────────┐
│  QUICK STATS                │
│  ┌──────┐ ┌──────┐ ┌──────┐│
│  │  12  │ │  8   │ │  4   ││  ← 3-column mini grid
│  │Total │ │Active│ │Pend. ││
│  └──────┘ └──────┘ └──────┘│
└─────────────────────────────┘

[Student list — card format, 1-column]
┌─────────────────────────────┐
│  @student1   ● Active       │
│  Acc: 78%   Last active: 2d │
│                    [View →] │
└─────────────────────────────┘
```

---

### 3.14 Admin Dashboard (`/admin/dashboard`)

#### Tab navigation
Horizontal scrollable tabs:
```
[Pending Academies] [All Academies] [Coaches] [Players]
```

All tables convert to card lists on mobile following the same pattern as Coach Dashboard.

**Pending Academies card**:
```
┌─────────────────────────────┐
│  Chess Academy XYZ          │
│  Owner: @coach_user         │
│  Players: 45  Registered: …  │
│  [Approve]        [Reject]  │
└─────────────────────────────┘
```

**All Academies card**:
```
┌─────────────────────────────┐
│  Elite Chess Club  ● Active │
│  15 coaches · 200 players   │
│                    [View →] │
└─────────────────────────────┘
```

---

## 4. Shared Mobile Patterns

### 4.1 Page Wrapper
All authenticated pages:
- `padding-top: 60px` (header)
- `padding-bottom: 76px` (bottom nav: 60px + 16px buffer)
- `min-height: 100dvh` (dynamic viewport height — handles iOS browser chrome)

### 4.2 Section Headings
On mobile, section titles sit above their content with a left-border accent:
```
│ Section Title
  Sub-description text
```
No decorative tag chips (they occupy too much vertical space on mobile).

### 4.3 Empty States
When a section has no data, show a minimal centered empty state:
```
       [icon]
   No games yet
 [Import your first game]  ← CTA button
```

### 4.4 Loading States
Skeleton loaders (shimmer animation) for all card lists and tables. Full-width skeleton cards match the shape of the content cards they replace.

### 4.5 Error States
Inline red banner below the triggering element:
```
⚠ Failed to fetch games. [Retry]
```
No full-page error screens on mobile.

### 4.6 Toast Notifications
Position: top-center on mobile (not bottom-right like desktop) to avoid overlap with bottom nav. Width: `calc(100% - 32px)`, max-width `360px`.

### 4.7 Swipe Gestures
- On tab bars (Puzzle modes, Dashboard tabs, Coach tabs): swipe left/right to switch tabs
- On game cards in lists: swipe right to reveal quick action (e.g. "View Analysis")
- On bottom sheets / modals: swipe down to dismiss

### 4.8 Safe Area Handling
All fixed bottom elements use:
```css
padding-bottom: calc(env(safe-area-inset-bottom) + 16px);
```
This prevents overlap with iPhone home indicator.

---

## 5. Implementation Checklist

### Phase 1 — Foundation
- [ ] Add `--bp-*` CSS variables to `:root`
- [ ] Update `.container` to `padding: 0 16px` on mobile
- [ ] Update `.glass-card` padding to `16px` on mobile
- [ ] Update `.page-wrapper` `padding-top: 60px` on mobile
- [ ] Fix input `font-size: 1rem` on mobile (prevent iOS zoom)
- [ ] Add `min-height: 44px` to all buttons (touch targets)

### Phase 2 — Navigation
- [ ] Shrink Header to 60px on mobile, hide nav links
- [ ] Add hamburger icon and slide-in drawer for public pages
- [ ] Build BottomNavBar component (player, coach, admin variants)
- [ ] Add safe-area padding to bottom nav

### Phase 3 — Landing Page
- [ ] Stack hero columns, reorder (board above text)
- [ ] Make CTA buttons full-width stacked
- [ ] Collapse bento grid to 1-column
- [ ] Collapse analytics/roles/steps grids to 1-column
- [ ] Footer accordion for link groups

### Phase 4 — Auth Pages
- [ ] Verify form inputs use `font-size: 1rem`
- [ ] Center glass card with correct mobile padding

### Phase 5 — Player Pages
- [ ] Dashboard: horizontal scroll stat chips + bottom sheet for details
- [ ] Analysis: stack board + controls + annotation vertically
- [ ] Puzzles: board on top, sidebar below, mode tabs as horizontal scroll
- [ ] Report: sticky section TOC, PDF as FAB, all grids → 1-column
- [ ] Batch: trigger panel top, results 1-column stack
- [ ] Training Plan: priority 2-col, theme 2-col

### Phase 6 — Coach & Admin Pages
- [ ] Coach Dashboard: tables → card lists, sort dropdown
- [ ] Coach Academy: card list for students
- [ ] Admin Dashboard: same table → card list conversion

### Phase 7 — Polish
- [ ] Swipe gestures on tabs
- [ ] Skeleton loaders for all async sections
- [ ] Toast repositioned to top-center on mobile
- [ ] `safe-area-inset-*` padding everywhere
- [ ] Disable floating animations (`boardFloat`, `float1/2/3`) via `@media (pointer: coarse)`
- [ ] Add `active` press states (`transform: scale(0.97)`) on all tappable elements
- [ ] Test on iOS Safari, Chrome Android, Firefox Android

---

## 6. Files to Modify

| File | Change |
|------|--------|
| `src/app/globals.css` | Add mobile breakpoint overrides for `.container`, `.glass-card`, `.page-wrapper`, inputs, buttons |
| `src/app/landing.module.css` | Already has `@media (max-width: 991px)` and `576px` — fill gaps for 375px, fix footer accordion |
| `src/components/Header.tsx` | Add hamburger, drawer, shrink to 60px on mobile |
| `src/components/Header.css` | Responsive header styles |
| `src/app/dashboard/page.tsx` | Time control stat chips + bottom sheets |
| `src/app/analysis/[filename]/page.tsx` | Stack layout: board → controls → annotation |
| `src/app/puzzles/page.tsx` | Stack layout: board top, sidebar below |
| `src/app/report/page.tsx` | Sticky TOC, PDF FAB, grid collapses |
| `src/app/batch/page.tsx` | Grid collapses, table horizontal scroll |
| `src/app/coach/(app)/dashboard/page.tsx` | Tables → card lists |
| `src/components/BottomNav.tsx` | **New component** — role-aware bottom navigation |
| `src/components/Drawer.tsx` | **New component** — hamburger slide-in drawer |
