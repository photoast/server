'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { UICard, UIButton, UIFormField, UIBadge, UIStatusBanner } from '@/app/components/ui'

interface BlobStats {
  totalBytes: number
  totalSizeMB: number
  blobCount: number
  maxSizeMB: number
  usagePercent: number
  byExtension: Record<string, { count: number; sizeMB: number }>
  configured: boolean
  error?: string
}

interface BlobEntry {
  url: string
  pathname: string
  size: number
  sizeMB: number
  uploadedAt: string
  orphaned?: boolean
}

interface DbStats {
  totalSizeMB: number
  dataSizeMB: number
  indexSizeMB: number
  maxSizeMB: number
  usagePercent: number
  collectionCount: number
  objectCount: number
  collections: { name: string; sizeMB: number; count: number; storageSizeMB: number; indexSizeMB: number }[]
}

function StoragePageInner() {
  const router = useRouter()
  const [authenticated, setAuthenticated] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Blob stats
  const [blobStats, setBlobStats] = useState<BlobStats | null>(null)
  const [blobStatsLoading, setBlobStatsLoading] = useState(false)

  // Blob list
  const [blobs, setBlobs] = useState<BlobEntry[]>([])
  const [nextCursor, setNextCursor] = useState<string | undefined>()
  const [loadingBlobs, setLoadingBlobs] = useState(false)
  const [selectedBlobs, setSelectedBlobs] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  // DB stats
  const [dbStats, setDbStats] = useState<DbStats | null>(null)
  const [dbStatsLoading, setDbStatsLoading] = useState(false)
  const [showDbDetail, setShowDbDetail] = useState(false)

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch('/api/events')
      if (res.ok) {
        setAuthenticated(true)
        fetchStats()
        fetchDbStats()
      }
    } catch {}
  }, [])

  useEffect(() => { checkAuth() }, [checkAuth])

  const fetchStats = async () => {
    setBlobStatsLoading(true)
    try {
      const res = await fetch('/api/system/storage?mode=stats')
      if (res.ok) setBlobStats(await res.json())
    } catch {}
    setBlobStatsLoading(false)
  }

  const fetchDbStats = async () => {
    setDbStatsLoading(true)
    try {
      const res = await fetch('/api/system/db-stats')
      if (res.ok) setDbStats(await res.json())
    } catch {}
    setDbStatsLoading(false)
  }

  const fetchBlobs = async (cursor?: string) => {
    setLoadingBlobs(true)
    try {
      const params = new URLSearchParams({ mode: 'list' })
      if (cursor) params.set('cursor', cursor)
      const res = await fetch(`/api/system/storage?${params}`)
      if (res.ok) {
        const data = await res.json()
        if (cursor) {
          setBlobs(prev => [...prev, ...data.blobs])
        } else {
          setBlobs(data.blobs)
        }
        setNextCursor(data.nextCursor)
      }
    } catch {}
    setLoadingBlobs(false)
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      if (!res.ok) throw new Error('Invalid credentials')
      setAuthenticated(true)
      fetchStats()
      fetchDbStats()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    setAuthenticated(false)
    setUsername('')
    setPassword('')
    setBlobStats(null)
    setBlobs([])
    setDbStats(null)
  }

  const toggleBlobSelection = (url: string) => {
    setSelectedBlobs(prev => {
      const next = new Set(prev)
      if (next.has(url)) next.delete(url)
      else next.add(url)
      return next
    })
  }

  const handleDeleteSelected = async () => {
    if (selectedBlobs.size === 0) return
    if (!confirm(`${selectedBlobs.size}개의 파일을 삭제하시겠습니까?\n삭제 후 복구가 불가능합니다.`)) return

    setDeleting(true)
    try {
      const res = await fetch('/api/system/storage', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: Array.from(selectedBlobs) }),
      })
      if (res.ok) {
        const data = await res.json()
        setBlobs(prev => prev.filter(b => !selectedBlobs.has(b.url)))
        setSelectedBlobs(new Set())
        fetchStats()
        alert(`${data.deleted}개 파일이 삭제되었습니다`)
      } else {
        const data = await res.json()
        throw new Error(data.error || '삭제 실패')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setDeleting(false)
    }
  }

  const handleDeleteOrphans = async () => {
    if (!confirm(
      'DB(printJobs)에서 참조하지 않는 Blob 파일(고아 파일)을 모두 삭제합니다.\n' +
      '인쇄 완료된 이미지 중 DB에 기록이 없는 것들도 함께 삭제될 수 있습니다.\n\n계속하시겠습니까?'
    )) return

    setDeleting(true)
    try {
      const res = await fetch('/api/system/storage', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'orphans' }),
      })
      if (res.ok) {
        const data = await res.json()
        alert(data.message)
        fetchStats()
        fetchBlobs()
      } else {
        const data = await res.json()
        throw new Error(data.error || '삭제 실패')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setDeleting(false)
    }
  }

  const handleDeleteSingle = async (url: string, pathname: string) => {
    if (!confirm(`"${pathname}" 파일을 삭제하시겠습니까?`)) return
    setDeleting(true)
    try {
      const res = await fetch('/api/system/storage', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: [url] }),
      })
      if (res.ok) {
        setBlobs(prev => prev.filter(b => b.url !== url))
        setSelectedBlobs(prev => { const next = new Set(prev); next.delete(url); return next })
        fetchStats()
      } else {
        const data = await res.json()
        throw new Error(data.error || '삭제 실패')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setDeleting(false)
    }
  }

  const filteredBlobs = searchTerm
    ? blobs.filter(b =>
        b.pathname.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.url.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : blobs

  const orphanBlobs = blobs.filter(b => b.orphaned)
  const orphanCount = orphanBlobs.length
  const orphanSize = orphanBlobs.reduce((sum, b) => sum + b.sizeMB, 0)

  // ─── Non-authenticated: Login ──────────────────────────────────────────────
  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <UICard className="w-full max-w-sm" padding="lg">
          <h1 className="text-2xl font-bold mb-6 text-gray-900">Storage Admin</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <UIFormField label="Username">
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="admin"
                required
              />
            </UIFormField>
            <UIFormField label="Password">
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="••••••••"
                required
              />
            </UIFormField>
            {error && <UIStatusBanner type="error" message={error} />}
            <UIButton type="submit" fullWidth loading={loading} disabled={loading}>
              {loading ? 'Logging in...' : 'Login'}
            </UIButton>
          </form>
        </UICard>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <UICard>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/admin')}
                className="p-2 -ml-2 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h1 className="text-2xl font-bold text-gray-900">📦 스토리지 관리</h1>
            </div>
            <UIButton variant="secondary" size="sm" onClick={handleLogout}>Logout</UIButton>
          </div>
        </UICard>

        {error && <UIStatusBanner type="error" message={error} />}

        {/* ─── Blob Storage Stats ───────────────────────────────────────────── */}
        <UICard>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">Vercel Blob 스토리지</h2>
            <div className="flex items-center gap-2">
              {blobStatsLoading && (
                <div className="w-4 h-4 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
              )}
              <UIButton variant="secondary" size="sm" onClick={fetchStats}>새로고침</UIButton>
            </div>
          </div>

          {blobStats ? (
            <div className="space-y-4">
              {blobStats.configured ? (
                <>
                  {/* Progress bar */}
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">
                        {blobStats.totalSizeMB.toFixed(1)}MB
                        <span className="text-gray-400"> / {blobStats.maxSizeMB}MB</span>
                      </span>
                      <span className={`font-semibold ${
                        blobStats.usagePercent > 90 ? 'text-red-600' :
                        blobStats.usagePercent > 70 ? 'text-amber-600' :
                        'text-green-600'
                      }`}>
                        {blobStats.usagePercent.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          blobStats.usagePercent > 90 ? 'bg-red-500' :
                          blobStats.usagePercent > 70 ? 'bg-amber-500' :
                          'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(blobStats.usagePercent, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Summary cards */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-gray-50 rounded-xl p-4 text-center">
                      <div className="text-xs text-gray-500 mb-1">총 파일</div>
                      <div className="text-xl font-bold text-gray-800">{blobStats.blobCount.toLocaleString()}개</div>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4 text-center">
                      <div className="text-xs text-gray-500 mb-1">사용량</div>
                      <div className="text-xl font-bold text-gray-800">{blobStats.totalSizeMB.toFixed(1)}MB</div>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4 text-center">
                      <div className="text-xs text-gray-500 mb-1">여유 공간</div>
                      <div className={`text-xl font-bold ${
                        blobStats.usagePercent > 90 ? 'text-red-600' :
                        blobStats.usagePercent > 70 ? 'text-amber-600' :
                        'text-green-600'
                      }`}>
                        {(blobStats.maxSizeMB - blobStats.totalSizeMB).toFixed(1)}MB
                      </div>
                    </div>
                  </div>

                  {/* Extension breakdown */}
                  {Object.keys(blobStats.byExtension).length > 0 && (
                    <div className="border rounded-lg divide-y">
                      <div className="px-3 py-2 text-xs font-medium text-gray-500 bg-gray-50 rounded-t-lg">
                        파일 형식별 사용량
                      </div>
                      {Object.entries(blobStats.byExtension)
                        .sort(([, a], [, b]) => b.sizeMB - a.sizeMB)
                        .map(([ext, info]) => (
                          <div key={ext} className="flex justify-between items-center px-3 py-2 text-sm">
                            <span className="font-mono text-gray-700">.{ext}</span>
                            <span className="text-gray-500">
                              {info.count.toLocaleString()}개 / {info.sizeMB.toFixed(2)}MB
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-amber-600 font-medium">⚠️ Blob 스토리지가 설정되지 않았습니다</p>
                  <p className="text-xs text-gray-500">
                    Vercel 대시보드에서 Blob 저장소를 생성하고{' '}
                    <code className="bg-gray-100 px-1 rounded">BLOB_READ_WRITE_TOKEN</code> 환경 변수를 설정하세요.
                  </p>
                </div>
              )}
              {blobStats.error && blobStats.configured && (
                <p className="text-xs text-red-500">{blobStats.error}</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400 py-2">
              {blobStatsLoading ? '불러오는 중...' : '스토리지 통계를 불러올 수 없습니다'}
            </p>
          )}
        </UICard>

        {/* ─── DB Usage Stats ────────────────────────────────────────────────── */}
        <UICard>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-900">🗄️ DB 사용량</h2>
            {dbStatsLoading && (
              <div className="w-4 h-4 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
            )}
          </div>
          {dbStats ? (
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">
                    {dbStats.totalSizeMB.toFixed(1)}MB
                    <span className="text-gray-400"> / {dbStats.maxSizeMB}MB</span>
                  </span>
                  <span className={`font-semibold ${
                    dbStats.usagePercent > 90 ? 'text-red-600' :
                    dbStats.usagePercent > 70 ? 'text-amber-600' :
                    'text-green-600'
                  }`}>
                    {dbStats.usagePercent.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      dbStats.usagePercent > 90 ? 'bg-red-500' :
                      dbStats.usagePercent > 70 ? 'bg-amber-500' :
                      'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(dbStats.usagePercent, 100)}%` }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-gray-50 rounded-lg py-2">
                  <div className="text-xs text-gray-500">컬렉션</div>
                  <div className="text-sm font-bold text-gray-800">{dbStats.collectionCount}개</div>
                </div>
                <div className="bg-gray-50 rounded-lg py-2">
                  <div className="text-xs text-gray-500">문서</div>
                  <div className="text-sm font-bold text-gray-800">{dbStats.objectCount.toLocaleString()}개</div>
                </div>
                <div className="bg-gray-50 rounded-lg py-2">
                  <div className="text-xs text-gray-500">인덱스</div>
                  <div className="text-sm font-bold text-gray-800">{dbStats.indexSizeMB.toFixed(1)}MB</div>
                </div>
              </div>
              <button
                onClick={() => setShowDbDetail(!showDbDetail)}
                className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 transition-colors"
              >
                <svg className={`w-3 h-3 transition-transform ${showDbDetail ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                컬렉션별 상세 {showDbDetail ? '접기' : '펼치기'}
              </button>
              {showDbDetail && (
                <div className="max-h-48 overflow-y-auto border rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">컬렉션</th>
                        <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">크기</th>
                        <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">문서수</th>
                        <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">인덱스</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {dbStats.collections.map(col => (
                        <tr key={col.name} className="hover:bg-gray-50">
                          <td className="px-3 py-1.5 font-mono text-xs text-gray-700">{col.name}</td>
                          <td className="px-3 py-1.5 text-xs text-right text-gray-600">{(col.storageSizeMB + col.indexSizeMB).toFixed(2)}MB</td>
                          <td className="px-3 py-1.5 text-xs text-right text-gray-500">{col.count.toLocaleString()}</td>
                          <td className="px-3 py-1.5 text-xs text-right text-gray-400">{col.indexSizeMB.toFixed(2)}MB</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400 py-2">{dbStatsLoading ? '불러오는 중...' : 'DB 통계 없음'}</p>
          )}
        </UICard>

        {/* ─── Cleanup Actions ────────────────────────────────────────────────── */}
        <UICard>
          <h2 className="text-lg font-bold text-gray-900 mb-3">🧹 정리 작업</h2>
          <div className="space-y-3">
            {blobStats?.configured && (
              <>
                {/* Orphan cleanup */}
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">고아 파일 정리</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      DB(printJobs)에서 참조하지 않는 Blob 파일을 찾아 삭제합니다
                    </p>
                    {orphanCount > 0 && (
                      <p className="text-xs text-red-500 mt-1 font-medium">
                        예상: {orphanCount}개 파일 / {orphanSize.toFixed(2)}MB
                      </p>
                    )}
                  </div>
                  <UIButton
                    variant="danger"
                    size="sm"
                    onClick={handleDeleteOrphans}
                    disabled={deleting || !blobStats?.configured}
                    loading={deleting}
                  >
                    {deleting ? '처리 중...' : '고아 파일 삭제'}
                  </UIButton>
                </div>

                {/* Refresh blob list to detect orphans */}
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">파일 목록 불러오기</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Blob 저장소의 전체 파일 목록을 불러와 고아 파일을 탐지합니다
                    </p>
                  </div>
                  <UIButton
                    variant="primary"
                    size="sm"
                    onClick={() => { fetchBlobs(); fetchStats() }}
                    disabled={loadingBlobs}
                    loading={loadingBlobs}
                  >
                    {loadingBlobs ? '불러오는 중...' : '파일 목록 로드'}
                  </UIButton>
                </div>
              </>
            )}
          </div>
        </UICard>

        {/* ─── Blob List ─────────────────────────────────────────────────────── */}
        {blobStats?.configured && (
          <UICard>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-900">📄 파일 목록</h2>
              <div className="flex items-center gap-2">
                {selectedBlobs.size > 0 && (
                  <UIButton
                    variant="danger"
                    size="sm"
                    onClick={handleDeleteSelected}
                    disabled={deleting}
                    loading={deleting}
                  >
                    {selectedBlobs.size}개 선택 삭제
                  </UIButton>
                )}
              </div>
            </div>

            {/* Search */}
            <div className="mb-3">
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="파일명 검색..."
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>

            {blobs.length === 0 && !loadingBlobs && (
              <div className="text-center py-8">
                <p className="text-sm text-gray-400 mb-2">아직 파일 목록을 불러오지 않았습니다</p>
                <UIButton size="sm" onClick={() => fetchBlobs()}>파일 목록 로드</UIButton>
              </div>
            )}

            {loadingBlobs && blobs.length === 0 && (
              <div className="text-center py-8">
                <div className="w-6 h-6 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-2" />
                <p className="text-sm text-gray-400">파일 목록 불러오는 중...</p>
              </div>
            )}

            {filteredBlobs.length > 0 && (
              <>
                <div className="text-xs text-gray-400 mb-2">
                  전체 {blobs.length}개
                  {orphanCount > 0 && <span className="text-red-400 ml-2">고아 {orphanCount}개</span>}
                  {searchTerm && <span className="ml-2">검색 결과 {filteredBlobs.length}개</span>}
                </div>
                <div className="space-y-1 max-h-[600px] overflow-y-auto border rounded-lg divide-y">
                  {filteredBlobs.map(blob => (
                    <div
                      key={blob.url}
                      className={`flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                        blob.orphaned ? 'bg-red-50/40' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedBlobs.has(blob.url)}
                        onChange={() => toggleBlobSelection(blob.url)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 shrink-0"
                      />
                      {/* Thumbnail preview */}
                      <div
                        className="w-8 h-8 rounded bg-gray-100 overflow-hidden shrink-0 cursor-pointer"
                        onClick={() => window.open(blob.url, '_blank')}
                        title="미리보기"
                      >
                        {/\.(jpg|jpeg|png|gif|webp|avif)/i.test(blob.pathname) ? (
                          <img
                            src={blob.url}
                            alt=""
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400 text-[10px]">
                            📄
                          </div>
                        )}
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-mono text-gray-800 truncate" title={blob.pathname}>
                            {blob.pathname}
                          </span>
                          {blob.orphaned && (
                            <UIBadge variant="error">고아</UIBadge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-gray-400">
                          <span>{blob.sizeMB.toFixed(2)}MB</span>
                          <span>{new Date(blob.uploadedAt).toLocaleString('ko-KR')}</span>
                        </div>
                      </div>
                      {/* Actions */}
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => navigator.clipboard.writeText(blob.url)}
                          className="px-1.5 py-1 text-[10px] rounded bg-gray-100 text-gray-500 hover:bg-gray-200"
                          title="URL 복사"
                        >
                          URL
                        </button>
                        <button
                          onClick={() => handleDeleteSingle(blob.url, blob.pathname)}
                          className="px-1.5 py-1 text-[10px] rounded bg-red-50 text-red-500 hover:bg-red-100"
                          disabled={deleting}
                          title="삭제"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Load more */}
                {nextCursor && (
                  <div className="mt-3 text-center">
                    <UIButton
                      variant="secondary"
                      size="sm"
                      onClick={() => fetchBlobs(nextCursor)}
                      disabled={loadingBlobs}
                      loading={loadingBlobs}
                    >
                      {loadingBlobs ? '불러오는 중...' : '더 불러오기'}
                    </UIButton>
                  </div>
                )}
              </>
            )}
          </UICard>
        )}

      </div>
    </div>
  )
}

export default function StoragePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-200 border-t-blue-500" /></div>}>
      <StoragePageInner />
    </Suspense>
  )
}
