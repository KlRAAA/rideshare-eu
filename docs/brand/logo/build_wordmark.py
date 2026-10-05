"""Draws the RideShareEU wordmark as monoline letters that share the Pin car's geometry
(circles and straight strokes, round ends). Output: wordmark.svg (strokes, 26 units wide)."""
import math

BASE, XH, CAP, R = 200, 110, 60, 45          # baseline, x-height top, cap top, bowl radius
CY = BASE - R                                 # bowl centre line
W = 26                                        # stroke width

def pt(x, y):
    return f"{x:.1f} {y:.1f}"

def glyphs():
    g = {}
    # Each entry: (width of the centre-line box, list of path strings drawn from x = 0)
    g['R'] = (96, [f"M0 {BASE} V{CAP} H42 A42 42 0 0 1 42 144 H0", "M40 144 L96 200"])
    g['i'] = (0, [f"M0 {BASE} V{XH}"])
    g['d'] = (90, [f"M90 {CAP} V{BASE}", f"M{R} {CY} m-{R} 0 a{R} {R} 0 1 0 {2*R} 0 a{R} {R} 0 1 0 -{2*R} 0"])
    e_end = (R + R*math.cos(math.radians(45)), CY + R*math.sin(math.radians(45)))
    g['e'] = (90, [f"M0 {CY} H90 A{R} {R} 0 1 0 {pt(*e_end)}"])
    # S: two stacked loops, radius 35, centres 70 apart.
    s_r, top_c, bot_c, sx = 35, 95, 165, 38
    a = math.radians(30)
    s_start = (sx + s_r*math.cos(-a), top_c + s_r*math.sin(-a))
    s_end = (sx - s_r*math.cos(-a), bot_c - s_r*math.sin(-a))
    g['S'] = (76, [f"M{pt(*s_start)} A{s_r} {s_r} 0 1 0 {pt(sx, top_c + s_r)} A{s_r} {s_r} 0 1 1 {pt(*s_end)}"])
    g['h'] = (90, [f"M0 {CAP} V{BASE}", f"M0 {CY} A{R} {R} 0 0 1 90 {CY} V{BASE}"])
    g['a'] = (90, [f"M90 {XH} V{BASE}", f"M{R} {CY} m-{R} 0 a{R} {R} 0 1 0 {2*R} 0 a{R} {R} 0 1 0 -{2*R} 0"])
    g['r'] = (52, [f"M0 {BASE} V{XH}", f"M0 {CY} A{R} {R} 0 0 1 {R} {XH} H52"])
    g['E'] = (70, [f"M70 {CAP} H0 V{BASE} H70", "M0 130 H58"])
    g['U'] = (90, [f"M0 {CAP} V{CY} A{R} {R} 0 0 0 90 {CY} V{CAP}"])
    return g

# Optical gaps between glyph boxes (centre line to centre line minus widths).
GAP = {('R','i'): 42, ('i','d'): 38, ('d','e'): 38, ('e','S'): 38, ('S','h'): 40, ('h','a'): 38,
       ('a','r'): 38, ('r','e'): 30, ('e','E'): 40, ('E','U'): 42}

def build(word="RideShareEU", x0=11 + 0.0):
    g = glyphs()
    x = x0 + W/2
    paths = []
    for i, ch in enumerate(word):
        width, ds = g[ch]
        paths.append(f'<g transform="translate({x:.1f} 0)">' + ''.join(f'<path d="{d}"/>' for d in ds) + '</g>')
        if ch == 'i':
            paths.append(f'<circle cx="{x:.1f}" cy="74" r="13" fill="currentColor" stroke="none"/>')
        if i + 1 < len(word):
            x += width + GAP[(ch, word[i+1])]
    total = x + g[word[-1]][0] + W/2 + x0
    return paths, total

paths, total = build()
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 {CAP - 26} {total:.0f} {BASE - CAP + 52}" color="#000">
  <title>RideShareEU</title>
  <!-- Custom monoline wordmark: circles of radius {R} and straight strokes, {W} wide, round ends. -->
  <g fill="none" stroke="currentColor" stroke-width="{W}" stroke-linecap="round" stroke-linejoin="round">
    {"".join(paths)}
  </g>
</svg>
'''
open('wordmark.svg', 'w', encoding='utf-8').write(svg)
print('width', round(total))
