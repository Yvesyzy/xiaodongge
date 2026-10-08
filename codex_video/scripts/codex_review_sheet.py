from pathlib import Path
from PIL import Image, ImageDraw, ImageStat
import re
import sys
import json

root=Path(__file__).resolve().parents[1]
final='--final' in sys.argv
version=next((value.split('=',1)[1] for value in sys.argv if value.startswith('--version=')),'v6')
if version!='v6':
    raise ValueError('The current film is v6')
timing=json.loads((root/'public/codex_timing_v6.json').read_text(encoding='utf-8'))
qa=root/'qa'/'v6'
checks=[]
for fmt in ['portrait','landscape']:
    folder=qa/'final_frames' if final else qa
    files=sorted(p for p in folder.glob(f'codex_{fmt}_*.jpg') if re.search(r'_\d+\.jpg$',p.name))
    if not final:
        manifest=json.loads((qa/'codex_stills_result.json').read_text(encoding='utf-8'))
        current={Path(p).name for item in manifest if item['format'].lower()==fmt for p in item['files']}
        files=[p for p in files if p.name in current]
    files.sort(key=lambda p:int(re.search(r'_(\d+)\.jpg$',p.name).group(1)))
    assert files, f'No {fmt} frames to check'
    for p in files:
        # Only verifies the exposed background; real UI theme is checked during capture.
        with Image.open(p) as image:
            rgb=ImageStat.Stat(image.convert('RGB').crop((0,0,24,24))).mean
            luma=sum(channel*weight for channel,weight in zip(rgb,[.2126,.7152,.0722]))
            suffix=int(re.search(r'_(\d+)\.jpg$',p.name).group(1))
            frame=suffix*timing['fps']/10 if final else suffix
            cues=timing['cues']
            dark=cues['themeDark']<=frame<cues['themeLight'] or cues['readerDark']<=frame<cues['readerLight']
            assert luma<100 if dark else luma>210, f'Theme background mismatch: {p.name} ({luma:.2f})'
            checks.append({'file':str(p.relative_to(root)),'paperCornerLuma':round(luma,2),'seconds':round(frame/timing['fps'],3),'expectedTheme':'dark' if dark else 'light'})
    batches=[files[i:i+11] for i in range(0,len(files),11)]
    for batch,items in enumerate(batches,1):
        if not items:
            continue
        w,h=(360,640) if fmt=='portrait' else (640,360)
        cols=3
        sheet=Image.new('RGB',(w*cols,(h+24)*((len(items)+cols-1)//cols)),'#f3f6f0')
        draw=ImageDraw.Draw(sheet)
        for i,p in enumerate(items):
            im=Image.open(p).resize((w,h),Image.Resampling.LANCZOS)
            x=(i%cols)*w;y=(i//cols)*(h+24)
            sheet.paste(im,(x,y));draw.text((x+8,y+h+5),p.stem,fill='#161712')
        name=f'codex_final_{fmt}_{batch}.jpg' if final else f'codex_keyframes_{fmt}_{batch}.jpg'
        sheet.save(qa/name,quality=91)
(qa/f'codex_theme_{"final" if final else "keyframes"}_checks.json').write_text(json.dumps({'passed':True,'check':'Exposed background at top-left; capture separately verifies global and reader themes','frames':checks},ensure_ascii=False,indent=2),encoding='utf-8')
print('Contact sheets ready')
