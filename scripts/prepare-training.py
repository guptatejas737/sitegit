"""Place independently reconstructed surveys in one GPS frame, then undistort.

RTK camera GPS is used for an approximate similarity alignment, not survey-grade
change measurement. No geometry from one date is reused to construct another.
"""
import argparse, json, pathlib
import numpy as np
import pycolmap as pc

ROOT=pathlib.Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser()
p.add_argument('--week',required=True)
a=p.parse_args()
work=ROOT/'qa/reconstruction'/a.week
recon=pc.Reconstruction(work/'model')
gps=json.loads((work/'gps.json').read_text())
# Fixed local origin near the site; axes are east, up, south, in metres.
origin=[43.4695,-80.5365,290.0]
source=[];target=[]
for im in recon.images.values():
    if im.name not in gps: continue
    g=gps[im.name]
    source.append(im.projection_center())
    target.append([(g['lon']-origin[1])*111320*np.cos(np.deg2rad(origin[0])),g['alt']-origin[2],-(g['lat']-origin[0])*111320])
transform=pc.estimate_sim3d(np.array(source),np.array(target))
if transform is None: raise RuntimeError('GPS alignment failed')
aligned=np.array([transform*x for x in source])
error=np.linalg.norm(aligned-np.array(target),axis=1)
recon.transform(transform)
output=work/'aligned';output.mkdir(exist_ok=True)
recon.write(output)
report={'originLatLonAlt':origin,'axes':'east, up, south; metres','registeredImages':recon.num_reg_images(),'sparsePoints':recon.num_points3D(),'cameraGpsResidualMedianM':float(np.median(error)),'cameraGpsResidualMaxM':float(error.max()),'similarityMatrix':transform.matrix().tolist(),'bounds':np.quantile(np.array([p.xyz for p in recon.points3D.values()]),[.01,.5,.99],axis=0).tolist()}
(work/'alignment.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report),flush=True)
options=pc.UndistortCameraOptions();options.max_image_size=1200
(ROOT/'qa/training').mkdir(exist_ok=True)
pc.undistort_images(ROOT/'qa/training'/a.week,output,work/'images',undistort_options=options,num_threads=6,jpeg_quality=95)
print('TRAINING INPUT READY',a.week,flush=True)
