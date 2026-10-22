/**
 * Image Normalization Service
 * Strictly normalizes, auto-crops (object-fit: cover for portrait photos), scales to exact high-DPI
 * dimensions, and converts uploaded/captured employee photos and signatures to clean, lightweight,
 * print-ready base64 data URLs.
 * 
 * Prevents layout distortion, font breaking, canvas overflow, and huge memory spikes during rendering
 * and bulk exports.
 */

// Target dimensions at 3x scale matching CardFront layout dimensions:
// Photo box on card is 94px width x 104px height (aspect ratio ~ 0.9038)
export const TARGET_PHOTO_WIDTH = 282; // 94px * 3
export const TARGET_PHOTO_HEIGHT = 312; // 104px * 3

// Signature box on card is 68px width x 26px height (aspect ratio ~ 2.615)
export const TARGET_SIGNATURE_WIDTH = 340; // 68px * 5
export const TARGET_SIGNATURE_HEIGHT = 130; // 26px * 5

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(new Error('Failed to load image for normalization.'));
    img.src = src;
  });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = (err) => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Normalizes an employee portrait photo.
 * Applies strict object-fit: cover with top-center bias (so human heads/faces are never cut off).
 * Resizes to exact 282x312 canvas at 3x high-DPI quality.
 */
export async function normalizeEmployeePhoto(
  input: File | string,
  targetW: number = TARGET_PHOTO_WIDTH,
  targetH: number = TARGET_PHOTO_HEIGHT
): Promise<string> {
  const dataUrl = typeof input === 'string' ? input : await fileToDataUrl(input);
  const img = await loadImage(dataUrl);

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Unable to create 2D canvas context for photo normalization.');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Fill pure white background first
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, targetW, targetH);

  // Compute object-fit: cover with top-center bias
  const srcRatio = img.width / img.height;
  const targetRatio = targetW / targetH;

  let sx = 0;
  let sy = 0;
  let sWidth = img.width;
  let sHeight = img.height;

  if (srcRatio > targetRatio) {
    // Source image is wider than target frame: crop sides, keep center horizontally
    sWidth = img.height * targetRatio;
    sx = (img.width - sWidth) / 2;
    sy = 0;
    sHeight = img.height;
  } else {
    // Source image is taller than target frame: crop bottom, keeping top 15% padding for head/hair
    sHeight = img.width / targetRatio;
    sx = 0;
    // Bias 18% towards the top of the photo so human faces remain centered and not cut off at forehead
    const excessHeight = img.height - sHeight;
    sy = Math.max(0, Math.min(excessHeight, excessHeight * 0.18));
  }

  // Draw into exact target dimension
  ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, targetW, targetH);

  // Export as high-quality compressed JPEG (~40-80 KB)
  return canvas.toDataURL('image/jpeg', 0.92);
}

/**
 * Normalizes an employee signature.
 * Fits cleanly within target dimensions preserving transparency and aspect ratio.
 */
export async function normalizeEmployeeSignature(
  input: File | string,
  targetW: number = TARGET_SIGNATURE_WIDTH,
  targetH: number = TARGET_SIGNATURE_HEIGHT
): Promise<string> {
  const dataUrl = typeof input === 'string' ? input : await fileToDataUrl(input);
  const img = await loadImage(dataUrl);

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Unable to create 2D canvas context for signature normalization.');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Clear canvas (transparent)
  ctx.clearRect(0, 0, targetW, targetH);

  // Fit signature with object-fit: contain so all strokes are preserved
  const srcRatio = img.width / img.height;
  const targetRatio = targetW / targetH;

  let dw = targetW;
  let dh = targetH;
  let dx = 0;
  let dy = 0;

  if (srcRatio > targetRatio) {
    dw = targetW;
    dh = targetW / srcRatio;
    dx = 0;
    dy = (targetH - dh) / 2;
  } else {
    dh = targetH;
    dw = targetH * srcRatio;
    dx = (targetW - dw) / 2;
    dy = 0;
  }

  // Draw signature centered with containment
  ctx.drawImage(img, 0, 0, img.width, img.height, dx, dy, dw, dh);

  // Export as high-resolution transparent PNG
  return canvas.toDataURL('image/png');
}
