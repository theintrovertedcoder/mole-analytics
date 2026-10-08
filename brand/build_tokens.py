"""The unified Mole tokens, written once and emitted twice:
  mole-tokens.json   the tokens, in the Mole Design System's own format
  mole-tokens.css    the same values as CSS custom properties
This file and its two outputs are kept identical in Mole V3 (brand/) and mole-rally (brand/).
The Mole Design System artifact holds the same tokens.json: https://claude.ai/artifact/4yHci7Z3FuU7N2dERYd77p

Sources: the Mole Brand package (Mole V3) and the Mole Bingo package (mole-rally), merged on
the decisions Haziq made on 3 Oct 2026: ink #16131F (the logo's), the purple-tinted grey family
(Bingo's), Poppins everywhere plus IBM Plex Mono for codes only.

Every contrast ratio in a usage note is computed here: write {r:fg/bg} in a note and it becomes
the measured ratio. CHECKS lists every text pair the system promises; the build fails if one
misses its floor.
"""
import json, re, sys, os

HERE = os.path.dirname(os.path.abspath(__file__))

# ── colour tokens, in the order the brand book reads them ──────────────────────
C = []
def c(name, value, usage): C.append({'name': name, 'value': value, 'usage': usage})

# Core: the four colours every Mole surface shares
c('brand-purple', '#7b4fdb', "Mole's colour, in every product. Fills: the app's and the Rally's main button (white text {r:neutral-on-fill/brand-purple}), selected states, the stamp field. Not for small text: use brand-purple-text.")
c('brand-purple-hover', '#624496', "brand-purple pressed or hovered. White text {r:neutral-on-fill/brand-purple-hover}.")
c('brand-purple-tint', '#efe9ff', "Soft purple: selected rows and tiles, info cards, chips, missing-photo placeholders. Carries brand-purple-text ({r:brand-purple-text/brand-purple-tint}) or ink.")
c('brand-purple-text', '#6a3fc7', "Purple taken dark enough for words, links and outlines: {r:brand-purple-text/neutral-surface} on white, {r:brand-purple-text/brand-base} on brand-base, {r:brand-purple-text/brand-purple-tint} on brand-purple-tint. (brand-purple itself is only {r:brand-purple/brand-purple-tint} on the tint, which misses AA.)")
c('brand-purple-border', '#ddd6fe', "Borders around brand-purple-tint panels.")
c('brand-yellow', '#ffe812', "Sunny's yellow: Sunny, the Mole Card, the logo. As a fill it appears only on dark grounds (board, brand-ink) for something live, with ink on it ({r:brand-ink/brand-yellow}). Never a button on a light ground, never text.")
c('brand-yellow-tint', '#fffcde', "The soft yellow disc or wash behind Sunny.")
c('brand-yellow-text', '#7e7200', "Yellow-family text on white ({r:brand-yellow-text/neutral-surface}) or brand-yellow-tint ({r:brand-yellow-text/brand-yellow-tint}).")
c('brand-ink', '#16131f', "Mole's one ink, the logo's: text, the main button on public pages and the programme (white text {r:neutral-on-fill/brand-ink}), the dark of the logo.")
c('brand-base', '#f8f7ff', "The page ground of the app and the Rally. Ink on it {r:brand-ink/brand-base}.")

