# Testify — Design System PRD
> Complete design specification. Every token, every component, every screen.
> Feed this to OpenCode before touching any CSS or component file.

---

## 1. Typography

### Font Stack
```css
/* Inject in app/layout.tsx <head> or globals.css @import */

/* Fontshare — Satoshi (UI) + Array (Mono/Numbers) */
@import url('https://api.fontshare.com/v2/css?f[]=satoshi@300,400,500,600,700&f[]=array@400&display=swap');

/* Google Fonts — Syne (Brand/Headers) */
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&display=swap');
```

### Font Roles
| Role | Font | Weight | Use case |
|---|---|---|---|
| `--font-ui` | Satoshi | 400/500/600 | All body text, labels, inputs, descriptions |
| `--font-brand` | Syne | 700/800 | Page titles, brand mark, section headers, CTAs |
| `--font-mono` | Array | 400 | Timers, scores, question numbers, metrics, code |

### Type Scale
```css
/* Brand / Display */
.text-display    { font: 800 48px/1.1 var(--font-brand); letter-spacing: -0.03em; }
.text-title      { font: 700 32px/1.2 var(--font-brand); letter-spacing: -0.02em; }
.text-heading    { font: 700 22px/1.3 var(--font-brand); letter-spacing: -0.015em; }
.text-subheading { font: 700 18px/1.4 var(--font-brand); letter-spacing: -0.01em; }

/* UI / Body */
.text-body-lg    { font: 400 16px/1.6 var(--font-ui); }
.text-body       { font: 400 15px/1.55 var(--font-ui); }
.text-body-sm    { font: 400 14px/1.5 var(--font-ui); }
.text-caption    { font: 400 12px/1.4 var(--font-ui); letter-spacing: 0.01em; }
.text-label      { font: 500 13px/1.4 var(--font-ui); }

/* Mono / Technical */
.text-mono-xl    { font: 400 64px/1 var(--font-mono); letter-spacing: -0.02em; }
.text-mono-lg    { font: 400 32px/1.1 var(--font-mono); letter-spacing: 0.02em; }
.text-mono-md    { font: 400 18px/1.2 var(--font-mono); letter-spacing: 0.04em; }
.text-mono-sm    { font: 400 13px/1.3 var(--font-mono); letter-spacing: 0.03em; }
.text-mono-xs    { font: 400 11px/1.2 var(--font-mono); letter-spacing: 0.06em; text-transform: uppercase; }

/* Where each mono size is used */
/* mono-xl  → streak count, hero score on results page */
/* mono-lg  → exam timer (HH:MM:SS), rank countdown */
/* mono-md  → subject scores, percentile numbers */
/* mono-sm  → question numbers in palette, time metrics */
/* mono-xs  → section labels, table headers, badges */
```

---

## 2. Color System

### Base Palette
```css
:root {
  /* Backgrounds — layered dark */
  --bg-base:        #05080F;   /* deepest — page background */
  --bg-elevated:    #0A0E16;   /* slightly lifted — sidebar, panels */
  --bg-card:        #0D1117;   /* cards, containers */
  --bg-card-hover:  #161B22;   /* card hover state */
  --bg-nav:         #010409;   /* top navigation bar */
  --bg-input:       #0D1117;   /* form inputs */
  --bg-overlay:     rgba(1, 4, 9, 0.85); /* modals, overlays */

  /* Borders */
  --border-subtle:  rgba(48, 54, 61, 0.8);   /* default card borders */
  --border-muted:   rgba(48, 54, 61, 0.4);   /* dividers, table rows */
  --border-active:  rgba(72, 190, 255, 0.5); /* hover/focus borders */
  --border-focus:   rgba(72, 190, 255, 0.8); /* focused input borders */

  /* Brand Accents */
  --cyan:    #48BEFF;   /* primary CTA, links, active states */
  --forest:  #2B9720;   /* approve, verified, forest green */
  --mint:    #5EF38C;   /* success, streak, correct answers */

  /* Semantic */
  --amber:   #D29922;   /* warning, marked for review, 40-70% accuracy */
  --crimson: #F85149;   /* error, wrong answer, red flags, danger */

  /* Text */
  --text-primary:   #E6EDF3;   /* main text */
  --text-secondary: #7D8590;   /* labels, captions, placeholders */
  --text-tertiary:  #484F58;   /* very muted, disabled */
  --text-inverse:   #05080F;   /* text on cyan/mint buttons */

  /* Accuracy heatmap */
  --heat-low-bg:    rgba(248, 81, 73, 0.12);
  --heat-low-border: #F85149;
  --heat-mid-bg:    rgba(210, 153, 34, 0.12);
  --heat-mid-border: #D29922;
  --heat-high-bg:   rgba(94, 243, 140, 0.12);
  --heat-high-border: #5EF38C;
}
```

