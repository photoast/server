'use client'

import { useState, useEffect, useCallback } from 'react'

interface JobResult {
  jobId: string
  status: 'PENDING' | 'DONE' | 'FAILED'
  imageUrl: string
  createdAt: string
}

export default function ResultPage({ params }: { params: { jobId: string } }) {
  const [job, setJob] = useState<JobResult | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

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

  // PENDING일 때 3초마다 폴링
  useEffect(() => {
    if (!job || job.status !== 'PENDING') return
    const interval = setInterval(fetchJob, 3000)
    return () => clearInterval(interval)
  }, [job?.status, fetchJob])

  const handleDownload = async () => {
    if (!job?.imageUrl) return
    try {
      const res = await fetch(job.imageUrl)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `photo-${job.jobId}.jpg`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('다운로드에 실패했습니다')
    }
  }

  const statusConfig = {
    PENDING: { label: '인쇄 대기 중', color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
    DONE: { label: '인쇄 완료', color: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
    FAILED: { label: '인쇄 실패', color: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
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
        {/* Status */}
        <div className="flex items-center justify-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${st.color}`}>
            <span className={`w-2 h-2 rounded-full ${st.dot} ${job.status === 'PENDING' ? 'animate-pulse' : ''}`} />
            {st.label}
          </span>
        </div>

        {/* Image */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
          <img
            src={job.imageUrl}
            alt="인쇄 결과"
            className="w-full"
          />
        </div>

        {/* Info */}
        <p className="text-center text-xs text-gray-400">
          {new Date(job.createdAt).toLocaleString('ko-KR')}
        </p>

        {/* Download button — only when status is not PENDING */}
        {job.status !== 'PENDING' && (
          <button
            onClick={handleDownload}
            className="w-full py-3.5 rounded-2xl bg-gray-900 text-white font-semibold text-sm hover:bg-gray-800 transition-colors"
          >
            사진 저장
          </button>
        )}
      </div>
    </div>
  )
}
