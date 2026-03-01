'use client'

import { useState } from 'react'
import type { StoryGroup, StoryDef } from './story-types'

// ─── Auto-discover *.stories.tsx from components/ui ──────────────────────────
// webpack require.context: 빌드 타임에 패턴 매칭되는 파일을 자동으로 번들링
const storyCtx = (require as any).context('../components/ui', false, /\.stories\.tsx$/)
const groups: StoryGroup[] = storyCtx
  .keys()
  .sort() // 파일명 알파벳순 정렬
  .map((key: string) => storyCtx(key).default as StoryGroup)
  .filter(Boolean)

// ─── Types ───────────────────────────────────────────────────────────────────
type StoryId = string

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({
  groups,
  activeStoryId,
  onSelect,
}: {
  groups: StoryGroup[]
  activeStoryId: StoryId
  onSelect: (id: StoryId) => void
}) {
  return (
    <aside className="w-60 shrink-0 bg-white border-r border-gray-200 overflow-y-auto">
      <div className="p-4 border-b border-gray-100">
        <h1 className="text-sm font-black text-gray-800 tracking-tight">포토토스트 UI</h1>
        <p className="text-xs text-gray-400 mt-0.5">Design System</p>
      </div>
      <nav className="p-2">
        {groups.map((group) => (
          <div key={group.title} className="mb-1">
            <p className="px-3 py-1.5 text-xs font-bold text-gray-400 uppercase tracking-widest">
              {group.title}
            </p>
            {group.stories.map((story) => (
              <button
                key={story.id}
                onClick={() => onSelect(story.id)}
                className={[
                  'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
                  activeStoryId === story.id
                    ? 'bg-purple-50 text-purple-700 font-semibold'
                    : 'text-gray-600 hover:bg-gray-50',
                ].join(' ')}
              >
                {story.label}
              </button>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function UIShowcase() {
  const allStories: StoryDef[] = groups.flatMap((g) => g.stories)
  const [activeStoryId, setActiveStoryId] = useState<StoryId>(allStories[0]?.id ?? '')

  const activeStory = allStories.find((s) => s.id === activeStoryId)
  const activeGroup = groups.find((g) => g.stories.some((s) => s.id === activeStoryId))

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar groups={groups} activeStoryId={activeStoryId} onSelect={setActiveStoryId} />

      <main className="flex-1 overflow-y-auto">
        {/* Breadcrumb */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-8 py-3 flex items-center gap-2 text-sm text-gray-500">
          <span>{activeGroup?.title}</span>
          <span>/</span>
          <span className="text-gray-800 font-medium">{activeStory?.label}</span>
        </div>

        {/* Content */}
        <div className="px-8 py-8 max-w-2xl">
          {activeStory ? activeStory.render() : (
            <p className="text-gray-400">스토리를 선택해주세요.</p>
          )}
        </div>
      </main>
    </div>
  )
}
