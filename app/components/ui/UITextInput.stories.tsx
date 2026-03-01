'use client'
import { useState } from 'react'
import { Canvas, StoryGroup } from '@/app/ui/story-types'
import UITextInput from './UITextInput'

function ControlledInput({ error, placeholder, type }: { error?: boolean; placeholder?: string; type?: string }) {
  const [value, setValue] = useState('')
  return (
    <UITextInput
      value={value}
      onChange={(e) => setValue(e.target.value)}
      placeholder={placeholder}
      error={error}
      type={type}
    />
  )
}

const stories: StoryGroup = {
  title: 'UITextInput',
  stories: [
    {
      id: 'default',
      label: 'Default',
      render: () => (
        <Canvas title="UITextInput" description="import UITextInput from '@/components/ui/UITextInput'">
          <div className="space-y-3 max-w-sm">
            <ControlledInput placeholder="이름을 입력하세요" />
          </div>
        </Canvas>
      ),
    },
    {
      id: 'states',
      label: 'States',
      render: () => (
        <Canvas title="UITextInput — States">
          <div className="space-y-3 max-w-sm">
            <ControlledInput placeholder="기본" />
            <ControlledInput placeholder="에러 상태" error={true} />
            <UITextInput placeholder="비활성화" disabled />
          </div>
        </Canvas>
      ),
    },
    {
      id: 'types',
      label: 'Input Types',
      render: () => (
        <Canvas title="UITextInput — Input Types">
          <div className="space-y-3 max-w-sm">
            <ControlledInput placeholder="텍스트" type="text" />
            <ControlledInput placeholder="이메일" type="email" />
            <ControlledInput placeholder="전화번호" type="tel" />
            <ControlledInput placeholder="숫자" type="number" />
          </div>
        </Canvas>
      ),
    },
  ],
}

export default stories
