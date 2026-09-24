"""Locate staff lines and noteheads in a score BMP (stdlib only).

Noteheads are found by erosion: a filled oval survives a 7x7 all-dark test;
staff lines (1-2px), stems (1-2px) and beams (~4-5px) do not.
"""
import struct, sys
from collections import deque

def load(path):
    d = open(path, 'rb').read()
    off = struct.unpack('<I', d[10:14])[0]
    w, h = struct.unpack('<ii', d[18:26])
    bpp = struct.unpack('<H', d[28:30])[0]
    absh = abs(h); topdown = h < 0
    stride = ((w * bpp // 8) + 3) & ~3
    px = bpp // 8
    g = [[0]*w for _ in range(absh)]
    for row in range(absh):
        src = off + row*stride
        y = row if topdown else absh - 1 - row
        line = d[src:src+w*px]
        gr = g[y]
        for x in range(w):
            b = line[x*px]; gn = line[x*px+1]; r = line[x*px+2]
            gr[x] = (r + gn + b)//3
    return g, w, absh

def staff_lines(g, w, y0, y1, x0, x1):
    span = x1 - x0
    rows = [y for y in range(y0, y1)
            if sum(1 for x in range(x0, x1) if g[y][x] < 128) > 0.55*span]
    lines, cur = [], [rows[0]] if rows else []
    for y in rows[1:]:
        if y - cur[-1] <= 2: cur.append(y)
        else: lines.append(sum(cur)/len(cur)); cur = [y]
    if cur: lines.append(sum(cur)/len(cur))
    return lines

def noteheads(g, w, h, y0, y1, x0, x1, thr=140, r=3):
    dark = [[1 if g[y][x] < thr else 0 for x in range(w)] for y in range(h)]
    # integral image
    I = [[0]*(w+1) for _ in range(h+1)]
    for y in range(h):
        s = 0
        for x in range(w):
            s += dark[y][x]
            I[y+1][x+1] = I[y][x+1] + s
    def box(a, b, c, d):  # y a..b, x c..d inclusive
        return I[b+1][d+1] - I[a][d+1] - I[b+1][c] + I[a][c]
    size = 2*r + 1
    surv = set()
    for y in range(max(y0, r), min(y1, h - r)):
        for x in range(max(x0, r), min(x1, w - r)):
            if dark[y][x] and box(y-r, y+r, x-r, x+r) == size*size:
                surv.add((y, x))
    blobs = []
    seen = set()
    for p in surv:
        if p in seen: continue
        q = deque([p]); seen.add(p); pts = []
        while q:
            cy, cx = q.popleft(); pts.append((cy, cx))
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    n = (cy+dy, cx+dx)
                    if n in surv and n not in seen:
                        seen.add(n); q.append(n)
        ys = [p0[0] for p0 in pts]; xs = [p0[1] for p0 in pts]
        blobs.append({'cx': sum(xs)/len(xs), 'cy': sum(ys)/len(ys),
                      'n': len(pts), 'w': max(xs)-min(xs)+1, 'h': max(ys)-min(ys)+1})
    blobs.sort(key=lambda b: b['cx'])
    return blobs

LETTERS = 'CDEFGAB'
def pitch_from_step(step_from_top, top_letter='A', top_octave=3):
    # step +1 = one diatonic step DOWN from the top staff line
    idx = LETTERS.index(top_letter) + top_octave*7 - step_from_top
    return LETTERS[idx % 7], idx // 7

if __name__ == '__main__':
    if len(sys.argv) == 2:
        # probe mode: find every staff line in the image, to pick the y-bands
        g, w, h = load(sys.argv[1])
        print('image %dx%d' % (w, h))
        lines = staff_lines(g, w, 0, h, w//4, 3*w//4)
        print('staff-line rows:', [round(v, 1) for v in lines])
        print('usage: read_notes.py <bmp> <staffY0> <staffY1> <blobY0> <blobY1> <x0> <x1> [bass|treble]')
        print('  staffY0..staffY1  band holding ONE staff (its 5 lines from the list above)')
        print('  blobY0..blobY1    band to search for noteheads (staff + ledger lines)')
        print('  x0..x1            start after the clef/key/time signatures')
        sys.exit(0)
    path, ly0, ly1, by0, by1, x0, x1 = sys.argv[1], *map(int, sys.argv[2:8])
    clef = sys.argv[8] if len(sys.argv) > 8 else 'bass'
    top_letter, top_octave = ('F', 5) if clef == 'treble' else ('A', 3)
    g, w, h = load(path)
    lines = staff_lines(g, w, ly0, ly1, x0, x1)
    print('staff lines:', [round(v,1) for v in lines])
    if len(lines) >= 2:
        sp = (lines[-1]-lines[0])/(len(lines)-1)
        top = lines[0]
        print('spacing %.2f, clef %s' % (sp, clef))
        for b in noteheads(g, w, h, by0, by1, x0, x1):
            if b['n'] < 8 or b['w'] > 26 or b['h'] > 18: continue
            step = round(2*(b['cy'] - top)/sp)
            L, o = pitch_from_step(step, top_letter, top_octave)
            print('x=%4d y=%5.1f step=%+d  %s%d  (n=%d %dx%d)'
                  % (b['cx'], b['cy'], step, L, o, b['n'], b['w'], b['h']))
