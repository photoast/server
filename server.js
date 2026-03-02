// Custom Next.js server
// Run with: node server.js (dev) or NODE_ENV=production node server.js (prod)

const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')

const dev = process.env.NODE_ENV !== 'production'
const hostname = process.env.HOSTNAME || 'localhost'
const port = parseInt(process.env.PORT || '3000', 10)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true)
    handle(req, res, parsedUrl)
  })

  httpServer.listen(port, (err) => {
    if (err) throw err
    console.log(`\n> Ready on http://${hostname}:${port}`)
    console.log(`> Mode: ${dev ? 'development' : 'production'}`)
    console.log(`> SEND_PRINTER: ${process.env.SEND_PRINTER !== 'false' ? 'ON' : 'OFF (스킵)'}\n`)
  })
})
