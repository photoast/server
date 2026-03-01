'use client'
import { useState } from 'react'
import { Canvas, StoryGroup } from '@/app/ui/story-types'
import UIFormField from './UIFormField'
import UITextInput from './UITextInput'

function FormFieldDemo({ label, hint, error }: { label?: string; hint?: string; error?: string }) {
  const [value, setValue] = useState('')
  return (
    <UIFormField label={label} hint={hint} error={error}>
      <UITextInput
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="입력하세요"
        error={!!error}
      />
    </UIFormField>
  )
}

const stories: StoryGroup = {
  title: 'UIFormField',
  stories: [
    {
      id: 'default',
      label: 'With Label',
      render: () => (
        <Canvas title="UIFormField" description="import UIFormField from '@/components/ui/UIFormField'">
          <div className="space-y-4 max-w-sm">
            <FormFieldDemo label="이름" />
          </div>
        </Canvas>
      ),
    },
    {
      id: 'with-hint',
      label: 'With Hint',
      render: () => (
        <Canvas title="UIFormField — Hint">
          <div className="space-y-4 max-w-sm">
            <FormFieldDemo label="전화번호" hint="010으로 시작하는 번호를 입력하세요" />
          </div>
        </Canvas>
      ),
    },
    {
      id: 'with-error',
      label: 'With Error',
      render: () => (
        <Canvas title="UIFormField — Error">
          <div className="space-y-4 max-w-sm">
            <FormFieldDemo label="이메일" error="올바른 이메일 형식이 아닙니다" />
          </div>
        </Canvas>
      ),
    },
  ],
}

export default stories
