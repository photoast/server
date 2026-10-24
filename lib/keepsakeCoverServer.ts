import sharp from 'sharp'
import { readImageBuffer } from './blob'
import { getPreviewSlotGroups, getRandomPreviewConfig } from './boothRandomPreviews'
import type { FrameLayout } from './types'

// Social crawlers cannot run the browser canvas renderer. Use the same registered
// pool, slot grouping and frame layers to prepare small server-side cover strips.
export async function keepsakeCoverBuffers(layout: FrameLayout | null): Promise<Buffer[]> {
  if (!layout) return []
  const completed = Array.from(new Set([layout.testPreviewImageUrl, ...(layout.previewImageUrls || [])].filter((url): url is string => Boolean(url))))
  const config = getRandomPreviewConfig({ ...layout, boothPreviewSource: 'samples' })
  const cache = new Map<string, Promise<Buffer>>()
  const read = (url: string) => { if (!cache.has(url)) cache.set(url, readImageBuffer(url)); return cache.get(url)! }
  if (config) {
    try {
      const scale = Math.min(1, 900 / Math.max(config.canvasWidth, config.canvasHeight))
      const width = Math.max(1, Math.round(config.canvasWidth * scale)), height = Math.max(1, Math.round(config.canvasHeight * scale))
      const groups = getPreviewSlotGroups(config.slots)
      const images: Buffer[] = []
      for (let card = 0; card < 3; card++) {
        const slots = new Map<string, string>()
        groups.forEach((group, i) => group.forEach(slot => slots.set(slot.id, config.photos[(i + card) % config.photos.length].imageUrl)))
        const items = [
          ...config.slots.map(slot => ({ url: slots.get(slot.id)!, x: slot.x, y: slot.y, w: slot.width, h: slot.height, rotation: slot.rotation || 0, opacity: 1, z: slot.zIndex ?? 10, frame: false })),
          ...config.frameLayers.filter(layer => layer.visible).map(layer => ({ url: layer.imageUrl, x: layer.x || 0, y: layer.y || 0, w: layer.width ?? config.canvasWidth, h: layer.height ?? config.canvasHeight, rotation: layer.rotation || 0, opacity: layer.opacity ?? 1, z: layer.zIndex, frame: true })),
        ].sort((a, b) => a.z - b.z)
        const overlays: sharp.OverlayOptions[] = []
        for (const item of items) {
          const w = Math.max(1, Math.round(item.w * scale)), h = Math.max(1, Math.round(item.h * scale))
          let buffer = await sharp(await read(item.url)).resize(w, h, { fit: item.frame ? 'fill' : 'cover' }).ensureAlpha().png().toBuffer()
          if (item.opacity < 1) {
            const { data, info } = await sharp(buffer).raw().toBuffer({ resolveWithObject: true })
            for (let i = 3; i < data.length; i += 4) data[i] = Math.round(data[i] * Math.max(0, item.opacity))
            buffer = await sharp(data, { raw: info }).png().toBuffer()
          }
          let left = Math.round(item.x * scale), top = Math.round(item.y * scale)
          if (item.rotation) {
            buffer = await sharp(buffer).rotate(item.rotation, { background: '#00000000' }).png().toBuffer()
            const meta = await sharp(buffer).metadata(), rad = item.rotation * Math.PI / 180
            left -= Math.round(meta.width! / 2 - w / 2 * Math.cos(rad) + h / 2 * Math.sin(rad))
            top -= Math.round(meta.height! / 2 - w / 2 * Math.sin(rad) - h / 2 * Math.cos(rad))
          }
          const meta = await sharp(buffer).metadata(), cropX = Math.max(0, -left), cropY = Math.max(0, -top)
          const cropW = Math.min(meta.width! - cropX, width - Math.max(0, left)), cropH = Math.min(meta.height! - cropY, height - Math.max(0, top))
          if (cropW <= 0 || cropH <= 0) continue
          if (cropX || cropY || cropW !== meta.width || cropH !== meta.height) buffer = await sharp(buffer).extract({ left: cropX, top: cropY, width: cropW, height: cropH }).toBuffer()
          overlays.push({ input: buffer, left: Math.max(0, left), top: Math.max(0, top) })
        }
        images.push(await sharp({ create: { width, height, channels: 3, background: config.backgroundColor || '#faf8f3' } }).composite(overlays).jpeg({ quality: 88 }).toBuffer())
      }
      return images
    } catch { /* A missing pool asset must not break the shared link preview. */ }
  }
  const buffers = await Promise.all(completed.slice(0, 3).map(async url => { try { return await sharp(await read(url)).resize({ height: 900, withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer() } catch { return null } }))
  return buffers.filter((buffer): buffer is Buffer => Boolean(buffer))
}