# Neutrals: one grey family, purple-tinted, for every product
c('neutral-fg', '{brand-ink}', "Body text and headings. {r:neutral-fg/neutral-surface} on white, {r:neutral-fg/brand-base} on brand-base.")
c('neutral-fg-muted', '#57506b', "Secondary text, labels, captions: {r:neutral-fg-muted/neutral-surface} on white, {r:neutral-fg-muted/brand-base} on brand-base, {r:neutral-fg-muted/neutral-surface-3} on neutral-surface-3, {r:neutral-fg-muted/rally-deep} on rally-deep.")
c('neutral-fg-subtle', '#6a6383', "Tertiary text: {r:neutral-fg-subtle/neutral-surface} on white, {r:neutral-fg-subtle/brand-base} on brand-base, {r:neutral-fg-subtle/neutral-surface-3} on neutral-surface-3, {r:neutral-fg-subtle/rally-deep} on rally-deep, {r:neutral-fg-subtle/loop-ground} on loop-ground. Fails on lavender ({r:neutral-fg-subtle/lavender}) and admin-tint ({r:neutral-fg-subtle/admin-tint}): use neutral-fg-muted there.")
c('neutral-fg-disabled', '#8d86a0', "Placeholders and disabled controls only, never information ({r:neutral-fg-disabled/neutral-surface} on white).")
c('neutral-border', '#eae3f9', "Dividers, card and input borders: Bingo's purple hairline (line) flattened onto white. Decorative: 1.2:1, so never the only edge of a control.")
c('neutral-border-strong', '#d4c3f3', "Secondary button outlines and input borders: line-firm flattened onto white ({r:neutral-border-strong/neutral-surface} on white). Below 3:1, kept from the sources: a control must also differ by its fill or label.")
c('neutral-surface', '#ffffff', "Cards, sheets, modals, the Bingo card's squares.")
c('neutral-surface-2', '{brand-base}', "Table stripes and inset panels: the base ground, one step down from white.")
c('neutral-surface-3', '{brand-purple-tint}', "Chips, tracks, pressed rows. Text on it is neutral-fg-muted or darker.")
c('neutral-on-fill', '#ffffff', "Text and icons on a dark fill: brand-purple, brand-ink, admin, the pro gradient.")
c('scrim', 'rgba(22, 19, 31, 0.58)', "The one dimmed room behind every sheet, overlay and dialog: ink at 58%.")

# Products: each has a fill, a tint, a text shade and an on-colour
c('admin', '#6d28d9', "Mole Admin (the den). Main button with white text ({r:admin-on/admin}).")
c('admin-tint', '#ebe1fa', "Soft admin backgrounds.")
c('admin-text', '{admin}', "Small admin text on white ({r:admin-text/neutral-surface}) or admin-tint ({r:admin-text/admin-tint}).")
c('admin-on', '#ffffff', "Text and icons on the admin fill.")
c('loop', '#22c55e', "Loop, the B2B product: fills take ink ({r:loop-on/loop}). White on it is {r:neutral-on-fill/loop} and fails: never.")
c('loop-tint', '#e0f7e8', "Soft Loop backgrounds.")
c('loop-text', '#157c3b', "Small Loop text on white ({r:loop-text/neutral-surface}) or loop-tint ({r:loop-text/loop-tint}).")
c('loop-on', '{brand-ink}', "Text and icons on the loop fill.")
c('loop-chrome', '#1e2235', "The Loop dashboard's sidebar. White on it {r:neutral-on-fill/loop-chrome}; the active item in loop green {r:loop/loop-chrome}.")
c('loop-ground', '#f3f6fa', "The Loop dashboard's page ground. Ink {r:brand-ink/loop-ground}.")
c('events', '#ffb088', "Events: badges, the Events tab, an event header with no accent of its own. Ink on it {r:events-on/events}.")
c('events-tint', '#fff4ee', "Soft Events backgrounds.")
c('events-text', '#c54200', "Small Events text on white ({r:events-text/neutral-surface}) or events-tint ({r:events-text/events-tint}).")
c('events-on', '{brand-ink}', "Text and icons on the events fill.")
c('spaces', '#5ec8d8', "Spaces (buildings): badges and headers. Ink on it {r:spaces-on/spaces}.")
c('spaces-tint', '#e8f7fa', "Soft Spaces backgrounds.")
c('spaces-text', '#217987', "Small Spaces text on white ({r:spaces-text/neutral-surface}) or spaces-tint ({r:spaces-text/spaces-tint}).")
c('spaces-on', '{brand-ink}', "Text and icons on the spaces fill.")

