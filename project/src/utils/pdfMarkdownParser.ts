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

  // Split text into styled segments
  const segments: { text: string; style: PDFTextStyle }[] = [];
  let currentText = '';
  let currentStyle = {
    isBold: false,
    isItalic: false,
    isUnderline: false
  };

  // Helper function to add current text as segment
  const addCurrentSegment = () => {
    if (currentText) {
      segments.push({ text: currentText, style: { ...currentStyle } });
      currentText = '';
    }
  };

  // Parse text into segments
  let i = 0;
  while (i < text.length) {
    const remainingText = text.slice(i);
    let matched = false;

    // Check for markdown patterns
    const patterns = [
      { regex: /^\*\*(.*?)\*\*/, style: { isBold: true } },
      { regex: /^\*(.*?)\*/, style: { isItalic: true } },
      { regex: /^`(.*?)`/, style: { isUnderline: false } },
      { regex: /^\[(.*?)\]\((.*?)\)/, style: { isUnderline: true } }
    ];

    for (const pattern of patterns) {
      const match = remainingText.match(pattern.regex);
      if (match) {
        addCurrentSegment();
        segments.push({
          text: match[1],
          style: { ...currentStyle, ...pattern.style }
        });
        i += match[0].length;
        matched = true;
        break;
      }
    }

    if (!matched) {
      currentText += text[i];
      i++;
    }
  }

  addCurrentSegment();

  // Calculate line breaks and positioning
  let currentY = y;
  const lineHeight = options.fontSize * options.lineSpacing * 0.352778;
  let currentLine: { text: string; width: number; segments: typeof segments }[] = [];
  let currentLineWidth = 0;

  // Process segments into lines
  for (const segment of segments) {
    // Set font for width calculation
    const fontStyle = [];
    if (segment.style.isBold) fontStyle.push('bold');
    if (segment.style.isItalic) fontStyle.push('italic');
    doc.setFont(doc.getFont().fontName, fontStyle.join('') || 'normal');

    const words = segment.text.split(' ');
    for (const word of words) {
      const wordWidth = doc.getTextWidth(word + ' ');

      if (currentLineWidth + wordWidth > options.maxWidth) {
        // Render current line
        renderLine(currentLine, currentY);
        currentY += lineHeight;
        currentLine = [];
        currentLineWidth = 0;
      }

      currentLine.push({
        text: word + ' ',
        width: wordWidth,
        segments: [{ text: word + ' ', style: segment.style }]
      });
      currentLineWidth += wordWidth;
    }
  }

  // Render remaining line if any
  if (currentLine.length > 0) {
    renderLine(currentLine, currentY);
    currentY += lineHeight;
  }

  function renderLine(line: { text: string; width: number; segments: typeof segments }[], lineY: number) {
    let xOffset = x;

    // Calculate starting x position based on alignment
    if (options.align === 'center') {
      xOffset = x + (options.maxWidth - currentLineWidth) / 2;
    } else if (options.align === 'right') {
      xOffset = x + options.maxWidth - currentLineWidth;
    }

    // Render each segment in the line
    for (const item of line) {
      for (const segment of item.segments) {
        // Set font style
        const fontStyle = [];
        if (segment.style.isBold) fontStyle.push('bold');
        if (segment.style.isItalic) fontStyle.push('italic');
        doc.setFont(doc.getFont().fontName, fontStyle.join('') || 'normal');

        // Render text
        doc.text(segment.text, xOffset, lineY);

        // Add underline if needed
        if (segment.style.isUnderline) {
          const underlineY = lineY + options.fontSize * 0.1;
          doc.line(
            xOffset,
            underlineY,
            xOffset + doc.getTextWidth(segment.text),
            underlineY
          );
        }

        xOffset += doc.getTextWidth(segment.text);
      }
    }
  }

  // Reset font to normal
  doc.setFont(doc.getFont().fontName, 'normal');

  return currentY;
}