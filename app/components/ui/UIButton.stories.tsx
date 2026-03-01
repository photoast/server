'use client'

import React from 'react'
import { Canvas, type StoryGroup } from '@/app/ui/story-types'
import UIButton from './UIButton'

const group: StoryGroup = {
  title: 'UIButton',
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
}

export default group
