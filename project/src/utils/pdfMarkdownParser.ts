import { jsPDF } from "jspdf";

interface PDFTextStyle {
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
}

interface TextSegment {
  text: string;
  style: PDFTextStyle;
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
  if (!text || typeof text !== 'string') return y;

  // Use built-in fonts instead of loading from Google Fonts
  doc.setFont('helvetica');
  doc.setFontSize(options.fontSize);

  const segments = parseMarkdownToSegments(text);
  let currentY = y;
  const lineHeight = options.fontSize * 0.352778 * options.lineSpacing; // Convert pt to mm
  let lines: TextSegment[][] = [];
  let currentLine: TextSegment[] = [];
  let currentLineWidth = 0;

  for (const segment of segments) {
    const words = segment.text.split(' ');

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const isLastWord = i === words.length - 1;
      const textToAdd = isLastWord ? word : `${word} `;
      
      setFontStyle(doc, segment.style);
      const wordWidth = doc.getTextWidth(textToAdd);

      if (currentLineWidth + wordWidth > options.maxWidth && currentLine.length > 0) {
        lines.push(currentLine);
        currentLine = [];
        currentLineWidth = 0;
      }

      if (currentLineWidth + wordWidth > options.maxWidth && !currentLine.length) {
        // Handle very long words that exceed maxWidth
        const splitChars = word.split('');
        let tempWord = '';
        let tempWidth = 0;

        for (const char of splitChars) {
          const charWidth = doc.getTextWidth(char);
          if (tempWidth + charWidth > options.maxWidth) {
            if (tempWord) {
              lines.push([{ text: tempWord, style: segment.style }]);
            }
            tempWord = char;
            tempWidth = charWidth;
          } else {
            tempWord += char;
            tempWidth += charWidth;
          }
        }
        if (tempWord) {
          currentLine = [{ text: tempWord, style: segment.style }];
          currentLineWidth = tempWidth;
        }
        continue;
      }

      currentLine.push({ text: textToAdd, style: segment.style });
      currentLineWidth += wordWidth;
    }
  }

  if (currentLine.length) {
    lines.push(currentLine);
  }

  // Calculate total height to ensure we don't exceed page bounds
  const totalHeight = lines.length * lineHeight;
  const pageHeight = doc.internal.pageSize.getHeight();
  const bottomMargin = 20; // 20mm bottom margin

  if (currentY + totalHeight > pageHeight - bottomMargin) {
    doc.addPage();
    currentY = options.fontSize; // Reset to top of new page with small margin
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isLastLine = i === lines.length - 1;
    currentY = renderLine(doc, line, x, currentY, options, isLastLine);
    
    if (i < lines.length - 1) { // Don't add extra space after last line
      currentY += lineHeight;
    }
  }

  doc.setFont('helvetica', 'normal');
  return currentY;
}

function parseMarkdownToSegments(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let currentIndex = 0;

  while (currentIndex < text.length) {
    const remaining = text.slice(currentIndex);
    let matched = false;

    // Bold italic (**_text_**)
    const boldItalicMatch = remaining.match(/^\*\*_(.*?)_\*\*/);
    if (boldItalicMatch) {
      segments.push({
        text: boldItalicMatch[1],
        style: { isBold: true, isItalic: true, isUnderline: false },
      });
      currentIndex += boldItalicMatch[0].length;
      matched = true;
      continue;
    }

    // Bold (**text**)
    const boldMatch = remaining.match(/^\*\*(.*?)\*\*/);
    if (boldMatch) {
      segments.push({
        text: boldMatch[1],
        style: { isBold: true, isItalic: false, isUnderline: false },
      });
      currentIndex += boldMatch[0].length;
      matched = true;
      continue;
    }

    // Italic (*text*)
    const italicMatch = remaining.match(/^\*(.*?)\*/);
    if (italicMatch) {
      segments.push({
        text: italicMatch[1],
        style: { isBold: false, isItalic: true, isUnderline: false },
      });
      currentIndex += italicMatch[0].length;
      matched = true;
      continue;
    }

    // Underline [text](url)
    const linkMatch = remaining.match(/^\[(.*?)\]\((.*?)\)/);
    if (linkMatch) {
      segments.push({
        text: linkMatch[1],
        style: { isBold: false, isItalic: false, isUnderline: true },
      });
      currentIndex += linkMatch[0].length;
      matched = true;
      continue;
    }

    if (!matched) {
      // Handle plain text, including spaces
      const plainTextMatch = remaining.match(/^[^*\[\]`]+/);
      if (plainTextMatch) {
        segments.push({
          text: plainTextMatch[0],
          style: { isBold: false, isItalic: false, isUnderline: false },
        });
        currentIndex += plainTextMatch[0].length;
      } else {
        // Handle single character if no match found
        segments.push({
          text: remaining[0],
          style: { isBold: false, isItalic: false, isUnderline: false },
        });
        currentIndex++;
      }
    }
  }

  return segments;
}

function setFontStyle(doc: jsPDF, style: PDFTextStyle) {
  let fontStyle = 'normal';
  if (style.isBold && style.isItalic) {
    fontStyle = 'bolditalic';
  } else if (style.isBold) {
    fontStyle = 'bold';
  } else if (style.isItalic) {
    fontStyle = 'italic';
  }
  doc.setFont('helvetica', fontStyle);
}

function renderLine(
  doc: jsPDF,
  line: TextSegment[],
  x: number,
  y: number,
  options: {
    maxWidth: number;
    align?: 'left' | 'center' | 'right' | 'justify';
    fontSize: number;
    lineSpacing: number;
  },
  isLastLine: boolean
): number {
  let totalWidth = 0;
  let totalSpaces = 0;

  for (const segment of line) {
    setFontStyle(doc, segment.style);
    totalWidth += doc.getTextWidth(segment.text.trim());
    totalSpaces += (segment.text.match(/ /g) || []).length;
  }

  let xPos = x;
  const align = options.align || 'left';

  if (align === 'center') {
    xPos = x + (options.maxWidth - totalWidth) / 2;
  } else if (align === 'right') {
    xPos = x + options.maxWidth - totalWidth;
  } else if (align === 'justify' && !isLastLine && totalSpaces > 0) {
    const extraSpace = (options.maxWidth - totalWidth) / totalSpaces;

    for (const segment of line) {
      setFontStyle(doc, segment.style);
      const words = segment.text.split(' ');
      
      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        doc.text(word, xPos, y);
        
        if (segment.style.isUnderline) {
          const wordWidth = doc.getTextWidth(word);
          const underlineOffset = options.fontSize * 0.05;
          doc.setLineWidth(0.5)
            .line(xPos, y + underlineOffset, xPos + wordWidth, y + underlineOffset);
        }
        
        if (i < words.length - 1) {
          xPos += doc.getTextWidth(word) + extraSpace;
        } else {
          xPos += doc.getTextWidth(word);
        }
      }
    }
    return y;
  }

  for (const segment of line) {
    setFontStyle(doc, segment.style);
    doc.text(segment.text, xPos, y);

    if (segment.style.isUnderline) {
      const textWidth = doc.getTextWidth(segment.text.trim());
      const underlineOffset = options.fontSize * 0.05;
      doc.setLineWidth(0.5)
        .line(xPos, y + underlineOffset, xPos + textWidth, y + underlineOffset);
    }

    xPos += doc.getTextWidth(segment.text);
  }

  return y;
}