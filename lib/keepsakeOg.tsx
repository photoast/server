import { ImageResponse } from 'next/og'
import { readFile } from 'fs/promises'
import path from 'path'
export async function renderKeepsakeOg(title: string, date: string, photos: Buffer[]) {
  const displayTitle = title.replace(/❤️|♥|♡|❤/g, ' · ').replace(new RegExp('[\\p{Extended_Pictographic}\\uFE0F]', 'gu'), ' ').replace(/\s+/g, ' ').trim() || '우리의 소중한 하루'
  const [serif, script] = await Promise.all(['NanumMyeongjo-Regular.ttf', 'Allura-Regular.ttf'].map(file => readFile(path.join(process.cwd(), 'public/fonts/wedding', file))))
  return new ImageResponse(<div style={{ width: '100%', height: '100%', display: 'flex', background: '#faf8f3', color: '#485443', padding: '48px 60px', position: 'relative' }}>
    <div style={{ position: 'absolute', top: 25, left: 30, right: 30, bottom: 25, border: '1px solid #d9ddcf', display: 'flex' }} />
    <div style={{ width: photos.length ? '55%' : '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: photos.length ? 'flex-start' : 'center' }}>
      <span style={{ fontFamily: 'Script', fontSize: 57, color: '#7d8b71', marginBottom: 18 }}>Our wedding day</span>
      <div style={{ display: 'flex', fontFamily: 'Serif', fontSize: displayTitle.length > 28 ? 30 : displayTitle.length > 14 ? 40 : 54, lineHeight: 1.5, maxWidth: photos.length ? 540 : 980, wordBreak: 'keep-all', overflowWrap: 'anywhere', marginBottom: 20 }}>{displayTitle}</div>
      {date && <span style={{ fontFamily: 'Serif', fontSize: 23, letterSpacing: 3, color: '#718065', marginBottom: 32 }}>{date.replace(/-/g, ' . ')}</span>}
      <span style={{ fontFamily: 'Serif', fontSize: 24, marginTop: 10 }}>함께 웃었던 순간들을 모아,</span>
      <span style={{ fontFamily: 'Serif', fontSize: 24, marginTop: 12 }}>두 분께 전하는 작은 선물.</span>
    </div>
    {photos.length > 0 && <div style={{ width: '45%', display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
      {[0, 1, 2].map(i => <div key={i} style={{ display: 'flex', position: 'absolute', left: i * 122 + 8, top: i === 1 ? 15 : 43, width: 146, height: 438, background: '#fffdf9', padding: 3, transform: `rotate(${i === 0 ? -9 : i === 1 ? 2 : 10}deg)`, boxShadow: '0 8px 20px #48544322' }}><img alt="" src={`data:image/jpeg;base64,${photos[i % photos.length].toString('base64')}`} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /></div>)}
    </div>}
    <span style={{ position: 'absolute', bottom: 45, left: 60, fontFamily: 'Script', fontSize: 30, color: '#7d8b71' }}>A little gift, filled with love.</span>
  </div>, { width: 1200, height: 630, fonts: [{ name: 'Serif', data: serif, weight: 400 }, { name: 'Script', data: script, weight: 400 }], headers: { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' } })
}