### Color Usage Map
| Element | Color |
|---|---|
| Page background | `--bg-base` |
| Nav bar | `--bg-nav` |
| All cards | `--bg-card` |
| Card on hover | `--bg-card-hover` |
| Input fields | `--bg-input` |
| Primary button | `--cyan` bg, `--text-inverse` text |
| Success button | `--forest` bg, white text |
| Outline button | transparent bg, `--border-subtle`, white text |
| Active nav item | `--cyan` left border 3px, no bg change |
| Correct answer | `--mint` |
| Wrong answer | `--crimson` |
| Unattempted | `--text-secondary` |
| Exam timer normal | `--text-primary` |
| Exam timer < 30min | `--amber` |
| Exam timer < 10min | `--crimson` |
| Streak number | `--mint` |
| Score number | `--mint` |
| Rank countdown | `--cyan` |
| Tab switch flag | `--crimson` |
| Question saved | `--cyan` filled dot |
| Question review | `--amber` filled dot |
| Question skipped | white outline dot |
| Question unvisited | `--border-subtle` outline dot |

---

## 3. Spacing & Layout

```css
/* Spacing scale */
--space-1:  4px;
--space-2:  8px;
--space-3:  12px;
--space-4:  16px;
--space-5:  20px;
--space-6:  24px;
--space-8:  32px;
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;

/* Border radius */
--radius-sm: 6px;    /* buttons, inputs, badges */
--radius-md: 10px;   /* cards, panels */
--radius-lg: 14px;   /* large cards, modals */
--radius-xl: 20px;   /* hero cards */
--radius-full: 9999px; /* pills, dots, avatars */

/* Page layout */
--nav-height: 56px;
--sidebar-width: 240px;
--content-max-width: 1280px;
--content-padding: 32px;

/* Card padding */
--card-padding-sm: 16px;
--card-padding-md: 24px;
--card-padding-lg: 32px;
```

---

## 4. Component Specs

### Navigation Bar
```
Height: 56px
Background: --bg-nav
Border bottom: 1px solid --border-subtle
Padding: 0 32px
Layout: flex, space-between, center aligned

Left: Brand mark
  "TESTIFY" in Syne 800 20px
  Small cyan dot (8px) before the text
  Letter spacing: -0.02em

Center: Screen nav links (desktop) or hidden (mobile)
  Font: Array mono-xs (11px uppercase)
  Active: --cyan color + 3px left border indicator
  Inactive: --text-secondary
  Gap between links: 2px

Right: Actions
  Theme toggle (glass/flat) — hidden in final build
  User avatar or logout button
  Notification dot if pending flags
```

### Card
```
Background: --bg-card
Border: 1px solid --border-subtle
Border radius: --radius-md (10px)
Padding: 24px
Transition: border-color 0.15s ease, background 0.15s ease

On hover:
  Border: --border-active
  Background: --bg-card-hover

Variants:
  card-sm: padding 16px, radius 6px
  card-lg: padding 32px, radius 14px
  card-flat: no border, no hover effect
```

### Buttons
```
Primary (Cyan):
  Background: --cyan
  Color: --text-inverse (#05080F)
  Font: Satoshi 600 14px
  Padding: 10px 20px
  Radius: --radius-sm
  Hover: brightness(1.1), translateY(-1px)
  Active: translateY(0), brightness(0.95)
  Focus: outline 2px --cyan, offset 2px

Success (Forest):
  Background: --forest
  Color: white
  Same sizing as primary
  Hover: brightness(1.15)

Outline:
  Background: transparent
  Border: 1px solid --border-subtle
  Color: --text-primary
  Hover: border --border-active, color --cyan

Danger:
  Background: rgba(248, 81, 73, 0.12)
  Border: 1px solid rgba(248, 81, 73, 0.3)
  Color: --crimson
  Hover: background rgba(248, 81, 73, 0.2)

Ghost:
  Background: transparent
  Color: --text-secondary
  No border
  Hover: color --text-primary, background rgba(255,255,255,0.04)

Size variants:
  sm: padding 6px 14px, font-size 12px
  md: padding 10px 20px, font-size 14px (default)
  lg: padding 14px 28px, font-size 16px
  full: width 100%, justify-content center
```

