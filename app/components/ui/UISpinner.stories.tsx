'use client'

import React from 'react'
import { Canvas, type StoryGroup } from '@/app/ui/story-types'
import { UISpinnerIcon } from './UISpinner'

const group: StoryGroup = {
  title: 'UISpinner',
  stories: [
    {
      id: 'spinner-icon-sizes',
      label: 'SpinnerIcon Sizes',
      render: () => (
        <Canvas title="UISpinnerIcon — Sizes" description="sm / md / lg / xl">
          <div className="flex gap-6 items-center">
            {(['sm', 'md', 'lg', 'xl'] as const).map((size) => (
              <div key={size} className="flex flex-col items-center gap-2">
                <UISpinnerIcon size={size} />
                <span className="text-xs text-gray-400">{size}</span>
              </div>
            ))}
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
}

export default group