# Status: separate from the brand, always with an icon and a word
# Text shades are Mole Bingo's (in its code, and darker: 4.8 to 6.5:1 on every ground); fills, tints
# and borders are the Mole Brand package's, which Mole V3's code uses.
for s, fill, tint, text, border in [
    ('success', '#22c55e', '#dcfce7', '#1f7a4d', '#bbf7d0'),
    ('warning', '#f59e0b', '#fef3c7', '#8a5a00', '#fde68a'),
    ('error',   '#ef4444', '#fee2e2', '#b3261e', '#fecaca'),
    ('info',    '#3b82f6', '#dbeafe', '#0a5de3', '#bfdbfe')]:
    c(f'status-{s}', fill, f"The {s} state's fill: icons, dots, bars. Always with an icon and a word, never colour alone. Ink on it {{r:brand-ink/status-{s}}}." + (" Shares its green with loop." if s == 'success' else ''))
    c(f'status-{s}-tint', tint, f"Background of a {s} notice.")
    c(f'status-{s}-text', text, f"{s.capitalize()} text on white ({{r:status-{s}-text/neutral-surface}}) or status-{s}-tint ({{r:status-{s}-text/status-{s}-tint}}).")
    c(f'status-{s}-border', border, f"Border of a {s} notice.")

# The Rally: Mole Bingo's light, playful register (the guest's phone, the host console)
c('rally', '{brand-base}', "The Rally's ground, fading to rally-deep. The same colour as brand-base.")
c('rally-deep', '#ece3ff', "The deep end of the Rally ground gradient. Ink {r:brand-ink/rally-deep}, neutral-fg-muted {r:neutral-fg-muted/rally-deep}.")
c('rally-card', '#fffdf3', "The Bingo card: warm paper. Ink {r:brand-ink/rally-card}, brand-purple-text {r:brand-purple-text/rally-card}.")
c('rally-tile', '{neutral-surface}', "A square on the card, and the desk's white panels.")
c('rally-filled', '#fff7e0', "A stamped square. Ink {r:brand-ink/rally-filled}.")
c('rally-pink', '#e84393', "Graphics only: the stamp badge, its +1 bubble, counters. {r:rally-pink/rally-card} on the card, so never text.")
c('line', 'rgba(123, 79, 219, 0.16)', "The purple hairline around the desk's white panels (the Rally's own; neutral-border is the same line on white).")
c('line-firm', 'rgba(123, 79, 219, 0.34)', "The firmer purple outline: Rally inputs, hovered tiles.")
c('berry', '#c2306e', "The far end of the brand gradient (brand-purple to berry). Graphics only.")
c('lavender', '#e6dcff', "Soft tint for decorative Rally fields. Ink {r:brand-ink/lavender}.")
c('pink-soft', '#ffe3ee', "Soft pink; the far end of the soft gradient. Ink {r:brand-ink/pink-soft}.")
c('mint', '#d8f5ea', "Success tint on the Rally. mint-ink on it {r:mint-ink/mint}.")
c('mint-ink', '#0f6b4e', "Success text on the Rally, and the WhatsApp button (white on it {r:neutral-on-fill/mint-ink}).")
c('mint-bright', '#34d399', "Bright success accent in pictures. Ink {r:brand-ink/mint-bright}.")

# The Board: Mole Bingo's dark, live register (the wall, the HUD, the Live hero)
c('board', '#171226', "The Board's ground: anything live and read at a distance. board-fg {r:board-fg/board}, board-muted {r:board-muted/board}, brand-yellow {r:brand-yellow/board}.")
c('board-2', '#221b3a', "The Board's raised fields: the door strip, panels. board-fg {r:board-fg/board-2}, board-muted {r:board-muted/board-2}.")
c('board-fg', '#f6f3ff', "Text on board and board-2.")
c('board-muted', '#b8aedc', "Secondary text on board and board-2.")
c('board-lilac', '#cfc8e8', "Labels and quiet text on board ({r:board-lilac/board}).")
c('board-line', 'rgba(255, 255, 255, 0.13)', "Hairlines on the Board.")
c('board-line-firm', 'rgba(255, 255, 255, 0.24)', "Stronger dividers and outlines on the Board.")
c('board-ok', '#7de0a8', "Good news on the Board: the word 'Bingo' on a projector ({r:board-ok/board}).")
c('pink-mid', '#ffc2d6', "The End-session warning on the Board: text and outline ({r:pink-mid/board}).")
c('amber-soft', '#ffd98a', "Paused and late-clock warnings on the Board ({r:amber-soft/board}).")

