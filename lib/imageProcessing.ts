export interface DetectedRegion {
  x: number; y: number; width: number; height: number
}

export function detectColorRegions(
  img: HTMLImageElement,
  clickIX: number, clickIY: number,
  tolerance: number,
  layerCanvasX: number, layerCanvasY: number,
  layerCanvasW: number, layerCanvasH: number,
  minCanvasDim: number,
): { regions: DetectedRegion[]; sampledColor: string } {
  const nw = img.naturalWidth
  const nh = img.naturalHeight

  const oc = document.createElement('canvas')
  oc.width = nw
  oc.height = nh
  const ctx = oc.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  const { data } = ctx.getImageData(0, 0, nw, nh)

  const ci = (Math.round(clickIY) * nw + Math.round(clickIX)) * 4
  const tr = data[ci], tg = data[ci + 1], tb = data[ci + 2], ta = data[ci + 3]
  const isTransparentClick = ta < 128
  const sampledColor = isTransparentClick
    ? 'transparent'
    : `#${tr.toString(16).padStart(2, '0')}${tg.toString(16).padStart(2, '0')}${tb.toString(16).padStart(2, '0')}`.toUpperCase()

  // Build match mask
  const total = nw * nh
  const matches = new Uint8Array(total)
  for (let i = 0; i < total; i++) {
    const off = i * 4
    if (isTransparentClick) {
      if (data[off + 3] < 128) matches[i] = 1
    } else {
      if (data[off + 3] < 128) continue
      const diff = Math.max(
        Math.abs(data[off] - tr),
        Math.abs(data[off + 1] - tg),
        Math.abs(data[off + 2] - tb),
      )
      if (diff <= tolerance) matches[i] = 1
    }
  }

  // Union-Find connected components (4-connectivity)
  const labels = new Int32Array(total).fill(-1)
  const parent: number[] = []
  let nextLabel = 0

  const find = (x: number): number => {
    while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x] }
    return x
  }
  const union = (a: number, b: number) => {
    const ra = find(a), rb = find(b)
    if (ra !== rb) parent[ra] = rb
  }

  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) {
      const idx = y * nw + x
      if (!matches[idx]) continue
      const above = y > 0 ? labels[(y - 1) * nw + x] : -1
      const left = x > 0 ? labels[y * nw + x - 1] : -1
      if (above === -1 && left === -1) {
        labels[idx] = nextLabel
        parent.push(nextLabel)
        nextLabel++
      } else if (above !== -1 && left === -1) {
        labels[idx] = above
      } else if (above === -1 && left !== -1) {
        labels[idx] = left
      } else {
        labels[idx] = above
        union(above, left)
      }
    }
  }

  // Collect bounding boxes
  const bboxMap = new Map<number, { minX: number; minY: number; maxX: number; maxY: number }>()
  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) {
      const idx = y * nw + x
      if (labels[idx] === -1) continue
      const root = find(labels[idx])
      const bb = bboxMap.get(root)
      if (!bb) bboxMap.set(root, { minX: x, minY: y, maxX: x, maxY: y })
      else {
        if (x < bb.minX) bb.minX = x; if (y < bb.minY) bb.minY = y
        if (x > bb.maxX) bb.maxX = x; if (y > bb.maxY) bb.maxY = y
      }
    }
  }

  // Convert to canvas coords and filter noise
  const scaleX = layerCanvasW / nw
  const scaleY = layerCanvasH / nh
  const regions: DetectedRegion[] = []
  bboxMap.forEach(bb => {
    const cw = (bb.maxX - bb.minX + 1) * scaleX
    const ch = (bb.maxY - bb.minY + 1) * scaleY
    if (cw < minCanvasDim || ch < minCanvasDim) return
    regions.push({
      x: layerCanvasX + bb.minX * scaleX,
      y: layerCanvasY + bb.minY * scaleY,
      width: cw, height: ch,
    })
  })

  return { regions, sampledColor }
}

