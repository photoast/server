const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;

// Create 4 sample images with different colors
async function createSampleImages() {
  const width = 1200;
  const height = 1600;

  const colors = [
    { bg: '#FF6B6B', text: 'Photo 1\n(Top Left)' },
    { bg: '#4ECDC4', text: 'Photo 2\n(Top Right)' },
    { bg: '#45B7D1', text: 'Photo 3\n(Bottom Left)' },
    { bg: '#FFA07A', text: 'Photo 4\n(Bottom Right)' }
  ];

  const buffers = [];

  for (let i = 0; i < 4; i++) {
    const svgImage = `
      <svg width="${width}" height="${height}">
        <rect width="${width}" height="${height}" fill="${colors[i].bg}" />
        <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="100" fill="white" text-anchor="middle">
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

// Process two-by-two image
async function testTwoByTwo() {
  console.log('Testing 2x2 Grid layout...\n');

  // Create sample images
  const imageBuffers = await createSampleImages();

  // Two-by-two layout specifications
  const TARGET_WIDTH = 1000;
  const TARGET_HEIGHT = 1500;
  const MARGIN_HORIZONTAL = 40;
  const MARGIN_VERTICAL = 60;
  const GAP = 20;

  const availableWidth = TARGET_WIDTH - (MARGIN_HORIZONTAL * 2);
  const availableHeight = TARGET_HEIGHT - (MARGIN_VERTICAL * 2);

  const photoWidth = Math.round((availableWidth - GAP) / 2);
  const photoHeight = Math.round((availableHeight - GAP) / 2);

  console.log(`Canvas: ${TARGET_WIDTH}x${TARGET_HEIGHT}px`);
  console.log(`Photo size: ${photoWidth}x${photoHeight}px`);
  console.log(`Margins: H=${MARGIN_HORIZONTAL}px, V=${MARGIN_VERTICAL}px`);
  console.log(`Gap: ${GAP}px\n`);

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

  // Create canvas with white background
  let finalImage = sharp({
    create: {
      width: TARGET_WIDTH,
      height: TARGET_HEIGHT,
      channels: 3,
      background: { r: 255, g: 255, b: 255 }
    }
  });

  // Compose photos in 2x2 grid
  const composites = [];
  for (let i = 0; i < 4; i++) {
    const row = Math.floor(i / 2);  // 0 or 1
    const col = i % 2;              // 0 or 1

    const left = MARGIN_HORIZONTAL + (col * (photoWidth + GAP));
    const top = MARGIN_VERTICAL + (row * (photoHeight + GAP));

    composites.push({
      input: photoBuffers[i],
      top,
      left,
    });
    console.log(`Photo ${i + 1} positioned at (${left}, ${top})`);
  }

  finalImage = finalImage.composite(composites);

  // Save output
  const outputPath = path.join(__dirname, '../output/two-by-two-test.jpg');
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  await finalImage
    .jpeg({
      quality: 95,
      chromaSubsampling: '4:4:4'
    })
    .toFile(outputPath);

  console.log(`\nOutput saved to: ${outputPath}`);
  console.log('\nTest completed successfully!');
}

testTwoByTwo().catch(console.error);
