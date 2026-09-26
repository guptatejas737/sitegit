"""Reproduce the published surveys, from verified source images to web assets."""
import argparse,json,os,pathlib,subprocess,sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--brush',required=True,help='Path to official Brush 0.3.0 executable');p.add_argument('--skip-download',action='store_true');a=p.parse_args()
brush=pathlib.Path(a.brush).resolve()
if not brush.is_file():raise FileNotFoundError(brush)
config=json.loads((ROOT/'pipeline/config.json').read_text())
logs=ROOT/'qa/pipeline-logs';logs.mkdir(parents=True,exist_ok=True)

def run(name,command):
    print(name,flush=True)
    with (logs/(name+'.log')).open('w',encoding='utf-8') as log:
        env=dict(os.environ,RUST_LOG='brush_cli=info,brush_process=info')
        subprocess.run([str(c) for c in command],cwd=ROOT,stdout=log,stderr=subprocess.STDOUT,check=True,env=env)

if not a.skip_download:run('download',[sys.executable,'scripts/fetch-surveys.py'])
for i,record in enumerate(config['records']):
    week=record['week'];tag=record['date']
    run(tag+'-sfm',[sys.executable,'scripts/reconstruct-surveys.py','--week',week])
    run(tag+'-prepare',[sys.executable,'scripts/prepare-training.py','--week',week])
    if i:
        command=[sys.executable,'scripts/align-records.py','--week',week]
        if i==2:command+=['--reference',config['records'][1]['week'],'--ratio','.8','--threshold','1.5']
        run(tag+'-align',command)
    training=ROOT/'qa/training'/week
    if record['stereo']:run(tag+'-stereo',[sys.executable,'scripts/densify-survey.py','--week',week])
    elif (training/'init.ply').exists():
        # Preserve optional dense seeds while selecting the published sparse run.
        (training/'init.ply').replace(training/'stereo-init.saved.ply')
    output=ROOT/'qa'/record['directory']/week
    if not (output/f"export_{record['steps']}.ply").exists():
        run(tag+'-train',[brush,training,'--total-steps',record['steps'],'--max-resolution',record['resolution'],'--max-splats',record['maxSplats'],'--sh-degree','0','--seed',config['seed'],'--refine-every','120','--growth-stop-iter',int(record['steps']*.8),'--export-every','500','--export-path',output,'--eval-split-every','12','--eval-save-to-disk'])
run('export',[sys.executable,'scripts/export-surveys.py','--config'])
run('compress',['node','scripts/compress-surveys.mjs'])
print('Three trained records exported. Run npm run build, then vercel --prod.',flush=True)
