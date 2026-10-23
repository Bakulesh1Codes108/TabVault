# Generates simple PNG icons (blue rounded square with a white "archive box") without any libraries.
import zlib, struct, os
def png(path, n):
    rows = []
    r = n * 0.22
    for y in range(n):
        row = bytearray([0])
        for x in range(n):
            # rounded-square mask
            cx = min(max(x, r), n - 1 - r); cy = min(max(y, r), n - 1 - r)
            inside = (x - cx) ** 2 + (y - cy) ** 2 <= r * r
            if not inside: row += bytes([0, 0, 0, 0]); continue
            t = y / n
            col = (int(36 + 40 * t), int(83 - 20 * t), int(214 - 30 * t), 255)
            u, v = x / n, y / n
            lid = 0.22 <= u <= 0.78 and 0.28 <= v <= 0.38
            box = 0.27 <= u <= 0.73 and 0.40 <= v <= 0.74
            slot = 0.42 <= u <= 0.58 and 0.48 <= v <= 0.53
            if (lid or box) and not slot: col = (255, 255, 255, 255)
            row += bytes(col)
        rows.append(bytes(row))
    raw = zlib.compress(b"".join(rows), 9)
    def chunk(t, d): return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    data = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", n, n, 8, 6, 0, 0, 0)) + chunk(b"IDAT", raw) + chunk(b"IEND", b"")
    open(path, "wb").write(data)
d = os.path.join(os.path.dirname(os.path.abspath(__file__)), "extension", "icons")
for s in (16, 32, 48, 96, 128, 256, 512): png(os.path.join(d, f"icon{s}.png"), s)