# The Programme: paper, for printed and document-like pages
c('paper-ground', '#faf8f2', "The Programme's page ground: printed reports, document pages. Ink {r:brand-ink/paper-ground}, neutral-fg-muted {r:neutral-fg-muted/paper-ground}.")
c('paper', '{rally-card}', "Paper surfaces on the Programme.")
c('rule', '#e2dcce', "Hairline rules on the Programme.")
c('rule-firm', '#c9c1ae', "Stronger rules on the Programme.")

# The Underground: the marketing sites' world (preview.mole.is, soon.mole.is)
for i, v in enumerate(['oklch(0.90 0.045 72)', 'oklch(0.875 0.05 70)', 'oklch(0.85 0.055 69)',
                       'oklch(0.83 0.06 68)', 'oklch(0.81 0.06 67)', 'oklch(0.79 0.065 66)']):
    c(f'soil-{i}', v, f"The Underground's soil, layer {i} from the surface down" + (": the ground band under Sunny on the marketing pages. Ink on it {r:brand-ink/soil-0}." if i == 0 else "."))
c('void', '#0c0a12', "The deepest Underground: the caverns' darkness on the marketing pages. board-fg on it {r:board-fg/void}.")
c('sunny-deep', '#f5b800', "Sunny's yellow in shadow: the Underground's highlights and edges. Graphics only.")
c('purple-deep', '#5a36ad', "Purple in shadow: the Underground's depth and the pro gradient's far end. White on it {r:neutral-on-fill/purple-deep}.")

# ── contrast ──────────────────────────────────────────────────────────────────
BY = {t['name']: t for t in C}
def resolve(name, seen=()):
    v = BY[name]['value']
    m = re.fullmatch(r'\{([\w.-]+)\}', v)
    if m:
        assert m.group(1) in BY and m.group(1) not in seen, f'bad alias {name} -> {v}'
        return resolve(m.group(1), seen + (name,))
    return v

def rgb(v, ground=(255, 255, 255)):
    v = v.strip()
    if v.startswith('#'):
        h = v[1:]; h = ''.join(ch * 2 for ch in h) if len(h) == 3 else h
        return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
    m = re.fullmatch(r'rgba?\(([^)]*)\)', v)
    if m:
        p = [float(x) for x in re.split(r'[\s,/]+', m.group(1).strip()) if x]
        a = p[3] if len(p) > 3 else 1
        return tuple(p[i] * a + ground[i] * (1 - a) for i in range(3))
    m = re.fullmatch(r'oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\)', v)
    if m:   # OKLCH -> linear sRGB -> sRGB
        import math
        L, Cc, H = map(float, m.groups()); a, b = Cc * math.cos(math.radians(H)), Cc * math.sin(math.radians(H))
        l_, m_, s_ = L + .3963377774 * a + .2158037573 * b, L - .1055613458 * a - .0638541728 * b, L - .0894841775 * a - 1.2914855480 * b
        l, mm, s = l_ ** 3, m_ ** 3, s_ ** 3
        lin = (4.0767416621 * l - 3.3077115913 * mm + .2309699292 * s, -1.2684380046 * l + 2.6097574011 * mm - .3413193965 * s, -.0041960863 * l - .7034186147 * mm + 1.7076147010 * s)
        f = lambda x: 255 * (12.92 * x if x <= .0031308 else 1.055 * x ** (1 / 2.4) - .055)
        return tuple(max(0, min(255, f(x))) for x in lin)
    raise ValueError(v)

def lum(c3):
    f = lambda x: (x / 255) / 12.92 if x / 255 <= .04045 else ((x / 255 + .055) / 1.055) ** 2.4
    r, g, b = map(f, c3); return .2126 * r + .7152 * g + .0722 * b

