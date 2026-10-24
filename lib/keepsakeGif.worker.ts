import { GIFEncoder, quantize, applyPalette } from 'gifenc'
const encoder = GIFEncoder()
self.onmessage = (event: MessageEvent) => {
  try {
    if (event.data.type === 'finish') {
      encoder.finish()
      const bytes = new Uint8Array(encoder.bytes())
      self.postMessage({ type: 'done', buffer: bytes.buffer }, { transfer: [bytes.buffer] })
      return
    }
    const { rgba, width, height, delay } = event.data
    const data = new Uint8Array(rgba), palette = quantize(data, 256)
    encoder.writeFrame(applyPalette(data, palette), width, height, { palette, delay, repeat: 0 })
    self.postMessage({ type: 'frame' })
  } catch { self.postMessage({ type: 'error', message: 'GIF를 만들지 못했어요. 사진 수나 크기를 줄여 다시 시도해 주세요.' }) }
}
