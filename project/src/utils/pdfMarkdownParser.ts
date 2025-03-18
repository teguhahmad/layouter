import { jsPDF } from "jspdf";

interface TextStyle {
  bold: boolean;
  italic: boolean;
  heading: number | null;
  list: boolean;
  listType: 'ordered' | 'unordered' | null;
  listLevel: number;
}

interface TextSegment {
  text: string;
  style: TextStyle;
}

function applyStyle(doc: jsPDF, style: TextStyle, baseFontSize: number) {
  let fontStyle = 'normal';
  if (style.bold && style.italic) fontStyle = 'bolditalic';
  else if (style.bold) fontStyle = 'bold';
  else if (style.italic) fontStyle = 'italic';
  doc.setFont('helvetica', fontStyle);

  if (style.heading) {
    const headingSizes = {
      1: baseFontSize * 2,
      2: baseFontSize * 1.5,
      3: baseFontSize * 1.17,
      4: baseFontSize * 1,
      5: baseFontSize * 0.83,
      6: baseFontSize * 0.67,
    };
    doc.setFontSize(headingSizes[style.heading]);
  } else {
    doc.setFontSize(baseFontSize);
  }
}

export function parsePDFMarkdown(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  options: {
    maxWidth: number;
    align?: 'left' | 'center' | 'right' | 'justify';
    fontSize: number;
    lineSpacing: number;
  }
): number {
  if (!text) return y;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(options.fontSize);

  const lineHeight = options.fontSize * 0.352778 * options.lineSpacing;
  let currentY = y;
  const textLines = text.split('\n');
  let listCounter = 1;
  let isFirstLine = true;
  let inOrderedList = false;
  let orderedListItems: string[] = [];
  let listLevel = 0;

  for (let i = 0; i < textLines.length; i++) {
    let line = textLines[i].trim();
    
    if (!line) {
      if (!isFirstLine) currentY += lineHeight;
      continue;
    }

    // Headers
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const content = headerMatch[2];
      
      if (!isFirstLine) currentY += lineHeight;
      
      doc.setFontSize(options.fontSize * (2.5 - (level * 0.3)));
      doc.setFont('helvetica', 'bold');
      
      const splitLines = doc.splitTextToSize(content, options.maxWidth);
      splitLines.forEach((splitLine: string) => {
        doc.text(splitLine, x, currentY);
        currentY += lineHeight * 1.5;
      });
      
      doc.setFontSize(options.fontSize);
      doc.setFont('helvetica', 'normal');
      continue;
    }

    // Ordered lists
    const orderedListMatch = line.match(/^(\d+)\.\s+(.+)$/);
    if (orderedListMatch) {
      const content = orderedListMatch[2];
      if (!isFirstLine) currentY += lineHeight * 0.5;
      
      doc.text(`${listCounter}.`, x, currentY);
      const splitLines = doc.splitTextToSize(content, options.maxWidth - 20);
      splitLines.forEach((splitLine: string, idx: number) => {
        doc.text(splitLine, x + 20, currentY + (idx * lineHeight));
      });
      
      currentY += splitLines.length * lineHeight;
      listCounter++;
      continue;
    }

    // Unordered lists
    const unorderedListMatch = line.match(/^[-*]\s+(.+)$/);
    if (unorderedListMatch) {
      const content = unorderedListMatch[1];
      if (!isFirstLine) currentY += lineHeight * 0.5;
      
      doc.text('•', x, currentY);
      const splitLines = doc.splitTextToSize(content, options.maxWidth - 20);
      splitLines.forEach((splitLine: string, idx: number) => {
        doc.text(splitLine, x + 20, currentY + (idx * lineHeight));
      });
      
      currentY += splitLines.length * lineHeight;
      continue;
    }

    // Regular paragraphs
    if (!isFirstLine) currentY += lineHeight;
    const splitLines = doc.splitTextToSize(line, options.maxWidth);
    splitLines.forEach((splitLine: string) => {
      doc.text(splitLine, x, currentY);
      currentY += lineHeight;
    });

    isFirstLine = false;
  }

  return currentY;
}