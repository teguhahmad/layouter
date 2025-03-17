import { jsPDF } from 'jspdf';

interface PDFTextStyle {
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
}

export function parsePDFMarkdown(doc: jsPDF, text: string, x: number, y: number, options: {
  maxWidth: number;
  align?: 'left' | 'center' | 'right' | 'justify';
  fontSize: number;
  lineSpacing: number;
}) {
  const defaultStyle: PDFTextStyle = {
    isBold: false,
    isItalic: false,
    isUnderline: false
  };

  let currentY = y;
  const segments: { text: string; style: PDFTextStyle }[] = [];
  let currentText = '';
  let currentStyle = { ...defaultStyle };

  // Parse text into segments with styles
  let i = 0;
  while (i < text.length) {
    if (text[i] === '*' || text[i] === '_') {
      // Handle bold and italic
      const marker = text[i];
      const isDouble = text[i + 1] === marker;

      if (currentText) {
        segments.push({ text: currentText, style: { ...currentStyle } });
        currentText = '';
      }

      if (isDouble) {
        currentStyle.isBold = !currentStyle.isBold;
        i += 2;
      } else {
        currentStyle.isItalic = !currentStyle.isItalic;
        i += 1;
      }
    } else if (text.slice(i, i + 2) === '~~') {
      // Handle strikethrough
      if (currentText) {
        segments.push({ text: currentText, style: { ...currentStyle } });
        currentText = '';
      }
      currentStyle.isUnderline = !currentStyle.isUnderline;
      i += 2;
    } else {
      currentText += text[i];
      i++;
    }
  }

  if (currentText) {
    segments.push({ text: currentText, style: { ...currentStyle } });
  }

  // Render segments with proper styling
  for (const segment of segments) {
    const { text: segmentText, style } = segment;
    
    // Apply styles
    const originalFont = doc.getFont();
    if (style.isBold && style.isItalic) {
      doc.setFont(originalFont, 'bolditalic');
    } else if (style.isBold) {
      doc.setFont(originalFont, 'bold');
    } else if (style.isItalic) {
      doc.setFont(originalFont, 'italic');
    } else {
      doc.setFont(originalFont, 'normal');
    }

    // Split text to fit width
    const lines = doc.splitTextToSize(segmentText, options.maxWidth);
    
    // Render each line
    for (const line of lines) {
      doc.text(line, x, currentY, {
        align: options.align || 'left'
      });
      currentY += options.fontSize * options.lineSpacing * 0.352778;
    }

    // Reset font
    doc.setFont(originalFont, 'normal');
  }

  return currentY;
}