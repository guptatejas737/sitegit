"""CPU photogrammetry of independently photographed iVISION survey dates.
Requires pycolmap, Pillow, numpy. All reconstruction intermediates stay in qa/.
"""
import argparse, json, pathlib, re, time
import numpy as np
from PIL import Image
import pycolmap as pc

ROOT = pathlib.Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--week', required=True)
args = parser.parse_args()
raw = ROOT/'qa/raw/ivision'/args.week
work = ROOT/'qa/reconstruction'/args.week
images = work/'images'
images.mkdir(parents=True,exist_ok=True)
metadata = {}
for source in sorted(raw.glob('*.JPG')):
    data=source.read_bytes()
    def tag(name):
        return float(re.search(('drone-dji:'+name+'="([^"]+)"').encode(),data)[1])
    im=Image.open(source)
    factor=1600/im.width
    im.resize((1600,round(im.height*factor)),Image.Resampling.LANCZOS).save(images/source.name,quality=95)
    metadata[source.name]={"lat":tag('GpsLatitude'),"lon":tag('GpsLongitude'),"alt":tag('AbsoluteAltitude'),"focal":tag('CalibratedFocalLength')*factor}
(work/'gps.json').write_text(json.dumps(metadata,indent=2))
print('PREPARED',len(metadata),args.week,flush=True)
database=work/'database.db'
if not database.exists():
    extraction=pc.FeatureExtractionOptions()
    extraction.max_image_size=1600
    extraction.num_threads=8
    extraction.sift.max_num_features=6000
    reader=pc.ImageReaderOptions()
    reader.camera_model='SIMPLE_RADIAL'
    first=next(iter(metadata.values()))
    height=Image.open(next(images.glob('*.JPG'))).height
    reader.camera_params=f"{first['focal']},800,{height/2},0"
    pc.extract_features(database,images,camera_mode=pc.CameraMode.SINGLE,reader_options=reader,extraction_options=extraction,device=pc.Device.cpu)
    matching=pc.FeatureMatchingOptions()
    matching.num_threads=8
    pc.match_exhaustive(database,matching_options=matching,device=pc.Device.cpu)
print('MATCHED',args.week,flush=True)
options=pc.IncrementalPipelineOptions()
options.num_threads=8
options.min_model_size=10
options.ba_global_max_num_iterations=30
existing=list((work/'sparse').glob('*/cameras.bin'))
maps={i:pc.Reconstruction(p.parent) for i,p in enumerate(existing)} if existing else pc.incremental_mapping(database,images,work/'sparse',options=options)
if not maps: raise RuntimeError('No valid reconstruction')
best=max(maps.values(),key=lambda r:r.num_reg_images())
(work/'model').mkdir(exist_ok=True)
best.write(work/'model')
best.export_PLY(work/'sparse.ply')
print('RECONSTRUCTED',args.week,'images',best.num_reg_images(),'points',best.num_points3D(),flush=True)
