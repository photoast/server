'use client'

import { useEffect, useRef, useState } from 'react'
import { drawWeddingFrame, WEDDING_SLOTS, WEDDING_GROUPS, WEDDING_STYLES, weddingBundle, type WeddingOptions } from '@/lib/weddingFrames'
import './studio.css'
import useSlotPhotoCrop from '@/app/components/useSlotPhotoCrop'
import FrameStudioPublishing from '@/app/components/FrameStudioPublishing'

const initial: WeddingOptions = { style: 'vows', names: '영근 · 예진', date: '', title: 'Our wedding day', accent: '#687e61', nameFont: 'serif', palette: 'concept' }
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob), anchor = document.createElement('a')
  anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export default function FrameStudio() {
  const cropEditor = useSlotPhotoCrop()
  const applyPhoto = (id: string,image:HTMLImageElement) => { const index = WEDDING_SLOTS.findIndex(slot=>slot.id===id); setPhotos(old=>old.map((p,i)=>i===index?image:p)); setMessage('') }
  const [options, setOptions] = useState<WeddingOptions>(initial)
  const [photos, setPhotos] = useState<(HTMLImageElement | null)[]>([null, null, null])
  const [message, setMessage] = useState(''), [ready, setReady] = useState(false), [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState(false)
  const [group, setGroup] = useState<string>('all')
  const canvases = useRef<(HTMLCanvasElement | null)[]>([])
  const revision = useRef(0)
  useEffect(() => {
    const current = ++revision.current
    setReady(false)
    Promise.all(WEDDING_STYLES.map(async (style, i) => {
      const scratch = document.createElement('canvas')
      await drawWeddingFrame(scratch, { ...options, style: style.id }, photos)
      if (current === revision.current) {
        const target = canvases.current[i]
        if (target) { target.width = 240; target.height = 720; target.getContext('2d')?.drawImage(scratch, 0, 0, 240, 720) }
      }
    })).then(() => { if (current === revision.current) setReady(true) })
      .catch(() => { if (current === revision.current) setMessage('폰트를 불러오지 못했어요. 새로고침한 뒤 다시 시도해 주세요.') })
  }, [options, photos])
  function change<K extends keyof WeddingOptions>(key: K, value: WeddingOptions[K]) { setOptions(o => ({ ...o, [key]: value })); setMessage('') }
  function photo(file: File | undefined, index: number) { if(file) cropEditor.select([file],[WEDDING_SLOTS[index]],applyPhoto) }
  async function exportFile(kind: 'png' | 'json' | 'preview') {
    if (!options.names.trim()) { setMessage('두 사람의 이름을 입력해 주세요.'); return }
    if (kind === 'preview' && photos.some(p => !p)) { setMessage('미리보기 사진 3장을 모두 선택해 주세요.'); return }
    setBusy(true); setMessage('')
    try {
      const canvas = document.createElement('canvas')
      await drawWeddingFrame(canvas, options, kind === 'preview' ? photos : [])
      if (kind === 'json') download(new Blob([JSON.stringify(weddingBundle(options, canvas.toDataURL('image/png')), null, 2)], { type: 'application/json' }), `phototoast-${options.style}.json`)
      else {
        const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error()), 'image/png'))
        download(blob, `phototoast-${options.style}${kind === 'preview' ? '-preview' : '-transparent'}.png`)
      }
      setMessage(kind === 'json' ? '레이아웃 파일을 내려받았어요. 2×6 편집기에서 가져올 수 있습니다.' : '이미지를 내려받았어요.')
    } catch { setMessage('파일을 만들지 못했어요. 잠시 후 다시 시도해 주세요.') }
    finally { setBusy(false) }
  }
  return <main className="wedding-studio">
    <header className="ws-header"><a href="/admin">PHOTO TOAST <span>/ FRAME STUDIO</span></a><span>웨딩 컬렉션 01</span></header>
    <div className="ws-intro"><p className="ws-eyebrow">MADE FOR YOUR DAY</p><h1>두 사람의 날을,<br />오래 간직할 프레임으로.</h1><p>이름과 색을 담고, 취향에 맞는 프레임을 골라보세요.</p></div>
    <div className="ws-workspace"><aside className="ws-controls">
      <div className="ws-section-title"><span>01</span><h2>우리의 이야기</h2></div>
      <label>두 사람의 이름<input value={options.names} maxLength={28} onChange={e => change('names', e.target.value)} /></label>
      <label>예식 날짜 <small>미정이면 비워두세요</small><input type="date" min="1900-01-01" max="2199-12-31" value={options.date} onChange={e => change('date', e.target.value)} /></label>
      <label>상단 문구<input value={options.title} maxLength={45} onChange={e => change('title', e.target.value)} /></label>
      <label>이름 글씨<select value={options.nameFont} onChange={e => change('nameFont', e.target.value as 'serif' | 'sans')}><option value="serif">나눔명조 · 차분하고 섬세하게</option><option value="sans">고딕 · 또렷하고 단정하게</option></select></label>
      <label>포인트 색상<div className="ws-colors">{['#687e61', '#343f35', '#7d6659', '#786578', '#303030'].map(color => <button key={color} style={{ background: color }} aria-label={`색상 ${color}`} aria-pressed={options.palette !== 'concept' && options.accent === color} onClick={() => { setOptions(o => ({ ...o, accent: color, palette: 'custom' })); setMessage('') }} />)}<input aria-label="직접 색상 선택" type="color" value={options.accent} onChange={e => { const color = e.target.value; setOptions(o => ({ ...o, accent: color, palette: 'custom' })); setMessage('') }} /></div><button className="ws-default-palette" aria-pressed={options.palette === 'concept'} onClick={() => change('palette', 'concept')}>컨셉 기본색{options.palette === 'concept' ? ' ✓' : '으로 돌아가기'}</button><small className="ws-palette-note">필름·딥 그린은 밝은 글씨를 유지합니다.</small></label>
      <div className="ws-section-title ws-photo-heading"><span>02</span><h2>사진으로 확인하기</h2></div><p className="ws-note">미리보기는 브라우저에서 처리합니다.<br />제안 링크를 만들면 완성 샘플이 저장됩니다.</p>
      <div className="ws-photo-inputs">{[0, 1, 2].map(i => <label key={i} className="ws-photo-input">{photos[i] ? `${i + 1}번 사진 교체` : `${i + 1}번 사진 선택`}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => { void photo(e.target.files?.[0], i); e.target.value = '' }} /></label>)}</div>
      <div className="ws-photo-adjust">{photos.map((photo,i)=>photo&&<button key={i} onClick={()=>cropEditor.edit(WEDDING_SLOTS[i],photo,applyPhoto)}>{i+1}번 사진 위치 조정</button>)}</div>
      {photos.some(Boolean) && <button className="ws-reset" onClick={() => setPhotos([null, null, null])}>사진 지우기</button>}
    </aside><section className="ws-results" aria-label="프레임 디자인 비교">
      <div className="ws-results-heading"><h2>프레임 컬렉션 · {WEDDING_STYLES.length}가지 무드</h2><span>2×6 · 동일한 사진 3칸</span></div>
      <p className="ws-swipe">옆으로 넘겨 디자인을 비교해 보세요 →</p>
      <div className="ws-filters" role="group" aria-label="템플릿 분류">{WEDDING_GROUPS.map(item => <button key={item.id} aria-pressed={group === item.id} onClick={() => { setGroup(item.id); if (item.id !== 'all' && WEDDING_STYLES.find(s => s.id === options.style)?.group !== item.id) { const first = WEDDING_STYLES.find(s => s.group === item.id); if (first) change('style', first.id) } }}>{item.name}<span>{item.id === 'all' ? WEDDING_STYLES.length : WEDDING_STYLES.filter(s => s.group === item.id).length}</span></button>)}</div>
      <div className="ws-designs">{WEDDING_STYLES.map((style, i) => <button hidden={group !== 'all' && group !== style.group} className={`ws-design ${options.style === style.id ? 'is-selected' : ''}`} key={style.id} aria-pressed={options.style === style.id} onClick={() => { change('style', style.id); setSelected(true) }}>
        <div className="ws-paper"><canvas ref={node => { canvases.current[i] = node }} aria-label={`${style.name} 미리보기`} /></div><div className="ws-design-label"><span>{String(i + 1).padStart(2, '0')}</span><h3>{style.name}</h3><span className="ws-check">{options.style === style.id ? '✓' : '○'}</span></div><p>{style.description}</p>
      </button>)}</div>
      <div className="ws-export"><div><span className="ws-eyebrow">YOUR KEEPSAKE</span><h2>{WEDDING_STYLES.find(s => s.id === options.style)?.name}</h2><p>600 × 1800px · 300ppi 기준 · 슬롯 내부 완전 투명</p></div><div className="ws-export-buttons"><button disabled={!ready || busy} onClick={() => void exportFile('png')}>투명 프레임 PNG ↓</button><button className="secondary" disabled={!ready || busy} onClick={() => void exportFile('json')}>포토토스트 레이아웃 ↓</button><button className="secondary" disabled={!ready || busy} onClick={() => void exportFile('preview')}>사진 포함 미리보기 ↓</button></div></div>
      <p className="ws-status" role="status">{message || (!ready ? '인화용 폰트를 준비하고 있어요…' : selected ? '선택한 디자인으로 내려받습니다.' : '마음에 드는 디자인을 선택해 주세요.')}</p>
      <p className="ws-footnote">체크무늬는 투명 영역입니다. 실제 인화 전에는 사용하는 프린터의 2×6 규격과 재단 위치를 한 장 테스트해 주세요.</p>
      <FrameStudioPublishing options={options} photos={photos} ready={ready} />
    </section></div>
    {cropEditor.dialog}
    {cropEditor.error && !cropEditor.active && <p role="alert">{cropEditor.error}</p>}
    <footer className="ws-footer">PHOTO TOAST <span>사진은 크게. 장식은 조용하게. 기억은 오래도록.</span></footer>
  </main>
}
