import { getPreviewSlotGroups, pickRandomPhotos, type RandomPreviewConfig } from './boothRandomPreviews'
import { renderLayoutPreviewCanvas } from './boothSamples'
const load = (url: string, signal?: AbortSignal) => new Promise<HTMLImageElement>((resolve,reject) => {
  const img = new Image(); img.crossOrigin='anonymous'
  const finish = (error?: Error) => { clearTimeout(timer); signal?.removeEventListener('abort',abort); img.onload=null;img.onerror=null; error ? reject(error) : resolve(img) }
  const abort = () => finish(new Error('취소됐어요.'))
  const timer=setTimeout(()=>finish(new Error('사진을 불러오지 못했어요.')),8000)
  img.onload=()=>finish();img.onerror=()=>finish(new Error('사진을 불러오지 못했어요.'));signal?.addEventListener('abort',abort,{once:true})
  if(signal?.aborted)abort();else img.src=url
})
export async function renderRandomBoothPreviews(config: RandomPreviewConfig, count=3, signal?:AbortSignal): Promise<string[]> {
  const groups=getPreviewSlotGroups(config.slots), cache=new Map<string,HTMLImageElement>(), outputs:string[]=[], keys=new Set<string>()
  const frames=new Map(await Promise.all(config.frameLayers.filter(l=>l.visible).map(async l=>[l.id,await load(l.imageUrl,signal)] as const)))
  let available=[...config.photos]
  for(let attempt=0;outputs.length<count && attempt<40;attempt++) {
    if(signal?.aborted)throw new Error('취소됐어요.')
    const selected=pickRandomPhotos(available,groups.length)
    if(!selected.length)break
    const key=selected.map(p=>p.imageUrl).join('|')
    if(keys.has(key))continue
    keys.add(key)
    const photos=new Map<string,HTMLImageElement>()
    let failed=false
    for(let i=0;i<selected.length;i++) {
      const photo=selected[i]
      try { if(!cache.has(photo.imageUrl))cache.set(photo.imageUrl,await load(photo.imageUrl,signal)); for(const slot of groups[i])photos.set(slot.id,cache.get(photo.imageUrl)!) }
      catch { available=available.filter(p=>p.imageUrl!==photo.imageUrl);failed=true;break }
    }
    if(failed)continue
    outputs.push(renderLayoutPreviewCanvas(config.canvasWidth,config.canvasHeight,config.backgroundColor,config.slots,config.frameLayers,photos,frames).toDataURL('image/png'))
  }
  return outputs
}
