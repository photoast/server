import type { PreviewPoolPhoto } from './types'
import type { Area } from 'react-easy-crop'
const load=(src:string)=>new Promise<HTMLImageElement>((resolve,reject)=>{const img=new Image();img.crossOrigin='anonymous';const timer=setTimeout(()=>reject(new Error('사진을 불러오지 못했어요. 다시 시도해 주세요.')),15000);img.onload=()=>{clearTimeout(timer);resolve(img)};img.onerror=()=>{clearTimeout(timer);reject(new Error('사진을 읽지 못했어요.'))};img.src=src})
async function upload(canvas:HTMLCanvasElement,type:string):Promise<string>{
 const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('사진을 준비하지 못했어요.')),'image/jpeg',.96))
 const body=new FormData();body.append('file',blob,type+'.jpg');body.append('type',type)
 const response=await fetch('/api/upload',{method:'POST',body}),data=await response.json()
 if(!response.ok||!data.url)throw new Error(data.error||'사진 업로드에 실패했어요.')
 return data.url
}
export async function savePoolPhoto(src:string,area:Area,width:number,height:number,existing?:PreviewPoolPhoto):Promise<PreviewPoolPhoto>{
 const img=await load(src),original=document.createElement('canvas'),scale=existing?1:Math.min(1,2000/Math.max(img.naturalWidth,img.naturalHeight))
 original.width=Math.round(img.naturalWidth*scale);original.height=Math.round(img.naturalHeight*scale)
 const orig=original.getContext('2d')!;orig.fillStyle='#fff';orig.fillRect(0,0,original.width,original.height);orig.drawImage(img,0,0,original.width,original.height)
 const cropped=document.createElement('canvas');cropped.width=width;cropped.height=height
 const ctx=cropped.getContext('2d')!;ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);ctx.imageSmoothingQuality='high';ctx.drawImage(img,area.x,area.y,area.width,area.height,0,0,width,height)
 const originalUrl=existing?.originalUrl||await upload(original,'booth-pool-original')
 const imageUrl=await upload(cropped,'booth-pool-crop'),sx=original.width/img.naturalWidth,sy=original.height/img.naturalHeight
 return {id:existing?.id||crypto.randomUUID(),imageUrl,originalUrl,originalWidth:original.width,originalHeight:original.height,crop:{x:area.x*sx,y:area.y*sy,width:area.width*sx,height:area.height*sy},aspectRatio:width/height}
}