### Input Fields
```
Background: --bg-input
Border: 1px solid --border-subtle
Border radius: --radius-sm
Padding: 11px 14px
Font: Satoshi 400 14px
Color: --text-primary
Placeholder: --text-secondary

Focus:
  Border: --border-focus
  Outline: none

Error state:
  Border: --crimson at 0.6 opacity

Label above input:
  Font: Satoshi 500 13px
  Color: --text-secondary
  Margin bottom: 6px
```

### Badges / Pills
```
Cyan badge:
  Background: rgba(72, 190, 255, 0.12)
  Color: --cyan
  Border: 1px solid rgba(72, 190, 255, 0.2)
  Font: Array 11px uppercase
  Padding: 3px 10px
  Radius: --radius-full

Forest badge:
  Background: rgba(43, 151, 32, 0.12)
  Color: --mint
  Border: 1px solid rgba(43, 151, 32, 0.2)
  Same sizing as cyan

Crimson badge:
  Background: rgba(248, 81, 73, 0.1)
  Color: --crimson
  Border: 1px solid rgba(248, 81, 73, 0.2)

Amber badge:
  Background: rgba(210, 153, 34, 0.1)
  Color: --amber
  Border: 1px solid rgba(210, 153, 34, 0.2)
```

### Data Tables
```
Header row:
  Font: Array 11px uppercase
  Color: --text-secondary
  Letter spacing: 0.06em
  Border bottom: 1px solid --border-subtle
  Padding: 10px 14px

Body rows:
  Font: Satoshi 14px
  Padding: 10px 14px
  Border bottom: 1px solid --border-muted
  Alternating bg: --bg-card and rgba(255,255,255,0.01)
  Hover: background rgba(72,190,255,0.04)

Numeric cells:
  Font: Array 13px
  Text align: right

Trend positive: --mint
Trend negative: --crimson
```

### Section Headers
```
Large section title:
  Font: Syne 700 22px
  Color: --text-primary
  Letter spacing: -0.015em
  Margin bottom: 24px

Section subhead / eyebrow:
  Font: Array 11px uppercase
  Color: --text-secondary
  Letter spacing: 0.06em
  Margin bottom: 12px

Dividers between sections:
  1px solid rgba(48, 54, 61, 0.6)
  Margin: 32px 0
```

---

## 5. Screen-by-Screen Specs

### Screen 01 — Auth (Login / Register)
```
Layout: centered card, min-height 80vh, flex center

Card:
  Width: 420px
  Background: --bg-card
  Border: 1px solid --border-subtle
  Padding: 40px
  Radius: --radius-lg

Title: Syne 800 28px center
Subtitle: Satoshi 14px --text-secondary center, margin-bottom 32px

Mode toggle (Login / Register):
  Two text buttons side by side
  Active: --cyan color, border-bottom 2px --cyan
  Inactive: --text-secondary

Form fields: full width, gap 16px between fields

Submit button: btn-forest full width, padding 14px

Bottom link: Satoshi 13px --text-secondary center
```

