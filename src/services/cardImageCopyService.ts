import html2canvas from 'html2canvas-pro';
import JSZip from 'jszip';
import { EmployeeCardData } from '../types';

/**
 * Ensures all <img> elements inside a DOM container are fully loaded before capturing
 */
export async function ensureImagesLoaded(container: HTMLElement): Promise<void> {
  const images = Array.from(container.querySelectorAll('img'));
  await Promise.all(
    images.map((img) => {
      if (img.complete && img.naturalWidth !== 0) {
        return Promise.resolve();
      }
      return new Promise<void>((resolve) => {
        const timeout = setTimeout(() => resolve(), 2500);
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
 * Clones a rendered card element to an isolated, unscaled container and captures
 * it as a lossless, high-resolution PNG Blob at 3x resolution (300+ DPI print quality).
 * Completely eliminates parent transform scale, margin offsets, and scroll clipping.
 */
export async function captureCardElementToBlob(
  sourceEl: HTMLElement,
  options?: {
    scale?: number;
    backgroundColor?: string;
  }
): Promise<Blob> {
  const scale = options?.scale ?? 3; // 3x for 300+ DPI
  const backgroundColor = options?.backgroundColor ?? '#ffffff';

  await ensureImagesLoaded(sourceEl);

  // Measure original dimensions without transforms
  const originalWidth = sourceEl.offsetWidth || 284;
  const originalHeight = sourceEl.offsetHeight || 500;

  // Clone node deeply to avoid modifying the live preview DOM
  const clone = sourceEl.cloneNode(true) as HTMLElement;
  clone.style.transform = 'none';
  clone.style.webkitTransform = 'none';
  clone.style.margin = '0';
  clone.style.boxShadow = 'none';
  clone.style.border = 'none';
  clone.style.outline = 'none';
  clone.style.position = 'relative';
  clone.style.left = '0';
  clone.style.top = '0';

  // Remove any guide overlays or control buttons in the clone
  const screenOnlyElements = clone.querySelectorAll('.screen-only-guide, button, .no-capture');
  screenOnlyElements.forEach((el) => el.remove());

  // Mount in isolated offscreen container
  const sandbox = document.createElement('div');
  sandbox.style.position = 'fixed';
  sandbox.style.left = '-99999px';
  sandbox.style.top = '-99999px';
  sandbox.style.width = `${originalWidth}px`;
  sandbox.style.height = `${originalHeight}px`;
  sandbox.style.overflow = 'hidden';
  sandbox.style.zIndex = '-99999';
  sandbox.style.background = backgroundColor;
  sandbox.appendChild(clone);
  document.body.appendChild(sandbox);

  try {
    await ensureImagesLoaded(clone);

    const canvas = await html2canvas(clone, {
      scale,
      useCORS: true,
      allowTaint: true,
      backgroundColor,
      logging: false,
      scrollX: 0,
      scrollY: 0,
      width: originalWidth,
      height: originalHeight,
      windowWidth: originalWidth,
      windowHeight: originalHeight,
    });

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => {
        if (b) resolve(b);
        else reject(new Error('Failed to generate PNG blob from card canvas'));
      }, 'image/png');
    });

    return blob;
  } finally {
    if (sandbox.parentElement) {
      document.body.removeChild(sandbox);
    }
  }
}

/**
 * Captures a Pair (Front and Back) of a card as a single high-resolution PNG image.
 * Arrangement can be 'side-by-side' or 'top-and-bottom'.
 */
export async function captureCardPairToBlob(
  frontEl: HTMLElement,
  backEl: HTMLElement,
  arrangement: 'side-by-side' | 'top-and-bottom' = 'side-by-side',
  scale: number = 3
): Promise<Blob> {
  await Promise.all([ensureImagesLoaded(frontEl), ensureImagesLoaded(backEl)]);

  const frontClone = frontEl.cloneNode(true) as HTMLElement;
  const backClone = backEl.cloneNode(true) as HTMLElement;

  [frontClone, backClone].forEach((el) => {
    el.style.transform = 'none';
    el.style.webkitTransform = 'none';
    el.style.margin = '0';
    el.style.boxShadow = 'none';
    el.querySelectorAll('.screen-only-guide, button, .no-capture').forEach((c) => c.remove());
  });

  const cardW = frontEl.offsetWidth || 284;
  const cardH = frontEl.offsetHeight || 500;
  const gapPx = 20; // Crisp, professional margin between Front & Back
  const paddingPx = 8; // Slight padding around the pair

  const sandbox = document.createElement('div');
  sandbox.style.position = 'fixed';
  sandbox.style.left = '-99999px';
  sandbox.style.top = '-99999px';
  sandbox.style.background = '#ffffff';
  sandbox.style.zIndex = '-99999';
  sandbox.style.overflow = 'hidden';

  const pairFlex = document.createElement('div');
  pairFlex.style.display = 'flex';
  pairFlex.style.flexDirection = arrangement === 'side-by-side' ? 'row' : 'column';
  pairFlex.style.gap = `${gapPx}px`;
  pairFlex.style.padding = `${paddingPx}px`;
  pairFlex.style.background = '#ffffff';

  pairFlex.appendChild(frontClone);
  pairFlex.appendChild(backClone);
  sandbox.appendChild(pairFlex);
  document.body.appendChild(sandbox);

  const totalWidth =
    arrangement === 'side-by-side' ? cardW * 2 + gapPx + paddingPx * 2 : cardW + paddingPx * 2;
  const totalHeight =
    arrangement === 'side-by-side' ? cardH + paddingPx * 2 : cardH * 2 + gapPx + paddingPx * 2;

  try {
    await ensureImagesLoaded(sandbox);

    const canvas = await html2canvas(pairFlex, {
      scale,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      scrollX: 0,
      scrollY: 0,
      width: totalWidth,
      height: totalHeight,
      windowWidth: totalWidth,
      windowHeight: totalHeight,
    });

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => {
        if (b) resolve(b);
        else reject(new Error('Failed to create pair PNG blob'));
      }, 'image/png');
    });

    return blob;
  } finally {
    if (sandbox.parentElement) {
      document.body.removeChild(sandbox);
    }
  }
}

