import React from 'react'

export interface StoryDef {
  id: string
  label: string
  render: () => React.ReactNode
}

export interface StoryGroup {
  title: string
  stories: StoryDef[]
}

export function Canvas({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">{title}</h2>
        {description && <p className="text-sm text-gray-500 mt-1 font-mono">{description}</p>}
      </div>
      <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
        {children}
      </div>
    </div>
  )
}