### Screen 02 — Dashboard (Student Home)
```
Layout: single column, max-width 1280px, padding 32px

Top bar below nav:
  Left: "Good morning, Sathvik" in Syne 700 24px
  Right: streak badge + notification bell

STREAK SECTION (dopamine card):
  Background: rgba(94, 243, 140, 0.06)
  Border: 1px solid rgba(94, 243, 140, 0.2)
  Border radius: --radius-lg
  Padding: 32px
  Layout: flex row, gap 32px, align center

  Left side:
    Streak number: Array 64px --mint, line-height 1
    "@keyframes streak-pulse" CSS animation:
      0%   { text-shadow: 0 0 20px rgba(94,243,140,0.3); }
      50%  { text-shadow: 0 0 40px rgba(94,243,140,0.7), 0 0 60px rgba(94,243,140,0.3); }
      100% { text-shadow: 0 0 20px rgba(94,243,140,0.3); }
    animation: streak-pulse 2s ease-in-out infinite
    "DAY STREAK" label: Syne 700 14px --mint uppercase letter-spacing 0.1em

  Middle:
    7-day dot row (Mon Tue Wed Thu Fri Sat Sun):
      Each day: 32px circle
      Completed: filled --mint, inner glow
      Today active: --cyan pulsing border
      Future: --border-subtle outline
      Day label below: Array 10px --text-secondary

  Right side:
    Personal best badge if streak >= 5:
      "🔥 Best: 12 days" in Array 12px --amber
    Motivation text: Satoshi 13px --text-secondary

DAILY CHALLENGE card (below streak):
  Background: --bg-card
  Border: 1px solid --border-subtle
  Left accent border: 3px solid --cyan
  Padding: 20px 24px
  Layout: flex row space-between align-center

  Left:
    "DAILY CHALLENGE" badge (Array mono-xs cyan)
    Question preview: Satoshi 14px, max 2 lines, ellipsis
    Difficulty badge: Easy/Medium/Hard

  Right:
    Countdown to midnight IST:
      Array 24px --cyan format "HH:MM:SS"
      Label: Array 10px --text-secondary "RESETS IN"
    "Attempt →" btn-cyan sm

MOCK PAPERS section:
  Section header: "Mock Papers"
  Grid: 3 columns, gap 16px

  Each paper tile:
    Background: --bg-card
    Border: 1px solid --border-subtle
    Radius: --radius-md
    Padding: 20px
    Hover: border --border-active, bg --bg-card-hover

    Top: Paper name Satoshi 600 15px
    Mid: "JEE Main • 75 Questions • 3 Hours"
         Array 12px --text-secondary
    Difficulty dots row
    Bottom: "Start Test →" btn-cyan sm

  "Start Full Mock" button → opens RANDOMIZER MODAL:
    Modal overlay: --bg-overlay
    Modal card: 480px wide, --bg-card, border --border-subtle

    Title: "Configure Mock Test" Syne 700 20px
    
    Question count: radio group
      Options: 30 / 60 / 90 questions
      Radio styled as toggle chips
      Active chip: --cyan border + bg rgba(72,190,255,0.1)

    Subject filter: radio group
      All / Physics / Chemistry / Mathematics

    Difficulty: radio group
      Mixed / Easy / Medium / Hard

    Rule notice:
      Background: rgba(72,190,255,0.06)
      Border: 1px solid rgba(72,190,255,0.15)
      Radius: --radius-sm
      Padding: 12px 16px
      Text: "Max 35% of questions will be previously seen"
      Font: Satoshi 13px --cyan

    Buttons: "Cancel" btn-outline + "Generate & Launch" btn-cyan

ANALYTICS CHART:
  Section header: "Performance History"
  Card: full width, padding 24px

  Chart area: 140px tall
  Bars: flex row, align flex-end, gap 4px
  Bar color: --cyan at 30% opacity
  Bar hover: --cyan at 100%
  Bar radius: 2px 2px 0 0

  X axis labels: Array 10px --text-secondary (month names)
  Y axis: implied, no lines

  Above chart: two metrics
    Left: "Avg Score: 247/300" Array 14px --text-primary
    Right: "Best: 272/300" Array 14px --mint
```

