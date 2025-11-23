const sharp = require('sharp');
const path = require('path');

// Create a sample image (1205x1795 to match 102x152mm at 300 DPI)
async function createSampleImage() {
  const width = 1205;
  const height = 1795;

  // Create a gradient background with text
  const svgImage = `
    <svg width="${width}" height="${height}">
      <defs>
        <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#grad1)" />
      <text x="50%" y="50%" font-family="Arial" font-size="80" fill="white" text-anchor="middle" opacity="0.3">
        SAMPLE PHOTO
      </text>
      <text x="50%" y="60%" font-family="Arial" font-size="40" fill="white" text-anchor="middle" opacity="0.3">
        102×152mm Preview
      </text>
    </svg>
  `;

  const outputPath = path.join(__dirname, '../public/sample-photo.jpg');

  await sharp(Buffer.from(svgImage))
    .jpeg({ quality: 95 })
    .toFile(outputPath);

  console.log('Sample image created at:', outputPath);
}

createSampleImage().catch(console.error);
