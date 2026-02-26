'use client'

import { useState } from 'react'
import { UIButton, UIStatusBanner, UICounterControl, UISectionHeading, UISpinnerIcon } from '../components/ui'

// ─── Types ──────────────────────────────────────────────────────────────────
type StoryId = string

interface Story {
  id: StoryId
  label: string
  render: () => React.ReactNode
}

interface ComponentGroup {
  id: string
  label: string
  stories: Story[]
}

// ─── Story definitions ───────────────────────────────────────────────────────
function useStories(): ComponentGroup[] {
  const [counter, setCounter] = useState(3)

  return [
    {
      id: 'UIButton',
      label: 'UIButton',
      stories: [
        {
          id: 'button-variants',
          label: 'Variants',
          render: () => (
            <Canvas title="Variants" description="5가지 버튼 스타일">
              <div className="flex flex-wrap gap-3">
                <UIButton variant="primary" size="md">Primary</UIButton>
                <UIButton variant="secondary" size="md">Secondary</UIButton>
                <UIButton variant="download" size="md">Download</UIButton>
                <UIButton variant="danger" size="md">Danger</UIButton>
                <UIButton variant="ghost" size="md">Ghost</UIButton>
              </div>
            </Canvas>
          ),
        },
        {
          id: 'button-sizes',
          label: 'Sizes',
          render: () => (
            <Canvas title="Sizes" description="sm / md / lg">
              <div className="flex flex-wrap gap-3 items-center">
                <UIButton size="sm">Small</UIButton>
                <UIButton size="md">Medium</UIButton>
                <UIButton size="lg">Large (기본)</UIButton>
              </div>
            </Canvas>
          ),
        },
        {
          id: 'button-loading',
          label: 'Loading',
          render: () => (
            <Canvas title="Loading" description="loading={true} 상태">
              <div className="flex flex-wrap gap-3">
                <UIButton loading size="md">결제하기</UIButton>
                <UIButton variant="secondary" loading size="md">저장 중</UIButton>
              </div>
            </Canvas>
          ),
        },
        {
          id: 'button-disabled',
          label: 'Disabled',
          render: () => (
            <Canvas title="Disabled" description="비활성화 상태">
              <div className="flex flex-wrap gap-3">
                <UIButton disabled size="md">비활성화</UIButton>
                <UIButton variant="secondary" disabled size="md">비활성화</UIButton>
                <UIButton variant="ghost" disabled size="md">비활성화</UIButton>
              </div>
            </Canvas>
          ),
        },
        {
          id: 'button-fullwidth',
          label: 'Full Width',
          render: () => (
            <Canvas title="Full Width" description="fullWidth 속성">
              <div className="space-y-3">
                <UIButton fullWidth>전체 너비 Primary</UIButton>
                <UIButton variant="secondary" fullWidth>전체 너비 Secondary</UIButton>
              </div>
            </Canvas>
          ),
        },
        {
          id: 'button-icon',
          label: 'With Icon',
          render: () => (
            <Canvas title="With Icon" description="아이콘과 함께 사용">
              <div className="flex flex-wrap gap-3">
                <UIButton size="md">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  저장
                </UIButton>
                <UIButton variant="download" size="md">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  무료 프린트 2매
                </UIButton>
                <UIButton variant="danger" size="md">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  삭제
                </UIButton>
              </div>
            </Canvas>
          ),
        },
      ],
    },
    {
      id: 'UIStatusBanner',
      label: 'UIStatusBanner',
      stories: [
        {
          id: 'banner-error',
          label: 'Error',
          render: () => (
            <Canvas title="Error" description='type="error"'>
              <UIStatusBanner type="error" message="이미지 처리에 실패했습니다. 다시 시도해주세요." />
            </Canvas>
          ),
        },
        {
          id: 'banner-success',
          label: 'Success',
          render: () => (
            <Canvas title="Success" description='type="success"'>
              <UIStatusBanner type="success" message="완벽해요! 이제 출력할 수 있어요!" />
            </Canvas>
          ),
        },
        {
          id: 'banner-info',
          label: 'Info',
          render: () => (
            <Canvas title="Info" description='type="info"'>
              <UIStatusBanner type="info" message="영역을 탭해서 예쁜 사진을 올려보세요!" />
            </Canvas>
          ),
        },
        {
          id: 'banner-processing',
          label: 'Processing',
          render: () => (
            <Canvas title="Processing" description='type="processing"'>
              <UIStatusBanner type="processing" message="미리보기 생성 중..." />
            </Canvas>
          ),
        },
        {
          id: 'banner-all',
          label: 'All Types',
          render: () => (
            <Canvas title="All Types" description="모든 배너 타입">
              <div className="space-y-3">
                <UIStatusBanner type="error" message="결제에 실패했습니다." />
                <UIStatusBanner type="success" message="결제가 완료되었습니다!" />
                <UIStatusBanner type="info" message="사진을 업로드해주세요." />
                <UIStatusBanner type="processing" message="처리 중입니다..." />
              </div>
            </Canvas>
          ),
        },
      ],
    },
    {
      id: 'UISpinner',
      label: 'UISpinner',
      stories: [
        {
          id: 'spinner-icon-sizes',
          label: 'SpinnerIcon Sizes',
          render: () => (
            <Canvas title="UISpinnerIcon — Sizes" description="sm / md / lg / xl">
              <div className="flex gap-6 items-center">
                <div className="flex flex-col items-center gap-2">
                  <UISpinnerIcon size="sm" />
                  <span className="text-xs text-gray-400">sm</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <UISpinnerIcon size="md" />
                  <span className="text-xs text-gray-400">md</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <UISpinnerIcon size="lg" />
                  <span className="text-xs text-gray-400">lg</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <UISpinnerIcon size="xl" />
                  <span className="text-xs text-gray-400">xl</span>
                </div>
              </div>
            </Canvas>
          ),
        },
        {
          id: 'spinner-page',
          label: 'UIPageSpinner',
          render: () => (
            <Canvas title="UIPageSpinner" description="전체 화면 로딩">
              <div className="rounded-2xl overflow-hidden border h-64 relative bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center">
                <div className="text-center">
                  <UISpinnerIcon size="xl" className="mx-auto mb-4" />
                  <p className="text-gray-600">페이지 로딩 중...</p>
                </div>
              </div>
            </Canvas>
          ),
        },
        {
          id: 'spinner-card',
          label: 'UICardSpinner',
          render: () => (
            <Canvas title="UICardSpinner" description="카드 스타일 로딩">
              <div className="rounded-2xl overflow-hidden border h-64 relative bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 flex items-center justify-center">
                <div className="text-center bg-white rounded-3xl shadow-2xl p-8">
                  <UISpinnerIcon size="xl" className="mx-auto mb-6" />
                  <h2 className="text-xl font-bold text-gray-800 mb-2">결제 처리 중...</h2>
                  <p className="text-gray-500">잠시만 기다려주세요 💕</p>
                </div>
              </div>
            </Canvas>
          ),
        },
      ],
    },
    {
      id: 'UICounterControl',
      label: 'UICounterControl',
      stories: [
        {
          id: 'counter-default',
          label: 'Default',
          render: () => (
            <Canvas title="Default" description="기본 카운터">
              <UICounterControl
                value={counter}
                min={1}
                max={10}
                onChange={setCounter}
                label="인쇄 매수"
                hint="최대 10매까지 선택 가능합니다"
              />
            </Canvas>
          ),
        },
        {
          id: 'counter-disabled',
          label: 'Disabled',
          render: () => (
            <Canvas title="Disabled" description="비활성화 상태">
              <UICounterControl
                value={3}
                onChange={() => {}}
                disabled
                label="퍼즐 세트 수"
                hint="최대 10세트 (총 12장)"
              />
            </Canvas>
          ),
        },
        {
          id: 'counter-no-label',
          label: 'No Label',
          render: () => (
            <Canvas title="No Label" description="레이블 없음">
              <UICounterControl
                value={counter}
                min={1}
                max={5}
                onChange={setCounter}
              />
            </Canvas>
          ),
        },
      ],
    },
    {
      id: 'UISectionHeading',
      label: 'UISectionHeading',
      stories: [
        {
          id: 'heading-full',
          label: 'Title + Subtitle',
          render: () => (
            <Canvas title="Title + Subtitle" description="제목과 부제목">
              <div className="bg-white rounded-2xl p-6 border">
                <UISectionHeading
                  title="어떤 스타일로 만들까요? 🎨"
                  subtitle="마음에 드는 레이아웃을 골라보세요!"
                />
              </div>
            </Canvas>
          ),
        },
        {
          id: 'heading-title-only',
          label: 'Title Only',
          render: () => (
            <Canvas title="Title Only" description="제목만">
              <div className="bg-white rounded-2xl p-6 border">
                <UISectionHeading title="결제하기 💳" />
              </div>
            </Canvas>
          ),
        },
      ],
    },
    {
      id: 'examples',
      label: '사용 예시',
      stories: [
        {
          id: 'example-payment',
          label: '결제 화면',
          render: () => (
            <Canvas title="결제 화면" description="실제 사용 예시 시나리오">
              <div className="bg-white rounded-3xl shadow-2xl p-6 space-y-6">
                <UISectionHeading
                  title="결제하기 💳"
                  subtitle={`${counter}매 프린트 비용을 결제해주세요`}
                />
                <div className="bg-gradient-to-r from-pink-50 to-purple-50 rounded-2xl p-4 space-y-2">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>단가</span><span>1,000원</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>수량</span><span>{counter}매</span>
                  </div>
                  <div className="border-t border-purple-200 pt-2 flex justify-between items-center">
                    <span className="text-sm text-gray-600">총 결제 금액</span>
                    <p className="text-2xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
                      {1000 * counter}원
                    </p>
                  </div>
                </div>
                <UICounterControl
                  value={counter}
                  min={1}
                  max={10}
                  onChange={setCounter}
                  label="인쇄 매수"
                  hint="최대 10매까지 선택 가능합니다"
                />
                <UIStatusBanner type="error" message="결제가 취소되었습니다. 다시 시도해주세요." />
                <div className="space-y-3">
                  <UIButton fullWidth>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                    {1000 * counter}원 결제하기
                  </UIButton>
                  <UIButton variant="secondary" size="md" fullWidth>← 이전 단계로</UIButton>
                </div>
              </div>
            </Canvas>
          ),
        },
        {
          id: 'example-upload',
          label: '업로드 화면',
          render: () => (
            <Canvas title="업로드 화면" description="사진 업로드 시나리오">
              <div className="bg-white rounded-3xl shadow-2xl p-6 space-y-6">
                <UISectionHeading
                  title="사진 업로드 📸"
                  subtitle="인쇄할 사진을 선택해주세요"
                />
                <UIStatusBanner type="info" message="영역을 탭해서 예쁜 사진을 올려보세요!" />
                <div className="border-2 border-dashed border-purple-300 rounded-2xl h-40 flex items-center justify-center bg-purple-50">
                  <div className="text-center">
                    <p className="text-3xl mb-2">📷</p>
                    <p className="text-sm text-gray-500">사진을 드래그하거나 탭하세요</p>
                  </div>
                </div>
                <UIStatusBanner type="processing" message="이미지 처리 중..." />
                <div className="space-y-3">
                  <UIButton fullWidth>다음 단계로 →</UIButton>
                  <UIButton variant="ghost" size="md" fullWidth>처음으로 돌아가기</UIButton>
                </div>
              </div>
            </Canvas>
          ),
        },
      ],
    },
  ]
}

// ─── Canvas wrapper ──────────────────────────────────────────────────────────
function Canvas({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">{title}</h2>
        {description && <p className="text-sm text-gray-500 mt-1 font-mono">{description}</p>}
      </div>
      <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
        {children}
      </div>
    </div>
  )
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────
function Sidebar({
  groups,
  activeStoryId,
  onSelect,
}: {
  groups: ComponentGroup[]
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
          <div key={group.id} className="mb-1">
            <p className="px-3 py-1.5 text-xs font-bold text-gray-400 uppercase tracking-widest">
              {group.label}
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
  const groups = useStories()
  const allStories = groups.flatMap((g) => g.stories)
  const [activeStoryId, setActiveStoryId] = useState<StoryId>(allStories[0]?.id ?? '')

  const activeStory = allStories.find((s) => s.id === activeStoryId)
  const activeGroup = groups.find((g) => g.stories.some((s) => s.id === activeStoryId))

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar groups={groups} activeStoryId={activeStoryId} onSelect={setActiveStoryId} />

      <main className="flex-1 overflow-y-auto">
        {/* Breadcrumb */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-8 py-3 flex items-center gap-2 text-sm text-gray-500">
          <span>{activeGroup?.label}</span>
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
