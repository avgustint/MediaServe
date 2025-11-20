// Simple script to generate base64-encoded colored square images
// Using a minimal PNG encoder approach

function createColoredSquarePNG(color) {
  // Create a simple 100x100 pixel PNG with a solid color
  // This is a minimal valid PNG structure
  const width = 100;
  const height = 100;
  
  // PNG signature
  const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  
  // For simplicity, we'll use a data URI with SVG converted to base64
  // This is easier and more reliable
  const svg = `<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="${color}"/></svg>`;
  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}

const colors = ['#FF0000', '#0000FF', '#00FF00'];
const images = colors.map(color => createColoredSquarePNG(color));

console.log('Red square:', images[0]);
console.log('Blue square:', images[1]);
console.log('Green square:', images[2]);

// Output as JSON array for easy copy-paste
console.log('\nJSON array:');
console.log(JSON.stringify(images, null, 2));

