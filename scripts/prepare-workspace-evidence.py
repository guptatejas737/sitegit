"""Build a modest, attributed photo sample. No new 3D epochs are fabricated."""
import concurrent.futures, hashlib, json, pathlib, re, time
from PIL import Image, ImageOps, ImageDraw
from kagglesdk import KaggleClient
from kagglesdk.datasets.types.dataset_api_service import ApiDownloadDatasetRequest, ApiGetDatasetRequest
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'public/data/evidence'; OUT.mkdir(parents=True,exist_ok=True)
index=json.loads((ROOT/'pipeline/ivision-photo-index.json').read_text(encoding='utf-8-sig'))
groups={}
for item in index:
    if item['name'].lower().endswith('.jpg'):groups.setdefault(item['name'].split('/')[0],[]).append(item)
request=ApiGetDatasetRequest(); request.owner_slug='danielmao2019'; request.dataset_slug='ivision-fall2024'
with KaggleClient() as client:
    metadata=client.datasets.dataset_api_client.get_dataset(request)
    meta=json.loads(str(metadata)); (ROOT/'pipeline/ivision-license-2026-10-03.json').write_text(json.dumps(meta,indent=2))
    print('License',meta.get('licenseName'),flush=True)
    if 'MIT' not in str(meta.get('licenseName','')):raise RuntimeError('Unexpected dataset license')
selected=[]; known={'20240927':'DJI_20240927092602_0083_D.JPG','20241018':'DJI_20241018110454_0086_D.JPG','20241127':'DJI_20241127104453_0262_D.JPG'}
for week,items in sorted(groups.items()):
    items.sort(key=lambda x:x['name']); stamp=re.search(r'DJI_(\d{8})',items[0]['name'])[1]
    picks=[items[round((len(items)-1)*f)] for f in [.75,.80,.85,.90]]
    if stamp in known:picks[0]=next(x for x in items if x['name'].endswith(known[stamp]))
    for i,item in enumerate(picks):selected.append((week,item,i,len(items)))
def work(job):
    week,item,i,count=job; name=pathlib.PurePosixPath(item['name']).name
    raw=ROOT/'qa/raw/ivision'/week/name; raw.parent.mkdir(parents=True,exist_ok=True)
    if not raw.exists():
        req=ApiDownloadDatasetRequest();req.owner_slug='danielmao2019';req.dataset_slug='ivision-fall2024';req.file_name=item['name'];req.raw=True
        for attempt in range(4):
            try:
                with KaggleClient() as client:
                    response=client.datasets.dataset_api_client.download_dataset(req);response.raise_for_status();raw.write_bytes(response.content)
                break
            except Exception:
                if attempt==3:raise
                time.sleep(2**attempt)
    data=raw.read_bytes(); original=Image.open(raw); original.verify(); im=ImageOps.exif_transpose(Image.open(raw)).convert('RGB')
    exif=Image.open(raw).getexif(); stamp=re.search(r'DJI_(\d{4})(\d{2})(\d{2})(\d{6})',name);date='-'.join(stamp.group(1,2,3));id=f'iv-{date}-{i+1}'
    target=OUT/(id+'.webp'); im.thumbnail((1600,1200));im.save(target,quality=88)
    print(id,name,flush=True)
    return {'id':id,'projectId':'ivision','date':date,'time':':'.join([stamp[4][j:j+2] for j in [0,2,4]]),'view':i+1,'url':'./data/evidence/'+target.name,'sourceFile':item['name'],'sourceUrl':'https://www.kaggle.com/datasets/danielmao2019/ivision-fall2024','license':'MIT','credit':'iVISION contributors: Dayou Mao, Yuchen Lin, Ashkan Ebadi, John Zelek, Alexander Wong, Yuhao Chen','originalSha256':hashlib.sha256(data).hexdigest(),'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'originalBytes':len(data),'width':im.width,'height':im.height,'captureSource':'DJI filename date; original dataset folder','sourceImagesOnDate':count,'alignment':'Independent aerial viewpoints. Not pixel-aligned; no calibrated dimensions in this workspace.','kind':'original photograph, resized to WebP'}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:frames=list(pool.map(work,selected))
frames.sort(key=lambda x:(x['date'],x['view']))
catalog={'version':1,'verifiedOn':'2026-10-03','projects':[{'id':'ivision','name':'iVISION · Waterloo construction','shortName':'Waterloo construction','sourceUrl':'https://www.kaggle.com/datasets/danielmao2019/ivision-fall2024','license':'MIT','description':'12 real aerial capture dates. Four source photographs per date; three separately trained Gaussian surveys remain available.','captureType':'Multi-view aerial surveys','splatDates':['2024-09-27','2024-10-18','2024-11-27'],'baseline':'No owner schedule, BOQ, drawings or billing records supplied.','credit':frames[0]['credit']}],'frames':frames}
(OUT/'catalog.json').write_text(json.dumps(catalog,indent=2))
sheet=Image.new('RGB',(1200,220*4),'#fafaf8');draw=ImageDraw.Draw(sheet)
for j,f in enumerate(frames[::4]):
    im=Image.open(OUT/pathlib.Path(f['url']).name);im.thumbnail((390,190));x=(j%3)*400;y=(j//3)*220;sheet.paste(im,(x,y+25));draw.text((x+8,y+5),f['date'],fill='black')
sheet.save(ROOT/'qa/workspace-contact-sheet.jpg')
print('Prepared',len(frames),'real evidence frames across',len(groups),'dates',flush=True)