// --- Alpha edge refinement: smooth jagged edges with gaussian blur on alpha channel ---
export function refineAlphaEdges(imageData: ImageData, radius: number = 2): void {
  const { data, width, height } = imageData

  // Build a map of boundary pixels (opaque pixel adjacent to transparent)
  const isEdge = new Uint8Array(width * height)
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x
      const a = data[idx * 4 + 3]
      if (a === 0) continue
      const neighbors = [
        data[((y - 1) * width + x) * 4 + 3],
        data[((y + 1) * width + x) * 4 + 3],
        data[(y * width + x - 1) * 4 + 3],
        data[(y * width + x + 1) * 4 + 3],
      ]
      if (neighbors.some(n => n === 0)) isEdge[idx] = 1
    }
  }

  const r = radius
  const sigma = radius / 2
  const kernel: number[] = []
  let kernelSum = 0
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const w = Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma))
      kernel.push(w)
      kernelSum += w
    }
  }
  for (let i = 0; i < kernel.length; i++) kernel[i] /= kernelSum

  const toBlur = new Uint8Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!isEdge[y * width + x]) continue
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const ny = y + dy, nx = x + dx
          if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
            toBlur[ny * width + nx] = 1
          }
        }
      }
    }
  }

  const origAlpha = new Uint8Array(width * height)
  for (let i = 0; i < width * height; i++) origAlpha[i] = data[i * 4 + 3]

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!toBlur[y * width + x]) continue
      let sum = 0
      let ki = 0
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const ny = y + dy, nx = x + dx
          if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
            sum += origAlpha[ny * width + nx] * kernel[ki]
          } else {
            sum += origAlpha[y * width + x] * kernel[ki]
          }
          ki++
        }
      }
      data[(y * width + x) * 4 + 3] = Math.round(sum)
    }
  }
}

// --- Flood fill: only erases connected pixels from click point ---
export function floodFillErase(
  imageData: ImageData,
  startX: number, startY: number,
  tolerance: number,
): void {
  const { data, width, height } = imageData
  const sx = Math.round(startX)
  const sy = Math.round(startY)
  if (sx < 0 || sy < 0 || sx >= width || sy >= height) return

  const startIdx = (sy * width + sx) * 4
  const tr = data[startIdx], tg = data[startIdx + 1], tb = data[startIdx + 2], ta = data[startIdx + 3]

  if (ta < 10) return

  // Soft edge zone: 30% of tolerance for gradual alpha transition
  const softZone = tolerance * 0.3
  const hardThreshold = tolerance - softZone

  const visited = new Uint8Array(width * height)
  const stack: number[] = [sx, sy]

  while (stack.length > 0) {
    const cy = stack.pop()!
    const cx = stack.pop()!
    const pi = cy * width + cx
    if (visited[pi]) continue
    visited[pi] = 1

    const off = pi * 4
    const a = data[off + 3]
    if (a < 10) continue

    const diff = Math.max(
      Math.abs(data[off] - tr),
      Math.abs(data[off + 1] - tg),
      Math.abs(data[off + 2] - tb),
    )
    if (diff > tolerance + softZone * 0.5) continue

    if (diff <= hardThreshold) {
      data[off + 3] = 0
    } else if (diff <= tolerance) {
      const t = (diff - hardThreshold) / softZone
      const newAlpha = Math.round(a * t * t)
      data[off + 3] = Math.min(newAlpha, a)
    } else {
      const overshoot = (diff - tolerance) / (softZone * 0.5)
      const newAlpha = Math.round(a * (0.7 + 0.3 * overshoot))
      data[off + 3] = Math.min(newAlpha, a)
    }

    if (cx > 0) stack.push(cx - 1, cy)
    if (cx < width - 1) stack.push(cx + 1, cy)
    if (cy > 0) stack.push(cx, cy - 1)
    if (cy < height - 1) stack.push(cx, cy + 1)
  }

  refineAlphaEdges(imageData, 2)
}

// --- Brush erase: erase pixels within brush circle matching target color ---
export function brushErase(
  imageData: ImageData,
  centerX: number, centerY: number,
  brushRadius: number,
  targetR: number, targetG: number, targetB: number,
  tolerance: number,
): void {
  const { data, width, height } = imageData
  const r = Math.ceil(brushRadius + 2)
  const cx = Math.round(centerX)
  const cy = Math.round(centerY)

  const softZone = tolerance * 0.3
  const hardThreshold = tolerance - softZone
  const featherZone = Math.max(2, brushRadius * 0.15)

  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist > brushRadius + featherZone) continue
      const px = cx + dx
      const py = cy + dy
      if (px < 0 || py < 0 || px >= width || py >= height) continue
      const off = (py * width + px) * 4
      const currentAlpha = data[off + 3]
      if (currentAlpha < 10) continue

      const diff = Math.max(
        Math.abs(data[off] - targetR),
        Math.abs(data[off + 1] - targetG),
        Math.abs(data[off + 2] - targetB),
      )

      let colorFactor: number
      if (diff <= hardThreshold) {
        colorFactor = 1.0
      } else if (diff <= tolerance) {
        const t = (diff - hardThreshold) / softZone
        colorFactor = 1.0 - t * t
      } else {
        continue
      }

      let brushFactor = 1.0
      if (dist > brushRadius - featherZone) {
        const edgeT = (dist - (brushRadius - featherZone)) / (featherZone * 2)
        brushFactor = Math.max(0, 1.0 - edgeT * edgeT)
      }

      const eraseFactor = colorFactor * brushFactor
      const newAlpha = Math.round(currentAlpha * (1.0 - eraseFactor))
      data[off + 3] = Math.min(newAlpha, currentAlpha)
    }
  }
}
