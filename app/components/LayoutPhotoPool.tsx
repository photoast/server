'use client'
import { useEffect, useRef, useState } from 'react'
import type { Area } from 'react-easy-crop'
import type { FrameLayout, PreviewPoolPhoto } from '@/lib/types'
import { getPreviewSlotGroups, getRandomPreviewConfig, uniformPreviewRatio } from '@/lib/boothRandomPreviews'
import { renderRandomBoothPreviews } from '@/lib/renderRandomBoothPreviews'
import { savePoolPhoto } from '@/lib/preparePoolPhoto'
import PoolPhotoCropDialog from './PoolPhotoCropDialog'
export default function LayoutPhotoPool({layout,disabled,onSave,onBusyChange}:{layout:FrameLayout;disabled:boolean;onSave:(photos:PreviewPoolPhoto[])=>Promise<void>;onBusyChange:(busy:boolean)=>void}) {
 const [queue,setQueue]=useState<{src:string;revoke:boolean}[]>([]),[edit,setEdit]=useState<PreviewPoolPhoto|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('')
 const [previews,setPreviews]=useState<string[]>([])
 useEffect(()=>setPreviews([]),[layout.previewPhotoPool,layout.frameLayers])
 const urls=useRef<string[]>([]),lock=useRef(false),latest=useRef(layout.previewPhotoPool||[])
 const pool=layout.previewPhotoPool||[],ratio=uniformPreviewRatio(layout.slots),needed=getPreviewSlotGroups(layout.slots).length
 latest.current=pool
 const compatible=ratio?pool.filter(p=>Math.abs(p.aspectRatio-ratio)<.002).length:0
 useEffect(()=>{onBusyChange(busy||queue.length>0||Boolean(edit))},[busy,queue.length,edit,onBusyChange])
 useEffect(()=>()=>urls.current.forEach(URL.revokeObjectURL),[])
 const cancel=()=>{if(busy)return;queue.forEach(q=>{if(q.revoke)URL.revokeObjectURL(q.src)});setQueue([]);setEdit(null);setError('')}
 return <div className="rounded-xl border border-green-200 bg-green-50/40 p-4 space-y-3">
 <h4 className="font-semibold text-gray-900">사진만 등록해서 랜덤 프레임 만들기</h4>
 <p className="text-sm text-gray-600 leading-7">사진마다 얼굴이 보이는 영역을 정해두면, {needed}장씩 중복 없이 골라 이 프레임으로 자동 합성합니다. 약 30초마다 다른 조합을 보여줘요.</p>
 {!ratio?<p className="text-sm text-amber-800">사진 칸의 비율이 모두 같은 레이아웃에서 사용할 수 있어요. 이 레이아웃은 아래 칸별 합성을 이용해 주세요.</p>:<>
 <label className="inline-flex min-h-11 items-center rounded-lg bg-green-800 text-white px-4 text-sm cursor-pointer">랜덤 사진 여러 장 추가 · 크롭 설정<input type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={disabled||busy||pool.length>=50} onChange={e=>{const files=Array.from(e.target.files||[]);e.target.value='';setError('');setMessage('');if(files.length+pool.length>50){setError('사진은 최대 50장까지 등록할 수 있어요.');return}if(files.some(f=>!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size>8*1024*1024)){setError('8MB 이하 JPG·PNG·WebP 사진을 선택해 주세요.');return}const next=files.map(f=>({src:URL.createObjectURL(f),revoke:true}));urls.current.push(...next.map(q=>q.src));setQueue(next)}}/></label>
 <p className="text-sm text-gray-600">{compatible}/{pool.length}장 사용 가능 · 최소 {needed}장 필요 · {compatible>=needed?'랜덤 합성 준비 완료':'사진을 더 등록하거나 크롭을 확인해 주세요'}</p>
 {layout.boothPreviewSource==='prints'&&<p className="text-sm text-amber-800">현재는 인화 사진만 표시하도록 설정되어 있어요. 랜덤 프레임을 표시하려면 위에서 미리보기 또는 혼합을 선택해 주세요.</p>}
 <button className="min-h-11 rounded-lg border border-green-300 px-4 text-sm text-green-800 disabled:opacity-40" disabled={disabled||busy||compatible<needed} onClick={async()=>{setBusy(true);setError('');try{const config=getRandomPreviewConfig({...layout,boothPreviewSource:'samples'});if(!config)throw new Error('사진 수와 비율을 확인해 주세요.');const images=await renderRandomBoothPreviews(config);if(!images.length)throw new Error('사진을 불러오지 못했어요. 크롭을 확인해 주세요.');setPreviews(images)}catch(e){setError(e instanceof Error?e.message:'합성하지 못했어요.')}finally{setBusy(false)}}}>랜덤 조합 미리 보기</button>
 {previews.length>0&&<div className="grid grid-cols-3 gap-3 rounded-lg bg-gray-100 p-3">{previews.map((src,i)=><img key={src} src={src} alt={'랜덤 프레임 샘플 '+(i+1)} className="max-h-72 w-full object-contain"/>)}</div>}
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{pool.map((photo,i)=><div className="rounded-lg border bg-white p-2" key={photo.id}><img src={photo.imageUrl} alt={'랜덤 사진 '+(i+1)+' 저장된 크롭'} className="h-24 w-full object-contain bg-gray-100"/><p className="mt-1 text-xs text-gray-500">사진 {i+1}{ratio&&Math.abs(photo.aspectRatio-ratio)>=.002?' · 비율 재설정 필요':''}</p><div className="flex justify-between gap-2"><button className="min-h-11 text-sm text-green-800" disabled={disabled||busy} onClick={()=>{setError('');setEdit(photo);setQueue([{src:photo.originalUrl,revoke:false}])}}>크롭 수정</button><button className="min-h-11 text-sm text-red-600" disabled={disabled||busy} onClick={async()=>{setBusy(true);setError('');try{await onSave(latest.current.filter(p=>p.id!==photo.id));setMessage('랜덤 사진 목록에서 제거했어요.')}catch(e){setError(e instanceof Error?e.message:'삭제하지 못했어요.')}finally{setBusy(false)}}}>제거</button></div></div>)}</div>
 </>}
 {queue[0]&&ratio&&<PoolPhotoCropDialog key={queue[0].src} src={queue[0].src} aspect={ratio} initial={edit?.crop} title={edit?'사진 크롭 수정':'사진 영역 선택 · '+queue.length+'장 남음'} busy={busy} error={error} onCancel={cancel} onSave={async(area:Area)=>{if(lock.current)return;lock.current=true;setBusy(true);setError('');try{const photo=await savePoolPhoto(queue[0].src,area,Math.round(layout.slots[0].width),Math.round(layout.slots[0].height),edit||undefined);const next=edit?latest.current.map(p=>p.id===edit.id?photo:p):[...latest.current,photo];await onSave(next);latest.current=next;if(queue[0].revoke)URL.revokeObjectURL(queue[0].src);setQueue(q=>q.slice(1));setEdit(null);setMessage('크롭한 영역을 저장했어요. 랜덤 합성에서도 그대로 사용됩니다.')}catch(e){setError(e instanceof Error?e.message:'저장하지 못했어요.')}finally{lock.current=false;setBusy(false)}}}/>}
 {message&&<p role="status" className="text-sm text-green-800">{message}</p>}{error&&!queue.length&&<p role="alert" className="text-sm text-red-600">{error}</p>}
 </div>
}
