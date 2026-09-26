"""Register dated reconstructions using cross-date visual correspondences.

Only transforms whole records. It does not copy or morph geometry between dates.
SIFT descriptor matches propose 3D correspondences; robust Sim(3) rejects change.
"""
import argparse,json,pathlib,sqlite3
import cv2,numpy as np,pycolmap as pc
ROOT=pathlib.Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--week',required=True);p.add_argument('--reference',default='Week-01-Fri-Sep-27-2024');p.add_argument('--ratio',type=float,default=.65);p.add_argument('--threshold',type=float,default=.7);a=p.parse_args()
base=a.reference

def features(week):
    work=ROOT/'qa/reconstruction'/week
    if (work/'registration-features.npz').exists():
        cached=np.load(work/'registration-features.npz');return cached['descriptors'],cached['positions']
    r=pc.Reconstruction(work/'aligned')
    con=sqlite3.connect(work/'database.db')
    descriptors=[];positions=[];seen=set()
    for im in r.images.values():
        rows,cols,blob=con.execute('select rows,cols,data from descriptors where image_id=?',(im.image_id,)).fetchone()
        d=np.frombuffer(blob,dtype=np.uint8).reshape(rows,cols)
        for j,pt in enumerate(im.points2D):
            if pt.has_point3D() and pt.point3D_id not in seen:
                seen.add(pt.point3D_id);descriptors.append(d[j]);positions.append(r.points3D[pt.point3D_id].xyz)
    con.close()
    descriptors=np.array(descriptors,dtype=np.float32);positions=np.array(positions)
    np.savez(work/'registration-features.npz',descriptors=descriptors,positions=positions)
    return descriptors,positions

refd,refp=features(base);srcd,srcp=features(a.week)
matcher=cv2.FlannBasedMatcher(dict(algorithm=1,trees=8),dict(checks=128))
pairs=matcher.knnMatch(srcd,refd,k=2)
good=[m for m,n in pairs if m.distance<a.ratio*n.distance]
source=np.array([srcp[m.queryIdx] for m in good]);target=np.array([refp[m.trainIdx] for m in good])
options=pc.RANSACOptions();options.max_error=a.threshold;options.min_num_trials=2000;options.max_num_trials=50000
t=pc.estimate_sim3d_robust(source,target,options)
if t is None: raise RuntimeError('No robust cross-date alignment')
t=t['tgt_from_src'] if isinstance(t,dict) else t
error=np.linalg.norm(np.array([t*x for x in source])-target,axis=1);inliers=error<a.threshold
if inliers.sum()<25:raise RuntimeError(f'Insufficient static correspondences: {inliers.sum()}')
if not .9<float(t.scale)<1.1:raise RuntimeError('Registration scale is inconsistent with GPS')
if base!='Week-01-Fri-Sep-27-2024':
    previous=json.loads((ROOT/'qa/reconstruction'/base/'registration.json').read_text())
    previous_transform=pc.Sim3d(np.array(previous['matrix']))
    t=previous_transform*t
report={'reference':base,'moving':a.week,'method':'SIFT 3D correspondences + LO-RANSAC similarity','descriptorMatches':len(good),'inliers':int(inliers.sum()),'inlierMedianResidualM':float(np.median(error[inliers])),'inlierMaxResidualM':float(error[inliers].max()),'scale':t.scale,'rotation':t.rotation.matrix().tolist(),'translation':t.translation.tolist(),'matrix':t.matrix().tolist()}
report['outputFrame']='Week-01-Fri-Sep-27-2024'
report['inlierThresholdM']=a.threshold;report['descriptorRatioThreshold']=a.ratio
out=ROOT/'qa/reconstruction'/a.week/'registration.json'
serialized=json.dumps(report,indent=2,default=lambda x:x.tolist())
out.write_text(serialized);print(serialized,flush=True)
