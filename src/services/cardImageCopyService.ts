import html2canvas from 'html2canvas-pro';
import JSZip from 'jszip';

/**
 * Ensures all <img> elements inside an element are fully loaded in memory before snapshot
 */
export async function ensureImagesLoaded(container: HTMLElement): Promise<void> {
  const images = Array.from(container.querySelectorAll('img'));
  await Promise.all(
    images.map((img) => {
      if (img.complete && img.naturalWidth !== 0) {
        return Promise.resolve();
      }
      return new Promise<void>((resolve) => {
        const timeout = setTimeout(() => resolve(), 2000);
        img.onload = () => {
          clearTimeout(timeout);
          resolve();
        };
        img.onerror = () => {
          clearTimeout(timeout);
          resolve();
        };
      });
    })
  );
}

/**
 * Captures an already-rendered card DOM element directly from Card Studio & Design,
 * preserving its visible design, fonts, positions, logos, and footers pixel-for-pixel.
 *
 * Uses a clean offscreen cloning sandbox so NO ancestor overflow:hidden or CSS zoom
 * can clip or distort any part of the card (e.g. Beyond Tomorrow, ROSA logo, footers).
 */
export async function captureDirectCardElement(
  sourceEl: HTMLElement,
  scale: number = 3
): Promise<HTMLCanvasElement> {
  await ensureImagesLoaded(sourceEl);

  // Create an offscreen, isolated clean container mounted to the body
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  container.style.width = '284px';
  container.style.height = '500px';
  container.style.overflow = 'visible';
  container.style.zIndex = '-99999';
  container.style.backgroundColor = '#ffffff';

  // Clone the exact, live rendered DOM node from Card Studio & Design
  const clone = sourceEl.cloneNode(true) as HTMLElement;

  // Ensure clone is 1:1 nominal 284x500 without preview zoom scale, shadows or borders
  clone.style.transform = 'none';
  clone.style.boxShadow = 'none';
  clone.style.border = 'none';
  clone.style.width = '284px';
  clone.style.height = '500px';
  clone.style.position = 'relative';
  clone.style.left = '0';
  clone.style.top = '0';

  // Hide any screen-only buttons inside the card (e.g. selection badges, hover copy tags)
  const screenOnlys = Array.from(
    clone.querySelectorAll<HTMLElement>('.screen-only-guide, button, .no-capture')
  );
  screenOnlys.forEach((el) => {
    el.style.display = 'none';
  });

  container.appendChild(clone);
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(clone, {
      scale,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      scrollX: 0,
      scrollY: 0,
      width: 284,
      height: 500,
      windowWidth: 1920,
      windowHeight: 1080,
    });

    return canvas;
  } finally {
    if (container.parentElement) {
      container.parentElement.removeChild(container);
    }
  }
}

/**
 * Captures Front and Back cards directly from the live preview and composes them
 * side-by-side using pure 2D Canvas drawing (zero DOM nesting, zero flexbox overlap).
 *
 * Front is on the left (with its red footer and Beyond Tomorrow logo).
 * Back is on the right (with its black footer and Akij Bashir logo).
 * They are cleanly separated by a crisp white margin and CAN NEVER overlap.
 */
export async function captureDirectCardPair(
  frontEl: HTMLElement,
  backEl: HTMLElement,
  scale: number = 3,
  arrangement: 'side-by-side' | 'top-and-bottom' = 'side-by-side'
): Promise<HTMLCanvasElement> {
  const frontCanvas = await captureDirectCardElement(frontEl, scale);
  const backCanvas = await captureDirectCardElement(backEl, scale);

  const combinedCanvas = document.createElement('canvas');
  const gap = Math.round(24 * scale); // 24px physical gap scaled (72px at scale 3)

  if (arrangement === 'side-by-side') {
    combinedCanvas.width = frontCanvas.width + backCanvas.width + gap;
    combinedCanvas.height = Math.max(frontCanvas.height, backCanvas.height);

    const ctx = combinedCanvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, combinedCanvas.width, combinedCanvas.height);

    // Draw Front on the left
    ctx.drawImage(frontCanvas, 0, 0);

    // Draw Back on the right
    ctx.drawImage(backCanvas, frontCanvas.width + gap, 0);
  } else {
    // Top-and-bottom
    combinedCanvas.width = Math.max(frontCanvas.width, backCanvas.width);
    combinedCanvas.height = frontCanvas.height + backCanvas.height + gap;

    const ctx = combinedCanvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, combinedCanvas.width, combinedCanvas.height);

    // Draw Front on top
    ctx.drawImage(frontCanvas, 0, 0);

    // Draw Back below
    ctx.drawImage(backCanvas, 0, frontCanvas.height + gap);
  }

  return combinedCanvas;
}

/**
 * Combines multiple card pair canvases into a single unified image layout
 */
export async function captureMultipleCardsCombined(
  canvases: HTMLCanvasElement[],
  gapPx: number = 24
): Promise<HTMLCanvasElement> {
  if (canvases.length === 0) {
    throw new Error('No cards provided to combine');
  }
  if (canvases.length === 1) {
    return canvases[0];
  }

  // Calculate total canvas width and maximum height
  const totalWidth = canvases.reduce((acc, c) => acc + c.width, 0) + (canvases.length - 1) * gapPx;
  const maxHeight = Math.max(...canvases.map((c) => c.height));

  const canvas = document.createElement('canvas');
  canvas.width = totalWidth;
  canvas.height = maxHeight;

  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let currentX = 0;
  for (const c of canvases) {
    ctx.drawImage(c, currentX, 0);
    currentX += c.width + gapPx;
  }

  return canvas;
}

/**
 * Writes an image canvas directly to the system clipboard as a high-resolution PNG.
 * This format is universally recognized by Microsoft Word for direct Ctrl+V pasting.
 */
export async function copyCanvasToClipboard(
  canvas: HTMLCanvasElement,
  fallbackFilename: string = 'ID_Card_Copy.png'
): Promise<{ success: boolean; blob?: Blob; error?: string }> {
  try {
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/png');
    });

    if (!blob) {
      throw new Error('Failed to generate PNG blob from canvas');
    }

    if (
      typeof navigator !== 'undefined' &&
      navigator.clipboard &&
      typeof ClipboardItem !== 'undefined'
    ) {
      const item = new ClipboardItem({ 'image/png': blob });
      await navigator.clipboard.write([item]);
      return { success: true, blob };
    }

    // Fallback: download PNG directly if clipboard is not accessible
    downloadCanvasPng(canvas, fallbackFilename);
    return { success: true, blob };
  } catch (err: any) {
    console.warn('Clipboard write failed, providing fallback download:', err);
    // Automatic fallback download so the user still gets the image
    downloadCanvasPng(canvas, fallbackFilename);
    return { success: false, error: err.message };
  }
}

/**
 * Triggers a direct download of a canvas as a PNG file.
 */
export function downloadCanvasPng(canvas: HTMLCanvasElement, filename: string): void {
  const url = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Packages multiple canvas snapshots into a single ZIP archive for batch download.
 */
export async function createZipFromCanvases(
  items: Array<{ canvas: HTMLCanvasElement; filename: string }>
): Promise<Blob> {
  const zip = new JSZip();

  for (const item of items) {
    const dataUrl = item.canvas.toDataURL('image/png');
    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
    zip.file(item.filename, base64Data, { base64: true });
  }

  return await zip.generateAsync({ type: 'blob' });
}
