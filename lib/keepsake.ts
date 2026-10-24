import type { RandomPreviewConfig } from './boothRandomPreviews'
export const KEEPSAKES = 'weddingKeepsakes'
export type Keepsake = { _id: string; eventId: string; title: string; date: string; createdAt: Date }
export type KeepsakePhoto = { id: string; url: string }
export type KeepsakeData = { title: string; date: string; cover: string[]; randomPreview?: RandomPreviewConfig | null; photos: KeepsakePhoto[]; total: number; page: number; hasMore: boolean }
export const keepsakeHeaders = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer' }
export function shuffleKeepsake<T>(items: T[]): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]] }
  return result
}
