'use client'

import React from 'react'
import { Canvas, type StoryGroup } from '@/app/ui/story-types'
import UIStatusBanner from './UIStatusBanner'

const group: StoryGroup = {
  title: 'UIStatusBanner',
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
}

export default group
