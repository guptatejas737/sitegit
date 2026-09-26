"""Download and verify the exact 180 public images used by this demo."""
import concurrent.futures,hashlib,json,pathlib,time
from kagglesdk import KaggleClient
from kagglesdk.datasets.types.dataset_api_service import ApiDownloadDatasetRequest
ROOT=pathlib.Path(__file__).resolve().parents[1]
source=json.loads((ROOT/'pipeline/sources.json').read_text())

def verified(path,item):
    return path.exists() and path.stat().st_size==item['bytes'] and hashlib.sha256(path.read_bytes()).hexdigest()==item['sha256']

def fetch(item):
    name=pathlib.PurePosixPath(item['name'])
    output=ROOT/'qa/raw/ivision'/name.parts[0]/name.name
    output.parent.mkdir(parents=True,exist_ok=True)
    if verified(output,item):return name.name+' verified cache'
    request=ApiDownloadDatasetRequest()
    request.owner_slug='danielmao2019';request.dataset_slug='ivision-fall2024'
    request.file_name=item['name'];request.raw=True
    temporary=output.with_suffix('.partial')
    for attempt in range(4):
        try:
            with KaggleClient() as client:
                response=client.datasets.dataset_api_client.download_dataset(request)
                response.raise_for_status()
                with temporary.open('wb') as f:
                    for chunk in response.iter_content(1024*1024):f.write(chunk)
            if not verified(temporary,item):raise RuntimeError('Source hash/size mismatch: '+item['name'])
            temporary.replace(output)
            return name.name+' downloaded and verified'
        except Exception:
            if attempt==3:raise
            time.sleep(2**attempt)

if __name__=='__main__':
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for result in pool.map(fetch,source['files']):print(result,flush=True)
