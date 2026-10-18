'use client'

import { useId, useState } from 'react'
import type { FrameLayer, FrameLayout } from '@/lib/types'

type PreviewLayout = Pick<FrameLayout, 'name' | 'canvasWidth' | 'canvasHeight' | 'slots'> &
  Partial<Pick<FrameLayout, 'frameLayers' | 'frameUrl' | 'backgroundColor'>>

export default function BoothLayoutPreview({ layout, sampleImageUrl, photoCount }: {
  layout: PreviewLayout
  sampleImageUrl?: string
  photoCount?: number
}) {
  const id = useId().replace(/:/g, '')
  const [failedImage, setFailedImage] = useState<string | null>(null)
  const sample = sampleImageUrl && sampleImageUrl !== failedImage ? sampleImageUrl : undefined
  const layers: FrameLayer[] = layout.frameLayers?.length ? layout.frameLayers : layout.frameUrl ? [{
    id: 'legacy', name: '프레임', imageUrl: layout.frameUrl, zIndex: 100, opacity: 1, visible: true,
  }] : []
  const items = [
    ...layout.slots.map((slot, index) => ({ type: 'slot' as const, slot, index, zIndex: slot.zIndex ?? 10 + index })),
    ...layers.filter(layer => layer.visible).map(layer => ({ type: 'frame' as const, layer, zIndex: layer.zIndex })),
  ].sort((a, b) => a.zIndex - b.zIndex)

  return (
    <svg
      className="booth-layout-svg"
      viewBox={`0 0 ${layout.canvasWidth} ${layout.canvasHeight}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`${layout.name} ${sample ? '샘플 사진이 들어간' : '사진 칸과 프레임'} 미리보기`}
    >
      <rect width={layout.canvasWidth} height={layout.canvasHeight} fill={layout.backgroundColor || '#FFFFFF'} />
      <defs>{layout.slots.map((slot, index) => <clipPath key={slot.id} id={`${id}-slot-${index}`}><rect width={slot.width} height={slot.height} /></clipPath>)}</defs>
      {items.map(item => {
        if (item.type === 'frame') {
          const layer = item.layer
          return <image key={`frame-${layer.id}`} href={layer.imageUrl}
            width={layer.width ?? layout.canvasWidth} height={layer.height ?? layout.canvasHeight}
            transform={`translate(${layer.x ?? 0} ${layer.y ?? 0}) rotate(${layer.rotation ?? 0})`}
            opacity={layer.opacity ?? 1} preserveAspectRatio="none" />
        }
        const { slot, index } = item
        const labelSize = Math.max(18, Math.min(slot.width, slot.height) * .09)
        return <g key={`slot-${slot.id}`} transform={`translate(${slot.x} ${slot.y}) rotate(${slot.rotation ?? 0})`}>
          <rect width={slot.width} height={slot.height} fill="#e2d8cc" />
          {sample ? <image href={sample} width={slot.width} height={slot.height}
            preserveAspectRatio="xMidYMid slice" clipPath={`url(#${id}-slot-${index})`}
            onError={() => setFailedImage(sample)} /> : <>
            <rect x="2" y="2" width={Math.max(0, slot.width - 4)} height={Math.max(0, slot.height - 4)} fill="none" stroke="#b8a58f" strokeWidth="3" strokeDasharray="12 10" />
            <text x={slot.width / 2} y={slot.height / 2} textAnchor="middle" dominantBaseline="middle" fill="#78634e" fontSize={labelSize} fontFamily="Arial, sans-serif">사진 {index % (photoCount || layout.slots.length) + 1}</text>
          </>}
        </g>
      })}
    </svg>
  )
}
