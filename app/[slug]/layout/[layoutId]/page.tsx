'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import type { SwitLayout } from '@/lib/types'
import { UIPageSpinner, UIStatusBanner, UIButton } from '@/app/components/ui'

const SwitUserEditor = dynamic(() => import('@/app/components/SwitUserEditor'), { ssr: false })

interface Event {
  _id: string
  name: string
  slug: string
  printerUrl: string
  price?: number
}

export default function SwitLayoutPage({
  params,
}: {
  params: { slug: string; layoutId: string }
}) {
  const [event, setEvent] = useState<Event | null>(null)
  const [layout, setLayout] = useState<SwitLayout | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [mergedUrl, setMergedUrl] = useState<string | null>(null)
  const [printing, setPrinting] = useState(false)
  const [printed, setPrinted] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const [evRes, layoutRes] = await Promise.all([
          fetch(`/api/events/slug/${params.slug}`),
          fetch(`/api/swit-layouts/${params.layoutId}`),
        ])
        if (!evRes.ok) throw new Error('이벤트를 찾을 수 없습니다')
        if (!layoutRes.ok) throw new Error('레이아웃을 찾을 수 없습니다')
        const [ev, lay] = await Promise.all([evRes.json(), layoutRes.json()])
        setEvent(ev)
        setLayout(lay)
      } catch (err: any) {
        setError(err.message || '불러오기 실패')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [params.slug, params.layoutId])

  const handleComplete = (url: string) => {
    setMergedUrl(url)
  }

  const handlePrint = async () => {
    if (!mergedUrl || !event) return
    setPrinting(true)
    try {
      const res = await fetch('/api/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: event.slug, imageUrl: mergedUrl, quantity: 1 }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || '프린트 실패')
      }
      setPrinted(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setPrinting(false)
    }
  }

  const handleDownload = async () => {
    if (!mergedUrl) return
    try {
      const link = document.createElement('a')
      if (mergedUrl.startsWith('data:')) {
        link.href = mergedUrl
      } else {
        const res = await fetch(mergedUrl)
        const blob = await res.blob()
        link.href = URL.createObjectURL(blob)
      }
      link.download = `swit-photo-${Date.now()}.jpg`
      link.click()
    } catch {
      setError('다운로드에 실패했습니다')
    }
  }

  const handleReset = () => {
    setMergedUrl(null)
    setPrinted(false)
    setError('')
  }

  if (loading) return <UIPageSpinner />

  if (!event || !layout) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <UIStatusBanner type="error" message={error || '페이지를 불러올 수 없습니다'} />
      </div>
    )
  }

  // ---- Success screen ----
  if (printed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-5">
          <div className="bg-green-50 rounded-2xl p-8 text-center">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">프린트 전송 완료</h2>
            <p className="text-sm text-gray-500">잠시 후 출력됩니다.</p>
          </div>
          <UIButton fullWidth onClick={handleReset}>새로운 사진 만들기</UIButton>
        </div>
      </div>
    )
  }

  // ---- Preview screen (after merge) ----
  if (mergedUrl) {
    return (
      <div className="min-h-screen bg-gray-50 py-6 px-4">
        <div className="max-w-sm mx-auto space-y-5">
          <div className="mb-1 px-1">
            <h1 className="text-xl font-bold text-gray-900">{event.name}</h1>
            <p className="text-sm text-gray-400 mt-0.5">{layout.name}</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
            <h2 className="text-base font-bold text-gray-900">미리보기</h2>
            <div
              className="relative mx-auto rounded-xl overflow-hidden shadow"
              style={{ aspectRatio: `${layout.canvasWidth} / ${layout.canvasHeight}`, maxWidth: 300 }}
            >
              <Image src={mergedUrl} alt="합성 미리보기" fill className="object-cover" unoptimized />
            </div>

            {error && <UIStatusBanner type="error" message={error} />}

            <div className="flex gap-3">
              <UIButton variant="download" className="flex-1" onClick={handleDownload}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                저장
              </UIButton>
              <UIButton className="flex-1" onClick={handlePrint} loading={printing} disabled={printing}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                {(event.price ?? 0) === 0 ? '무료 프린트' : `${event.price}원 결제`}
              </UIButton>
            </div>
            <UIButton fullWidth variant="secondary" onClick={handleReset}>다시 만들기</UIButton>
          </div>
        </div>
      </div>
    )
  }

  // ---- Editor screen ----
  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4">
      <div className="max-w-sm mx-auto">
        <div className="mb-4 px-1">
          <h1 className="text-xl font-bold text-gray-900">{event.name}</h1>
          <p className="text-sm text-gray-400 mt-0.5">사진을 선택해 인쇄해보세요</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <SwitUserEditor
            layout={layout}
            eventSlug={params.slug}
            onComplete={handleComplete}
            onBack={() => window.history.back()}
          />
        </div>
      </div>
    </div>
  )
}
