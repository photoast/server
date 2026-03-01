'use client'

import React, { useState } from 'react'
import { Canvas, type StoryGroup } from '@/app/ui/story-types'
import UIButton from './UIButton'
import UIStatusBanner from './UIStatusBanner'
import UICounterControl from './UICounterControl'
import UISectionHeading from './UISectionHeading'

function PaymentExampleStory() {
  const [count, setCount] = useState(3)
  return (
    <Canvas title="결제 화면" description="실제 사용 예시 시나리오">
      <div className="bg-white rounded-3xl shadow-2xl p-6 space-y-6">
        <UISectionHeading
          title="결제하기 💳"
          subtitle={`${count}매 프린트 비용을 결제해주세요`}
        />
        <div className="bg-gradient-to-r from-pink-50 to-purple-50 rounded-2xl p-4 space-y-2">
          <div className="flex justify-between text-sm text-gray-600">
            <span>단가</span><span>1,000원</span>
          </div>
          <div className="flex justify-between text-sm text-gray-600">
            <span>수량</span><span>{count}매</span>
          </div>
          <div className="border-t border-purple-200 pt-2 flex justify-between items-center">
            <span className="text-sm text-gray-600">총 결제 금액</span>
            <p className="text-2xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
              {1000 * count}원
            </p>
          </div>
        </div>
        <UICounterControl
          value={count}
          min={1}
          max={10}
          onChange={setCount}
          label="인쇄 매수"
          hint="최대 10매까지 선택 가능합니다"
        />
        <UIStatusBanner type="error" message="결제가 취소되었습니다. 다시 시도해주세요." />
        <div className="space-y-3">
          <UIButton fullWidth>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            {1000 * count}원 결제하기
          </UIButton>
          <UIButton variant="secondary" size="md" fullWidth>← 이전 단계로</UIButton>
        </div>
      </div>
    </Canvas>
  )
}

const group: StoryGroup = {
  title: '사용 예시',
  stories: [
    {
      id: 'example-payment',
      label: '결제 화면',
      render: () => <PaymentExampleStory />,
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
}

export default group
