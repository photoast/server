const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;

// Create 4 sample images with different colors
async function createSampleImages() {
  const width = 1200;
  const height = 1600;

  const colors = [
    { bg: '#667eea', text: 'Photo 1' },
    { bg: '#f093fb', text: 'Photo 2' },
    { bg: '#4facfe', text: 'Photo 3' },
    { bg: '#43e97b', text: 'Photo 4' }
  ];

  const buffers = [];

  for (let i = 0; i < 4; i++) {
    const svgImage = `
      <svg width="${width}" height="${height}">
        <rect width="${width}" height="${height}" fill="${colors[i].bg}" />
        <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="120" fill="white" text-anchor="middle">
          ${colors[i].text}
        </text>
      </svg>
    `;

    const buffer = await sharp(Buffer.from(svgImage))
      .jpeg({ quality: 95 })
      .toBuffer();

    buffers.push(buffer);
  }

  console.log('Created 4 sample image buffers');
  return buffers;
}

// Helper function to convert hex color to RGB
function hexToRgb(hex) {
  hex = hex.replace(/^#/, '');
  const bigint = parseInt(hex, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return { r, g, b };
}

// Process four-cut dual strip image
async function testFourCutDual(backgroundColor = '#000000') {
  console.log('Testing Life Four-Cut Dual Strip layout...\n');

  const imageBuffers = await createSampleImages();

  const TARGET_WIDTH = 1000;
  const TARGET_HEIGHT = 1500;
  const MARGIN_OUTER = 20;
  const GAP_CENTER = 10;
  const GAP_BETWEEN_PHOTOS = 10;

  const stripWidth = Math.round((TARGET_WIDTH - (MARGIN_OUTER * 2) - GAP_CENTER) / 2);
  const stripHeight = TARGET_HEIGHT - (MARGIN_OUTER * 2);

  const photoWidth = stripWidth;
  const totalGapsHeight = GAP_BETWEEN_PHOTOS * 3;
  const photoHeight = Math.round((stripHeight - totalGapsHeight) / 4);

  console.log(`Canvas: ${TARGET_WIDTH}x${TARGET_HEIGHT}px (4x6 inch)`);
  console.log(`Strip size: ${stripWidth}x${stripHeight}px`);
  console.log(`Photo size: ${photoWidth}x${photoHeight}px`);
  console.log(`Background color: ${backgroundColor}\n`);

  // Process each photo
  const photoBuffers = [];
  for (let i = 0; i < 4; i++) {
    const processed = await sharp(imageBuffers[i])
      .resize(photoWidth, photoHeight, {
        fit: 'cover',
        position: 'centre',
      })
      .toBuffer();

    photoBuffers.push(processed);
  }

  // Parse background color
  const rgb = hexToRgb(backgroundColor);

  // Create canvas with custom background
  let finalImage = sharp({
    create: {
      width: TARGET_WIDTH,
      height: TARGET_HEIGHT,
      channels: 3,
      background: rgb
    }
  });

  const composites = [];

  // Add 4 photos to LEFT strip
  for (let i = 0; i < 4; i++) {
    const topPosition = MARGIN_OUTER + (i * (photoHeight + GAP_BETWEEN_PHOTOS));
    const leftPosition = MARGIN_OUTER;

    composites.push({
      input: photoBuffers[i],
      top: topPosition,
      left: leftPosition,
    });

    console.log(`Left Strip - Photo ${i + 1} at (${leftPosition}, ${topPosition})`);
  }

  // Add 4 photos to RIGHT strip (identical)
  for (let i = 0; i < 4; i++) {
    const topPosition = MARGIN_OUTER + (i * (photoHeight + GAP_BETWEEN_PHOTOS));
    const rightPosition = MARGIN_OUTER + stripWidth + GAP_CENTER;

    composites.push({
      input: photoBuffers[i],
      top: topPosition,
      left: rightPosition,
    });

    console.log(`Right Strip - Photo ${i + 1} at (${rightPosition}, ${topPosition})`);
  }

  finalImage = finalImage.composite(composites);

  // Save output
  const bgName = backgroundColor.replace('#', '');
  const outputPath = path.join(__dirname, `../output/life-four-cut-dual-${bgName}.jpg`);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  await finalImage
    .jpeg({
      quality: 95,
      chromaSubsampling: '4:4:4'
    })
    .toFile(outputPath);

  console.log(`\nOutput saved to: ${outputPath}`);
  console.log('✂️ Cut vertically down the center to get 2 identical strips!\n');
}

// Test with different background colors
async function runTests() {
  console.log('='.repeat(60));
  console.log('Testing with BLACK background');
  console.log('='.repeat(60));
  await testFourCutDual('#000000');

  console.log('\n' + '='.repeat(60));
  console.log('Testing with PINK background');
  console.log('='.repeat(60));
  await testFourCutDual('#ffb6c1');

  console.log('\n' + '='.repeat(60));
  console.log('Testing with MINT background');
  console.log('='.repeat(60));
  await testFourCutDual('#98d8c8');

  console.log('\nAll tests completed successfully! 🎉');
}

runTests().catch(console.error);
