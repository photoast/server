export const GIF_MAX_PHOTOS = 20
export function gifDimensions(width: number, aspect: number) {
  return { width, height: Math.min(1600, Math.max(1, Math.round(width * aspect))) }
}
export async function makeKeepsakeGif(urls: string[], width: number, delay: number, signal: AbortSignal, onProgress: (value: number) => void): Promise<Blob> {
  if (urls.length < 2 || urls.length > GIF_MAX_PHOTOS || ![240, 360, 480].includes(width) || !Number.isFinite(delay) || delay < 200 || delay > 3000) throw new Error('사진 2~20장과 전환 간격을 확인해 주세요.')
  const worker = new Worker(new URL('./keepsakeGif.worker.ts', import.meta.url))
  const cancelled = () => new DOMException('제작을 취소했어요.', 'AbortError')
  const send = (message: object, transfer: Transferable[] = []) => new Promise<MessageEvent>((resolve, reject) => {
    const cleanup = () => { signal.removeEventListener('abort', abort); worker.onmessage = null; worker.onerror = null; clearTimeout(timeout) }
    const abort = () => { cleanup(); reject(cancelled()) }
    const timeout = setTimeout(() => { cleanup(); reject(new Error('제작 시간이 길어지고 있어요. 크기를 줄여 다시 시도해 주세요.')) }, 60000)
    worker.onmessage = event => { cleanup(); event.data.type === 'error' ? reject(new Error(event.data.message)) : resolve(event) }
    worker.onerror = () => { cleanup(); reject(new Error('GIF 제작기를 실행하지 못했어요. 다시 시도해 주세요.')) }
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) { abort(); return }
    worker.postMessage(message, transfer)
  })
  try {
    let height = 0
    const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('사진을 처리할 수 없는 브라우저입니다.')
    for (let i = 0; i < urls.length; i++) {
      if (signal.aborted) throw cancelled()
      const response = await fetch(urls[i], { signal, referrerPolicy: 'no-referrer' })
      if (!response.ok) throw new Error(`${i + 1}번째 사진을 불러오지 못했어요.`)
      const url = URL.createObjectURL(await response.blob())
      const image = new Image()
      try {
        await new Promise<void>((resolve, reject) => {
          const abort = () => { cleanup(); reject(cancelled()) }
          const timeout = setTimeout(() => { cleanup(); reject(new Error('사진을 읽는 시간이 초과됐어요.')) }, 15000)
          const cleanup = () => { clearTimeout(timeout); signal.removeEventListener('abort', abort); image.onload = null; image.onerror = null }
          image.onload = () => { cleanup(); resolve() }; image.onerror = () => { cleanup(); reject(new Error(`${i + 1}번째 사진을 읽지 못했어요.`)) }
          signal.addEventListener('abort', abort, { once: true }); if (signal.aborted) abort(); else image.src = url
        })
        if (!height) { height = gifDimensions(width, image.naturalHeight / image.naturalWidth).height; canvas.width = width; canvas.height = height }
        ctx.fillStyle = '#faf8f3'; ctx.fillRect(0, 0, width, height)
        const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight), w = image.naturalWidth * scale, h = image.naturalHeight * scale
        ctx.drawImage(image, (width - w) / 2, (height - h) / 2, w, h)
        const rgba = ctx.getImageData(0, 0, width, height).data
        await send({ type: 'frame', rgba: rgba.buffer, width, height, delay }, [rgba.buffer])
        onProgress(Math.round((i + 1) / urls.length * 100))
      } finally { URL.revokeObjectURL(url) }
    }
    const result = await send({ type: 'finish' })
    return new Blob([result.data.buffer], { type: 'image/gif' })
  } finally { worker.terminate() }
}