### Screen 03 — Exam Engine
```
Layout: fills viewport below nav, no scroll on outer container

TOP BELT:
  Height: 56px
  Background: --bg-card
  Border bottom: 1px solid --border-subtle
  Padding: 0 24px
  Layout: flex space-between center

  Left:
    Paper name: Satoshi 600 14px --text-primary
    Subtitle: "Physics · 75 Questions · 180 min"
             Array 11px --text-secondary

  Center:
    Section tabs: Physics | Chemistry | Mathematics
    Each tab: padding 8px 16px
    Active: --cyan color + 2px border-bottom --cyan
    Inactive: --text-secondary
    Font: Satoshi 500 13px

  Right:
    Q counter badge: "14/75" Array 12px --cyan bg
    Question type badge: "MCQ" or "NUM" --forest bg
    Timer: Array 32px, color changes with time
      > 1hr: --text-primary
      30-60min: --mint
      10-30min: --amber
      < 10min: --crimson + @keyframes timer-blink
    Sync dot: 8px circle, --mint when synced, --amber when syncing

MAIN AREA:
  Height: calc(100vh - 56px - 56px)
  Grid: 1fr 280px, gap 16px, padding 16px

  LEFT PANEL (question canvas):
    Overflow-y: auto
    Padding right: 8px

    Question card:
      Background: --bg-card
      Border: 1px solid --border-subtle
      Radius: --radius-md
      Padding: 28px

      Q number eyebrow: "Question 14 of 75"
                        Array 11px --text-secondary uppercase

      Question text:
        Satoshi 16px 1.7 line-height
        Color: --text-primary
        Margin bottom: 20px

      Question image (if exists):
        max-width: 100%
        border-radius: 8px
        border: 1px solid rgba(72,190,255,0.2)
        margin-bottom: 20px
        background: --bg-elevated

      MCQ Options (A B C D):
        Each option: flex row, align center, gap 16px
        Padding: 14px 16px
        Border: 1px solid --border-subtle
        Radius: --radius-sm
        Margin bottom: 8px
        Cursor: pointer
        Transition: all 0.12s ease

        Option letter circle:
          Width/height: 32px
          Border: 1px solid --border-subtle
          Radius: full
          Font: Array 13px center
          Flex shrink 0

        Option text: Satoshi 14px

        Hover state:
          Border: --border-active
          Background: rgba(72,190,255,0.05)

        Selected state:
          Border: --cyan
          Background: rgba(72,190,255,0.1)
          Letter circle: bg --cyan, color --text-inverse

        Correct state (after key uploaded):
          Border: --mint
          Background: rgba(94,243,140,0.08)
          Letter circle: bg --mint

        Wrong selected state:
          Border: --crimson
          Background: rgba(248,81,73,0.08)

      NUMERICAL INPUT:
        (replaces options when question type = numerical/integer)

        Display box:
          Padding: 16px
          Border: 1px solid --border-subtle
          Radius: --radius-sm
          Font: Array 24px center
          Background: --bg-input
          Margin bottom: 12px
          Min-height: 58px
          Shows typed value or placeholder "Enter numerical answer"

        Numpad grid: 4 columns, gap 8px
          Keys: 7 8 9 ÷  4 5 6 ×  1 2 3 −  0 . CLR ↵
          Each key: padding 16px, border --border-subtle
          Font: Array 16px center
          Radius: --radius-sm
          Background: --bg-input
          Hover: border --cyan, bg rgba(72,190,255,0.08)

          CLR key: color --crimson
          ↵ (submit) key: bg --cyan, color --text-inverse, font-weight 600
          − key: for negative numbers

    Action row below question card:
      Flex row, space-between
      "← Previous" btn-outline sm
      "Mark for Review" btn-outline sm (amber color on active)
      "Save & Next →" btn-cyan sm

  RIGHT PANEL (palette + submit):
    Background: rgba(13,17,23,0.6)
    Border left: 1px solid --border-subtle
    Padding: 16px
    Display: flex flex-col gap 16px

    Section subhead: "Question Palette" Array mono-xs

    Palette grid: 8 columns, gap 6px
      Each dot:
        Width/height: 100%, aspect-ratio 1/1
        Border radius: full
        Font: Array 10px center
        Cursor: pointer
        Transition: all 0.12s

        unvisited: transparent bg, --border-subtle border, --text-tertiary
        skipped: transparent bg, rgba(255,255,255,0.25) border, --text-secondary
        saved: --cyan bg, --text-inverse
        review: --amber bg, --text-inverse

    Legend:
      4 items flex wrap gap 12px
      Each: dot 10px + label Array 10px --text-secondary

    Submit button at bottom:
      btn-forest full width padding 16px
      Font: Satoshi 600 16px
      "Submit Final Paper"

FLAG ALERT BANNER:
  Position: fixed top (below nav)
  Background: rgba(248, 81, 73, 0.1)
  Border bottom: 1px solid rgba(248, 81, 73, 0.3)
  Padding: 10px 24px
  Font: Satoshi 14px --crimson
  Text: "⚠ Tab switch detected (2 times) — this is being logged"
  Shows only after first infraction, auto-hides after 5 seconds
```

