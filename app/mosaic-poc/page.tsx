'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

interface GridCell {
  row: number
  col: number
  avgColor: [number, number, number]
  filled: boolean
  userImageUrl?: string
  userImg?: HTMLImageElement
}

type Phase = 'admin' | 'user'

const MOSAIC_MAX = 600

export default function MosaicPocPage() {
  const [phase, setPhase] = useState<Phase>('admin')
  const [targetImage, setTargetImage] = useState<HTMLImageElement | null>(null)
  const [targetPreviewUrl, setTargetPreviewUrl] = useState<string>('')
  const [gridX, setGridX] = useState(10)
  const [gridY, setGridY] = useState(10)
  const [grid, setGrid] = useState<GridCell[][]>([])
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null)
  const [userImage, setUserImage] = useState<HTMLImageElement | null>(null)
  const [userPreviewUrl, setUserPreviewUrl] = useState<string>('')
  const [photoOpacity, setPhotoOpacity] = useState(60)
  const [tintStrength, setTintStrength] = useState(20)
  const [previewCell, setPreviewCell] = useState<{ row: number; col: number } | null>(null)
  const [fillLoading, setFillLoading] = useState(false)

  const mosaicCanvasRef = useRef<HTMLCanvasElement>(null)
  const resultCanvasRef = useRef<HTMLCanvasElement>(null)
  const previewCanvasRef = useRef<HTMLCanvasElement>(null)

  const analyzeImage = useCallback((img: HTMLImageElement, cols: number, rows: number) => {
    const offscreen = document.createElement('canvas')
    offscreen.width = img.naturalWidth
    offscreen.height = img.naturalHeight
    const ctx = offscreen.getContext('2d')!
    ctx.drawImage(img, 0, 0)

    const cellW = img.naturalWidth / cols
    const cellH = img.naturalHeight / rows
    const newGrid: GridCell[][] = []

    for (let r = 0; r < rows; r++) {
      const row: GridCell[] = []
      for (let c = 0; c < cols; c++) {
        const sx = Math.floor(c * cellW)
        const sy = Math.floor(r * cellH)
        const sw = Math.max(1, Math.floor(cellW))
        const sh = Math.max(1, Math.floor(cellH))
        const data = ctx.getImageData(sx, sy, sw, sh).data
        let totalR = 0, totalG = 0, totalB = 0
        const pixelCount = sw * sh
        for (let i = 0; i < data.length; i += 4) {
          totalR += data[i]
          totalG += data[i + 1]
          totalB += data[i + 2]
        }
        row.push({
          row: r, col: c,
          avgColor: [
            Math.round(totalR / pixelCount),
            Math.round(totalG / pixelCount),
            Math.round(totalB / pixelCount),
          ],
          filled: false,
        })
      }
      newGrid.push(row)
    }
    setGrid(newGrid)
    return newGrid
  }, [])

  const drawMosaic = useCallback(() => {
    const canvas = mosaicCanvasRef.current
    if (!canvas || grid.length === 0 || !targetImage) return
    const rows = grid.length
    const cols = grid[0].length

    const cellSize = Math.floor(MOSAIC_MAX / Math.max(cols, rows))
    const canvasW = cellSize * cols
    const canvasH = cellSize * rows

    canvas.width = canvasW
    canvas.height = canvasH
    const ctx = canvas.getContext('2d')!

    // Draw target image cropped to square grid area
    const imgW = targetImage.naturalWidth
    const imgH = targetImage.naturalHeight
    const imgCellW = imgW / cols
    const imgCellH = imgH / rows

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = grid[r][c]
        const dx = c * cellSize
        const dy = r * cellSize

        // Draw target image region as base
        const srcX = Math.round(c * imgCellW)
        const srcY = Math.round(r * imgCellH)
        const srcW = Math.round(imgCellW)
        const srcH = Math.round(imgCellH)
        ctx.drawImage(targetImage, srcX, srcY, srcW, srcH, dx, dy, cellSize, cellSize)

        if (cell.filled && cell.userImg) {
          const ui = cell.userImg
          const uiRatio = ui.naturalWidth / ui.naturalHeight
          let ux = 0, uy = 0, uw = ui.naturalWidth, uh = ui.naturalHeight
          if (uiRatio > 1) { uw = uh; ux = (ui.naturalWidth - uw) / 2 }
          else { uh = uw; uy = (ui.naturalHeight - uh) / 2 }

          // User photo with adjustable opacity
          ctx.globalAlpha = photoOpacity / 100
          ctx.drawImage(ui, ux, uy, uw, uh, dx, dy, cellSize, cellSize)
          ctx.globalAlpha = 1.0

          // Color tint
          const [cr, cg, cb] = cell.avgColor
          ctx.globalAlpha = tintStrength / 100
          ctx.fillStyle = `rgb(${cr},${cg},${cb})`
          ctx.fillRect(dx, dy, cellSize, cellSize)
          ctx.globalAlpha = 1.0
        }

        ctx.strokeStyle = 'rgba(255,255,255,0.5)'
        ctx.lineWidth = 1
        ctx.strokeRect(dx, dy, cellSize, cellSize)
      }
    }

    if (phase === 'user' && selectedCell) {
      const { row: sr, col: sc } = selectedCell
      const sx = sc * cellSize
      const sy = sr * cellSize
      ctx.strokeStyle = '#2563eb'
      ctx.lineWidth = 3
      ctx.strokeRect(sx + 1, sy + 1, cellSize - 2, cellSize - 2)
      ctx.fillStyle = 'rgba(37, 99, 235, 0.15)'
      ctx.fillRect(sx, sy, cellSize, cellSize)
    }
  }, [grid, targetImage, phase, selectedCell, photoOpacity, tintStrength])

  useEffect(() => {
    drawMosaic()
  }, [drawMosaic])

  const handleTargetUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setTargetPreviewUrl(url)
    const img = new Image()
    img.onload = () => {
      setTargetImage(img)
      analyzeImage(img, gridX, gridY)
    }
    img.src = url
  }

  const handleGridChange = (axis: 'x' | 'y', value: number) => {
    const clamped = Math.max(2, Math.min(100, value))
    if (axis === 'x') {
      setGridX(clamped)
      if (targetImage) analyzeImage(targetImage, clamped, gridY)
    } else {
      setGridY(clamped)
      if (targetImage) analyzeImage(targetImage, gridX, clamped)
    }
  }

  const handleUserImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setUserPreviewUrl(url)
    const img = new Image()
    img.onload = () => setUserImage(img)
    img.src = url
  }

  const getCellLabel = (row: number, col: number) => {
    const rowLabel = String.fromCharCode(65 + row)
    return `${rowLabel}-${col + 1}`
  }

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (phase !== 'user' || grid.length === 0) return
    const canvas = mosaicCanvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY

    const rows = grid.length
    const cols = grid[0].length
    const cellSize = canvas.width / cols
    const col = Math.floor(x / cellSize)
    const row = Math.floor(y / cellSize)

    if (row >= 0 && row < rows && col >= 0 && col < cols) {
      const cell = grid[row][col]
      if (cell.filled) {
        setPreviewCell({ row, col })
        setSelectedCell(null)
      } else {
        setPreviewCell(null)
        setSelectedCell({ row, col })
      }
    }
  }

  const handleSubmit = () => {
    if (!selectedCell || !userImage) return
    setGrid(prev => {
      const next = prev.map(row => row.map(cell => ({ ...cell })))
      const c = next[selectedCell.row][selectedCell.col]
      c.filled = true
      c.userImageUrl = userPreviewUrl
      c.userImg = userImage
      return next
    })
    setSelectedCell(null)
    setUserImage(null)
    setUserPreviewUrl('')
  }

  const loadImage = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = url
    })
  }

  const handleFillRandomPicsum = async (count: number) => {
    setFillLoading(true)
    try {
      const empty = grid.flat().filter(c => !c.filled)
      const targets = empty.sort(() => Math.random() - 0.5).slice(0, count)
      const images = await Promise.all(
        targets.map((_, i) => loadImage(`https://picsum.photos/200?random=${Date.now()}-${i}`))
      )
      setGrid(prev => {
        const next = prev.map(row => row.map(cell => ({ ...cell })))
        targets.forEach((t, i) => {
          const c = next[t.row][t.col]
          c.filled = true
          c.userImg = images[i]
        })
        return next
      })
    } finally {
      setFillLoading(false)
    }
  }

  const handleFillAllPicsum = async () => {
    setFillLoading(true)
    try {
      const empty = grid.flat().filter(c => !c.filled)
      const images = await Promise.all(
        empty.map((_, i) => loadImage(`https://picsum.photos/200?random=${Date.now()}-${i}`))
      )
      setGrid(prev => {
        const next = prev.map(row => row.map(cell => ({ ...cell })))
        empty.forEach((t, i) => {
          const c = next[t.row][t.col]
          c.filled = true
          c.userImg = images[i]
        })
        return next
      })
    } finally {
      setFillLoading(false)
    }
  }

  const handleReset = () => {
    setPreviewCell(null)
    setGrid(prev => prev.map(row => row.map(cell => ({
      ...cell, filled: false, userImageUrl: undefined, userImg: undefined,
    }))))
  }

  const drawPreviewForCell = useCallback((canvasRef: React.RefObject<HTMLCanvasElement | null>, img: HTMLImageElement, cellRow: number, cellCol: number) => {
    const canvas = canvasRef.current
    if (!canvas || !targetImage) return
    const cell = grid[cellRow]?.[cellCol]
    if (!cell) return

    canvas.width = 1200
    canvas.height = 1800
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, 1200, 1800)

    const imgRatio = img.naturalWidth / img.naturalHeight
    let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight
    if (imgRatio > 1) { sw = sh; sx = (img.naturalWidth - sw) / 2 }
    else { sh = sw; sy = (img.naturalHeight - sh) / 2 }

    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 1200, 1200)

    const imgW = targetImage.naturalWidth
    const imgH = targetImage.naturalHeight
    const cols = grid[0].length
    const rows = grid.length
    const srcCellW = imgW / cols
    const srcCellH = imgH / rows
    const srcTX = Math.round(cellCol * srcCellW)
    const srcTY = Math.round(cellRow * srcCellH)
    ctx.drawImage(targetImage, srcTX, srcTY, Math.round(srcCellW), Math.round(srcCellH), 0, 1200, 600, 600)

    ctx.globalAlpha = photoOpacity / 100
    ctx.drawImage(img, sx, sy, sw, sh, 0, 1200, 600, 600)
    ctx.globalAlpha = 1.0

    const [cr, cg, cb] = cell.avgColor
    ctx.globalAlpha = tintStrength / 100
    ctx.fillStyle = `rgb(${cr},${cg},${cb})`
    ctx.fillRect(0, 1200, 600, 600)
    ctx.globalAlpha = 1.0

    ctx.strokeStyle = `rgb(${cr},${cg},${cb})`
    ctx.lineWidth = 16
    ctx.strokeRect(8, 1208, 584, 584)

    const label = getCellLabel(cellRow, cellCol)
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    ctx.fillRect(0, 1740, 600, 60)
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 32px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(`[ ${label} ]`, 300, 1778)

    ctx.fillStyle = '#f3f4f6'
    ctx.fillRect(600, 1200, 600, 600)
    ctx.strokeStyle = '#d1d5db'
    ctx.lineWidth = 2
    ctx.strokeRect(600, 1200, 600, 600)
    ctx.fillStyle = '#6b7280'
    ctx.font = 'bold 28px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('EVENT LOGO', 900, 1460)
    ctx.font = '20px sans-serif'
    ctx.fillText('QR Code Area', 900, 1510)
    ctx.fillText('Lucky Draw / Info', 900, 1550)
  }, [grid, tintStrength, photoOpacity, targetImage])

  useEffect(() => {
    if (userImage && selectedCell) {
      drawPreviewForCell(resultCanvasRef, userImage, selectedCell.row, selectedCell.col)
    }
  }, [userImage, selectedCell, drawPreviewForCell])

  useEffect(() => {
    if (previewCell) {
      const cell = grid[previewCell.row]?.[previewCell.col]
      if (cell?.filled && cell.userImg) {
        drawPreviewForCell(previewCanvasRef, cell.userImg, previewCell.row, previewCell.col)
      }
    }
  }, [previewCell, drawPreviewForCell, grid])

  const filledCount = grid.flat().filter(c => c.filled).length
  const totalCount = gridX * gridY

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 16px', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Mosaic PoC</h1>
      <p style={{ color: '#6b7280', marginBottom: 24 }}>실물 참여형 모자이크 시스템 프로토타입</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
        <button
          onClick={() => setPhase('admin')}
          style={{
            padding: '10px 24px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: phase === 'admin' ? '#2563eb' : '#e5e7eb',
            color: phase === 'admin' ? '#fff' : '#374151',
            fontWeight: 600, fontSize: 15,
          }}
        >
          관리자 설정
        </button>
        <button
          onClick={() => setPhase('user')}
          disabled={grid.length === 0}
          style={{
            padding: '10px 24px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: phase === 'user' ? '#2563eb' : '#e5e7eb',
            color: phase === 'user' ? '#fff' : '#374151',
            fontWeight: 600, fontSize: 15,
            opacity: grid.length === 0 ? 0.4 : 1,
          }}
        >
          유저 참여
        </button>
        {grid.length > 0 && (
          <span style={{ alignSelf: 'center', marginLeft: 8, color: '#6b7280', fontSize: 14 }}>
            {filledCount}/{totalCount}칸 참여
          </span>
        )}
      </div>

      {/* Mosaic preview - always visible when grid exists */}
      {grid.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>모자이크 현황</h2>
          <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 12 }}>
            {phase === 'user'
              ? `칸을 클릭하세요 — 빈 칸: 위치 선택 / 채워진 칸: 미리보기 (${filledCount}/${totalCount})`
              : `원본 위에 참여자 사진이 채워집니다 (${filledCount}/${totalCount})`}
          </p>
          <canvas
            ref={mosaicCanvasRef}
            onClick={handleCanvasClick}
            style={{ borderRadius: 8, border: '1px solid #e5e7eb', maxWidth: '100%', cursor: phase === 'user' ? 'pointer' : 'default' }}
          />
        </div>
      )}

      {phase === 'admin' && (
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>1. 타겟 이미지 업로드</h2>
          <input type="file" accept="image/*" onChange={handleTargetUpload} style={{ marginBottom: 16 }} />
          {targetPreviewUrl && (
            <div style={{ marginBottom: 16 }}>
              <img src={targetPreviewUrl} alt="target" style={{ maxWidth: 300, borderRadius: 8, border: '1px solid #e5e7eb' }} />
            </div>
          )}

          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>2. 그리드 설정</h2>
          <div style={{ display: 'flex', gap: 16, marginBottom: 24, alignItems: 'center' }}>
            <label>
              가로(X):
              <input
                type="number" min={2} max={100} value={gridX}
                onChange={e => handleGridChange('x', parseInt(e.target.value) || 2)}
                style={{ width: 60, marginLeft: 8, padding: '4px 8px', borderRadius: 4, border: '1px solid #d1d5db' }}
              />
            </label>
            <label>
              세로(Y):
              <input
                type="number" min={2} max={100} value={gridY}
                onChange={e => handleGridChange('y', parseInt(e.target.value) || 2)}
                style={{ width: 60, marginLeft: 8, padding: '4px 8px', borderRadius: 4, border: '1px solid #d1d5db' }}
              />
            </label>
            <span style={{ color: '#9ca3af', fontSize: 14 }}>총 {totalCount}칸</span>
          </div>

          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>3. 합성 설정</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ minWidth: 120 }}>사진 투명도: {photoOpacity}%</span>
              <input
                type="range" min={0} max={100} value={photoOpacity}
                onChange={e => setPhotoOpacity(parseInt(e.target.value))}
                style={{ flex: 1, maxWidth: 300 }}
              />
              <span style={{ color: '#9ca3af', fontSize: 13, minWidth: 100 }}>
                {photoOpacity < 40 ? '원본 잘 보임' : photoOpacity < 70 ? '균형' : '사진 강조'}
              </span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ minWidth: 120 }}>색상 틴팅: {tintStrength}%</span>
              <input
                type="range" min={0} max={100} value={tintStrength}
                onChange={e => setTintStrength(parseInt(e.target.value))}
                style={{ flex: 1, maxWidth: 300 }}
              />
              <span style={{ color: '#9ca3af', fontSize: 13, minWidth: 100 }}>
                {tintStrength < 10 ? '약하게' : tintStrength < 30 ? '적당' : '강하게'}
              </span>
            </label>
          </div>
        </div>
      )}

      {phase === 'user' && grid.length > 0 && (
        <div>
          {selectedCell && (
            <p style={{ marginBottom: 16, fontWeight: 600, color: '#2563eb' }}>
              선택: {getCellLabel(selectedCell.row, selectedCell.col)}
              <span style={{
                marginLeft: 8, display: 'inline-block', width: 20, height: 20,
                verticalAlign: 'middle', borderRadius: 4,
                background: `rgb(${grid[selectedCell.row][selectedCell.col].avgColor.join(',')})`,
                border: '1px solid #d1d5db',
              }} />
            </p>
          )}

          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>사진 업로드</h2>
          <input type="file" accept="image/*" onChange={handleUserImageUpload} style={{ marginBottom: 16 }} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16, padding: 12, background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
            <span style={{ fontSize: 13, color: '#6b7280', alignSelf: 'center', marginRight: 4 }}>테스트 (picsum):</span>
            {[10, 30, 50].map(n => (
              <button key={n} disabled={fillLoading} onClick={() => handleFillRandomPicsum(n)} style={{
                padding: '6px 14px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff',
                cursor: fillLoading ? 'wait' : 'pointer', fontSize: 13, color: '#374151',
                opacity: fillLoading ? 0.5 : 1,
              }}>랜덤 {n}칸</button>
            ))}
            <button disabled={fillLoading} onClick={handleFillAllPicsum} style={{
              padding: '6px 14px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff',
              cursor: fillLoading ? 'wait' : 'pointer', fontSize: 13, color: '#374151',
              opacity: fillLoading ? 0.5 : 1,
            }}>전체 채우기</button>
            <button onClick={handleReset} style={{
              padding: '6px 14px', borderRadius: 6, border: '1px solid #fca5a5', background: '#fef2f2',
              cursor: 'pointer', fontSize: 13, color: '#dc2626',
            }}>초기화</button>
            {fillLoading && <span style={{ fontSize: 13, color: '#6b7280', alignSelf: 'center' }}>이미지 로딩중...</span>}
          </div>
          {userPreviewUrl && (
            <img src={userPreviewUrl} alt="user" style={{ maxWidth: 200, borderRadius: 8, display: 'block', marginBottom: 16, border: '1px solid #e5e7eb' }} />
          )}

          {userImage && selectedCell && (
            <>
              <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 32, marginBottom: 16 }}>인화용 결과물 미리보기</h2>
              <canvas ref={resultCanvasRef} style={{ maxWidth: '100%', borderRadius: 8, border: '1px solid #e5e7eb' }} />
              <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                <button
                  onClick={handleSubmit}
                  style={{
                    padding: '12px 32px', borderRadius: 8, border: 'none',
                    background: '#22c55e', color: '#fff', fontWeight: 600, fontSize: 15, cursor: 'pointer',
                  }}
                >
                  참여 확정
                </button>
                <button
                  onClick={() => {
                    const canvas = resultCanvasRef.current
                    if (!canvas) return
                    const link = document.createElement('a')
                    link.download = `mosaic-${getCellLabel(selectedCell.row, selectedCell.col)}.jpg`
                    link.href = canvas.toDataURL('image/jpeg', 0.95)
                    link.click()
                  }}
                  style={{
                    padding: '12px 32px', borderRadius: 8, border: 'none',
                    background: '#2563eb', color: '#fff', fontWeight: 600, fontSize: 15, cursor: 'pointer',
                  }}
                >
                  다운로드 (JPG)
                </button>
              </div>
            </>
          )}

          {previewCell && grid[previewCell.row]?.[previewCell.col]?.filled && (
            <>
              <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 32, marginBottom: 8 }}>
                [{getCellLabel(previewCell.row, previewCell.col)}] 인화 미리보기
                <button onClick={() => setPreviewCell(null)} style={{
                  marginLeft: 12, padding: '4px 12px', borderRadius: 6, border: '1px solid #d1d5db',
                  background: '#fff', cursor: 'pointer', fontSize: 13, color: '#6b7280', verticalAlign: 'middle',
                }}>닫기</button>
              </h2>
              <canvas ref={previewCanvasRef} style={{ maxWidth: '100%', borderRadius: 8, border: '1px solid #e5e7eb' }} />
              <button
                onClick={() => {
                  const canvas = previewCanvasRef.current
                  if (!canvas) return
                  const link = document.createElement('a')
                  link.download = `mosaic-${getCellLabel(previewCell.row, previewCell.col)}.jpg`
                  link.href = canvas.toDataURL('image/jpeg', 0.95)
                  link.click()
                }}
                style={{
                  marginTop: 12, padding: '10px 24px', borderRadius: 8, border: 'none',
                  background: '#2563eb', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer',
                }}
              >
                다운로드 (JPG)
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
