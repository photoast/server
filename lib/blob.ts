import { put } from '@vercel/blob'
import path from 'path'
import fs from 'fs/promises'

const BLOB_TOKEN = process.env.phototoast_READ_WRITE_TOKEN

/**
 * 이미지를 Vercel Blob(프로덕션) 또는 로컬 파일시스템(개발)에 업로드
 * @returns 공개 접근 가능한 URL
 */
export async function uploadToBlob(
  filename: string,
  buffer: Buffer,
  contentType = 'image/jpeg'
): Promise<string> {
  // Vercel 환경 + 토큰이 있으면 Blob 사용
  if (BLOB_TOKEN) {
    const blob = await put(filename, buffer, {
      access: 'public',
      token: BLOB_TOKEN,
      contentType,
    })
    return blob.url
  }

  // 로컬 개발: 기존대로 public/uploads에 저장
  const uploadDir = path.join(process.cwd(), 'public', 'uploads')
  await fs.mkdir(uploadDir, { recursive: true })
  const filePath = path.join(uploadDir, filename)
  await fs.writeFile(filePath, buffer)
  return `/uploads/${filename}`
}

/**
 * URL 또는 경로에서 이미지 Buffer를 읽기
 * - blob URL (https://) → fetch
 * - /api/serve-image/ → /tmp/uploads 파일
 * - /uploads/ → public/uploads 파일
 * - /tmp/ 또는 절대경로 → 직접 읽기
 */
export async function readImageBuffer(urlOrPath: string): Promise<Buffer> {
  // Blob URL 또는 외부 URL
  if (urlOrPath.startsWith('https://') || urlOrPath.startsWith('http://')) {
    const res = await fetch(urlOrPath)
    if (!res.ok) throw new Error(`Failed to fetch image: ${urlOrPath}`)
    return Buffer.from(await res.arrayBuffer())
  }

  // /api/serve-image/ → /tmp/uploads/
  if (urlOrPath.startsWith('/api/serve-image/')) {
    const filename = urlOrPath.replace('/api/serve-image/', '')
    const isVercel = process.env.VERCEL === '1'
    const filePath = isVercel
      ? path.join('/tmp/uploads', filename)
      : path.join(process.cwd(), 'public', 'uploads', filename)
    return fs.readFile(filePath)
  }

  // /uploads/ → public/uploads/
  if (urlOrPath.startsWith('/uploads/')) {
    return fs.readFile(path.join(process.cwd(), 'public', urlOrPath))
  }

  // 절대경로
  return fs.readFile(urlOrPath)
}
