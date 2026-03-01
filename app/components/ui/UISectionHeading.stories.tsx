'use client'

import React from 'react'
import { Canvas, type StoryGroup } from '@/app/ui/story-types'
import UISectionHeading from './UISectionHeading'

const group: StoryGroup = {
  title: 'UISectionHeading',
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
}

export default group
