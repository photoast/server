'use client'

import { useState, useEffect, useCallback } from 'react'

interface JobResult {
  jobId: string
  status: 'PENDING' | 'PRINTING' | 'DONE' | 'FAILED' | 'CANCELLED'
  imageUrl: string
  printedImageUrl?: string
  orderNumber?: number
  createdAt: string
  expiresAt: string
  refunded: boolean
  paymentTid?: string
}

export default function ResultPage({ params, searchParams }: { params: { jobId: string }; searchParams?: { download?: string } }) {
  const downloadOnly = searchParams?.download === '1'
  const [job, setJob] = useState<JobResult | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)
  const [cancelRequested, setCancelRequested] = useState(false)
  const [expired, setExpired] = useState(false)
  const [remainTime, setRemainTime] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState('')

  const fetchJob = useCallback(async () => {
    try {
      const res = await fetch(`/api/print-jobs/job/${params.jobId}`)
      if (res.status === 410) {
        setExpired(true)
        setError('')
        return
      }
      if (!res.ok) {
        setError(res.status === 404 ? '인쇄 결과를 찾을 수 없습니다' : '불러오기 실패')
        return
      }
      const data = await res.json()
      setJob(data)
      setError('')
    } catch {
      setError('네트워크 오류')
    } finally {
      setLoading(false)
    }
  }, [params.jobId])

  useEffect(() => {
    fetchJob()
  }, [fetchJob])

  useEffect(() => {
    if (!job || (job.status !== 'PENDING' && job.status !== 'PRINTING')) return
    const interval = setInterval(fetchJob, 3000)
    return () => clearInterval(interval)
  }, [job?.status, fetchJob])

  useEffect(() => {
    if (!job?.expiresAt) return
    const update = () => {
      const diff = new Date(job.expiresAt).getTime() - Date.now()
      if (diff <= 0) { setExpired(true); setRemainTime(''); return }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      setRemainTime(`${h}시간 ${m}분`)
    }
    update()
    const interval = setInterval(update, 60000)
    return () => clearInterval(interval)
  }, [job?.expiresAt])

  const handleDownload = async () => {
    if (!job || downloading) return
    const url = job.imageUrl
    if (!url) return
    setDownloading(true)
    setDownloadError('')
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error('사진을 불러오지 못했습니다.')
      const blob = await res.blob()
      const file = new File([blob], `photo-${job.orderNumber || job.jobId}.jpg`, { type: blob.type || 'image/jpeg' })
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: '오늘의 사진' })
          return
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') return
          // Browsers may reject sharing after fetching; use a download instead.
        }
      }
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = file.name
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 10000)
    } catch (err) {
      if (!(err instanceof Error && err.name === 'AbortError')) setDownloadError('사진을 저장하지 못했어요. 다시 눌러 주세요.')
    } finally {
      setDownloading(false)
    }
  }

  const handleCancel = async () => {
    if (!confirm('정말 취소하시겠습니까? 환불 처리됩니다.')) return
    setCancelling(true)
    try {
      const res = await fetch(`/api/print-jobs/job/${params.jobId}/cancel`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || '취소 실패')
        return
      }
      await fetchJob()
    } catch {
      alert('취소 처리 중 오류가 발생했습니다')
    } finally {
      setCancelling(false)
    }
  }

  const handleCancelRequest = () => {
    setCancelRequested(true)
  }

  const statusConfig = {
    PENDING: { label: '인쇄 대기 중', color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
    PRINTING: { label: '인쇄 중', color: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500' },
    DONE: { label: '인쇄 완료', color: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
    FAILED: { label: '인쇄 실패', color: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
    CANCELLED: { label: '취소됨', color: 'bg-gray-100 text-gray-700', dot: 'bg-gray-500' },
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-200 border-t-blue-500" />
      </div>
    )
  }

  if (expired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center space-y-3">
          <p className="text-gray-900 text-lg font-semibold">페이지가 만료되었습니다</p>
          <p className="text-gray-500 text-sm">결과 페이지는 인쇄 후 24시간 동안만 열람할 수 있습니다.</p>
        </div>
      </div>
    )
  }

  if (error || !job) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <p className="text-gray-500 text-lg">{error || '결과를 찾을 수 없습니다'}</p>
        </div>
      </div>
    )
  }

  const st = statusConfig[job.status]

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-md space-y-5">
        {downloadOnly && <div className="text-center"><h1 className="text-2xl font-bold text-gray-900">오늘의 사진을 저장하세요</h1><p className="mt-2 text-base text-gray-500">아래 버튼을 눌러 휴대폰에 간직해 주세요.</p></div>}
        {/* Order Number */}
        {job.orderNumber && (
          <div className="text-center">
            <p className="text-xs text-gray-400 uppercase tracking-wider">인쇄번호</p>
            <p className="text-4xl font-bold text-gray-900 mt-1">#{job.orderNumber}</p>
          </div>
        )}

        {/* Status */}
        <div className="flex items-center justify-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${st.color}`}>
            <span className={`w-2 h-2 rounded-full ${st.dot} ${job.status === 'PENDING' || job.status === 'PRINTING' ? 'animate-pulse' : ''}`} />
            {st.label}
          </span>
          {job.refunded && (
            <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold bg-orange-100 text-orange-700">
              환불완료
            </span>
          )}
        </div>

        {/* Image */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={job.imageUrl}
            alt="인쇄 사진"
            className="w-full"
          />
        </div>

        {/* Info */}
        <p className="text-center text-xs text-gray-400">
          {new Date(job.createdAt).toLocaleString('ko-KR')}
        </p>
        {remainTime && (
          <p className="text-center text-xs text-gray-400">
            이 페이지는 {remainTime} 후 만료됩니다
          </p>
        )}

        {/* Actions */}
        <div className="space-y-3">
          {/* Download */}
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="w-full min-h-14 py-3.5 rounded-2xl bg-gray-900 text-white font-semibold text-base hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {downloading ? '사진 준비 중…' : '사진 저장 / 공유'}
          </button>
          {downloadOnly && <p className="text-center text-sm text-gray-500">공유 메뉴가 열리면 이미지 저장을 선택해 주세요.</p>}
          {downloadError && <p role="alert" className="text-center text-sm text-red-600">{downloadError}</p>}

          {/* Cancel - direct cancel for PENDING, request for others */}
          {!downloadOnly && job.paymentTid && !job.refunded && job.status === 'PENDING' && (
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="w-full py-3.5 rounded-2xl bg-white text-red-500 font-semibold text-sm border border-red-200 hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              {cancelling ? '취소 처리 중...' : '취소'}
            </button>
          )}

          {!downloadOnly && job.paymentTid && !job.refunded && job.status === 'PRINTING' && (
            <p className="text-center text-xs text-gray-400">현재 인쇄 중이므로 취소할 수 없습니다</p>
          )}

          {!downloadOnly && job.paymentTid && !job.refunded && job.status !== 'PENDING' && job.status !== 'PRINTING' && !cancelRequested && (
            <button
              onClick={handleCancelRequest}
              className="w-full py-3.5 rounded-2xl bg-white text-red-500 font-semibold text-sm border border-red-200 hover:bg-red-50 transition-colors"
            >
              취소 요청
            </button>
          )}

          {cancelRequested && !job.refunded && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center">
              <p className="text-sm text-red-700 font-medium mb-1">취소를 요청하시겠습니까?</p>
              <p className="text-xs text-red-500 mb-3">
                인쇄번호 <span className="font-bold">#{job.orderNumber}</span>을(를) 관리자에게 전달해 주세요.
              </p>
              <p className="text-xs text-gray-500">
                현장 관리자에게 인쇄번호를 말씀해 주시면 취소 처리해 드립니다.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
