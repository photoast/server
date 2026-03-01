'use client'
import { useState } from 'react'
import { Canvas, StoryGroup } from '@/app/ui/story-types'
import UISelectItem from './UISelectItem'

const LAYOUTS = [
  { id: '2cut', label: '2컷', description: '세로 2장' },
  { id: '4cut', label: '4컷', description: '세로 4장' },
  { id: '6cut', label: '6컷', description: '가로 6장' },
  { id: 'free-layout', label: '자유 레이아웃', description: '내 맘대로' },
]

function SingleSelect() {
  const [selected, setSelected] = useState('4cut')
  return (
    <div className="grid grid-cols-2 gap-2">
      {LAYOUTS.map((l) => (
        <UISelectItem key={l.id} selected={selected === l.id} onClick={() => setSelected(l.id)}>
          <p className="text-sm font-semibold text-gray-800">{l.label}</p>
          <p className="text-xs text-gray-400 mt-0.5">{l.description}</p>
        </UISelectItem>
      ))}
    </div>
  )
}

function ColorSelect() {
  const colors = ['#ffffff', '#000000', '#3182F6', '#FF6B6B', '#51CF66', '#FCC419']
  const [selected, setSelected] = useState('#ffffff')
  return (
    <div className="flex gap-2 flex-wrap">
      {colors.map((color) => (
        <UISelectItem
          key={color}
          selected={selected === color}
          onClick={() => setSelected(color)}
          className="w-10 h-10 p-0 flex items-center justify-center"
        >
          <div
            className="w-6 h-6 rounded-full border border-gray-200"
            style={{ backgroundColor: color }}
          />
        </UISelectItem>
      ))}
    </div>
  )
}

const stories: StoryGroup = {
  title: 'UISelectItem',
  stories: [
    {
      id: 'grid-select',
      label: 'Grid Select',
      render: () => (
        <Canvas title="UISelectItem" description="import UISelectItem from '@/components/ui/UISelectItem'">
          <SingleSelect />
        </Canvas>
      ),
    },
    {
      id: 'color-select',
      label: 'Color Select',
      render: () => (
        <Canvas title="UISelectItem — Color Picker">
          <ColorSelect />
        </Canvas>
      ),
    },
  ],
}

export default stories
