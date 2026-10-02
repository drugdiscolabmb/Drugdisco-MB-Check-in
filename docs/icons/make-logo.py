import math
from PIL import Image
N = 32
BG, OUT, RED, RED_D, CREAM, CREAM_D, HI, GRN, GRN_D, WHITE = '#16181d', '#0b0c0f', '#e5383b', '#a8262a', '#f6efe2', '#cdbfa8', '#ffffff', '#3ec46d', '#23874a', '#ffffff'
g = [[BG]*N for _ in range(N)]
cx, cy = 13.8, 13.8           # capsule centre (shifted up-left to leave room for the badge)
L, R = 7.0, 6.0               # half-length of straight part, radius
ang = math.radians(-45)
def local(x, y):
    dx, dy = x + .5 - cx, y + .5 - cy
    u = (dx - dy) / math.sqrt(2)      # along the capsule (bottom-left → top-right)
    v = (dx + dy) / math.sqrt(2)      # across it (+ = lower-right side)
    return u, v
def inside(x, y):
    u, v = local(x, y)
    uu = max(abs(u) - L, 0)
    return uu*uu + v*v <= R*R
for y in range(N):
    for x in range(N):
        if not inside(x, y): continue
        edge = any(not (0 <= x+a < N and 0 <= y+b < N and inside(x+a, y+b)) for a, b in ((1,0),(-1,0),(0,1),(0,-1)))
        u, v = local(x, y)
        if edge: g[y][x] = OUT; continue
        top = u > 0                                   # top-right half = red
        if abs(u) < .5: g[y][x] = RED_D if u >= 0 else CREAM_D; continue      # seam between halves
        shade = v > R - 2.4                           # lower side shadow
        g[y][x] = (RED_D if shade else RED) if top else (CREAM_D if shade else CREAM)
        if -R + 1.2 < v < -R + 2.4 and 1.4 < abs(u) < L + 1.0: g[y][x] = HI   # highlight stripe
# check badge (bottom-right)
CHECK = []
for (x, y) in [(20,24),(21,25),(22,26),(23,25),(24,24),(25,23),(26,22),(27,21)]:
    CHECK += [(x, y), (x, y-1)]
bx, by, br = 24.0, 24.0, 6.25
def inb(x, y): return (x + .5 - bx)**2 + (y + .5 - by)**2 <= br*br
for y in range(N):
    for x in range(N):
        if inb(x, y):
            edge = any(not inb(x+a, y+b) for a, b in ((1,0),(-1,0),(0,1),(0,-1)))
            g[y][x] = OUT if edge else (GRN_D if (x + .5 - bx) + (y + .5 - by) > 3.2 else GRN)
for x, y in CHECK:
    g[y][x] = WHITE
open('/home/claude/logo/grid.txt','w').write('\n'.join(''.join({BG:'.',OUT:'#',RED:'R',RED_D:'r',CREAM:'C',CREAM_D:'c',HI:'H',GRN:'G',GRN_D:'g'}.get(c,'W') for c in row) for row in g))
# SVG (crisp pixels)
rects = []
for y in range(N):
    x = 0
    while x < N:
        c = g[y][x]; w = 1
        while x + w < N and g[y][x+w] == c: w += 1
        if c != BG: rects.append(f'<rect x="{x}" y="{y}" width="{w}" height="1" fill="{c}"/>')
        x += w
def svg(bg=True, rounded=True):
    back = f'<rect width="{N}" height="{N}" rx="{7 if rounded else 0}" fill="{BG}"/>' if bg else ''
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {N} {N}" shape-rendering="crispEdges">{back}{"".join(rects)}</svg>\n'
open('/home/claude/logo/logo.svg','w').write(svg())
img = Image.new('RGB', (N, N))
for y in range(N):
    for x in range(N): img.putpixel((x, y), tuple(int(g[y][x][i:i+2], 16) for i in (1,3,5)))
img.save('/home/claude/logo/logo24.png')
def scaled(size, pad=0):
    s = (size - 2*pad) // N; off = (size - s*N) // 2
    c = Image.new('RGB', (size, size), BG); c.paste(img.resize((s*N, s*N), Image.NEAREST), (off, off)); return c
for size, name, pad in [(180,'apple-touch-icon.png',6),(192,'icon-192.png',0),(512,'icon-512.png',0),(512,'icon-maskable-512.png',72),(48,'favicon-48.png',0)]:
    scaled(size, pad).save('/home/claude/logo/'+name)
scaled(48).save('/home/claude/logo/favicon.ico', sizes=[(48,48)])
big = scaled(480); big.save('/home/claude/logo/preview.png')
