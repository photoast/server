'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import type { SwitLayout, SwitSlot } from '@/lib/types'
import { UIButton, UICard, UIFormField, UITextInput, UIStatusBanner } from '@/app/components/ui'

const SwitSlotEditor = dynamic(() => import('@/app/components/SwitSlotEditor'), { ssr: false })

const PRINT_SIZES = ['4x6', '2x6', '6x4'] as const

interface EventOption {
  _id: string
  name: string
  slug: string
}

function LayoutsPageInner() {
  const searchParams = useSearchParams()
  const eventId = searchParams.get('eventId') || ''
  const eventName = searchParams.get('eventName') || ''

  const [events, setEvents] = useState<EventOption[]>([])
  const [layouts, setLayouts] = useState<SwitLayout[]>([])
  const [selectedLayout, setSelectedLayout] = useState<SwitLayout | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPrintSize, setNewPrintSize] = useState<'4x6' | '2x6' | '6x4'>('4x6')
  const [copyLink, setCopyLink] = useState('')

  useEffect(() => {
    // Fetch all events for the dropdown
    fetch('/api/events', { headers: { 'x-admin': '1' } })
      .then(r => r.json())
      .then(data => setEvents(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!eventId) return
    loadLayouts()
  }, [eventId])

  const loadLayouts = async () => {
    if (!eventId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/swit-layouts?eventId=${eventId}`)
      const data = await res.json()
      setLayouts(Array.isArray(data) ? data : [])
    } catch {
      setError('레이아웃을 불러오지 못했습니다')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!eventId || !newName.trim()) return
    setLoading(true)
    try {
      const res = await fetch('/api/swit-layouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, name: newName.trim(), printSize: newPrintSize }),
      })
      if (!res.ok) throw new Error('생성 실패')
      setNewName('')
      setShowCreate(false)
      await loadLayouts()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('이 레이아웃을 삭제하시겠어요?')) return
    await fetch(`/api/swit-layouts/${id}`, { method: 'DELETE' })
    if (selectedLayout?._id === id) setSelectedLayout(null)
    await loadLayouts()
  }

  const handleSaveSlots = async (slots: SwitSlot[], frameUrl: string | null) => {
    if (!selectedLayout) return
    const res = await fetch(`/api/swit-layouts/${selectedLayout._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slots, frameUrl }),
    })
    if (res.ok) {
      const updated = await res.json()
      setSelectedLayout(updated)
      await loadLayouts()
      alert('저장되었습니다!')
    }
  }

  const copyUserLink = (layout: SwitLayout) => {
    // We need the event slug. Find it.
    const ev = events.find(e => e._id === layout.eventId)
    if (!ev) { alert('이벤트 정보를 찾을 수 없습니다'); return }
    const url = `${window.location.origin}/${ev.slug}/layout/${layout._id}`
    navigator.clipboard?.writeText(url).catch(() => {})
    setCopyLink(url)
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <UICard>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">레이아웃 편집기</h1>
              {eventName && <p className="text-sm text-gray-500 mt-0.5">{eventName}</p>}
            </div>
            <Link href="/admin">
              <UIButton variant="secondary" size="sm">← 어드민으로</UIButton>
            </Link>
          </div>
        </UICard>

        {error && <UIStatusBanner type="error" message={error} />}

        {!eventId ? (
          <UICard>
            <p className="text-gray-500 text-sm mb-4">레이아웃을 관리할 이벤트를 선택하세요.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {events.map(ev => (
                <Link
                  key={ev._id}
                  href={`/admin/layouts?eventId=${ev._id}&eventName=${encodeURIComponent(ev.name)}`}
                >
                  <div className="p-4 border border-gray-100 rounded-2xl hover:border-blue-300 hover:bg-blue-50 transition-colors cursor-pointer">
                    <p className="font-semibold text-gray-800">{ev.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">/{ev.slug}</p>
                  </div>
                </Link>
              ))}
              {events.length === 0 && <p className="text-gray-400 text-sm col-span-2">이벤트가 없습니다. 어드민에서 이벤트를 먼저 생성하세요.</p>}
            </div>
          </UICard>
        ) : (
          <>
            {/* Layouts List */}
            <UICard>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">레이아웃 목록</h2>
                <UIButton size="sm" onClick={() => setShowCreate(v => !v)}>
                  {showCreate ? '취소' : '+ 새 레이아웃'}
                </UIButton>
              </div>

              {showCreate && (
                <form onSubmit={handleCreate} className="mb-5 p-4 bg-gray-50 rounded-xl space-y-3">
                  <UIFormField label="레이아웃 이름">
                    <UITextInput
                      value={newName}
                      onChange={e => setNewName(e.target.value)}
                      placeholder="예: 웨딩 4x6 기본 레이아웃"
                      required
                    />
                  </UIFormField>
                  <UIFormField label="인화 규격">
                    <div className="flex gap-2">
                      {PRINT_SIZES.map(size => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => setNewPrintSize(size)}
                          className={`flex-1 py-2.5 text-sm font-semibold rounded-xl border transition-colors ${
                            newPrintSize === size
                              ? 'border-blue-500 bg-blue-50 text-blue-600'
                              : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                          }`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </UIFormField>
                  <UIButton type="submit" disabled={loading || !newName.trim()} loading={loading}>
                    레이아웃 생성
                  </UIButton>
                </form>
              )}

              {loading && !showCreate && <p className="text-gray-400 text-sm">불러오는 중...</p>}

              <div className="space-y-2">
                {layouts.map(layout => (
                  <div
                    key={layout._id}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                      selectedLayout?._id === layout._id
                        ? 'border-blue-400 bg-blue-50'
                        : 'border-gray-100 hover:border-gray-200 bg-white'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-gray-800 truncate">{layout.name}</p>
                      <p className="text-xs text-gray-400">
                        {layout.printSize} · 슬롯 {layout.slots.length}개
                        {layout.frameUrl && ' · 프레임 ✓'}
                      </p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={() => setSelectedLayout(layout)}
                        className="px-3 py-1.5 text-xs rounded-xl bg-blue-500 text-white hover:bg-blue-600 font-semibold"
                      >
                        편집
                      </button>
                      <button
                        onClick={() => copyUserLink(layout)}
                        className="px-3 py-1.5 text-xs rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 font-semibold"
                      >
                        링크 복사
                      </button>
                      <button
                        onClick={() => handleDelete(layout._id)}
                        className="px-3 py-1.5 text-xs rounded-xl bg-red-50 text-red-500 hover:bg-red-100 font-semibold"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))}
                {!loading && layouts.length === 0 && (
                  <p className="text-gray-400 text-sm py-4 text-center">레이아웃이 없습니다. 위에서 새 레이아웃을 생성하세요.</p>
                )}
              </div>

              {copyLink && (
                <div className="mt-3 p-3 bg-green-50 rounded-xl">
                  <p className="text-xs text-green-700 font-medium">링크가 클립보드에 복사됐습니다:</p>
                  <p className="text-xs text-green-600 mt-0.5 break-all">{copyLink}</p>
                </div>
              )}
            </UICard>

            {/* Slot Editor */}
            {selectedLayout && (
              <UICard>
                <h2 className="text-lg font-bold text-gray-900 mb-4">
                  슬롯 편집: {selectedLayout.name}
                </h2>
                <SwitSlotEditor
                  key={selectedLayout._id}
                  layout={selectedLayout}
                  onSave={handleSaveSlots}
                />
              </UICard>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default function LayoutsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-200 border-t-blue-500" /></div>}>
      <LayoutsPageInner />
    </Suspense>
  )
}
