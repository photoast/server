const fs = require('fs')
const https = require('https')
const path = require('path')
const ipp = require('ipp')

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"

async function testPrint() {
  try {
    // 가장 최신 이미지 파일 찾기
    const uploadsDir = path.join(__dirname, 'public', 'uploads')
    const files = fs.readdirSync(uploadsDir)
      .filter(f => f.startsWith('processed-') && f.endsWith('.jpg'))
      .sort()
      .reverse()

    if (files.length === 0) {
      console.error('No processed images found')
      return
    }

    const imagePath = path.join(uploadsDir, files[0])
    const printerUrl = 'https://192.168.219.150/ipp/print'

    console.log('='.repeat(50))
    console.log('TEST PRINT JOB')
    console.log('='.repeat(50))
    console.log('Image:', imagePath)
    console.log('Printer:', printerUrl)
    console.log('File exists:', fs.existsSync(imagePath))

    const imageData = fs.readFileSync(imagePath)
    console.log('Image size:', (imageData.length / 1024).toFixed(2), 'KB')

    // HTTPS agent for self-signed certs
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false
    })

    const printer = ipp.Printer(printerUrl, { agent: httpsAgent })

    const msg = {
      'operation-attributes-tag': {
        'requesting-user-name': 'photoast-test',
        'job-name': path.basename(imagePath),
        'document-format': 'image/jpeg',
      },
      'job-attributes-tag': {
        'media': 'na_5x7_borderless',
        'orientation-requested': 3,
        'ipp-attribute-fidelity': false,
        'copies': 1,
        'print-quality': 5,
        'print-color-mode': 'color',
      },
      data: imageData,
    }

    console.log('\nSending IPP Print-Job...')
    console.log('Job attributes:', JSON.stringify(msg['job-attributes-tag'], null, 2))

    printer.execute('Print-Job', msg, (err, res) => {
      console.log('\n' + '='.repeat(50))
      console.log('CALLBACK RESPONSE')
      console.log('='.repeat(50))

      console.log('\n--- ERROR ---')
      console.log('err is null?', err === null)
      console.log('err is undefined?', err === undefined)
      console.log('err type:', typeof err)
      console.log('err value:', err)

      console.log('\n--- RESPONSE ---')
      console.log('res is null?', res === null)
      console.log('res is undefined?', res === undefined)
      console.log('res type:', typeof res)
      console.log('res value:', res)

      if (err) {
        console.log('\n✗ ERROR DETECTED')
        console.log('Error keys:', err ? Object.keys(err) : 'N/A')
        console.log('Error message:', err?.message)
        console.log('Error toString:', err ? String(err) : 'N/A')
        process.exit(1)
      }

      if (res) {
        console.log('\n✓ RESPONSE RECEIVED')
        console.log('Response keys:', Object.keys(res))
        console.log('Version:', res.version)
        console.log('Status Code:', res.statusCode)
        console.log('Operation:', res.operation)

        if (res['job-attributes-tag']) {
          console.log('\nJob Attributes:')
          console.log(JSON.stringify(res['job-attributes-tag'], null, 2))
        }

        if (res['operation-attributes-tag']) {
          console.log('\nOperation Attributes:')
          console.log(JSON.stringify(res['operation-attributes-tag'], null, 2))
        }

        process.exit(0)
      }

      console.log('\n⚠ No error and no response?')
      process.exit(1)
    })

  } catch (error) {
    console.error('\n✗ EXCEPTION:', error)
    process.exit(1)
  }
}

testPrint()
