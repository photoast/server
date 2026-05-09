'use client'

import { useState, useEffect, useCallback } from 'react'

interface JobResult {
  jobId: string
  status: 'PENDING' | 'DONE' | 'FAILED' | 'CANCELLED'
  imageUrl: string
  printedImageUrl?: string
  orderNumber?: number
  createdAt: string
  refunded: boolean
  paymentTid?: string
}

export default function ResultPage({ params }: { params: { jobId: string } }) {
  const [job, setJob] = useState<JobResult | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)
  const [cancelRequested, setCancelRequested] = useState(false)

  const fetchJob = useCallback(async () => {
    try {
      const res = await fetch(`/api/print-jobs/job/${params.jobId}`)
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
    if (!job || job.status !== 'PENDING') return
    const interval = setInterval(fetchJob, 3000)
    return () => clearInterval(interval)
  }, [job?.status, fetchJob])

  const handleDownload = async () => {
    if (!job) return
    const url = job.imageUrl
    if (!url) return
    try {
      const res = await fetch(url)
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = `photo-${job.orderNumber || job.jobId}.jpg`
      a.click()
      URL.revokeObjectURL(blobUrl)
    } catch {
      alert('다운로드에 실패했습니다')
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
            <span className={`w-2 h-2 rounded-full ${st.dot} ${job.status === 'PENDING' ? 'animate-pulse' : ''}`} />
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

        {/* Actions */}
        <div className="space-y-3">
          {/* Download */}
          <button
            onClick={handleDownload}
            className="w-full py-3.5 rounded-2xl bg-gray-900 text-white font-semibold text-sm hover:bg-gray-800 transition-colors"
          >
            사진 저장
          </button>

          {/* Cancel - direct cancel for PENDING, request for others */}
          {job.paymentTid && !job.refunded && job.status === 'PENDING' && (
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="w-full py-3.5 rounded-2xl bg-white text-red-500 font-semibold text-sm border border-red-200 hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              {cancelling ? '취소 처리 중...' : '취소'}
            </button>
          )}

          {job.paymentTid && !job.refunded && job.status !== 'PENDING' && !cancelRequested && (
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
