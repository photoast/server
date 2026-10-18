'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Script from 'next/script'
import { useParams, useSearchParams } from 'next/navigation'

const NICEPAY_CLIENT_ID = process.env.NEXT_PUBLIC_NICEPAY_CLIENT_ID || 'S2_af4543a0be4d49a98122e01ec2059a56'

declare global {
  interface Window {
    AUTHNICE?: {
      requestPay: (options: {
        clientId: string
        method: string
        orderId: string
        amount: number
        goodsName: string
        returnUrl: string
        mallReserved?: string
        fnError?: (result: { errorMsg: string }) => void
      }) => void
    }
  }
}

type BoothEvent = {
  name: string
  slug: string
  price?: number
  authCodeRequired?: boolean
  endedAt?: string | null
  logoUrl?: string
  isTestPrinter?: boolean
}

type Screen = 'welcome' | 'shoot' | 'preview' | 'sending' | 'done'

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

async function makeWeddingStrip(photos: string[], eventName: string): Promise<string> {
  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = 1800
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('인화 이미지를 만들지 못했어요. 다시 시도해 주세요.')

  ctx.fillStyle = '#f7f2ea'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#fffdf9'
  ctx.fillRect(22, 22, 1156, 1756)
  ctx.strokeStyle = '#d9c7ae'
  ctx.lineWidth = 3
  ctx.strokeRect(38, 38, 1124, 1724)

  const drawStrip = async (x: number) => {
    const stripW = 530
    ctx!.fillStyle = '#fffdf9'
    ctx!.fillRect(x, 74, stripW, 1652)
    ctx!.textAlign = 'center'
    ctx!.fillStyle = '#8d7359'
    ctx!.font = 'italic 38px Georgia, serif'
    ctx!.fillText('A day to remember', x + stripW / 2, 132)
    ctx!.fillStyle = '#493d31'
    ctx!.font = '600 34px Arial, sans-serif'
    const title = eventName.length > 22 ? `${eventName.slice(0, 21)}…` : eventName
    ctx!.fillText(title, x + stripW / 2, 185)

    const imgX = x + 30
    const imgW = stripW - 60
    const imgH = 330
    const gap = 20
    for (let i = 0; i < photos.length; i++) {
      const img = new Image()
      img.src = photos[i]
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('촬영한 사진을 불러오지 못했어요.'))
      })
      const y = 230 + i * (imgH + gap)
      ctx!.save()
      roundedRect(ctx!, imgX, y, imgW, imgH, 4)
      ctx!.clip()
      const scale = Math.max(imgW / img.width, imgH / img.height)
      const dw = img.width * scale
      const dh = img.height * scale
      ctx!.drawImage(img, imgX + (imgW - dw) / 2, y + (imgH - dh) / 2, dw, dh)
      ctx!.restore()
      ctx!.strokeStyle = '#e7ddd0'
      ctx!.lineWidth = 3
      ctx!.strokeRect(imgX, y, imgW, imgH)
    }

    ctx!.fillStyle = '#ad8c69'
    ctx!.font = 'italic 28px Georgia, serif'
    ctx!.fillText('With love, always ♡', x + stripW / 2, 1668)
  }

  await drawStrip(45)
  await drawStrip(625)
  ctx.setLineDash([10, 12])
  ctx.strokeStyle = '#cdbba3'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(600, 72)
  ctx.lineTo(600, 1728)
  ctx.stroke()
  return canvas.toDataURL('image/jpeg', 0.94)
}