def ratio(fg, bg):
    b = rgb(resolve(bg)); f = rgb(resolve(fg), b)
    hi, lo = sorted([lum(f), lum(b)], reverse=True)
    return (hi + .05) / (lo + .05)

for t in C:
    t['usage'] = re.sub(r'\{r:([\w.-]+)/([\w.-]+)\}', lambda m: f'{ratio(m.group(1), m.group(2)):.2f}:1', t['usage'])

# Every pair the system promises, with its floor: 4.5 for text, 3 for large text, icons and marks.
CHECKS = [(fg, bg, 4.5) for fg, bg in [
    ('neutral-fg', 'neutral-surface'), ('neutral-fg', 'brand-base'), ('neutral-fg', 'rally-deep'), ('neutral-fg', 'rally-card'),
    ('neutral-fg', 'paper-ground'), ('neutral-fg', 'loop-ground'), ('neutral-fg', 'neutral-surface-3'),
    ('neutral-fg-muted', 'neutral-surface'), ('neutral-fg-muted', 'brand-base'), ('neutral-fg-muted', 'neutral-surface-3'),
    ('neutral-fg-muted', 'rally-deep'), ('neutral-fg-muted', 'paper-ground'), ('neutral-fg-muted', 'loop-ground'), ('neutral-fg-muted', 'rally-card'),
    ('neutral-fg-subtle', 'neutral-surface'), ('neutral-fg-subtle', 'brand-base'), ('neutral-fg-subtle', 'rally-card'),
    ('neutral-fg-subtle', 'loop-ground'), ('neutral-fg-subtle', 'paper-ground'),
    ('neutral-fg-subtle', 'neutral-surface-3'), ('neutral-fg-subtle', 'rally-deep'), ('neutral-fg-subtle', 'rally-filled'),
    ('neutral-fg-muted', 'lavender'), ('neutral-fg-muted', 'admin-tint'), ('neutral-fg-muted', 'rally-filled'),
    ('neutral-on-fill', 'brand-purple'), ('neutral-on-fill', 'brand-purple-hover'), ('neutral-on-fill', 'brand-ink'),
    ('neutral-on-fill', 'purple-deep'), ('neutral-on-fill', 'mint-ink'), ('neutral-on-fill', 'loop-chrome'),
    ('brand-purple-text', 'neutral-surface'), ('brand-purple-text', 'brand-base'), ('brand-purple-text', 'brand-purple-tint'), ('brand-purple-text', 'rally-card'),
    ('brand-yellow-text', 'neutral-surface'), ('brand-yellow-text', 'brand-yellow-tint'), ('brand-ink', 'brand-yellow'),
    ('admin-on', 'admin'), ('admin-text', 'neutral-surface'), ('admin-text', 'admin-tint'),
    ('loop-on', 'loop'), ('loop-text', 'neutral-surface'), ('loop-text', 'loop-tint'),
    ('events-on', 'events'), ('events-text', 'neutral-surface'), ('events-text', 'events-tint'),
    ('spaces-on', 'spaces'), ('spaces-text', 'neutral-surface'), ('spaces-text', 'spaces-tint'),
    ('mint-ink', 'mint'), ('brand-ink', 'soil-0'),
    ('board-fg', 'board'), ('board-fg', 'board-2'), ('board-muted', 'board'), ('board-muted', 'board-2'), ('board-lilac', 'board'),
    ('brand-yellow', 'board'), ('board-ok', 'board'), ('pink-mid', 'board'), ('amber-soft', 'board'), ('board-fg', 'void'),
]] + [(f'status-{s}-text', g, 4.5) for s in ('success', 'warning', 'error', 'info') for g in ('neutral-surface', f'status-{s}-tint')] \
  + [('loop', 'loop-chrome', 3.0)]

fails = [(f, b, round(ratio(f, b), 2), floor) for f, b, floor in CHECKS if ratio(f, b) < floor]

# ── type ───────────────────────────────────────────────────────────────────────
FONTS = [{'family': 'Poppins', 'file': f'fonts/poppins-latin-{w}-normal.woff2', 'weight': str(w), 'style': 'normal'} for w in (400, 500, 600, 700, 800, 900)] + \
        [{'family': 'IBM Plex Mono', 'file': f'fonts/ibm-plex-mono-latin-{w}-normal.woff2', 'weight': str(w), 'style': 'normal'} for w in (400, 500)]
