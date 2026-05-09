'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import type { FrameLayout } from '@/lib/types'
import { UIButton, UICard, UIFormField, UITextInput, UIStatusBanner } from '@/app/components/ui'

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
  const [layouts, setLayouts] = useState<FrameLayout[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPrintSize, setNewPrintSize] = useState<'4x6' | '2x6' | '6x4'>('4x6')
  const [copyLink, setCopyLink] = useState('')
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [editingNameId, setEditingNameId] = useState<string | null>(null)
  const [editingNameValue, setEditingNameValue] = useState('')
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null)
  const [editingPriceValue, setEditingPriceValue] = useState('')

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
      const res = await fetch(`/api/layouts?eventId=${eventId}`)
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
      const res = await fetch('/api/layouts', {
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
    await fetch(`/api/layouts/${id}`, { method: 'DELETE' })
    await loadLayouts()
  }

  const handleToggleVisible = async (layout: FrameLayout) => {
    const newVisible = layout.visible === false ? true : false
    await fetch(`/api/layouts/${layout._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visible: newVisible }),
    })
    await loadLayouts()
  }

  const sortedLayouts = [...layouts].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  const handleDragStart = (e: React.DragEvent, layoutId: string) => {
    setDraggedId(layoutId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', layoutId)
  }

  const handleDragOver = (e: React.DragEvent, layoutId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (layoutId !== draggedId) {
      setDragOverId(layoutId)
    }
  }

  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    setDragOverId(null)

    if (!draggedId || draggedId === targetId) {
      setDraggedId(null)
      return
    }

    const newOrder = [...sortedLayouts]
    const draggedIndex = newOrder.findIndex(l => l._id === draggedId)
    const targetIndex = newOrder.findIndex(l => l._id === targetId)
    if (draggedIndex < 0 || targetIndex < 0) return

    const [removed] = newOrder.splice(draggedIndex, 1)
    newOrder.splice(targetIndex, 0, removed)

    const reordered = newOrder.map((l, i) => ({ ...l, order: i }))
    setLayouts(reordered)
    setDraggedId(null)

    try {
      await fetch('/api/layouts/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds: reordered.map(l => l._id) }),
      })
    } catch {
      await loadLayouts()
    }
  }

  const handleDragEnd = () => {
    setDraggedId(null)
    setDragOverId(null)
  }

  const handleRenameSave = async (layoutId: string) => {
    const trimmed = editingNameValue.trim()
    if (!trimmed) { setEditingNameId(null); return }
    await fetch(`/api/layouts/${layoutId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    })
    setEditingNameId(null)
    await loadLayouts()
  }

  const handlePriceSave = async (layoutId: string) => {
    const val = editingPriceValue.trim()
    const price = val === '' ? null : Number(val)
    if (price !== null && isNaN(price)) { setEditingPriceId(null); return }
    await fetch(`/api/layouts/${layoutId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ price: price ?? undefined }),
    })
    setEditingPriceId(null)
    await loadLayouts()
  }

  const copyUserLink = (layout: FrameLayout) => {
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
                {sortedLayouts.map(layout => (
                  <div
                    key={layout._id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, layout._id)}
                    onDragOver={(e) => handleDragOver(e, layout._id)}
                    onDragLeave={() => setDragOverId(null)}
                    onDrop={(e) => handleDrop(e, layout._id)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-colors ${
                      draggedId === layout._id
                        ? 'opacity-40 border-gray-200 bg-gray-50'
                        : dragOverId === layout._id
                          ? 'border-blue-400 bg-blue-50/60'
                          : layout.visible === false
                              ? 'border-transparent hover:border-gray-200 bg-gray-50 opacity-50'
                              : 'border-transparent hover:border-gray-200 bg-white'
                    }`}
                  >
                    {/* Drag handle */}
                    <div className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 shrink-0 select-none">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <circle cx="5" cy="3" r="1.5"/>
                        <circle cx="11" cy="3" r="1.5"/>
                        <circle cx="5" cy="8" r="1.5"/>
                        <circle cx="11" cy="8" r="1.5"/>
                        <circle cx="5" cy="13" r="1.5"/>
                        <circle cx="11" cy="13" r="1.5"/>
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {editingNameId === layout._id ? (
                          <input
                            autoFocus
                            className="font-semibold text-sm text-gray-800 bg-white border border-blue-400 rounded-lg px-2 py-0.5 outline-none w-48"
                            value={editingNameValue}
                            onChange={e => setEditingNameValue(e.target.value)}
                            onBlur={() => handleRenameSave(layout._id)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleRenameSave(layout._id)
                              if (e.key === 'Escape') setEditingNameId(null)
                            }}
                          />
                        ) : (
                          <p
                            className="font-semibold text-sm text-gray-800 truncate cursor-pointer hover:text-blue-600"
                            onClick={(e) => { e.stopPropagation(); setEditingNameId(layout._id); setEditingNameValue(layout.name) }}
                            title="클릭하여 이름 변경"
                          >
                            {layout.name}
                          </p>
                        )}
                        {layout.visible === false && (
                          <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded shrink-0">미노출</span>
                        )}
                        {layout.isPreset && (
                          <span className="text-[10px] font-semibold text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded shrink-0">프리셋</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400">
                        {layout.printSize} · 슬롯 {layout.slots.length}개
                        {(layout.frameLayers?.length || 0) > 0 && ` · 레이어 ${layout.frameLayers.length}개`}
                        {!layout.frameLayers?.length && layout.frameUrl && ' · 프레임 ✓'}
                      </div>
                      <div className="mt-0.5">
                        {editingPriceId === layout._id ? (
                          <input
                            autoFocus
                            type="number"
                            className="w-24 bg-white border border-blue-400 rounded px-1.5 py-0.5 text-xs outline-none"
                            value={editingPriceValue}
                            onChange={e => setEditingPriceValue(e.target.value)}
                            onBlur={() => handlePriceSave(layout._id)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handlePriceSave(layout._id)
                              if (e.key === 'Escape') setEditingPriceId(null)
                            }}
                            placeholder="이벤트 기본"
                          />
                        ) : (
                          <span
                            className="text-[10px] cursor-pointer hover:text-blue-500 bg-gray-100 px-1.5 py-0.5 rounded"
                            onClick={e => { e.stopPropagation(); setEditingPriceId(layout._id); setEditingPriceValue(layout.price != null ? String(layout.price) : '') }}
                            title="클릭하여 가격 변경"
                          >
                            {layout.price != null ? `💰 ${layout.price.toLocaleString()}원` : '💰 가격 미설정'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={() => handleToggleVisible(layout)}
                        className={`px-3 py-1.5 text-xs rounded-xl font-semibold ${
                          layout.visible === false
                            ? 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                            : 'bg-green-50 text-green-600 hover:bg-green-100'
                        }`}
                        title={layout.visible === false ? '노출로 전환' : '미노출로 전환'}
                      >
                        {layout.visible === false ? '미노출' : '노출'}
                      </button>
                      <Link href={`/admin/layouts/${layout._id}/edit`}>
                        <button className="px-3 py-1.5 text-xs rounded-xl bg-blue-500 text-white hover:bg-blue-600 font-semibold">
                          편집
                        </button>
                      </Link>
                      <button
                        onClick={async () => {
                          await fetch(`/api/layouts/${layout._id}/duplicate`, { method: 'POST' })
                          await loadLayouts()
                        }}
                        className="px-3 py-1.5 text-xs rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 font-semibold"
                      >
                        복제
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
