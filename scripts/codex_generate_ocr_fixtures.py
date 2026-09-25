from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json
import struct
import zlib


out = Path(__file__).resolve().parents[1] / "release" / "codex_t10_baseline_20260923"
out.mkdir(parents=True, exist_ok=True)
font = ImageFont.truetype(r"C:\Windows\Fonts\msyh.ttc", 52)
small = ImageFont.truetype(r"C:\Windows\Fonts\msyh.ttc", 32)


def screenshot(name, width, height):
    image = Image.new("RGB", (width, height), "#f5f4f0")
    draw = ImageDraw.Draw(image)
    for y in range(90, height - 100, 600):
        draw.rounded_rectangle((42, y, width - 42, min(height - 30, y + 440)), radius=24, fill="white", outline="#d1d5d2", width=2)
        draw.text((82, y + 42), "专辑：罗生门", font=font, fill="#171b1a")
        draw.text((82, y + 128), "艺人：麦浚龙", font=font, fill="#171b1a")
        draw.text((82, y + 230), "音乐截图识别基线 · 2026", font=small, fill="#454c47")
    path = out / name
    image.save(path, "JPEG", quality=88, optimize=True)
    return {"file": name, "width": width, "height": height, "bytes": path.stat().st_size}


manifest = [screenshot("codex_ocr_normal.jpg", 1080, 2400), screenshot("codex_ocr_long.jpg", 1080, 8000)]
image = Image.effect_noise((4000, 6000), 28).convert("RGB")
draw = ImageDraw.Draw(image)
draw.rounded_rectangle((180, 180, 3820, 1080), radius=50, fill="white")
draw.text((280, 320), "专辑：罗生门", font=font, fill="#171b1a")
draw.text((280, 510), "艺人：麦浚龙", font=font, fill="#171b1a")
path = out / "codex_ocr_gallery_high.jpg"
image.save(path, "JPEG", quality=90, optimize=True)
manifest.append({"file": path.name, "width": 4000, "height": 6000, "bytes": path.stat().st_size})

path = out / "codex_ocr_corrupt.png"
path.write_bytes(b"not a PNG")
manifest.append({"file": path.name, "bytes": path.stat().st_size})

ihdr = struct.pack(">IIBBBBB", 100000, 100000, 8, 2, 0, 0, 0)
chunk = struct.pack(">I", len(ihdr)) + b"IHDR" + ihdr
path = out / "codex_ocr_huge_header.png"
path.write_bytes(b"\x89PNG\r\n\x1a\n" + chunk + struct.pack(">I", zlib.crc32(chunk[4:])))
manifest.append({"file": path.name, "declared_width": 100000, "declared_height": 100000, "bytes": path.stat().st_size})

(out / "codex_ocr_fixture_manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(manifest, ensure_ascii=False))