def st(name, size, lh, weight, sample, usage, ls=None, transform=None):
    d = {'name': name, 'fontSize': size, 'lineHeight': lh, 'fontWeight': weight}
    if ls: d['letterSpacing'] = ls
    if transform: d['textTransform'] = transform
    d['sample'] = sample; d['usage'] = usage; return d
TYPE = {
    'fonts': FONTS,
    'families': {'sans': '"Poppins", system-ui, -apple-system, sans-serif',
                 'mono': '"IBM Plex Mono", ui-monospace, "SFMono-Regular", Menlo, monospace'},
    'groups': [
        {'name': 'Headlines', 'family': 'sans', 'styles': [
            st('statement', '38px', '1.05', 900, 'Remember who matters.', 'The public-page and marketing headline (52px from the sm breakpoint). Black (900) is for display sizes only.', '-0.035em'),
            st('figure', '44px', '1', 800, 'READY', "The biggest figure on a phone: the lobby's dig timer, an invite code. Digits use tabular figures.", '-0.03em'),
            st('display', '28px', '1.15', 900, 'Menara Suria HQ', 'The one big thing on a screen: an event, a building, a session name in the Live hero.'),
            st('title', '22px', '1.2', 800, 'Who saved your card', 'Page and panel headings.', '-0.03em'),
            st('heading', '20px', '1.25', 800, 'Share', 'Sheet and drawer headings.', '-0.03em'),
            st('subheading', '18px', '1.3', 800, "What's true about you?", 'Card headings.', '-0.02em'),
        ]},
        {'name': 'Text', 'family': 'sans', 'styles': [
            st('lead', '17px', '1.4', 400, 'Capture contacts instantly. Track interactions.', 'Lead paragraphs and subheads.'),
            st('body-lg', '15px', '1.55', 400, 'Meet people, stamp your card, fill a line.', "Running text on marketing pages, and Sunny's speech bubbles."),
            st('body', '14px', '1.55', 400, 'Your card was saved by three people this week.', 'Body copy in the products.'),
            st('control', '14px', '1.5', 600, 'Save contact', 'Buttons, tabs, list rows: text a person acts on.'),
            st('small', '13px', '1.55', 400, 'Pick one that is true about you.', 'Helper text and notices.'),
            st('label', '12.5px', '1.5', 600, 'Quiet hours', 'Form labels and secondary text.'),
            st('meta', '12px', '1.4', 400, '2 Oct, 14:05', 'Captions and timestamps.'),
            st('micro', '11px', '1.3', 400, 'Choose your card', 'Legal lines and the smallest captions. The floor: nothing anyone reads is under 11px.'),
        ]},
        {'name': 'Eyebrows', 'family': 'sans', 'styles': [
            st('eyebrow', '12px', '1.3', 800, "You're in", 'Uppercase section labels. Typed in sentence case; the style makes it uppercase.', '0.14em', 'uppercase'),
            st('eyebrow-sm', '11px', '1.3', 800, 'Locked, round started', 'Uppercase chips and status words.', '0.13em', 'uppercase'),
        ]},
        {'name': 'Mono', 'family': 'mono', 'styles': [
            st('code', '13px', '1.5', 500, 'MOLE-7KQ2  ·  48 213', 'Codes, IDs and numbers that must line up: invite codes, card IDs, table figures. Never headings, labels or running text.'),
        ]},
    ]}

SPACE = [('space-0', '0px', 'None.'), ('space-1', '4px', 'Icon to its label.'), ('space-2', '8px', 'Between related controls.'),
         ('space-3', '12px', 'Inside chips and small panels.'), ('space-4', '16px', 'Card padding; the page gutter on a phone.'),
         ('space-5', '20px', 'Between cards.'), ('space-6', '24px', 'Section padding.'), ('space-8', '32px', 'Between page sections.'),
         ('space-10', '40px', "Above a page's first heading.")]
