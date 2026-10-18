'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Script from 'next/script'
import { useParams, useSearchParams } from 'next/navigation'
import BoothPhotoWall from '@/app/components/BoothPhotoWall'
import type { FrameLayout } from '@/lib/types'
import QRCode from 'qrcode'

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
  _id: string
  name: string
  slug: string
  price?: number
  authCodeRequired?: boolean
  endedAt?: string | null
  boothLayoutId?: string
  boothCountdownSeconds?: number
  boothSampleImageUrl?: string
  isTestPrinter?: boolean
}

type BoothLayout = {
  _id: string
  eventId: string
  name: string
  printSize: string
  canvasWidth: number
  canvasHeight: number
  backgroundColor?: string
  slots: FrameLayout['slots']
  frameLayers?: FrameLayout['frameLayers']
  frameUrl?: string | null
  price?: number
  visible?: boolean
  testImageUrls?: FrameLayout['testImageUrls']
  testPreviewImageUrl?: string
  previewImageUrls?: string[]
  boothPreviewSource?: FrameLayout['boothPreviewSource']
}

type Screen = 'welcome' | 'shoot' | 'composing' | 'preview' | 'sending' | 'done'

function getCaptureCount(layout: BoothLayout): number {
  const half = layout.slots.length / 2
  if (!Number.isInteger(half) || half < 3) return layout.slots.length
  const offsets = layout.slots.slice(0, half).map((slot, index) => {
    const twin = layout.slots[index + half]
    return twin && slot.y === twin.y && slot.width === twin.width && slot.height === twin.height
      ? twin.x - slot.x
      : null
  })
  return offsets.every(offset => offset !== null && offset === offsets[0]) ? half : layout.slots.length
}

