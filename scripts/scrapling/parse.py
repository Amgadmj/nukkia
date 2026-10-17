"""Offline HTML parser. Network collection remains in Nukkia's validated gateway."""
import json
import sys
from scrapling.parser import Selector

if "--palette" in sys.argv:
    import base64
    import io
    from PIL import Image
    Image.MAX_IMAGE_PIXELS = 4_000_000
    raw = base64.b64decode(sys.stdin.read(800_001), validate=True)
    if len(raw) > 600_000:
        raise ValueError("Image above limit")
    image = Image.open(io.BytesIO(raw)).convert("RGBA")
    image.thumbnail((128, 128))
    canvas = Image.new("RGBA", image.size, "white")
    canvas.alpha_composite(image)
    palette = canvas.convert("RGB").quantize(colors=6).convert("RGB")
    colors = sorted(palette.getcolors(16384) or [], reverse=True)
    print(json.dumps({"colors": ["#%02x%02x%02x" % color for count, color in colors]}))
    sys.exit(0)

html = sys.stdin.read(1_000_001)
if len(html.encode("utf-8")) > 1_000_000:
    raise ValueError("HTML above collection limit")
page = Selector(html)
blocks = page.css("h1, h2, h3, h4, h5, p, li, dt, dd, a[href*='especial'], a[href*='servi'], a[href*='tratamento'], a[href*='exame']")
text = "\n".join(dict.fromkeys(
    " ".join(node.get_all_text().split()) for node in blocks
))[:10000]
print(json.dumps({"text": text}, ensure_ascii=False))