/**
 * Captures multiple selected cards together arranged in their existing print-preview arrangement
 * as a single high-resolution image object that can be pasted directly into Microsoft Word (Ctrl+V).
 */
export async function captureMultipleCardsCombinedToBlob(
  cardPairs: Array<{ frontEl: HTMLElement; backEl?: HTMLElement }>,
  layoutMode: 'side-by-side' | 'top-and-bottom' | 'front-only' | 'back-only',
  columns: number = 3,
  scale: number = 2.5
): Promise<Blob> {
  const cardW = 284;
  const cardH = 500;
  const gapX = 24;
  const gapY = 28;
  const padding = 20;

  const sandbox = document.createElement('div');
  sandbox.style.position = 'fixed';
  sandbox.style.left = '-99999px';
  sandbox.style.top = '-99999px';
  sandbox.style.background = '#ffffff';
  sandbox.style.zIndex = '-99999';

  const gridContainer = document.createElement('div');
  gridContainer.style.display = 'grid';
  gridContainer.style.gap = `${gapY}px ${gapX}px`;
  gridContainer.style.padding = `${padding}px`;
  gridContainer.style.background = '#ffffff';

  // Determine grid template columns
  const effectiveCols = Math.max(1, Math.min(columns, cardPairs.length));
  gridContainer.style.gridTemplateColumns = `repeat(${effectiveCols}, auto)`;

  cardPairs.forEach(({ frontEl, backEl }) => {
    const cardSlot = document.createElement('div');
    cardSlot.style.display = 'flex';
    cardSlot.style.flexDirection = layoutMode === 'top-and-bottom' ? 'column' : 'row';
    cardSlot.style.gap = '14px';
    cardSlot.style.background = '#ffffff';

    if (layoutMode === 'front-only' || !backEl) {
      const fClone = frontEl.cloneNode(true) as HTMLElement;
      fClone.style.transform = 'none';
      fClone.querySelectorAll('.screen-only-guide, button, .no-capture').forEach((c) => c.remove());
      cardSlot.appendChild(fClone);
    } else if (layoutMode === 'back-only') {
      const bClone = backEl.cloneNode(true) as HTMLElement;
      bClone.style.transform = 'none';
      bClone.querySelectorAll('.screen-only-guide, button, .no-capture').forEach((c) => c.remove());
      cardSlot.appendChild(bClone);
    } else {
      // side-by-side or top-and-bottom
      const fClone = frontEl.cloneNode(true) as HTMLElement;
      const bClone = backEl.cloneNode(true) as HTMLElement;
      [fClone, bClone].forEach((el) => {
        el.style.transform = 'none';
        el.querySelectorAll('.screen-only-guide, button, .no-capture').forEach((c) => c.remove());
      });
      cardSlot.appendChild(fClone);
      cardSlot.appendChild(bClone);
    }

    gridContainer.appendChild(cardSlot);
  });

  sandbox.appendChild(gridContainer);
  document.body.appendChild(sandbox);

  try {
    await ensureImagesLoaded(sandbox);

    const canvas = await html2canvas(gridContainer, {
      scale,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      scrollX: 0,
      scrollY: 0,
    });

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => {
        if (b) resolve(b);
        else reject(new Error('Failed to generate combined grid PNG blob'));
      }, 'image/png');
    });

    return blob;
  } finally {
    if (sandbox.parentElement) {
      document.body.removeChild(sandbox);
    }
  }
}

/**
 * Writes an image PNG blob directly to the system clipboard using the standard Clipboard API.
 * This format (image/png) is universally recognized by Microsoft Word for Ctrl+V paste.
 */
export async function copyBlobToClipboard(
  blob: Blob
): Promise<{ success: boolean; fallbackUrl?: string; error?: string }> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof ClipboardItem !== 'undefined') {
      const clipboardItem = new ClipboardItem({ 'image/png': blob });
      await navigator.clipboard.write([clipboardItem]);
      return { success: true };
    }
    throw new Error('Clipboard API not supported in this browser context');
  } catch (err: any) {
    console.warn('Direct clipboard.write failed, falling back to manual copy/download:', err);
    const fallbackUrl = URL.createObjectURL(blob);
    return {
      success: false,
      fallbackUrl,
      error: err.message || 'Clipboard access denied or unsupported',
    };
  }
}

/**
 * Triggers a browser download of a Blob file.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Bundles multiple PNG blobs into a single ZIP archive using JSZip for convenient batch download.
 */
export async function createCardsZipBlob(
  files: Array<{ filename: string; blob: Blob }>
): Promise<Blob> {
  const zip = new JSZip();
  files.forEach(({ filename, blob }) => {
    zip.file(filename, blob);
  });
  return await zip.generateAsync({ type: 'blob' });
}
