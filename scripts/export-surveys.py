"""Export actual trained Brush Gaussians as compact independently hosted records.

.splat layout: position xyz (float32), scale xyz (float32), RGBA (uint8),
rotation wxyz (uint8). Colour is SH0, the same degree used during training.
"""
import argparse,hashlib,json,pathlib,shutil
import numpy as np
import pycolmap as pc
ROOT=pathlib.Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--steps',type=int,default=3000);p.add_argument('--preview',action='store_true');p.add_argument('--config',action='store_true');a=p.parse_args()
settings=json.loads((ROOT/'pipeline/config.json').read_text())['records'] if a.config else None
weeks=['Week-01-Fri-Sep-27-2024','Week-04-Fri-Oct-18-2024','Week-10-Wed-Nov-27-2024']
dates=['2024-09-27','2024-10-18','2024-11-27'];labels=['27 Sep 2024','18 Oct 2024','27 Nov 2024']
notes=['Graded ground and early excavation.','Excavation and material staging have advanced.','Concrete foundation walls and pads are visible.']
out=ROOT/'public/data/surveys';out.mkdir(parents=True,exist_ok=True)
records=[]
for i,week in enumerate(weeks):
    setup=settings[i] if settings else {'steps':a.steps,'resolution':640,'maxSplats':180000,'directory':'trained','stereo':False}
    steps=setup['steps']
    file=ROOT/'qa'/setup['directory']/week/f'export_{steps}.ply'
    record={'date':dates[i],'label':labels[i],'imageCount':60,'pointCount':0,'sha256':'pending','note':notes[i],'url':f'./data/surveys/{dates[i]}.splat','still':f'./data/surveys/{dates[i]}.webp','available':file.exists()}
    record['stillMobile']=f'./data/surveys/{dates[i]}-mobile.webp'
    if not file.exists():
        if not a.preview:raise FileNotFoundError(file)
        records.append(record);continue
    data=file.read_bytes();end=data.index(b'end_header\n')+11
    header=data[:end].decode();props=[s.split()[-1] for s in header.splitlines() if s.startswith('property float ')]
    count=int(next(s.split()[-1] for s in header.splitlines() if s.startswith('element vertex ')))
    raw=np.frombuffer(data[end:],dtype='<f4').reshape(count,len(props))
    def values(names):return raw[:,[props.index(k) for k in names]].copy()
    xyz=values(['x','y','z']);scales=np.exp(values(['scale_0','scale_1','scale_2']))
    quat=values(['rot_1','rot_2','rot_3','rot_0'])
    alpha=1/(1+np.exp(-np.clip(values(['opacity'])[:,0],-80,80)))
    rgb=np.clip(values(['f_dc_0','f_dc_1','f_dc_2'])*.28209479177387814+.5,0,1)
    work=ROOT/'qa/reconstruction'/week
    registration=None
    if i:
        registration=json.loads((work/'registration.json').read_text())
        rot=np.array(registration['rotation']);scale=float(registration['scale']);shift=np.array(registration['translation'])
        xyz=(xyz@rot.T)*scale+shift;scales*=scale
        q=pc.Rotation3d(rot).quat
        vector=q[3]*quat[:,:3]+quat[:,3,None]*q[:3]+np.cross(q[:3],quat[:,:3])
        scalar=q[3]*quat[:,3]-(quat[:,:3]*q[:3]).sum(1)
        quat=np.column_stack((vector,scalar))
        quat/=np.linalg.norm(quat,axis=1,keepdims=True)
    # One fixed spatial window for every visit. This only removes remote scenery
    # and reconstruction outliers; it does not create or hide construction phases.
    keep=np.isfinite(xyz).all(1)&np.isfinite(scales).all(1)&(alpha>.02)&(scales.max(1)<12)
    keep &= (xyz[:,0]>-130)&(xyz[:,0]<55)&(xyz[:,1]>-6)&(xyz[:,1]<40)&(xyz[:,2]>-105)&(xyz[:,2]<5)
    xyz,scales,quat,rgb,alpha=(x[keep] for x in (xyz,scales,quat,rgb,alpha))
    packed=np.empty(len(xyz),dtype=[('xyz','<f4',(3,)),('scale','<f4',(3,)),('rgba','u1',(4,)),('rotation','u1',(4,))])
    packed['xyz']=xyz;packed['scale']=scales;packed['rgba'][:,:3]=np.round(rgb*255).astype(np.uint8);packed['rgba'][:,3]=np.round(alpha*255).astype(np.uint8)
    packed['rotation']=np.clip(quat[:,[3,0,1,2]]*128+128,0,255).astype(np.uint8)
    output=out/f'{dates[i]}.splat';output.write_bytes(packed.tobytes())
    record.update(pointCount=len(xyz),sha256=hashlib.sha256(output.read_bytes()).hexdigest(),bytes=output.stat().st_size,trainingSteps=steps)
    report={'date':dates[i],'sourceImages':60,'trainingImages':55,'heldOutFromOptimizationImages':5,'trainingSteps':steps,'maxTrainingResolution':setup['resolution'],'maxSplats':setup['maxSplats'],'stereoInitialization':setup['stereo'],'shDegree':0,'trainer':'Brush 0.3.0','trainedPlySha256':hashlib.sha256(data).hexdigest(),'trainedGaussians':count,'exportedGaussians':len(xyz),'splatSha256':record['sha256'],'gpsAlignment':json.loads((work/'alignment.json').read_text()),'visualRegistration':registration}
    if setup['stereo']:report['stereo']=json.loads((ROOT/'qa/training'/week/'dense-report.json').read_text())
    report['commonDisplayBoundsMetres']={'x':[-130,55],'y':[-6,40],'z':[-105,5]}
    (out/f'{dates[i]}.json').write_text(json.dumps(report,indent=2))
    records.append(record);print(dates[i],len(xyz),'Gaussians',output.stat().st_size,'bytes')
manifest={'source':'https://www.kaggle.com/datasets/danielmao2019/ivision-fall2024','license':'MIT','camera':{'position':[-41,120,41],'mobilePosition':[135,230,-40],'target':[-55,1,-50]},'records':records}
(out/'manifest.json').write_text(json.dumps(manifest,indent=2))
