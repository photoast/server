'use client'
import { useState } from 'react'
import { Canvas, StoryGroup } from '@/app/ui/story-types'
import UIBottomSheet from './UIBottomSheet'
import UIButton from './UIButton'

function BottomSheetDemo({ title }: { title?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <UIButton onClick={() => setOpen(true)}>바텀시트 열기</UIButton>
      <UIBottomSheet open={open} onClose={() => setOpen(false)} title={title}>
        <UIButton fullWidth onClick={() => setOpen(false)}>확인</UIButton>
        <UIButton fullWidth variant="secondary" onClick={() => setOpen(false)}>취소</UIButton>
      </UIBottomSheet>
    </div>
  )
}

function ActionSheetDemo() {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <UIButton onClick={() => setOpen(true)}>액션시트 열기</UIButton>
      <UIBottomSheet open={open} onClose={() => setOpen(false)} title="어떻게 하시겠어요?">
        <button
          className="w-full text-left px-4 py-3 rounded-xl hover:bg-gray-50 text-sm font-medium text-gray-800"
          onClick={() => setOpen(false)}
        >
          다운로드
        </button>
        <button
          className="w-full text-left px-4 py-3 rounded-xl hover:bg-gray-50 text-sm font-medium text-gray-800"
          onClick={() => setOpen(false)}
        >
          공유하기
        </button>
        <button
          className="w-full text-left px-4 py-3 rounded-xl hover:bg-gray-50 text-sm font-medium text-red-500"
          onClick={() => setOpen(false)}
        >
          삭제
        </button>
      </UIBottomSheet>
    </div>
  )
}

const stories: StoryGroup = {
  title: 'UIBottomSheet',
  stories: [
    {
      id: 'basic',
      label: 'Basic',
      render: () => (
        <Canvas title="UIBottomSheet" description="import UIBottomSheet from '@/components/ui/UIBottomSheet'">
          <BottomSheetDemo title="확인해주세요" />
        </Canvas>
      ),
    },
    {
      id: 'action-sheet',
      label: 'Action Sheet',
      render: () => (
        <Canvas title="UIBottomSheet — Action Sheet">
          <ActionSheetDemo />
        </Canvas>
      ),
    },
    {
      id: 'no-title',
      label: 'No Title',
      render: () => (
        <Canvas title="UIBottomSheet — No Title">
          <BottomSheetDemo />
        </Canvas>
      ),
    },
  ],
}

export default stories
