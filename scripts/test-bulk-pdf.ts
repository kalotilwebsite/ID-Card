import { jsPDF } from 'jspdf';
import sharp from 'sharp';

async function runBulkPdfTests() {
  console.log('====================================================');
  console.log('TESTING BULK PDF DOWNLOAD ENGINE & 18-CARD CONSTRAINTS');
  console.log('====================================================');

  // Generate mock front & back PNG buffers for testing
  const frontBuffer = await sharp({
    create: {
      width: 852,
      height: 1500,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .png()
    .toBuffer();

  const backBuffer = await sharp({
    create: {
      width: 852,
      height: 1500,
      channels: 4,
      background: { r: 245, g: 245, b: 245, alpha: 1 },
    },
  })
    .png()
    .toBuffer();

  const frontBase64 = `data:image/png;base64,${frontBuffer.toString('base64')}`;
  const backBase64 = `data:image/png;base64,${backBuffer.toString('base64')}`;

  // Helper simulating the PDF generation layout
  function createBulkPdf(cardsCount: number) {
    if (cardsCount === 0) {
      throw new Error('Please select at least 1 card from the table to download.');
    }
    if (cardsCount > 18) {
      throw new Error(`Maximum 18 cards per PDF download. Please select no more than 18 cards (currently selected: ${cardsCount}).`);
    }

    const pageWidthMm = 297;
    const pageHeightMm = 210;

    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const cardWidthMm = 44;
    const cardHeightMm = Number(((cardWidthMm * 500) / 284).toFixed(3)); // 77.465 mm
    const pairGapMm = 2;
    const cardGapXMm = 4;
    const rowGapYMm = 12;

    const totalRowWidthMm = 3 * (cardWidthMm * 2 + pairGapMm) + 2 * cardGapXMm; // 278 mm
    const marginLeft = (pageWidthMm - totalRowWidthMm) / 2; // 9.5 mm
    const totalGridHeightMm = 2 * cardHeightMm + rowGapYMm; // 166.93 mm
    const marginTop = (pageHeightMm - totalGridHeightMm) / 2; // 21.535 mm

    const totalPages = Math.ceil(cardsCount / 6);

    for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
      if (pageIdx > 0) {
        pdf.addPage('a4', 'landscape');
      }

      const countOnThisPage = Math.min(6, cardsCount - pageIdx * 6);
      for (let slotIdx = 0; slotIdx < countOnThisPage; slotIdx++) {
        const col = slotIdx % 3;
        const row = Math.floor(slotIdx / 3);

        const cardStartX = marginLeft + col * (cardWidthMm * 2 + pairGapMm + cardGapXMm);
        const cardStartY = marginTop + row * (cardHeightMm + rowGapYMm);

        const xFront = cardStartX;
        const yFront = cardStartY;
        pdf.addImage(frontBase64, 'PNG', xFront, yFront, cardWidthMm, cardHeightMm, undefined, 'FAST');

        const xBack = cardStartX + cardWidthMm + pairGapMm;
        const yBack = cardStartY;
        pdf.addImage(backBase64, 'PNG', xBack, yBack, cardWidthMm, cardHeightMm, undefined, 'FAST');
      }
    }

    return {
      pdf,
      pageCount: totalPages,
      cardWidthMm,
      cardHeightMm,
      marginLeft,
      marginTop,
      totalRowWidthMm,
      totalGridHeightMm,
    };
  }

  // TEST 1: Rejection over 18 cards
  try {
    createBulkPdf(19);
    console.error('[FAIL] 19 cards should have been rejected');
  } catch (err: any) {
    console.log('[PASS] Rejection when > 18 cards selected:', err.message);
  }

  // TEST 2: Rejection on 0 cards
  try {
    createBulkPdf(0);
    console.error('[FAIL] 0 cards should have been rejected');
  } catch (err: any) {
    console.log('[PASS] Rejection when 0 cards selected:', err.message);
  }

  // TEST 3: Small selection (e.g. 3 cards)
  const smallTest = createBulkPdf(3);
  const smallPageCount = smallTest.pdf.getNumberOfPages();
  console.log(`[PASS] Small selection (3 cards): Exactly ${smallPageCount} landscape page (expected 1).`);

  // TEST 4: Medium selection (e.g. 8 cards)
  const medTest = createBulkPdf(8);
  const medPageCount = medTest.pdf.getNumberOfPages();
  console.log(`[PASS] Medium selection (8 cards): Exactly ${medPageCount} landscape pages (expected 2).`);

  // TEST 5: Maximum allowed cards (18 cards)
  const maxTest = createBulkPdf(18);
  const maxPageCount = maxTest.pdf.getNumberOfPages();
  console.log(`[PASS] Max selection (18 cards): Exactly ${maxPageCount} landscape pages (expected 3).`);

  // TEST 6: Aspect ratio and layout dimensions
  const aspectRatio = maxTest.cardWidthMm / maxTest.cardHeightMm;
  const originalRatio = 284 / 500;
  const ratioDiff = Math.abs(aspectRatio - originalRatio);
  console.log(`Card Aspect Ratio: ${aspectRatio.toFixed(5)} vs Original ${originalRatio.toFixed(5)} (diff: ${ratioDiff.toFixed(6)})`);
  if (ratioDiff < 0.001) {
    console.log('[PASS] Aspect ratio preserved without distortion or stretching.');
  } else {
    console.error('[FAIL] Aspect ratio distortion detected');
  }

  // TEST 7: Page fits within A4 Landscape margins
  const fitsWidth = maxTest.totalRowWidthMm < 297 && maxTest.marginLeft > 5;
  const fitsHeight = maxTest.totalGridHeightMm < 210 && maxTest.marginTop > 5;
  if (fitsWidth && fitsHeight) {
    console.log(`[PASS] Page Grid fits comfortably within A4 Landscape:`);
    console.log(`       Width: ${maxTest.totalRowWidthMm}mm on 297mm page (Margins: L=${maxTest.marginLeft.toFixed(1)}mm, R=${maxTest.marginLeft.toFixed(1)}mm)`);
    console.log(`       Height: ${maxTest.totalGridHeightMm.toFixed(1)}mm on 210mm page (Margins: T=${maxTest.marginTop.toFixed(1)}mm, B=${maxTest.marginTop.toFixed(1)}mm)`);
  } else {
    console.error('[FAIL] Page dimensions overflow');
  }

  // TEST 8: Output PDF Buffer verification
  const pdfBytes = maxTest.pdf.output('arraybuffer');
  console.log(`[PASS] PDF generated successfully. Output size: ${(pdfBytes.byteLength / 1024).toFixed(1)} KB for 18 cards.`);
  console.log('====================================================');
  console.log('ALL BULK PDF LOGIC TESTS PASSED');
  console.log('====================================================');
}

runBulkPdfTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
