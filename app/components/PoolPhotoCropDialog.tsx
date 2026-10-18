'use client'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Cropper, { type Area } from 'react-easy-crop'
import './PoolPhotoCropDialog.css'
export default function PoolPhotoCropDialog({src,aspect,initial,title,busy,error,onSave,onCancel}:{src:string;aspect:number;initial?:Area;title:string;busy:boolean;error:string;onSave:(area:Area)=>void;onCancel:()=>void}) {
 const dialog=useRef<HTMLDialogElement>(null),[crop,setCrop]=useState({x:0,y:0}),[zoom,setZoom]=useState(1),[area,setArea]=useState<Area|null>(null)
 useEffect(()=>{const focus=document.activeElement as HTMLElement|null;const overflow=document.body.style.overflow;document.body.style.overflow='hidden';dialog.current?.showModal();return()=>{document.body.style.overflow=overflow;focus?.focus({preventScroll:true})}},[])
 return createPortal(<dialog ref={dialog} className="pool-crop-dialog" aria-label="사진 슬롯 크롭 편집" onCancel={e=>{e.preventDefault();if(!busy)onCancel()}}>
 <header><div><h2>{title}</h2><p>사진을 움직이고 확대해 얼굴이 칸 안에 들어오도록 맞춰주세요.</p></div><button disabled={busy} onClick={onCancel} aria-label="크롭 닫기">닫기 ✕</button></header>
 <div className="pool-crop-stage"><Cropper image={src} aspect={aspect} crop={crop} zoom={zoom} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={(_,pixels)=>setArea(pixels)} initialCroppedAreaPixels={initial} showGrid mediaProps={{crossOrigin:'anonymous'}} /></div>
 <label className="pool-crop-zoom">확대<input type="range" min={1} max={4} step={.01} value={zoom} onChange={e=>setZoom(Number(e.target.value))} disabled={busy}/><span>{zoom.toFixed(1)}×</span><button disabled={busy} onClick={()=>{setCrop({x:0,y:0});setZoom(1)}}>초기화</button></label>
 <footer><p>선택한 영역 그대로 사진 슬롯에 들어갑니다.</p><button disabled={!area||busy} onClick={()=>area&&onSave(area)}>{busy?'저장 중…':'이 영역으로 저장'}</button></footer>
 {error&&<p role="alert" className="pool-crop-error">{error}</p>}
 </dialog>,document.body)
}
