"""Read a small, auditable subset using HTTP ranges; do not download 21 GB."""
import urllib.request,json,zipfile,io,re,collections,pathlib,hashlib
from PIL import Image,ImageOps
ROOT=pathlib.Path(__file__).resolve().parents[1];qa=ROOT/'qa';out=ROOT/'public/data/evidence';out.mkdir(exist_ok=True,parents=True)
qa.mkdir(exist_ok=True)
d=json.loads((ROOT/'pipeline/montijo-source-record.json').read_text());f=d['files'][0];url=f['links']['self'];size=f['size']
class Remote(io.RawIOBase):
    def __init__(self):self.pos=0
    def seekable(self):return True
    def readable(self):return True
    def tell(self):return self.pos
    def seek(self,o,w=0):self.pos=o if w==0 else self.pos+o if w==1 else size+o;return self.pos
    def read(self,n=-1):
        if n<0:n=size-self.pos
        n=min(n,size-self.pos)
        if not n:return b''
        if n>12000000:raise RuntimeError('Unexpectedly large ZIP entry')
        req=urllib.request.Request(url,headers={'Range':f'bytes={self.pos}-{self.pos+n-1}'})
        r=urllib.request.urlopen(req,timeout=60)
        if r.status!=206:r.close();raise RuntimeError('Range requests unavailable')
        b=r.read();self.pos+=len(b);return b
z=zipfile.ZipFile(Remote());dates=collections.defaultdict(list)
for name in z.namelist():
    match=re.search(r'(\d{4}-\d{2}-\d{2})_(\d{2}-\d{2})',name)
    if match and name.lower().endswith('.jpg'):dates[match[1]].append(name)
days=sorted(dates);chosen=[days[round((len(days)-1)*i/11)] for i in range(12)];frames=[]
for day in chosen:
    names=sorted(dates[day]);name=min(names,key=lambda n:abs(int(re.search(r'_(\d{2})-\d{2}',n)[1])-12))
    raw=qa/('montijo-'+pathlib.Path(name).name)
    if not raw.exists():raw.write_bytes(z.read(name))
    data=raw.read_bytes();im=ImageOps.exif_transpose(Image.open(raw)).convert('RGB');im.thumbnail((1600,1200));id='mt-'+day;target=out/(id+'.webp');im.save(target,quality=88)
    frames.append({'id':id,'projectId':'montijo','date':day,'time':pathlib.Path(name).stem[11:16].replace('-',':'),'view':1,'url':'./data/evidence/'+target.name,'sourceFile':name,'sourceUrl':'https://zenodo.org/records/21055820','license':'CC BY 4.0','credit':'Rui Barros Garcia and Ruben Pereira Silva · Garcia, Garcia S.A.','originalSha256':hashlib.sha256(data).hexdigest(),'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'originalBytes':len(data),'width':im.width,'height':im.height,'captureSource':'Original archive filename; archive description has inconsistent dates','sourceImagesOnDate':len(names),'alignment':'Timelapse viewpoints vary across recording periods. Side-by-side only; not geometrically or pixel aligned.','kind':'original timelapse photograph, resized to WebP'})
    print(day,name,flush=True)
project={'id':'montijo','name':'Montijo · Logistics construction','shortName':'Montijo logistics','sourceUrl':'https://zenodo.org/records/21055820','license':'CC BY 4.0','description':'12 sampled dates from 98 filename dates and 3,289 real timelapse frames. Viewpoint changes between recording periods. No 3D model.','captureType':'Fixed-position timelapse (framing changes)','splatDates':[],'baseline':'No owner schedule, BOQ or drawings supplied.','credit':frames[0]['credit']}
(out/'montijo.json').write_text(json.dumps({'project':project,'frames':frames,'archiveDates':{k:len(v) for k,v in sorted(dates.items())},'archiveChecksum':f['checksum'],'archiveBytes':size},indent=2))
(ROOT/'pipeline/montijo-provenance.json').write_text(json.dumps({'record':d['metadata'],'archive':f,'sampleDates':chosen,'actualFilenameDateRange':[days[0],days[-1]],'actualDistinctDates':len(days),'framing':'Varies between periods; no exact registration claimed.'},indent=2))