RADIUS = [('radius-sm', '4px', 'Form fields (Bingo radius-field).'), ('radius-md', '6px', 'Small controls in the app and the den.'),
          ('radius-lg', '8px', 'The small Button; small chips, tags and swatches (Bingo radius-rally-chip).'), ('radius-xl', '12px', 'The Button in the App, the den and Loop; rail tabs and menus (Bingo radius-rally-tab).'),
          ('radius-2xl', '16px', "The Bingo card's head strip; large panels in the app (Bingo radius-rally-head)."),
          ('radius-full', '999px', 'Pills: chips, avatars and round buttons everywhere; every button on the Rally, the Board, the Programme and the marketing sites (Bingo radius-control).'),
          ('radius-chip', '10px', 'Public pages: pills, tags, small avatars.'), ('radius-panel', '14px', "Public pages: an inset panel; the Bingo card's squares, KPI tiles, notices (Bingo radius-rally-tile)."),
          ('radius-card', '20px', 'Public pages: ordinary cards.'), ('radius-rally-panel', '18px', "The Rally desk's white panels."),
          ('radius-rally-card', '26px', 'The Bingo card, the Rally sheets and the Live hero.'), ('radius-feature', '28px', 'Public pages: the statement cards a page is built around.'),
          ('radius-sheet', '40px', 'Public pages: the top curve of the sheet a page sits on.')]
INK = '22, 19, 31'   # brand-ink as rgb, for shadows
SHADOW = [('shadow-subtle', f'0 1px 2px rgba({INK}, 0.04), 0 1px 1px rgba({INK}, 0.02)', 'Resting cards.'),
          ('shadow-medium', f'0 4px 8px rgba({INK}, 0.06), 0 2px 4px rgba({INK}, 0.04)', 'Hovered cards, menus.'),
          ('shadow-large', f'0 12px 24px rgba({INK}, 0.08), 0 4px 8px rgba({INK}, 0.04)', 'Sheets and popovers.'),
          ('shadow-elevated', f'0 24px 48px rgba({INK}, 0.12), 0 12px 24px rgba({INK}, 0.06)', 'Modals and the paywall.'),
          ('shadow-panel', '0 12px 30px rgba(20, 12, 40, 0.08)', 'A card lifted off the Rally ground.'),
          ('shadow-loud', '0 10px 22px rgba(123, 79, 219, 0.28)', "The Rally's loud purple button, and only that.")]
Z = [('z-base', '1', 'Ordinary content.'), ('z-dropdown', '1000', 'Menus inside a component.'), ('z-sticky', '1100', 'The bottom nav, sticky bars, the install banner.'),
     ('z-overlay', '1200', 'Every sheet and full-screen overlay.'), ('z-modal', '1300', 'Confirm dialogs, which can open over a sheet.'),
     ('z-popover', '1400', 'Popovers inside a modal.'), ('z-toast', '1500', 'Toasts, above everything.')]
lst = lambda rows: [{'name': n, 'value': v, 'usage': u} for n, v, u in rows]

tokens = {
    'name': 'Mole', 'version': 1,
    'meta': {'source': {'kind': 'merge', 'from': ['Mole Brand (Mole V3)', 'Mole Bingo (mole-rally)', 'the marketing sites (mole-rally sites/)'],
                        'decided': '2026-10-03: ink #16131F, purple-tinted greys, Poppins + IBM Plex Mono for codes'}},
    'color': {'themes': [{'id': 'light', 'name': 'Mole'}],
              'tokens': [{'name': t['name'], 'value': {'light': t['value']}, 'usage': t['usage']} for t in C]},
    'type': TYPE,
    'spacing': {'note': 'A 4px grid.', 'tokens': lst(SPACE)},
    'radius': {'tokens': lst(RADIUS)},
    'shadow': {'tokens': lst(SHADOW)},
    'zIndex': {'note': 'Anything fixed takes one of these layers; small numbers only order things inside one component.', 'tokens': lst(Z)},
}