export default function WeddingBoothPage() {
  const params = useParams<{ slug: string }>()
  const slug = params.slug
  const searchParams = useSearchParams()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const photosRef = useRef<string[]>([])
  const processedPayment = useRef(false)
  const [event, setEvent] = useState<BoothEvent | null>(null)
  const [screen, setScreen] = useState<Screen>('welcome')
  const [photos, setPhotos] = useState<string[]>([])
  const [previewUrl, setPreviewUrl] = useState('')
  const [countdown, setCountdown] = useState<number | null>(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [authCode, setAuthCode] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [needEmail, setNeedEmail] = useState(false)

  const stopCamera = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
    setCameraReady(false)
  }, [])

  useEffect(() => {
    fetch(`/api/events/slug/${slug}`).then(async res => {
      if (!res.ok) throw new Error('이 이벤트를 찾을 수 없어요.')
      setEvent(await res.json())
    }).catch(err => setError(err.message || '이벤트 정보를 불러오지 못했어요.'))
    return () => stopCamera()
  }, [slug, stopCamera])

  const openCamera = async () => {
    setError('')
    setScreen('shoot')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      })
      streamRef.current = stream
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
      const video = videoRef.current
      if (!video) throw new Error('카메라 화면을 준비하지 못했어요.')
      video.srcObject = stream
      await video.play()
      setCameraReady(true)
    } catch {
      stopCamera()
      setScreen('welcome')
      setError('카메라를 열 수 없어요. Safari의 카메라 권한을 허용하고 다시 시도해 주세요.')
    }
  }

  const finishCapture = async () => {
    stopCamera()
    try {
      setPreviewUrl(await makeWeddingStrip(photosRef.current, event?.name || 'Wedding Day'))
      setScreen('preview')
    } catch (err) {
      setError(err instanceof Error ? err.message : '미리보기를 만들지 못했어요.')
      setScreen('welcome')
    }
  }

  const captureSequence = async () => {
    const video = videoRef.current
    if (!video || !cameraReady || busy) return
    setBusy(true)
    setError('')
    photosRef.current = []
    setPhotos([])
    let remaining = 3
    setCountdown(remaining)
    timerRef.current = setInterval(() => {
      remaining -= 1
      if (remaining > 0) {
        setCountdown(remaining)
        return
      }
      clearInterval(timerRef.current!)
      timerRef.current = null
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        setError('카메라 이미지를 저장하지 못했어요.')
        setCountdown(null)
        setBusy(false)
        return
      }
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
      ctx.drawImage(video, 0, 0)
      const shot = canvas.toDataURL('image/jpeg', 0.9)
      photosRef.current = [...photosRef.current, shot]
      setPhotos(photosRef.current)
      const count = photosRef.current.length
      if (count === 4) {
        setCountdown(null)
        setBusy(false)
        void finishCapture()
        return
      }
      setCountdown(null)
      window.setTimeout(() => {
        let next = 3
        setCountdown(next)
        timerRef.current = setInterval(() => {
          next -= 1
          if (next > 0) {
            setCountdown(next)
            return
          }
          clearInterval(timerRef.current!)
          timerRef.current = null
          const shotCanvas = document.createElement('canvas')
          shotCanvas.width = video.videoWidth
          shotCanvas.height = video.videoHeight
          const shotCtx = shotCanvas.getContext('2d')
          if (!shotCtx) return
          shotCtx.translate(shotCanvas.width, 0)
          shotCtx.scale(-1, 1)
          shotCtx.drawImage(video, 0, 0)
          photosRef.current = [...photosRef.current, shotCanvas.toDataURL('image/jpeg', 0.9)]
          setPhotos(photosRef.current)
          if (photosRef.current.length === 4) {
            setCountdown(null)
            setBusy(false)
            void finishCapture()
          } else {
            window.setTimeout(() => captureNext(), 700)
          }
        }, 1000)
      }, 700)
    }, 1000)
  }

  const captureNext = () => {
    const video = videoRef.current
    if (!video) return
    let next = 3
    setCountdown(next)
    timerRef.current = setInterval(() => {
      next -= 1
      if (next > 0) {
        setCountdown(next)
        return
      }
      clearInterval(timerRef.current!)
      timerRef.current = null
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
      ctx.drawImage(video, 0, 0)
      photosRef.current = [...photosRef.current, canvas.toDataURL('image/jpeg', 0.9)]
      setPhotos(photosRef.current)
      if (photosRef.current.length === 4) {
        setCountdown(null)
        setBusy(false)
        void finishCapture()
      } else window.setTimeout(captureNext, 700)
    }, 1000)
  }

  const submitPrint = async (paymentTid?: string) => {
    if (!event) return
    setBusy(true)
    setError('')
    setScreen('sending')
    try {
      const imageUrl = await makeWeddingStrip(photosRef.current, event.name)
      localStorage.setItem('weddingBoothPreview', imageUrl)
      const res = await fetch('/api/print', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          imageUrl,
          ...(paymentTid ? { paymentTid } : {}),
          ...(authCode ? { authCode: authCode.trim().toUpperCase() } : {}),
          ...(customerEmail ? { customerEmail } : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '인쇄 요청을 보내지 못했어요.')
      localStorage.removeItem('weddingBoothPreview')
      setScreen('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : '인쇄 중 문제가 생겼어요.')
      setScreen('preview')
    } finally {
      setBusy(false)
    }
  }

  const printOrPay = async () => {
    if (!event) return
    if (event.authCodeRequired && !authCode.trim()) {
      setError('인증코드를 입력해 주세요.')
      return
    }
    if (event.authCodeRequired) {
      const res = await fetch('/api/auth-codes/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, code: authCode.trim().toUpperCase() }),
      })
      const data = await res.json()
      if (!res.ok || !data.valid) {
        setError(data.error || '인증코드를 확인해 주세요.')
        return
      }
    }
    const price = event.price ?? 0
    if (!price) return submitPrint()
    if (!customerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      setNeedEmail(true)
      setError('결제 안내를 받을 이메일을 입력해 주세요.')
      return
    }
    if (!window.AUTHNICE) {
      setError('결제창을 불러오는 중이에요. 잠시 후 다시 눌러 주세요.')
      return
    }
    try {
      const imageUrl = await makeWeddingStrip(photosRef.current, event.name)
      localStorage.setItem('pendingPrintUrl', imageUrl)
      localStorage.setItem('pendingCustomerEmail', customerEmail)
      if (authCode) localStorage.setItem('pendingAuthCode', authCode)
      window.AUTHNICE.requestPay({
        clientId: NICEPAY_CLIENT_ID,
        method: 'card',
        orderId: `PRINT_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        amount: price,
        goodsName: '웨딩 포토부스 인화 1매',
        returnUrl: `${window.location.origin}/api/payment/nicepay-return`,
        mallReserved: window.location.pathname,
        fnError: result => setError(result.errorMsg || '결제를 완료하지 못했어요.'),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : '결제 준비 중 문제가 생겼어요.')
    }
  }

  useEffect(() => {
    const status = searchParams.get('payment')
    const tid = searchParams.get('tid')
    const orderId = searchParams.get('orderId')
    const amount = searchParams.get('amount')
    if (status === 'fail') {
      setError(searchParams.get('errorMsg') || '결제가 취소되었어요. 인화 버튼을 다시 눌러 주세요.')
      window.history.replaceState({}, '', window.location.pathname)
      return
    }
    if (status !== 'success' || !tid || !orderId || !amount || processedPayment.current) return
    processedPayment.current = true
    const complete = async () => {
      setScreen('sending')
      try {
        const confirm = await fetch('/api/payment', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tid, orderId, amount: Number(amount), eventSlug: slug }),
        })
        if (!confirm.ok) throw new Error((await confirm.json()).error || '결제를 확인하지 못했어요.')
        const imageUrl = localStorage.getItem('pendingPrintUrl')
        if (!imageUrl) throw new Error('인화할 사진을 찾지 못했어요. 직원에게 알려 주세요.')
        const print = await fetch('/api/print', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug, imageUrl, paymentTid: tid, customerEmail: localStorage.getItem('pendingCustomerEmail'), authCode: localStorage.getItem('pendingAuthCode') }),
        })
        if (!print.ok) throw new Error((await print.json()).error || '인쇄 요청을 보내지 못했어요.')
        localStorage.removeItem('pendingPrintUrl')
        localStorage.removeItem('pendingCustomerEmail')
        localStorage.removeItem('pendingAuthCode')
        window.history.replaceState({}, '', window.location.pathname)
        setScreen('done')
      } catch (err) {
        setError(err instanceof Error ? err.message : '결제 확인 중 문제가 생겼어요.')
        setScreen('preview')
      }
    }
    void complete()
  }, [searchParams, slug])

  const startAgain = () => {
    setPhotos([])
    photosRef.current = []
    setPreviewUrl('')
    setError('')
    setScreen('welcome')
  }

  const ended = Boolean(event?.endedAt && new Date(event.endedAt).getTime() <= Date.now())
  if (!event) return <main className="booth-page"><div className="booth-loading">{error || '웨딩 포토부스를 준비하고 있어요…'}</div></main>

  return (
    <main className="booth-page">
      <Script src="https://pay.nicepay.co.kr/v1/js/" strategy="lazyOnload" />
      <header className="booth-topbar">
        <div className="booth-brand"><span className="booth-brand-mark">♡</span><span>PHOTO TOAST <i>WEDDING EDITION</i></span></div>
        <span className="booth-event-name">{event.name}</span>
      </header>
      <div className="booth-layout">
        <section className={`booth-stage booth-stage-${screen}`}>
          {screen === 'shoot' && <>
            <video ref={videoRef} autoPlay muted playsInline className="booth-video" />
            <div className="booth-viewfinder"><span /><span /><span /><span /></div>
            <div className="booth-live-label"><span /> CAMERA READY</div>
            <div className="booth-shot-progress">{[0, 1, 2, 3].map((n) => <span key={n} className={n < photos.length ? 'is-shot' : ''}>{n + 1}</span>)}</div>
            {countdown !== null && <div className="booth-countdown" key={`${photos.length}-${countdown}`}>{countdown}</div>}
          </>}
          {screen === 'welcome' && <div className="booth-welcome-art"><div className="booth-art-frame"><div className="booth-art-spark">✳</div><div className="booth-art-placeholder"><span>♡</span></div><div className="booth-art-caption">THE WEDDING DAY<br /><small>FOUR LITTLE MEMORIES</small></div></div><span className="booth-art-stamp">KEEP<br />THIS<br />MOMENT</span></div>}
          {screen === 'preview' && <div className="booth-print-preview"><img src={previewUrl} alt="웨딩 포토스트립 미리보기" /></div>}
          {screen === 'sending' && <div className="booth-message"><span className="booth-spinner"/><h2>사진을 보내고 있어요</h2><p>잠시만 기다려 주세요.</p></div>}
          {screen === 'done' && <div className="booth-message booth-complete"><span>♡</span><h2>오늘의 순간이 출력 중이에요</h2><p>사진을 챙기고 행복한 하루 보내세요.</p></div>}
        </section>
        <aside className="booth-controls">
          <div className="booth-kicker">A LITTLE KEEPSAKE</div>
          {screen === 'welcome' && <>
            <h1>오늘의 축하를<br /><em>네 컷에 담아요.</em></h1>
            <p className="booth-description">카메라를 보고 포즈를 취해 주세요.<br />3초 뒤, 네 장의 사진을 차례로 찍어요.</p>
            <div className="booth-howto"><span>01</span><div><b>카메라 앞에 서기</b><small>화면에 얼굴이 잘 보이도록 모여 주세요.</small></div></div>
            <div className="booth-howto"><span>02</span><div><b>네 가지 포즈 남기기</b><small>한 컷씩 3초 간격으로 촬영돼요.</small></div></div>
            <div className="booth-howto"><span>03</span><div><b>미리 보고 인화하기</b><small>완성된 스트립을 확인할 수 있어요.</small></div></div>
            {ended ? <div className="booth-error">이 행사는 종료되어 촬영할 수 없어요.</div> : <button className="booth-primary" onClick={openCamera}>카메라 시작 <span>→</span></button>}
          </>}
          {screen === 'shoot' && <>
            <h1>하나, 둘,<br /><em>찰칵!</em></h1>
            <p className="booth-description">카메라를 바라보고 자유롭게 포즈를 바꿔 보세요. 네 컷을 자동으로 촬영해요.</p>
            <div className="booth-counter"><strong>0{Math.min(photos.length + 1, 4)}</strong><span>/ 04<br />NEXT SHOT</span></div>
            <button className="booth-primary" onClick={captureSequence} disabled={busy || !cameraReady}>{busy ? '촬영 중이에요…' : '4컷 촬영 시작'} <span>◎</span></button>
            <button className="booth-text-button" onClick={() => { stopCamera(); setScreen('welcome') }}>돌아가기</button>
          </>}
          {screen === 'preview' && <>
            <h1>우리의 오늘을<br /><em>간직해요.</em></h1>
            <p className="booth-description">사진 네 장을 양쪽 스트립에 담았어요. 한 장은 간직하고, 한 장은 나눠 주세요.</p>
            {event.authCodeRequired && <input className="booth-input" value={authCode} onChange={e => { setAuthCode(e.target.value.toUpperCase()); setError('') }} placeholder="인증코드" maxLength={6} aria-label="인증코드" />}
            {needEmail && <input className="booth-input" value={customerEmail} onChange={e => { setCustomerEmail(e.target.value); setError('') }} placeholder="결제 안내 이메일" type="email" aria-label="결제 안내 이메일" />}
            <div className="booth-price">{(event.price ?? 0) ? `${(event.price ?? 0).toLocaleString()}원 · 1회 인화` : '무료 인화'}</div>
            <button className="booth-primary" onClick={printOrPay} disabled={busy}>{(event.price ?? 0) ? '결제하고 인화하기' : '인화하기'} <span>→</span></button>
            <button className="booth-text-button" onClick={() => { setPhotos([]); photosRef.current = []; setError(''); void openCamera() }}>다시 촬영하기</button>
          </>}
          {screen === 'sending' && <><h1>잠시만요,<br /><em>곧 나와요.</em></h1><p className="booth-description">완성된 사진을 프린터로 보내고 있어요.</p></>}
          {screen === 'done' && <><h1>고마워요.<br /><em>행복하세요!</em></h1><p className="booth-description">인화된 사진을 챙기고, 다음 분을 위해 첫 화면으로 돌아가 주세요.</p><button className="booth-primary" onClick={startAgain}>처음으로 <span>↺</span></button></>}
          {error && <div className="booth-error" role="alert">{error}</div>}
          {event.isTestPrinter && <div className="booth-test-note">테스트 프린터가 설정된 이벤트예요. 실제 사진은 출력되지 않습니다.</div>}
        </aside>
      </div>
      <footer className="booth-footer"><span>MADE FOR YOUR FOREVER</span><span>PHOTO TOAST · WEDDING EDITION</span></footer>
    </main>
  )
}