### Screen 04 — Results (Post-Exam Scoreboard)
```
Layout: max-width 1280px, padding 32px

HERO ROW (2 columns):
  Left — Score card:
    Background: --bg-card
    Border: 1px solid --border-subtle
    Radius: --radius-xl
    Padding: 40px
    Text align: center

    Eyebrow: "YOUR SCORE" Array mono-xs --text-secondary
    Score number: Array 96px --mint, line-height 1
    Out of: "/ 300" Satoshi 18px --text-secondary
    Delta: "+12 vs last attempt" Array 13px --mint

  Right — Rank countdown:
    Background: --bg-card
    Border: 1px solid --border-subtle
    Radius: --radius-xl
    Padding: 40px

    Eyebrow: "ALL INDIA RANKINGS PROCESSING"
             Array mono-xs --text-secondary
    Countdown: Array 56px --cyan, letter-spacing 0.02em
    Sub: "~184,000 candidates in queue" Satoshi 13px --text-secondary
    Progress bar: 6px tall, --cyan fill, 68% width

SUBJECT BREAKDOWN (4 columns below hero):
  Each card: bg --bg-card, border, radius --radius-md, padding 20px, center

  Eyebrow: subject name Array mono-xs
  Number: Array 36px, color per subject:
    Physics: --cyan
    Chemistry: --mint
    Mathematics: --amber
    Percentile: --text-primary + "%" suffix

QUESTION REVIEW TABLE:
  Section header: "Response Review"

  Table columns:
    Q#      — Array 12px --cyan, 60px wide
    Topic   — Satoshi 14px, flex 1
    Yours   — Array 13px, 80px
    Correct — Array 13px --mint, 80px
    Time    — Array 12px --text-secondary, 80px
    Result  — icon only, 60px center

  Result icons:
    ✓ correct: --mint, font-size 16px
    ✗ wrong:   --crimson, font-size 16px
    — skip:    --text-secondary, font-size 16px

  Wrong rows expandable:
    Click row → accordion opens below
    Accordion bg: rgba(248,81,73,0.05)
    Border: 1px solid rgba(248,81,73,0.15)
    Padding: 12px 16px
    "Teacher Trap: [hint text]" Satoshi 13px --crimson

  "Show All 64 Questions" text button:
    --cyan color, Satoshi 14px, center
    Shows after row 10

GOD MODE BUTTON (bottom, full width):
  Background: --cyan
  Color: --text-inverse
  Font: Syne 700 18px
  Padding: 18px
  Radius: --radius-md
  Text: "Unlock GOD Mode Analysis →"
  Hover: brightness(1.1)
```

### Screen 05 — GOD Mode Analysis
```
Layout: max-width 1280px, padding 32px

Top navigation:
  "← Back to Results" btn-ghost sm, links to scoreboard

Page title: "GOD Mode — Deep Analysis" Syne 800 32px
Subtitle: "Question-level performance vs. global cohort"
          Satoshi 14px --text-secondary

CHAPTER ACCURACY HEATMAP:
  Section header: "Chapter Performance"
  Grid: 3 columns, gap 12px, margin-bottom 40px

  Each chapter tile:
    Padding: 16px 20px
    Border radius: --radius-md
    Border: 1px solid (color based on accuracy)
    Background: (color based on accuracy)

    Chapter name: Satoshi 600 14px --text-primary
    Accuracy: Array 24px (color based on accuracy)
    Label: "accuracy" Array 10px --text-secondary

    Accuracy thresholds:
      < 40%: --heat-low-bg, --heat-low-border, --crimson number
      40-70%: --heat-mid-bg, --heat-mid-border, --amber number
      > 70%: --heat-high-bg, --heat-high-border, --mint number

  Chapter data (with accuracy):
    Mechanics 34% | Thermodynamics 58% | Electrostatics 71%
    Optics 82% | Modern Physics 45% | Organic Chemistry 29%
    Inorganic Chemistry 67% | Physical Chemistry 73%
    Algebra 88% | Calculus 52% | Coordinate Geometry 41% | Vectors 79%

TIME ANALYSIS ROWS:
  Section header: "Question Time Analysis"

  Each row:
    Layout: grid 60px 1fr 160px 160px, gap 16px
    Padding: 16px
    Border: 1px solid --border-subtle
    Radius: --radius-sm
    Background: --bg-card
    Margin bottom: 8px

    Q number: Array 16px --cyan center
    Topic: Satoshi 14px --text-primary
    Your time: Array 13px --text-secondary
               "Your: 190s"
    Global avg: Array 13px --mint
               "Global: 42s"

    If your time > 2x global avg:
      Row left border: 3px solid --amber
      Your time color: --amber

    Expand button: "▸ Teacher Trap" --cyan Satoshi 13px
    Expanded accordion:
      Background: rgba(94,243,140,0.06)
      Border: 1px solid rgba(94,243,140,0.2)
      Radius: --radius-sm
      Padding: 14px 16px
      Font: Satoshi 13px --mint
      Hint text content
```