# names are unique across families (the page drops duplicates)
names = [t['name'] for t in C] + [n for fam in (SPACE, RADIUS, SHADOW, Z) for n, _, _ in fam]
dups = sorted({n for n in names if names.count(n) > 1})

# ── CSS for the codebases ──────────────────────────────────────────────────────
def css():
    out = ['/* Mole design tokens: one file for Mole V3, Mole Bingo and the marketing sites.',
           '   Generated from the Mole Design System (tokens.json) by build_tokens.py. Do not edit by hand:',
           '   change the design system and regenerate, so every product keeps reading the same values. */', ':root {']
    for t in C:
        v = t['value']; m = re.fullmatch(r'\{([\w.-]+)\}', v)
        out.append(f'  --{t["name"]}: {"var(--" + m.group(1) + ")" if m else v};')
    out.append(f'  --font-sans: {TYPE["families"]["sans"]};')
    out.append(f'  --font-mono: {TYPE["families"]["mono"]};')
    for fam in (SPACE, RADIUS, SHADOW, Z):
        for n, v, _ in fam: out.append(f'  --{n}: {v};')
    out += ['  --duration-fast: 120ms;', '  --duration-normal: 200ms;', '  --duration-slow: 300ms;',
            '  --ease: cubic-bezier(0.4, 0, 0.2, 1);', '  --ease-enter: cubic-bezier(0.22, 1, 0.36, 1);',
            '  --ease-exit: cubic-bezier(0.4, 0, 1, 1);', '  --ease-spring: cubic-bezier(0.22, 1.5, 0.5, 1);',
            '  --gradient-glow: radial-gradient(circle, rgba(255, 232, 18, 0.35), transparent 70%);',
            '  --gradient-pro: linear-gradient(135deg, var(--brand-purple), var(--purple-deep));',
            '  --gradient-brand: linear-gradient(120deg, var(--brand-purple), var(--berry));',
            '  --gradient-soft: linear-gradient(120deg, var(--brand-purple-tint), var(--pink-soft));', '}']
    for g in TYPE['groups']:
        fam = 'var(--font-mono)' if g['family'] == 'mono' else 'var(--font-sans)'
        for s in g['styles']:
            decl = [f'font-family: {fam}', f'font-size: {s["fontSize"]}', f'line-height: {s["lineHeight"]}', f'font-weight: {s["fontWeight"]}']
            if 'letterSpacing' in s: decl.append(f'letter-spacing: {s["letterSpacing"]}')
            if 'textTransform' in s: decl.append(f'text-transform: {s["textTransform"]}')
            if s['name'] in ('figure', 'code'): decl.append('font-variant-numeric: tabular-nums')
            out.append(f'.type-{s["name"]} {{ {"; ".join(decl)}; }}')
    return '\n'.join(out) + '\n'

if __name__ == '__main__':
    # python3 build_tokens.py            -> mole-tokens.json and mole-tokens.css beside this file (a repo's brand/)
    # python3 build_tokens.py <dir>      -> also <dir>/project/tokens.json, for the Mole Design System artifact
    open(os.path.join(HERE, 'mole-tokens.json'), 'w').write(json.dumps(tokens, indent=1, ensure_ascii=False) + '\n')
    open(os.path.join(HERE, 'mole-tokens.css'), 'w').write(css())
    if len(sys.argv) > 1:
        os.makedirs(os.path.join(sys.argv[1], 'project'), exist_ok=True)
        json.dump(tokens, open(os.path.join(sys.argv[1], 'project', 'tokens.json'), 'w'), indent=1, ensure_ascii=False)
    print(f'{len(C)} colours, {sum(len(g["styles"]) for g in TYPE["groups"])} type styles, {len(SPACE)} spaces, {len(RADIUS)} radii, {len(SHADOW)} shadows, {len(Z)} layers')
    print(f'{len(CHECKS)} contrast pairs checked')
    for f, b, r, floor in fails: print(f'  FAIL {f} on {b}: {r}:1 (needs {floor})')
    for d in dups: print('  DUPLICATE NAME', d)
    sys.exit(1 if fails or dups else 0)
