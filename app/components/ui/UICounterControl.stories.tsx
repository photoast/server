'use client'

import React, { useState } from 'react'
import { Canvas, type StoryGroup } from '@/app/ui/story-types'
import UICounterControl from './UICounterControl'

function CounterDefaultStory() {
  const [value, setValue] = useState(3)
  return (
    <Canvas title="Default" description="기본 카운터">
      <UICounterControl
        value={value}
        min={1}
        max={10}
        onChange={setValue}
        label="인쇄 매수"
        hint="최대 10매까지 선택 가능합니다"
      />
    </Canvas>
  )
}

function CounterNoLabelStory() {
  const [value, setValue] = useState(2)
  return (
    <Canvas title="No Label" description="레이블 없음">
      <UICounterControl value={value} min={1} max={5} onChange={setValue} />
    </Canvas>
  )
}

const group: StoryGroup = {
  title: 'UICounterControl',
  stories: [
    {
      id: 'counter-default',
      label: 'Default',
      render: () => <CounterDefaultStory />,
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
      render: () => <CounterNoLabelStory />,
    },
  ],
}

export default group
