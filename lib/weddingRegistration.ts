import sharp from 'sharp'
import { WEDDING_SLOTS } from './weddingFrames'

/** Normalize the overlay and cut exactly the same canonical holes used by the booth. */
export async function normalizeWeddingOverlay(dataUrl: unknown): Promise<string> {
  if (typeof dataUrl !== 'string' || dataUrl.length > 1400000 || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(dataUrl)) throw new Error('올바른 600×1800 PNG 프레임을 보내주세요.')
  const buffer = Buffer.from(dataUrl.split(',')[1], 'base64')
  const image = sharp(buffer, { limitInputPixels: 1080000 })
  const meta = await image.metadata()
  if (meta.width !== 600 || meta.height !== 1800 || meta.format !== 'png') throw new Error('프레임은 600×1800px이어야 합니다.')
  const holes = `<svg width="600" height="1800">${WEDDING_SLOTS.map(s => `<rect x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}" fill="white"/>`).join('')}</svg>`
  const normalized = await image.ensureAlpha().composite([{ input: Buffer.from(holes), blend: 'dest-out' }]).png().toBuffer()
  return `data:image/png;base64,${normalized.toString('base64')}`
}