### Screen 06 — Teacher Faculty Hub
```
Layout: sidebar + main, 240px + 1fr

Left sidebar:
  Background: --bg-elevated
  Border right: 1px solid --border-subtle
  Padding: 24px 16px

  Filter chips: full width
  Active: --cyan text, rgba(72,190,255,0.1) bg,
          1px solid rgba(72,190,255,0.2) border
  Inactive: --text-secondary, hover --text-primary

Main area: card with data table (see table spec above)

Summary cards row (above table):
  3 cards: Total Students / Tests This Week / Class Average
  Each: bg --bg-card, border, padding 20px
  Number: Array 32px --cyan
  Label: Array mono-xs --text-secondary
```

### Screen 07 — Paper Creation
```
Layout: max-width 800px centered

Tab bar:
  3 tabs: Excel Upload / Type Manually / Hint Strings
  Active tab: --cyan color + 2px border-bottom --cyan
  Font: Satoshi 500 13px

Excel Upload tab:
  Drop zone:
    Border: 2px dashed rgba(72,190,255,0.3)
    Background: rgba(72,190,255,0.03)
    Radius: --radius-lg
    Padding: 60px 40px
    Text center
    Hover: border rgba(72,190,255,0.6), bg rgba(72,190,255,0.06)

    Icon: 48px, opacity 0.4
    Title: "Drop Excel file here" Satoshi 600 16px
    Sub: ".xlsx or .csv" Satoshi 13px --text-secondary
    Button: "Browse Files" btn-outline sm, margin-top 16px

  Cloud sync indicator:
    Fixed bottom right of card
    "● Cloud sync active" Array 11px --mint

Manual Entry tab:
  Card form:
    Subject + Topic: 2 col grid
    Question textarea: full width, rows 4
    Options: 2 col grid (A B C D)
    Correct answer radio: inline A B C D
    Hint textarea: full width rows 2
    Save button: btn-forest

Hint Strings tab:
  Input row: Q# input (100px) + hint input (flex) + Add btn
  Saved hints list:
    Each: card-sm, badge Q# + hint text
```

### Screen 08 — Live Proctoring Monitor
```
Layout: header stats + grid of student cards

Header:
  "Live Proctoring" Syne 700 22px
  Right: "6 Active" badge-forest + "3 Alerts" badge-amber

Student grid: 3 columns, gap 16px

Student card:
  Background: --bg-card
  Border: 1px solid --border-subtle
  Radius: --radius-md
  Padding: 16px
  Transition: border-color 0.3s, box-shadow 0.3s

  Warning state (infractions >= 3):
    Border: rgba(248,81,73,0.4)
    Box shadow: 0 0 16px rgba(248,81,73,0.08)

  Top row:
    Name: Satoshi 600 14px
    Section: Satoshi 12px --text-secondary
    Flag count badge: right aligned
      0 flags: "0 flags" badge-forest
      1-2 flags: "N flags" badge-amber
      3+ flags: "N flags" badge-crimson

  Progress bar:
    Height: 3px
    Background: --border-subtle
    Fill: --cyan (normal), --crimson (warned)
    Radius: full

  Bottom:
    "N% complete" Array 11px --text-secondary
    "🟢 Active" or "🔴 Paused" Array 11px

  Dismiss button (shows on warned cards):
    "Dismiss False Positive" btn-ghost sm --text-secondary
```

---

## 6. Animations

```css
/* Streak pulse — on the streak number */
@keyframes streak-pulse {
  0%, 100% { text-shadow: 0 0 20px rgba(94,243,140,0.3); }
  50%       { text-shadow: 0 0 50px rgba(94,243,140,0.8),
                            0 0 80px rgba(94,243,140,0.3); }
}

/* Timer blink — only when < 10 min */
@keyframes timer-blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.6; }
}

/* Flag banner slide in */
@keyframes flag-slide {
  from { transform: translateY(-100%); opacity: 0; }
  to   { transform: translateY(0); opacity: 1; }
}

/* Modal fade in */
@keyframes modal-in {
  from { opacity: 0; transform: scale(0.96) translateY(8px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}

/* Card hover lift */
/* Use transform: translateY(-2px) on card hover — NO box-shadow glow */

/* Transition defaults */
/* All interactive elements: transition: all 0.15s ease */
/* Color changes: transition: color 0.2s ease */
/* Border changes: transition: border-color 0.15s ease */
```

