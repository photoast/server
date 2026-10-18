import type { FrameLayer, PhotoSlot } from './types'

export async function uploadSampleCanvas(canvas: HTMLCanvasElement): Promise<string> {
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
    value => value ? resolve(value) : reject(new Error('사진을 준비하지 못했어요.')),
    'image/jpeg', .88,
  ))
  const body = new FormData()
  body.append('file', blob, 'booth-preview.jpg')
  body.append('type', 'booth-preview')
  const response = await fetch('/api/upload', { method: 'POST', body })
  const data = await response.json()
  if (!response.ok || !data.url) throw new Error(data.error || '사진 업로드에 실패했어요.')
  return data.url
}

export async function uploadSampleImage(image: HTMLImageElement): Promise<string> {
  const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('사진을 준비하지 못했어요.')
  context.fillStyle = '#FFFFFF'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  return uploadSampleCanvas(canvas)
}

export async function uploadPreviewFile(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) {
    throw new Error('8MB 이하 JPG, PNG, WebP 사진을 선택해 주세요.')
  }
  const url = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error('사진을 읽지 못했어요.'))
      image.src = url
    })
    return await uploadSampleImage(image)
  } finally { URL.revokeObjectURL(url) }
}

export async function composeTestPreview(width: number, height: number, background: string,
  slots: PhotoSlot[], layers: FrameLayer[], photos: Map<string, HTMLImageElement>, frames: Map<string, HTMLImageElement>): Promise<string> {
  const scale = Math.min(1, 1600 / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('미리보기를 만들지 못했어요.')
  ctx.scale(scale, scale)
  ctx.fillStyle = background
  ctx.fillRect(0, 0, width, height)
  const items = [
    ...slots.map(slot => ({ slot, layer: null as FrameLayer | null, zIndex: slot.zIndex ?? 10 })),
    ...layers.filter(layer => layer.visible).map(layer => ({ slot: null as PhotoSlot | null, layer, zIndex: layer.zIndex })),
  ].sort((a, b) => a.zIndex - b.zIndex)
  for (const { slot, layer } of items) {
    ctx.save()
    if (slot) {
      const image = photos.get(slot.id)
      if (!image) throw new Error('모든 사진 칸에 테스트 이미지를 넣어 주세요.')
      ctx.translate(slot.x, slot.y)
      ctx.rotate((slot.rotation ?? 0) * Math.PI / 180)
      ctx.beginPath()
      ctx.rect(0, 0, slot.width, slot.height)
      ctx.clip()
      const factor = Math.max(slot.width / image.naturalWidth, slot.height / image.naturalHeight)
      const w = image.naturalWidth * factor, h = image.naturalHeight * factor
      ctx.drawImage(image, (slot.width - w) / 2, (slot.height - h) / 2, w, h)
    } else if (layer) {
      const image = frames.get(layer.id)
      if (!image) throw new Error('프레임 이미지를 불러온 뒤 다시 저장해 주세요.')
      ctx.translate(layer.x ?? 0, layer.y ?? 0)
      ctx.rotate((layer.rotation ?? 0) * Math.PI / 180)
      ctx.globalAlpha = layer.opacity ?? 1
      ctx.drawImage(image, 0, 0, layer.width ?? width, layer.height ?? height)
    }
    ctx.restore()
  }
  return uploadSampleCanvas(canvas)
}
