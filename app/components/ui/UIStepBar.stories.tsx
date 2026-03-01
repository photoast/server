'use client'
import { useState } from 'react'
import { Canvas, StoryGroup } from '@/app/ui/story-types'
import UIStepBar from './UIStepBar'
import UIButton from './UIButton'

const STEPS = [
  { id: 'layout', label: '레이아웃' },
  { id: 'photos', label: '사진' },
  { id: 'color', label: '색상' },
  { id: 'confirm', label: '확인' },
]

function StepBarDemo() {
  const [current, setCurrent] = useState('layout')
  const currentIndex = STEPS.findIndex((s) => s.id === current)
  return (
    <div className="space-y-4">
      <UIStepBar steps={STEPS} currentStep={current} />
      <div className="flex gap-2">
        <UIButton
          variant="secondary"
          size="sm"
          disabled={currentIndex === 0}
          onClick={() => setCurrent(STEPS[currentIndex - 1].id)}
        >
          이전
        </UIButton>
        <UIButton
          size="sm"
          disabled={currentIndex === STEPS.length - 1}
          onClick={() => setCurrent(STEPS[currentIndex + 1].id)}
        >
          다음
        </UIButton>
      </div>
    </div>
  )
}

const stories: StoryGroup = {
  title: 'UIStepBar',
  stories: [
    {
      id: 'interactive',
      label: 'Interactive',
      render: () => (
        <Canvas title="UIStepBar" description="import UIStepBar from '@/components/ui/UIStepBar'">
          <StepBarDemo />
        </Canvas>
      ),
    },
    {
      id: 'states',
      label: 'All States',
      render: () => (
        <Canvas title="UIStepBar — States">
          <div className="space-y-6">
            {STEPS.map((step) => (
              <div key={step.id}>
                <p className="text-xs text-gray-400 mb-2">currentStep="{step.id}"</p>
                <UIStepBar steps={STEPS} currentStep={step.id} />
              </div>
            ))}
          </div>
        </Canvas>
      ),
    },
  ],
}

export default stories
