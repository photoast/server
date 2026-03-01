import { Canvas, StoryGroup } from '@/app/ui/story-types'
import UICard from './UICard'

const stories: StoryGroup = {
  title: 'UICard',
  stories: [
    {
      id: 'padding-variants',
      label: 'Padding Variants',
      render: () => (
        <Canvas title="UICard" description="import UICard from '@/components/ui/UICard'">
          <div className="space-y-3">
            {(['sm', 'md', 'lg'] as const).map((p) => (
              <UICard key={p} padding={p}>
                <p className="text-sm text-gray-700">padding="{p}"</p>
              </UICard>
            ))}
            <UICard padding="none" className="p-0 overflow-hidden">
              <div className="bg-gray-100 p-4 rounded-t-2xl"><p className="text-sm text-gray-500">padding="none" (custom content)</p></div>
              <div className="p-4"><p className="text-sm text-gray-700">Body content</p></div>
            </UICard>
          </div>
        </Canvas>
      ),
    },
    {
      id: 'as-tags',
      label: 'Semantic Tags',
      render: () => (
        <Canvas title="UICard — Semantic Tags">
          <div className="space-y-3">
            <UICard as="section">
              <p className="text-sm font-medium text-gray-700">as="section"</p>
            </UICard>
            <UICard as="article">
              <p className="text-sm font-medium text-gray-700">as="article"</p>
            </UICard>
          </div>
        </Canvas>
      ),
    },
  ],
}

export default stories
