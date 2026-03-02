// Custom Next.js server with Socket.IO integration
// Run with: node server.js (dev) or NODE_ENV=production node server.js (prod)

const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const { Server } = require('socket.io')

const dev = process.env.NODE_ENV !== 'production'
const hostname = process.env.HOSTNAME || 'localhost'
const port = parseInt(process.env.PORT || '3000', 10)

// Global map for print result callbacks: jobId → resolve function
global._printCallbacks = new Map()

// Global connected printer clients count (for status checking)
global._printerClientCount = 0

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true)
    handle(req, res, parsedUrl)
  })

  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  })

  // Store Socket.IO instance globally so Next.js API routes can access it
  global._socketIO = io

  io.on('connection', (socket) => {
    global._printerClientCount++
    console.log(`[Socket.IO] 프린터 클라이언트 연결됨: ${socket.id} (총 ${global._printerClientCount}개)`)

    // Receive print result from phototoast client
    socket.on('print_result', (data) => {
      const { jobId, success, error, filename } = data

      console.log(
        `[Socket.IO] print_result 수신 (jobId: ${jobId}):`,
        success ? `성공 (${filename})` : `실패 - ${error}`
      )

      if (jobId && global._printCallbacks.has(jobId)) {
        const callback = global._printCallbacks.get(jobId)
        global._printCallbacks.delete(jobId)
        callback({ success, error, filename })
      } else if (!jobId) {
        console.warn('[Socket.IO] print_result에 jobId가 없습니다. 클라이언트 업데이트 필요')
      }
    })

    socket.on('disconnect', () => {
      global._printerClientCount = Math.max(0, global._printerClientCount - 1)
      console.log(`[Socket.IO] 프린터 클라이언트 연결 해제: ${socket.id} (남은 ${global._printerClientCount}개)`)
    })
  })

  httpServer.listen(port, (err) => {
    if (err) throw err
    console.log(`\n> Ready on http://${hostname}:${port}`)
    console.log(`> Mode: ${dev ? 'development' : 'production'}`)
    console.log(`> SEND_PRINTER: ${process.env.SEND_PRINTER !== 'false' ? 'ON' : 'OFF (스킵)'}`)
    console.log(`> Socket.IO: 프린터 클라이언트 연결 대기 중...\n`)
  })
})
