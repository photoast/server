'use client'
import { useEffect, useRef, useState } from 'react'
import type { Area } from 'react-easy-crop'
import PoolPhotoCropDialog from './PoolPhotoCropDialog'
type Slot={id:string;width:number;height:number}
type Pending={src:string;slot:Slot;initial?:Area;apply:(id:string,image:HTMLImageElement)=>void}
const load=(src:string)=>new Promise<HTMLImageElement>((resolve,reject)=>{const img=new Image();img.crossOrigin='anonymous';const timer=setTimeout(()=>reject(new Error('사진을 읽지 못했어요.')),15000);img.onload=()=>{clearTimeout(timer);resolve(img)};img.onerror=()=>{clearTimeout(timer);reject(new Error('사진을 읽지 못했어요.'))};img.src=src})
export default function useSlotPhotoCrop(){
 const [queue,setQueue]=useState<Pending[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const sources=useRef(new Map<string,{src:string;area?:Area}>()),urls=useRef(new Set<string>()),locked=useRef(false)
 useEffect(()=>()=>urls.current.forEach(URL.revokeObjectURL),[])
 function select(files:File[],slots:Slot[],apply:Pending['apply']){
  setError('')
  if(!files.length)return
  if(files.length>slots.length){setError('사진은 '+slots.length+'장까지 선택해 주세요.');return}
  if(files.some(f=>!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size>12*1024*1024)){setError('12MB 이하 JPG·PNG·WebP 사진을 선택해 주세요.');return}
  setQueue(files.map((file,i)=>{const src=URL.createObjectURL(file);urls.current.add(src);return{src,slot:slots[i],apply}}))
 }
 function edit(slot:Slot,image:HTMLImageElement,apply:Pending['apply']){const source=sources.current.get(slot.id);setError('');setQueue([{src:source?.src||image.src,slot,initial:source?.area,apply}])}
 const pending=queue[0]
 return {select,edit,error,active:queue.length>0,busy,dialog:pending?<PoolPhotoCropDialog key={pending.src+'-'+pending.slot.id} src={pending.src} aspect={pending.slot.width/pending.slot.height} initial={pending.initial} title={'사진 영역 조정 · '+pending.slot.width+'×'+pending.slot.height+'px'+(queue.length>1?' · '+queue.length+'장 남음':'')} busy={busy} error={error} onCancel={()=>{if(!busy){setQueue([]);setError('')}}} onSave={async area=>{
  if(locked.current)return;locked.current=true;setBusy(true);setError('')
  try{
   const original=await load(pending.src),canvas=document.createElement('canvas');canvas.width=Math.round(pending.slot.width);canvas.height=Math.round(pending.slot.height)
   const ctx=canvas.getContext('2d')!;ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.imageSmoothingQuality='high';ctx.drawImage(original,area.x,area.y,area.width,area.height,0,0,canvas.width,canvas.height)
   const image=await load(canvas.toDataURL('image/png'));image.dataset.thumbnail=image.src
   pending.apply(pending.slot.id,image);sources.current.set(pending.slot.id,{src:pending.src,area});setQueue(q=>q.slice(1))
  }catch(e){setError(e instanceof Error?e.message:'사진 영역을 적용하지 못했어요.')}finally{locked.current=false;setBusy(false)}
 }}/> : null}
}
