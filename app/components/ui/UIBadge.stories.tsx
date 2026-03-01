import { Canvas, StoryGroup } from '@/app/ui/story-types'
import UIBadge from './UIBadge'

const stories: StoryGroup = {
  title: 'UIBadge',
  stories: [
    {
      id: 'variants',
      label: 'Variants',
      render: () => (
        <Canvas title="UIBadge" description="import UIBadge from '@/components/ui/UIBadge'">
          <div className="flex flex-wrap gap-2">
            <UIBadge>Default</UIBadge>
            <UIBadge variant="success">완료</UIBadge>
            <UIBadge variant="error">오류</UIBadge>
            <UIBadge variant="warning">주의</UIBadge>
            <UIBadge variant="info">정보</UIBadge>
            <UIBadge variant="blue">Blue</UIBadge>
          </div>
        </Canvas>
      ),
    },
    {
      id: 'in-context',
      label: 'In Context',
      render: () => (
        <Canvas title="UIBadge — In Context">
          <div className="space-y-2">
            {[
              { label: '주문 완료', variant: 'success' as const },
              { label: '결제 대기', variant: 'warning' as const },
              { label: '취소됨', variant: 'error' as const },
              { label: '처리중', variant: 'info' as const },
            ].map(({ label, variant }) => (
              <div key={label} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <span className="text-sm text-gray-700">주문 #{Math.floor(Math.random() * 10000)}</span>
                <UIBadge variant={variant}>{label}</UIBadge>
              </div>
            ))}
          </div>
        </Canvas>
      ),
    },
  ],
}

export default stories
