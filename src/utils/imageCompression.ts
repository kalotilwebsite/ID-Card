/**
 * Utility for client-side image compression and validation using HTML Canvas.
 * Resizes images to maximum dimensions (e.g., 800px) and compresses with JPEG quality (0.75 - 0.80)
 * to maintain crisp, print-ready quality while strictly keeping the file size under 1 MB.
 */

export const MAX_FILE_SIZE_BYTES = 1024 * 1024; // 1 MB (1,048,576 bytes)
export const BANGLA_SIZE_ALERT_MESSAGE =
  'ছবি বা সিগনেচারের সাইজ অনেক বেশি বড়! অনুগ্রহ করে ১ মেগাবাইটের (1 MB) নিচের ছবি বা সিগনেচার আপলোড করুন।';

export interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  isSignature?: boolean;
}

export interface CompressResult {
  dataUrl: string;
  sizeBytes: number;
  isValidSize: boolean;
  width: number;
  height: number;
}

/**
 * Calculates the binary byte size of a Base64 data URL.
 */
export function getDataUrlSizeBytes(dataUrl: string): number {
  if (!dataUrl) return 0;
  const commaIdx = dataUrl.indexOf(',');
  const base64Data = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
  const padding = base64Data.endsWith('==') ? 2 : base64Data.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.round((base64Data.length * 3) / 4) - padding);
}

/**
 * Loads an image from a Data URL or object URL.
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(new Error('Failed to load image for compression: ' + err));
    img.src = src;
  });
}

/**
 * Resizes and compresses an image Data URL using HTML Canvas.
 */
export async function compressDataUrl(
  dataUrl: string,
  options: CompressOptions = {}
): Promise<CompressResult> {
  const {
    maxWidth = 800,
    maxHeight = 800,
    quality = 0.8,
    isSignature = false,
  } = options;

  const img = await loadImage(dataUrl);

  // Calculate proportional dimensions
  let { width, height } = img;
  if (width > maxWidth || height > maxHeight) {
    const ratio = Math.min(maxWidth / width, maxHeight / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  // Ensure minimum dimensions
  width = Math.max(1, width);
  height = Math.max(1, height);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context is not available');
  }

  // High quality image smoothing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Fill white background (ensures clean edges and optimal JPEG compression)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  // Generate compressed output
  const mimeType = 'image/jpeg';
  let compressedDataUrl = canvas.toDataURL(mimeType, quality);
  let sizeBytes = getDataUrlSizeBytes(compressedDataUrl);

  // If still larger than 1 MB, try lower quality (0.7)
  if (sizeBytes > MAX_FILE_SIZE_BYTES) {
    compressedDataUrl = canvas.toDataURL(mimeType, 0.7);
    sizeBytes = getDataUrlSizeBytes(compressedDataUrl);
  }

  // If still exceeds 1 MB, do a second-stage dimension reduction
  if (sizeBytes > MAX_FILE_SIZE_BYTES && (width > 500 || height > 500)) {
    const stepCanvas = document.createElement('canvas');
    stepCanvas.width = Math.round(width * 0.75);
    stepCanvas.height = Math.round(height * 0.75);
    const stepCtx = stepCanvas.getContext('2d');
    if (stepCtx) {
      stepCtx.imageSmoothingEnabled = true;
      stepCtx.imageSmoothingQuality = 'high';
      stepCtx.fillStyle = '#ffffff';
      stepCtx.fillRect(0, 0, stepCanvas.width, stepCanvas.height);
      stepCtx.drawImage(canvas, 0, 0, stepCanvas.width, stepCanvas.height);
      compressedDataUrl = stepCanvas.toDataURL(mimeType, 0.7);
      sizeBytes = getDataUrlSizeBytes(compressedDataUrl);
      width = stepCanvas.width;
      height = stepCanvas.height;
    }
  }

  const isValidSize = sizeBytes <= MAX_FILE_SIZE_BYTES;

  return {
    dataUrl: compressedDataUrl,
    sizeBytes,
    isValidSize,
    width,
    height,
  };
}

/**
 * Reads a File object, compresses it via Canvas, and validates that the final size is <= 1 MB.
 */
export async function compressImageFile(
  file: File,
  options: CompressOptions = {}
): Promise<CompressResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file from disk'));
    reader.onload = async (e) => {
      try {
        const rawDataUrl = e.target?.result as string;
        const result = await compressDataUrl(rawDataUrl, options);
        resolve(result);
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsDataURL(file);
  });
}