---

## 7. What NOT to do

```
✗ No backdrop-filter blur anywhere
✗ No purple, violet, indigo anywhere
✗ No gradient backgrounds
✗ No box-shadow glow effects (except streak-pulse text-shadow)
✗ No rounded corners > 14px except --radius-full pills
✗ No animations on page load (no entrance animations)
✗ No Inter as a display/heading font
✗ No fake metrics with made-up numbers in production
✗ No emoji in buttons or navigation
✗ No border-left accent on cards (only on active nav items)
✗ No overlapping cards or z-fighting
✗ No horizontal scroll on mobile
✗ No font-size below 11px
✗ No color contrast below 4.5:1 for body text
```

---

## 8. Responsive Breakpoints

```css
/* Mobile first */
@media (max-width: 640px) {
  /* exam split → single column, palette moves to top */
  /* teacher sidebar → hidden, filter becomes dropdown */
  /* proctor grid → 1 column */
  /* score hero → 1 column */
  /* paper grid → 1 column */
  --content-padding: 16px;
}

@media (max-width: 1024px) {
  /* teacher layout → sidebar collapses */
  /* score breakdown → 2 columns */
  /* proctor grid → 2 columns */
  --content-padding: 24px;
}
```

---

## 9. globals.css Starting Point

```css
@import url('https://api.fontshare.com/v2/css?f[]=satoshi@300,400,500,600,700&f[]=array@400&display=swap');
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&display=swap');

:root {
  --bg-base: #05080F;
  --bg-elevated: #0A0E16;
  --bg-card: #0D1117;
  --bg-card-hover: #161B22;
  --bg-nav: #010409;
  --bg-input: #0D1117;
  --bg-overlay: rgba(1, 4, 9, 0.85);
  --border-subtle: rgba(48, 54, 61, 0.8);
  --border-muted: rgba(48, 54, 61, 0.4);
  --border-active: rgba(72, 190, 255, 0.5);
  --border-focus: rgba(72, 190, 255, 0.8);
  --cyan: #48BEFF;
  --forest: #2B9720;
  --mint: #5EF38C;
  --amber: #D29922;
  --crimson: #F85149;
  --text-primary: #E6EDF3;
  --text-secondary: #7D8590;
  --text-tertiary: #484F58;
  --text-inverse: #05080F;
  --heat-low-bg: rgba(248, 81, 73, 0.12);
  --heat-low-border: #F85149;
  --heat-mid-bg: rgba(210, 153, 34, 0.12);
  --heat-mid-border: #D29922;
  --heat-high-bg: rgba(94, 243, 140, 0.12);
  --heat-high-border: #5EF38C;
  --font-ui: 'Satoshi', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-brand: 'Syne', sans-serif;
  --font-mono: 'Array', ui-monospace, 'JetBrains Mono', monospace;
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-xl: 20px;
  --radius-full: 9999px;
  --nav-height: 56px;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html { scroll-behavior: smooth; -webkit-text-size-adjust: 100%; }

body {
  background: var(--bg-base);
  color: var(--text-primary);
  font-family: var(--font-ui);
  font-size: 15px;
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  min-height: 100vh;
}

button { font: inherit; cursor: pointer; border: none; background: none; }
input, textarea, select { font: inherit; color: inherit; }
a { color: var(--cyan); text-decoration: none; }
a:hover { text-decoration: underline; }
img { max-width: 100%; display: block; }

::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background: rgba(48, 54, 61, 0.6);
  border-radius: 3px;
}

@keyframes streak-pulse {
  0%, 100% { text-shadow: 0 0 20px rgba(94,243,140,0.3); }
  50%       { text-shadow: 0 0 50px rgba(94,243,140,0.8),
                            0 0 80px rgba(94,243,140,0.3); }
}

@keyframes timer-blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.5; }
}

@keyframes modal-in {
  from { opacity: 0; transform: scale(0.96) translateY(8px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}
```