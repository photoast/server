'use client'
import { useState } from 'react'
import { Canvas, StoryGroup } from '@/app/ui/story-types'
import UISlider from './UISlider'

function SliderDemo({ label, min, max, step, unit }: { label: string; min: number; max: number; step?: number; unit?: string }) {
  const [value, setValue] = useState(Math.floor((min + max) / 2))
  return <UISlider label={label} value={value} min={min} max={max} step={step} unit={unit} onChange={setValue} />
}

const stories: StoryGroup = {
  title: 'UISlider',
  stories: [
    {
      id: 'default',
      label: 'Default',
      render: () => (
        <Canvas title="UISlider" description="import UISlider from '@/components/ui/UISlider'">
          <div className="max-w-sm space-y-6">
            <SliderDemo label="밝기" min={0} max={100} unit="%" />
          </div>
        </Canvas>
      ),
    },
    {
      id: 'multiple',
      label: 'Multiple Sliders',
      render: () => (
        <Canvas title="UISlider — Multiple">
          <div className="max-w-sm space-y-6">
            <SliderDemo label="크기" min={10} max={100} unit="%" />
            <SliderDemo label="투명도" min={0} max={100} unit="%" />
            <SliderDemo label="회전" min={-180} max={180} unit="°" step={5} />
          </div>
        </Canvas>
      ),
    },
    {
      id: 'disabled',
      label: 'Disabled',
      render: () => (
        <Canvas title="UISlider — Disabled">
          <div className="max-w-sm">
            <UISlider label="비활성화" value={50} min={0} max={100} unit="%" onChange={() => {}} disabled />
          </div>
        </Canvas>
      ),
    },
  ],
}

export default stories
