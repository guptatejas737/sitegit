"""CPU calibrated stereo reconstruction to seed texture-poor ground surfaces.

Rectified COLMAP cameras + SGBM, bidirectional disparity consistency, physical
site bounds and voxel reduction. The result is measured from each visit's images.
"""
import argparse,json,pathlib
import cv2,numpy as np,pycolmap as pc
ROOT=pathlib.Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--week',required=True);p.add_argument('--width',type=int,default=960);a=p.parse_args()
work=ROOT/'qa/training'/a.week
rec=pc.Reconstruction(work/'sparse')
images=sorted(rec.images.values(),key=lambda i:i.name)
xyzs=[];rgbs=[];pairs=[]
cv2.setNumThreads(6)

def camera(im):
    c=rec.cameras[im.camera_id];k=c.calibration_matrix().copy()
    factor=a.width/c.width;k[:2]*=factor
    shape=(a.width,round(c.height*factor))
    rgb=cv2.cvtColor(cv2.imread(str(work/'images'/im.name)),cv2.COLOR_BGR2RGB)
    rgb=cv2.resize(rgb,shape,interpolation=cv2.INTER_AREA)
    pose=im.cam_from_world()
    return k,pose.rotation.matrix(),pose.translation,rgb,shape

for ix in range(0,len(images)-1,2):
    one,two=images[ix:ix+2]
    baseline=np.linalg.norm(one.projection_center()-two.projection_center())
    if not 1.5<baseline<18:continue
    K1,R1,t1,I1,size=camera(one);K2,R2,t2,I2,_=camera(two)
    relative=R2@R1.T;shift=t2-relative@t1
    if relative[2,2]<.97:continue
    A,B,P1,P2,Q,_,_=cv2.stereoRectify(K1,None,K2,None,size,relative,shift,alpha=0)
    vertical=abs(P2[1,3])>abs(P2[0,3]);axis=1 if vertical else 0
    if P2[axis,3]>0:
        one,two=two,one;K1,K2=K2,K1;R1,R2=R2,R1;t1,t2=t2,t1;I1,I2=I2,I1
        relative=R2@R1.T;shift=t2-relative@t1
        A,B,P1,P2,Q,_,_=cv2.stereoRectify(K1,None,K2,None,size,relative,shift,alpha=0)
    mx,my=cv2.initUndistortRectifyMap(K1,None,A,P1,size,cv2.CV_32FC1)
    nx,ny=cv2.initUndistortRectifyMap(K2,None,B,P2,size,cv2.CV_32FC1)
    left=cv2.remap(I1,mx,my,cv2.INTER_LINEAR);right=cv2.remap(I2,nx,ny,cv2.INTER_LINEAR)
    gl=cv2.cvtColor(left,cv2.COLOR_RGB2GRAY);gr=cv2.cvtColor(right,cv2.COLOR_RGB2GRAY)
    if vertical:gl,gr=gl.T.copy(),gr.T.copy()
    config=dict(numDisparities=256,blockSize=5,P1=8*25,P2=32*25,disp12MaxDiff=1,uniquenessRatio=12,speckleWindowSize=100,speckleRange=2,mode=cv2.STEREO_SGBM_MODE_SGBM_3WAY)
    dl=cv2.StereoSGBM_create(minDisparity=0,**config).compute(gl,gr).astype(np.float32)/16
    dr=cv2.StereoSGBM_create(minDisparity=-256,**config).compute(gr,gl).astype(np.float32)/16
    yy,xx=np.indices(dl.shape);rx=np.round(xx-dl).astype(int)
    valid=(dl>1)&(dl<254)&(rx>=0)&(rx<dl.shape[1]);rx=np.clip(rx,0,dl.shape[1]-1)
    valid &= np.abs(dl+dr[yy,rx])<1.1
    if vertical:dl,valid=dl.T.copy(),valid.T.copy()
    rect=cv2.reprojectImageTo3D(dl,Q)
    world=(rect@A-t1)@R1
    valid &= np.isfinite(world).all(2)&(world[:,:,0]>-135)&(world[:,:,0]<90)&(world[:,:,1]>-6)&(world[:,:,1]<40)&(world[:,:,2]>-145)&(world[:,:,2]<155)
    xyzs.append(world[valid]);rgbs.append(left[valid]);pairs.append({'first':one.name,'second':two.name,'points':int(valid.sum())})
    print('STEREO',ix,'baseline',round(baseline,2),'m','points',int(valid.sum()),flush=True)

if not xyzs:raise RuntimeError('No usable stereo pairs')
xyz=np.concatenate(xyzs);rgb=np.concatenate(rgbs)
cells=np.floor(xyz/.22).astype(np.int32)
_,inverse,counts=np.unique(cells,axis=0,return_inverse=True,return_counts=True)
centres=np.zeros((len(counts),3));colours=np.zeros_like(centres)
for d in range(3):
    centres[:,d]=np.bincount(inverse,weights=xyz[:,d])/counts
    colours[:,d]=np.bincount(inverse,weights=rgb[:,d])/counts
print('RAW',len(xyz),'VOXEL',len(centres),flush=True)
# Retain at most 350k dense seeds, uniformly; include SfM points for tall details.
if len(centres)>350000:
    ix=np.random.default_rng(42).choice(len(centres),350000,replace=False);centres=centres[ix];colours=colours[ix]
sparse=np.array([p.xyz for p in rec.points3D.values()]);colour=np.array([p.color for p in rec.points3D.values()])
centres=np.concatenate([centres,sparse]);colours=np.concatenate([colours,colour])
arr=np.empty(len(centres),dtype=[('xyz','<f4',(3,)),('rgb','u1',(3,))]);arr['xyz']=centres;arr['rgb']=np.clip(colours,0,255).astype(np.uint8)
header=f'ply\nformat binary_little_endian 1.0\nelement vertex {len(arr)}\nproperty float x\nproperty float y\nproperty float z\nproperty uchar red\nproperty uchar green\nproperty uchar blue\nend_header\n'.encode()
(work/'init.ply').write_bytes(header+arr.tobytes())
(work/'dense-report.json').write_text(json.dumps({'method':'calibrated SGBM stereo with left/right consistency','pairs':pairs,'rawPoints':len(xyz),'seedPoints':len(arr),'voxelSizeM':.22},indent=2))
print('DENSE INIT READY',len(arr),flush=True)
