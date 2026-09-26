"""Freeze provenance for the locally downloaded survey subset."""
from pathlib import Path
import hashlib,json,re
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1]
root=ROOT/'qa/raw/ivision'
index=json.loads((ROOT/'qa/ivision-all-files.json').read_text(encoding='utf-8-sig'))
existing={p.name:p for p in root.glob('*/*.JPG')}
selected=[]
for row in index:
    if Path(row['name']).name in existing:
        p=existing[Path(row['name']).name]
        selected.append({'name':row['name'],'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
(ROOT/'pipeline').mkdir(exist_ok=True)
(ROOT/'pipeline/sources.json').write_text(json.dumps({'dataset':'danielmao2019/ivision-fall2024','license':'MIT','source':'https://www.kaggle.com/datasets/danielmao2019/ivision-fall2024','files':selected},indent=2))
sheet=Image.new('RGB',(1200,350),'white');draw=ImageDraw.Draw(sheet)
for i,week in enumerate(sorted(root.iterdir())):
    candidates=[]
    for p in week.glob('*.JPG'):
        b=p.read_bytes()
        lat=float(re.search(b'drone-dji:GpsLatitude="([^"]+)"',b)[1])
        lon=float(re.search(b'drone-dji:GpsLongitude="([^"]+)"',b)[1])
        candidates.append(((lat-43.4695)**2+(lon+80.5365)**2,p))
    p=min(candidates)[1];im=Image.open(p);im.thumbnail((400,310))
    sheet.paste(im,(i*400,30));draw.text((i*400+8,5),week.name,fill='black')
sheet.save(ROOT/'qa/source-surveys.jpg')
print('Source manifest:',len(selected),'images')
