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

// Process four-cut image
async function testFourCut() {
  console.log('Testing Life Four-Cut layout...\n');

  // Create sample images
  const imageBuffers = await createSampleImages();

  // Import the image processing function
  // Note: We need to use a workaround since lib/image.ts is TypeScript
  // For now, we'll simulate the four-cut processing directly

  const LIFE_FOUR_CUT_WIDTH = 1000;
  const LIFE_FOUR_CUT_HEIGHT = 1500;
  const MARGIN_HORIZONTAL = 50;
  const MARGIN_VERTICAL = 40;
  const GAP_BETWEEN_PHOTOS = 20;

  const availableWidth = LIFE_FOUR_CUT_WIDTH - (MARGIN_HORIZONTAL * 2);
  const availableHeight = LIFE_FOUR_CUT_HEIGHT - (MARGIN_VERTICAL * 2);

  const photoWidth = availableWidth;
  const totalGapsHeight = GAP_BETWEEN_PHOTOS * 3;
  const photoHeight = Math.round((availableHeight - totalGapsHeight) / 4);

  console.log(`Canvas: ${LIFE_FOUR_CUT_WIDTH}x${LIFE_FOUR_CUT_HEIGHT}px`);
  console.log(`Photo size: ${photoWidth}x${photoHeight}px`);
  console.log(`Margins: H=${MARGIN_HORIZONTAL}px, V=${MARGIN_VERTICAL}px`);
  console.log(`Gap: ${GAP_BETWEEN_PHOTOS}px\n`);

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

  // Create canvas with black background
  let finalImage = sharp({
    create: {
      width: LIFE_FOUR_CUT_WIDTH,
      height: LIFE_FOUR_CUT_HEIGHT,
      channels: 3,
      background: { r: 0, g: 0, b: 0 }
    }
  });

  // Compose photos
  const composites = [];
  for (let i = 0; i < 4; i++) {
    const topPosition = MARGIN_VERTICAL + (i * (photoHeight + GAP_BETWEEN_PHOTOS));
    composites.push({
      input: photoBuffers[i],
      top: topPosition,
      left: MARGIN_HORIZONTAL,
    });
    console.log(`Photo ${i + 1} positioned at (${MARGIN_HORIZONTAL}, ${topPosition})`);
  }

  finalImage = finalImage.composite(composites);

  // Save output
  const outputPath = path.join(__dirname, '../output/life-four-cut-test.jpg');
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

testFourCut().catch(console.error);
