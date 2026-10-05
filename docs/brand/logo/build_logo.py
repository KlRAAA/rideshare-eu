"""Builds the RideShareEU master logo files from one geometry definition.

The mark ("Pin car"): a map pin laid on its side is the car body. Its point is the nose (the car
moves right), its round hole is the rear window, and two wheels sit just below.

Outputs (black masters; colour versions come from export_variants.py):
  symbol.svg             the mark on a 256 x 256 canvas
  symbol-small.svg       simplified cut for 16-32 px (bigger window, wheels and gaps)
  lockup-horizontal.svg  mark + wordmark side by side
  lockup-stacked.svg     mark above the wordmark
Run build_wordmark.py first (it writes wordmark.svg, which the lockups embed).
"""
import math
import re

SQRT_HALF = 1 / math.sqrt(2)


def pin_car(cx=84.0, cy=110.0, r=62.0, floor=158.0, window_r=25.0, wheel_r=22.0, wheel_gap=8.0, rear_wheel=84.0,
            front_inset=48.0):
    """Returns (body path, wheel circles, nose x, wheel bottom y). Roof line is exactly 45 degrees."""
    tangent = (cx + r * SQRT_HALF, cy - r * SQRT_HALF)
    nose = tangent[0] + (floor - tangent[1])
    rear_angle = math.pi - math.asin((floor - cy) / r)
    rear = (cx + r * math.cos(rear_angle), floor)
    body = (f"M{nose:.1f} {floor:.1f} L{tangent[0]:.1f} {tangent[1]:.1f} "
            f"A{r:g} {r:g} 0 0 0 {rear[0]:.1f} {rear[1]:.1f} Z "
            f"M{cx - 4 - window_r:.1f} {cy - 2:.1f} a{window_r:g} {window_r:g} 0 1 0 {2 * window_r:g} 0 "
            f"a{window_r:g} {window_r:g} 0 1 0 {-2 * window_r:g} 0 Z")
    wheel_y = floor + wheel_gap + wheel_r
    wheels = [(rear_wheel, wheel_y, wheel_r), (nose - front_inset, wheel_y, wheel_r)]
    return body, wheels, nose, wheel_y + wheel_r, cx - r, cy - r


def mark_group(color="#000", **geometry):
    body, wheels, nose, bottom, left, top = pin_car(**geometry)
    circles = "".join(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{wr:g}"/>' for x, y, wr in wheels)
    return (f'<g fill="{color}"><path fill-rule="evenodd" d="{body}"/>{circles}</g>'), (left, top, nose, bottom)


def centred(group, box, size=256.0, fill=0.70):
    """Scales the mark so its larger side is `fill` of the canvas, and centres it (optically 2% high)."""
    left, top, right, bottom = box
    w, h = right - left, bottom - top
    s = size * fill / max(w, h)
    tx = (size - w * s) / 2 - left * s
    ty = (size - h * s) / 2 - top * s - size * 0.02
    return f'<g transform="translate({tx:.2f} {ty:.2f}) scale({s:.4f})">{group}</g>'


def svg(view_box, body, title="RideShareEU"):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{view_box}">\n'
            f'  <title>{title}</title>\n  {body}\n</svg>\n')


def wordmark_parts():
    raw = open("wordmark.svg", encoding="utf-8").read()
    vb = [float(v) for v in re.search(r'viewBox="([^"]+)"', raw).group(1).split()]
    inner = re.search(r"<g fill=\"none\".*</g>", raw, re.S).group(0)
    return vb, inner.replace('stroke="currentColor"', 'stroke="#000"').replace('fill="currentColor"', 'fill="#000"')


def main():
    group, box = mark_group()
    open("symbol.svg", "w", encoding="utf-8").write(svg("0 0 256 256", centred(group, box)))

    # Small-size cut: same idea, but a larger window, chunkier wheels and wider gaps so 16 px stays readable.
    small, small_box = mark_group(window_r=28.0, wheel_r=25.0, wheel_gap=13.0, rear_wheel=86.0, front_inset=52.0)
    open("symbol-small.svg", "w", encoding="utf-8").write(svg("0 0 256 256", centred(small, small_box, fill=0.86)))

    # Lockups: the wordmark's baseline sits on the same ground as the wheels, and its cap height is about
    # 60 % of the car's height, so the mark leads and the name follows.
    (vx, vy, vw, vh), letters = wordmark_parts()
    left, top, right, bottom = box
    cap_top, baseline = 60.0, 200.0                       # wordmark units (see build_wordmark.py)
    mark_h = bottom - top
    s = 0.60 * mark_h / (baseline - cap_top)
    gap = 0.30 * mark_h                                   # space between the car's nose and the R
    word_x = right + gap - (vx + 13) * s                  # vx + 13 = the R's stroke edge
    word_y = bottom - baseline * s
    word_w = vw * s
    width = word_x + (vx + vw) * s - left + 24
    horizontal = (f'<g transform="translate({24 - left:.2f} 0)">{group}'
                  f'<g transform="translate({word_x:.2f} {word_y:.2f}) scale({s:.4f})">{letters}</g></g>')
    open("lockup-horizontal.svg", "w", encoding="utf-8").write(
        svg(f"0 {top - 24:.1f} {width:.1f} {mark_h + 48:.1f}", horizontal))

    # Stacked: the car is about half the wordmark's width, centred above it.
    mark_w = right - left
    k = 0.48 * word_w / mark_w                            # mark scale in the stacked version
    stack_w = word_w + 48
    mark_x = (stack_w - mark_w * k) / 2 - left * k
    mark_y = 24 - top * k
    word_top = 24 + mark_h * k + 0.35 * mark_h * k
    word_x2 = (stack_w - word_w) / 2 - vx * s
    word_y2 = word_top - (cap_top - 13) * s
    total_h = word_top + (baseline + 13 - cap_top + 13) * s + 24
    stacked = (f'<g transform="translate({mark_x:.2f} {mark_y:.2f}) scale({k:.4f})">{group}</g>'
               f'<g transform="translate({word_x2:.2f} {word_y2:.2f}) scale({s:.4f})">{letters}</g>')
    open("lockup-stacked.svg", "w", encoding="utf-8").write(svg(f"0 0 {stack_w:.1f} {total_h:.1f}", stacked))
    print("wrote symbol.svg, symbol-small.svg, lockup-horizontal.svg, lockup-stacked.svg")


if __name__ == "__main__":
    main()
