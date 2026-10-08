"""Inspect source captures and rendered frames without altering the originals."""
from pathlib import Path
from PIL import Image, ImageDraw
import json
import sys

project = Path(__file__).resolve().parents[1]
theme = '--theme' in sys.argv
assets = project / 'public' / ('codex_theme_v5' if theme else 'codex_light')
qa = project / 'qa' / 'v6'
sizes = {p.name: list(Image.open(p).size) for p in assets.glob('*.png')}
(assets / 'codex_sizes.json').write_text(json.dumps(sizes, indent=2), encoding='utf-8')
groups = {
    'ui': ['reader','quick_empty','quick_filled','quick_saved','relisten_blind','yearbook'],
    'details': ['archive_card','rating','moods','genre_result','dimensions','dimensions_after','comparison_score','months_grid','year_facts','poster_3'],
}
if theme:
    groups = {
        'ui': ['theme_home_light','theme_home_dark','theme_reader_light','theme_reader_menu_light','theme_reader_menu_dark','theme_reader_dark'],
        'details': ['theme_appearance_light','theme_appearance_dark','theme_reader_controls_light','theme_reader_controls_dark','theme_reader_controls_light_after'],
    }
for group, names in groups.items():
    cols=3 if group=='ui' else 5
    w,h=(390,870) if group=='ui' else (380,550)
    sheet=Image.new('RGB',(cols*w,((len(names)+cols-1)//cols)*h),'#f3f6f0')
    d=ImageDraw.Draw(sheet)
    for i,name in enumerate(names):
        im=Image.open(assets/f'codex_{name}.png').convert('RGB')
        im.thumbnail((w-20,h-42))
        x=(i%cols)*w+(w-im.width)//2;y=(i//cols)*h+30
        sheet.paste(im,(x,y))
        d.text(((i%cols)*w+12,(i//cols)*h+8),name,fill='#161712')
    tag='' if theme else 'light_'
    sheet.save(qa/f'codex_{tag}sources_{group}.jpg',quality=88)
print(json.dumps(sizes))
