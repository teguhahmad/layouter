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
  if (!text || typeof text !== 'string') {
    return y;
  }

  const defaultStyle: PDFTextStyle = {
    isBold: false,
    isItalic: false,
    isUnderline: false
  };

  let currentY = y;
  const segments: { text: string; style: PDFTextStyle }[] = [];
  let currentText = '';
  let currentStyle = { ...defaultStyle };

  // Split text into lines that fit within maxWidth
  const lines = doc.splitTextToSize(text, options.maxWidth);

  // Process each line
  for (const line of lines) {
    // Apply text alignment
    const xPos = options.align === 'center' 
      ? x + (options.maxWidth / 2)
      : options.align === 'right'
        ? x + options.maxWidth
        : x;

    doc.text(line, xPos, currentY, { 
      align: options.align || 'left',
      maxWidth: options.maxWidth
    });

    // Move to next line with proper spacing
    currentY += options.fontSize * options.lineSpacing * 0.352778;
  }

  return currentY;
}