export default function WeddingBoothPage() {
  const params = useParams<{ slug: string }>()
  const slug = params.slug
  const searchParams = useSearchParams()
  const videoRef = useRef<HTMLVideoElement>(null)
  const stageRef = useRef<HTMLElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const delayRef = useRef<number | null>(null)
  const photosRef = useRef<string[]>([])
  const processedPayment = useRef(false)
  const printActionRef = useRef(false)

  const [event, setEvent] = useState<BoothEvent | null>(null)
  const [layout, setLayout] = useState<BoothLayout | null>(null)
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
  // The printer API counts sheets/jobs. A 2x6 sheet is cut into two strips.
  const [printQuantity, setPrintQuantity] = useState(1)
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 })
  const [resultJobId, setResultJobId] = useState<string | null>(null)
  const [downloadQr, setDownloadQr] = useState('')
  const [qrError, setQrError] = useState('')
  const [returnSeconds, setReturnSeconds] = useState(30)
  const [paymentOpen, setPaymentOpen] = useState(false)

  useEffect(() => {
    if (screen !== 'shoot' || !stageRef.current) return
    const observer = new ResizeObserver(entries => {
      const rect = entries[0]?.contentRect
      if (rect) setStageSize({ width: rect.width, height: rect.height })
    })
    observer.observe(stageRef.current)
    return () => observer.disconnect()
  }, [screen])

  const stopCamera = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (delayRef.current !== null) window.clearTimeout(delayRef.current)
    timerRef.current = null
    delayRef.current = null
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
    setCameraReady(false)
  }, [])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const eventRes = await fetch(`/api/events/slug/${slug}`)
        if (!eventRes.ok) throw new Error('이 이벤트를 찾을 수 없어요.')
        const eventData: BoothEvent = await eventRes.json()
        if (cancelled) return
        if (eventData.boothLayoutId) {
          const layoutRes = await fetch(`/api/layouts/${eventData.boothLayoutId}`)
          if (!layoutRes.ok) throw new Error('관리자에서 포토부스 레이아웃을 다시 선택해 주세요.')
          const layoutData: BoothLayout = await layoutRes.json()
          if (cancelled) return
          if (layoutData.eventId !== eventData._id || layoutData.visible === false || !layoutData.slots?.length || layoutData.slots.some(slot => !Number.isFinite(slot.width) || !Number.isFinite(slot.height) || slot.width < 1 || slot.height < 1)) {
            throw new Error('선택한 레이아웃을 사용할 수 없어요. 관리자에서 사진 슬롯이 있는 레이아웃을 선택해 주세요.')
          }
          setLayout(layoutData)
        }
        if (!cancelled) setEvent(eventData)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : '포토부스 설정을 불러오지 못했어요.')
      }
    }
    void load()
    return () => { cancelled = true; stopCamera() }
  }, [slug, stopCamera])

  const openCamera = async () => {
    if (!layout || !event) {
      setError('관리자가 이벤트 설정에서 촬영 레이아웃을 선택해야 해요.')
      return
    }
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

  const composePhotos = async (capturedPhotos: string[]) => {
    if (!layout || capturedPhotos.length !== getCaptureCount(layout)) {
      throw new Error('촬영한 사진 수가 선택된 레이아웃과 맞지 않아요. 다시 촬영해 주세요.')
    }
    const formData = new FormData()
    formData.append('layoutId', layout._id)
    formData.append('backgroundColor', layout.backgroundColor || '#FFFFFF')
    await Promise.all(layout.slots.map(async (slot, index) => {
      const photoIndex = layout.slots.length === capturedPhotos.length * 2 ? index % capturedPhotos.length : index
      const blob = await (await fetch(capturedPhotos[photoIndex])).blob()
      formData.append(`slot_${slot.id}_photo`, new File([blob], `booth-${photoIndex + 1}.jpg`, { type: 'image/jpeg' }))
    }))
    const response = await fetch('/api/layouts/merge', { method: 'POST', body: formData })
    const data = await response.json()
    if (!response.ok || !data.url) throw new Error(data.error || '사진을 합성하지 못했어요.')
    return data.url as string
  }

  const finishCapture = async () => {
    stopCamera()
    setBusy(true)
    setScreen('composing')
    try {
      setPreviewUrl(await composePhotos(photosRef.current))
      setScreen('preview')
    } catch (err) {
      setError(err instanceof Error ? err.message : '미리보기를 만들지 못했어요.')
      setScreen('welcome')
    } finally {
      setBusy(false)
    }
  }

  const captureNextPhoto = (video: HTMLVideoElement, seconds: number) => {
    let remaining = seconds
    setCountdown(remaining)
    timerRef.current = setInterval(() => {
      remaining -= 1
      if (remaining > 0) {
        setCountdown(remaining)
        return
      }
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = null
      if (!video.videoWidth || !video.videoHeight) {
        setBusy(false)
        setCountdown(null)
        setError('카메라 영상이 아직 준비되지 않았어요. 잠시 후 다시 촬영해 주세요.')
        return
      }
      const canvas = document.createElement('canvas')
      const slot = layout?.slots[photosRef.current.length]
      if (!slot) return
      canvas.width = Math.max(1, Math.round(slot.width))
      canvas.height = Math.max(1, Math.round(slot.height))
      const targetRatio = canvas.width / canvas.height
      const sourceWidth = Math.min(video.videoWidth, video.videoHeight * targetRatio)
      const sourceHeight = sourceWidth / targetRatio
      const context = canvas.getContext('2d')
      if (!context) {
        setBusy(false)
        setCountdown(null)
        setError('카메라 이미지를 저장하지 못했어요.')
        return
      }
      context.translate(canvas.width, 0)
      context.scale(-1, 1)
      context.drawImage(video,
        (video.videoWidth - sourceWidth) / 2, (video.videoHeight - sourceHeight) / 2,
        sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height)
      photosRef.current = [...photosRef.current, canvas.toDataURL('image/jpeg', 0.92)]
      setPhotos(photosRef.current)
      setCountdown(null)
      if (layout && photosRef.current.length >= getCaptureCount(layout)) {
        void finishCapture()
      } else {
        delayRef.current = window.setTimeout(() => {
          delayRef.current = null
          captureNextPhoto(video, Math.max(3, Math.min(15, event?.boothCountdownSeconds ?? 7)))
        }, 900)
      }
    }, 1000)
  }

  const captureSequence = () => {
    const video = videoRef.current
    if (!video || !cameraReady || busy || !layout) return
    setBusy(true)
    setError('')
    photosRef.current = []
    setPhotos([])
    captureNextPhoto(video, Math.max(3, Math.min(15, event?.boothCountdownSeconds ?? 7)))
  }

  const submitPrint = async (paymentTid?: string) => {
    if (!event || !layout || !previewUrl) return
    setBusy(true)
    setError('')
    setScreen('sending')
    try {
      const res = await fetch('/api/print', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          layoutId: layout._id,
          imageUrl: previewUrl,
          quantity: printQuantity,
          ...(paymentTid ? { paymentTid } : {}),
          ...(authCode ? { authCode: authCode.trim().toUpperCase() } : {}),
          ...(customerEmail ? { customerEmail } : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '인쇄 요청을 보내지 못했어요.')
      setResultJobId(data.jobIds?.[0] || null)
      if (Number.isInteger(data.quantity) && data.quantity >= 1 && data.quantity <= 10) setPrintQuantity(data.quantity)
      setScreen('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : '인쇄 중 문제가 생겼어요.')
      setScreen('preview')
    } finally {
      setBusy(false)
    }
  }

  const printOrPay = async () => {
    if (!event || !layout || !previewUrl) return
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
    const price = (layout.price ?? event.price ?? 0) * printQuantity
    if (price <= 0) return submitPrint()
    if (!customerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      setNeedEmail(true)
      setError('결제 안내를 받을 이메일을 입력해 주세요.')
      return
    }
    if (!window.AUTHNICE) {
      setError('결제창을 불러오는 중이에요. 잠시 후 다시 눌러 주세요.')
      return
    }
    localStorage.setItem('pendingPrintUrl', previewUrl)
    localStorage.setItem('pendingCustomerEmail', customerEmail)
    localStorage.setItem('pendingLayoutId', layout._id)
    localStorage.setItem('pendingBoothQuantity', String(printQuantity))
    if (authCode) localStorage.setItem('pendingAuthCode', authCode)
    setPaymentOpen(true)
    try {
      window.AUTHNICE.requestPay({
        clientId: NICEPAY_CLIENT_ID,
        method: 'card',
        orderId: `PRINT_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        amount: price,
        goodsName: `${layout.name} ${printQuantity * (layout.printSize === '2x6' ? 2 : 1)}장`,
        returnUrl: `${window.location.origin}/api/payment/nicepay-return`,
        mallReserved: window.location.pathname,
        fnError: result => {
          setPaymentOpen(false)
          setError(result.errorMsg || '결제를 완료하지 못했어요.')
        },
      })
    } catch (err) {
      setPaymentOpen(false)
      throw err
    }
  }

  const handlePrintAction = async () => {
    if (printActionRef.current) return
    printActionRef.current = true
    setBusy(true)
    setError('')
    try {
      await printOrPay()
    } catch (err) {
      setError(err instanceof Error ? err.message : '요청을 보내지 못했어요. 다시 눌러 주세요.')
    } finally {
      printActionRef.current = false
      setBusy(false)
    }
  }

  useEffect(() => {
    const status = searchParams.get('payment')
    const tid = searchParams.get('tid')
    const orderId = searchParams.get('orderId')
    const amount = searchParams.get('amount')
    if (status === 'success' || status === 'fail') {
      const savedImage = localStorage.getItem('pendingPrintUrl')
      if (savedImage) {
        setPreviewUrl(savedImage)
        setPrintQuantity(Math.max(1, Math.min(10, Number(localStorage.getItem('pendingBoothQuantity')) || 1)))
        setAuthCode(localStorage.getItem('pendingAuthCode') || '')
        setCustomerEmail(localStorage.getItem('pendingCustomerEmail') || '')
      }
    }
    if (status === 'fail') {
      if (localStorage.getItem('pendingPrintUrl')) setScreen('preview')
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
        const layoutId = localStorage.getItem('pendingLayoutId')
        if (!imageUrl || !layoutId) throw new Error('인화할 사진을 찾지 못했어요. 직원에게 알려 주세요.')
        const print = await fetch('/api/print', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slug, imageUrl, layoutId, paymentTid: tid,
            quantity: Math.max(1, Math.min(10, Number(localStorage.getItem('pendingBoothQuantity')) || 1)),
            customerEmail: localStorage.getItem('pendingCustomerEmail'),
            authCode: localStorage.getItem('pendingAuthCode'),
          }),
        })
        const printData = await print.json()
        if (!print.ok) throw new Error(printData.error || '인쇄 요청을 보내지 못했어요.')
        setResultJobId(printData.jobIds?.[0] || null)
        if (Number.isInteger(printData.quantity) && printData.quantity >= 1 && printData.quantity <= 10) setPrintQuantity(printData.quantity)
        localStorage.removeItem('pendingPrintUrl')
        localStorage.removeItem('pendingLayoutId')
        localStorage.removeItem('pendingBoothQuantity')
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

  useEffect(() => {
    if (screen !== 'done' || !resultJobId) {
      setDownloadQr('')
      return
    }
    let active = true
    setDownloadQr('')
    setQrError('')
    const url = `${window.location.origin}/result/${encodeURIComponent(resultJobId)}?download=1`
    QRCode.toDataURL(url, { width: 320, margin: 3, errorCorrectionLevel: 'M', color: { dark: '#392f27', light: '#FFFFFF' } })
      .then(data => { if (active) setDownloadQr(data) })
      .catch(() => { if (active) setQrError('QR을 불러오지 못했어요. 아래 저장 페이지를 열어 주세요.') })
    return () => { active = false }
  }, [screen, resultJobId])

  const startAgain = useCallback(() => {
    stopCamera()
    setBusy(false)
    setCountdown(null)
    setReturnSeconds(30)
    setPaymentOpen(false)
    setPhotos([])
    photosRef.current = []
    setPreviewUrl('')
    setAuthCode('')
    setCustomerEmail('')
    setNeedEmail(false)
    setPrintQuantity(1)
    setResultJobId(null)
    setDownloadQr('')
    setQrError('')
    setError('')
    setScreen('welcome')
  }, [stopCamera])

  useEffect(() => {
    setReturnSeconds(30)
    if ((screen !== 'preview' && screen !== 'done') || busy || paymentOpen) return
    const deadline = Date.now() + 30_000
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
      setReturnSeconds(remaining)
      if (remaining === 0) startAgain()
    }
    const interval = window.setInterval(tick, 250)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [screen, busy, paymentOpen, startAgain])

  const ended = Boolean(event?.endedAt && new Date(event.endedAt).getTime() <= Date.now())
  const photoCount = layout ? getCaptureCount(layout) : 0
  const price = layout?.price ?? event?.price ?? 0
  const photosPerPrint = layout?.printSize === '2x6' ? 2 : 1
  const photoQuantity = printQuantity * photosPerPrint
  const activeSlot = layout?.slots[Math.min(photos.length, Math.max(0, photoCount - 1))]
  const activeRatio = activeSlot ? Math.round(activeSlot.width) / Math.round(activeSlot.height) : 4 / 3
  const cameraWidth = Math.max(0, Math.min(stageSize.width - 32, (stageSize.height - 32) * activeRatio))
  if (!event) return <main className="booth-page"><div className="booth-loading">{error || '웨딩 포토부스를 준비하고 있어요…'}</div></main>

  return (
    <main className={`booth-page booth-screen-${screen}`}>
      <Script src="https://pay.nicepay.co.kr/v1/js/" strategy="lazyOnload" />
      <header className="booth-topbar">
        <div className="booth-brand"><span className="booth-brand-mark">♡</span><span>PHOTO TOAST <i>WEDDING EDITION</i></span></div>
        <span className="booth-event-name">{event.name}</span>
      </header>
      <div className="booth-layout">
        <section ref={stageRef} className={`booth-stage booth-stage-${screen}`}>
          {screen === 'shoot' && <>
            <div className="booth-camera-window" style={{ width: cameraWidth || '100%', aspectRatio: activeRatio }}>
              <video ref={videoRef} autoPlay muted playsInline className="booth-video" />
              <div className="booth-viewfinder"><span /><span /><span /><span /></div>
              <span className="booth-crop-label">인화되는 사진 영역</span>
              {!busy && <div className="booth-start-overlay">
                <button type="button" className="booth-shutter-start" onClick={captureSequence} disabled={!cameraReady}>
                  <strong>{cameraReady ? '촬영 시작' : '카메라 준비 중…'}</strong>
                  <span>{cameraReady ? `누르면 ${event.boothCountdownSeconds ?? 7}초 뒤에 찍어요` : '카메라 권한을 허용해 주세요'}</span>
                </button>
                <p>한 번만 누르면 {photoCount}장 자동 촬영</p>
              </div>}
            </div>
            <div className="booth-live-label"><span /> {cameraReady ? '셀카 모드' : '카메라 준비 중'}</div>
            <div className="booth-camera-instruction" aria-live="polite">{busy ? `${Math.min(photos.length + 1, photoCount)}번째 사진 · 카메라를 봐 주세요` : '모두 화면 안에 들어오도록 모여 주세요'}</div>
            <div className="booth-shot-progress">{Array.from({ length: photoCount }, (_, index) => <span key={index} className={index < photos.length ? 'is-shot' : ''}>{index + 1}</span>)}</div>
            {countdown !== null && <div className="booth-countdown" key={`${photos.length}-${countdown}`}>{countdown}</div>}
          </>}
          {screen === 'welcome' && (layout ? <BoothPhotoWall
            key={`${slug}-${layout._id}`}
            slug={slug}
            initialImageUrls={layout.boothPreviewSource === 'prints' ? [] : [layout.testPreviewImageUrl, ...(layout.previewImageUrls || [])].filter((url): url is string => Boolean(url))}
            initialSamplesOnly={layout.boothPreviewSource !== 'mixed' && layout.boothPreviewSource !== 'prints'}
          /> : <div className="booth-message"><h2>촬영 프레임 준비 중</h2><p>관리자가 프레임을 선택하면 여기에 보여요.</p></div>)}
          {(screen === 'preview' || screen === 'sending' || screen === 'done') && previewUrl && <div className="booth-print-preview"><img src={previewUrl} alt={`${layout?.name || '사진'} ${screen === 'done' ? '인화 요청한 사진' : '인화 미리보기'}`} /></div>}
          {(screen === 'composing' || (screen === 'sending' && !previewUrl)) && <div className="booth-message"><span className="booth-spinner"/><h2>{screen === 'composing' ? '사진을 예쁘게 담고 있어요' : '사진을 보내고 있어요'}</h2><p>잠시만 기다려 주세요.</p></div>}
        </section>
        <aside className="booth-controls">
          <div className="booth-kicker">A LITTLE KEEPSAKE</div>
          {screen === 'welcome' && <>
            <h1>오늘의 축하를<br /><em>사진에 담아요.</em></h1>
            {layout ? <>
              <p className="booth-description">카메라를 보고 포즈를 취해 주세요.<br />{event.boothCountdownSeconds ?? 7}초 뒤, {photoCount}장의 사진을 차례로 찍어요.</p>
              <div className="booth-howto"><span>01</span><div><b>카메라 앞에 서기</b><small>화면에 얼굴이 잘 보이도록 모여 주세요.</small></div></div>
              <div className="booth-howto"><span>02</span><div><b>{photoCount}가지 포즈 남기기</b><small>컷마다 {event.boothCountdownSeconds ?? 7}초 카운트다운이 있어요.</small></div></div>
              <div className="booth-howto"><span>03</span><div><b>미리 보고 인화하기</b><small>{layout.name} · {layout.printSize}</small></div></div>
              {ended ? <div className="booth-error">이 행사는 종료되어 촬영할 수 없어요.</div> : <button className="booth-primary" onClick={openCamera}>여기를 눌러 시작하기 <span aria-hidden="true">→</span></button>}
            </> : <>
              <p className="booth-description">아이패드 포토부스가 아직 설정되지 않았어요.<br />매장 관리자에게 레이아웃 선택을 요청해 주세요.</p>
              <div className="booth-error" role="status">관리자 페이지의 이벤트 설정에서 포토부스 레이아웃을 선택하면 촬영을 시작할 수 있어요.</div>
            </>}
          </>}
          {screen === 'shoot' && <>
            <div className="booth-shoot-summary"><strong>{busy ? `${photos.length} / ${photoCount}장 촬영 완료` : '화면 가운데 ‘촬영 시작’을 눌러 주세요'}</strong><p>{busy ? '포즈를 바꿔 주세요. 다음 사진은 자동으로 찍어요.' : `누른 뒤 ${event.boothCountdownSeconds ?? 7}초마다 한 장씩 찍어요. 보이는 사진 영역 그대로 인화돼요.`}</p></div>
            <button className="booth-text-button" disabled={busy} onClick={() => { stopCamera(); setScreen('welcome') }}>처음으로</button>
          </>}
          {screen === 'preview' && <>
            <div className="booth-preview-fields">
            <h1>우리의 오늘을<br /><em>간직해요.</em></h1>
            <p className="booth-description">{layout?.name} 레이아웃으로 완성했어요. 인화하기 전에 사진을 확인해 주세요.</p>
            <div className="booth-quantity" role="group" aria-label="인화 매수 선택">
              <span>몇 장 인화할까요?</span>
              <div><button type="button" aria-label={`인화 사진 ${photosPerPrint}장 줄이기`} disabled={printQuantity <= 1 || busy} onClick={() => setPrintQuantity(value => value - 1)}>−</button><output aria-live="polite">{photoQuantity}<small>장</small></output><button type="button" aria-label={`인화 사진 ${photosPerPrint}장 늘리기`} disabled={printQuantity >= 10 || busy} onClick={() => setPrintQuantity(value => value + 1)}>+</button></div>
              <small>{photosPerPrint === 2 ? `2장씩 선택 · 최대 20장${price > 0 ? ` · 2장 ${price.toLocaleString()}원` : ''}` : '최대 10장'}</small>
            </div>
            {event.authCodeRequired && <input className="booth-input" value={authCode} onChange={e => { setAuthCode(e.target.value.toUpperCase()); setError('') }} placeholder="인증코드" maxLength={6} aria-label="인증코드" />}
            {(needEmail || price > 0) && <label className="booth-email-label">결제 안내 이메일<input className="booth-input" value={customerEmail} onChange={e => { setCustomerEmail(e.target.value); setError('') }} placeholder="example@email.com" type="email" autoCapitalize="none" autoCorrect="off" aria-label="결제 안내 이메일" /></label>}
            </div>
            <div className="booth-preview-actions">
            <div className="booth-price">{price > 0 ? `총 ${(price * printQuantity).toLocaleString()}원 · ${photoQuantity}장` : `${photoQuantity}장 무료 인화`}</div>
            <button className="booth-primary" onClick={handlePrintAction} disabled={busy || paymentOpen}>{paymentOpen ? '결제를 진행해 주세요…' : busy ? '처리 중이에요…' : price > 0 ? `${photoQuantity}장 결제하고 인화하기` : `${photoQuantity}장 인화하기`} <span aria-hidden="true">→</span></button>
            <button className="booth-text-button" disabled={busy || paymentOpen} onClick={() => { setPhotos([]); photosRef.current = []; setPreviewUrl(''); setError(''); void openCamera() }}>다시 촬영하기 <span className="booth-return-count">{returnSeconds}S</span></button>
            <p className="booth-return-notice">{paymentOpen ? '결제 중에는 첫 화면으로 돌아가지 않아요.' : busy ? '인화 요청을 처리하고 있어요.' : `${returnSeconds}초 후 첫 화면으로 돌아가요.`}</p>
            </div>
          </>}
          {screen === 'composing' && <><h1>잠시만요,<br /><em>사진을 담고 있어요.</em></h1><p className="booth-description">관리자가 고른 레이아웃에 맞춰 사진을 합성하고 있어요.</p></>}
          {screen === 'sending' && <><h1>잠시만요,<br /><em>사진을 보내고 있어요.</em></h1><p className="booth-description">사진 {photoQuantity}장을 인화할 수 있도록 프린터로 요청을 보내고 있어요.</p></>}
          {screen === 'done' && <>
            <div className="booth-done-details">
              <div className="booth-done-badge" role="status">{event.isTestPrinter ? '테스트 요청 완료' : '인화 요청 완료'} · {photoQuantity}장</div>
              <h1>오늘의 사진을<br /><em>챙겨 주세요.</em></h1>
              <p className="booth-description">{event.isTestPrinter ? '실제 출력 없이 테스트 요청을 기록했어요.' : `사진 ${photoQuantity}장을 프린터로 보냈어요. 휴대폰에도 저장해 보세요.`}</p>
              {resultJobId ? <div className="booth-download-card">
                <div className="booth-download-qr">{downloadQr ? <img src={downloadQr} alt="휴대폰으로 사진 저장 페이지를 여는 QR 코드" width="160" height="160" /> : <span role="status">{qrError ? 'QR 준비 실패' : 'QR 준비 중…'}</span>}</div>
                <div><strong>휴대폰에 사진 저장</strong><p>휴대폰 카메라로<br />QR을 스캔해 주세요.</p><small>저장 페이지는 24시간 동안 열려요.</small><a href={`/result/${encodeURIComponent(resultJobId)}?download=1`} target="_blank" rel="noopener noreferrer">사진 저장 페이지 열기 ↗</a></div>
                {qrError && <p className="booth-qr-error" role="alert">{qrError}</p>}
              </div> : <p className="booth-description">사진 저장 링크를 준비하지 못했어요. 현장 관리자에게 알려 주세요.</p>}
            </div>
            <div className="booth-done-actions"><button className="booth-primary" onClick={startAgain}>다시 촬영하기 <span className="booth-return-count">{returnSeconds}S</span></button><p className="booth-return-notice">{returnSeconds}초 후 첫 화면으로 돌아가요. QR을 먼저 스캔해 주세요.</p></div>
          </>}
          {error && <div className="booth-error" role="alert">{error}</div>}
          {event.isTestPrinter && <div className="booth-test-note">테스트 프린터가 설정된 이벤트예요. 실제 사진은 출력되지 않습니다.</div>}
        </aside>
      </div>
      <footer className="booth-footer"><span>MADE FOR YOUR FOREVER</span><span>PHOTO TOAST · WEDDING EDITION</span></footer>
    </main>
  )
}
