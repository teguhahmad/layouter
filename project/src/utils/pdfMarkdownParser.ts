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

  // Add Roboto font from Google Fonts
  doc.addFont('https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxKKTU1Kg.woff2', 'Roboto', 'normal');
  doc.addFont('https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmEU9fBBc4.woff2', 'Roboto', 'bold');
  doc.addFont('https://fonts.gstatic.com/s/roboto/v30/KFOkCnqEu92Fr1Mu51xFIzIFKw.woff2', 'Roboto', 'italic');
  doc.setFont('Roboto');
  doc.setFontSize(options.fontSize);

  const segments = parseMarkdownToSegments(text);
  let currentY = y;
  const lineHeight = options.fontSize * options.lineSpacing;
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
      const wordWidth = doc.getTextWidth(textToAdd.trim()) + (isLastWord ? 0 : doc.getTextWidth(' '));

      if (currentLineWidth + wordWidth > options.maxWidth && !currentLine.length) {
        // Handle very long words that exceed maxWidth
        const splitChars = word.split('');
        let tempWord = '';
        let tempWidth = 0;

        for (const char of splitChars) {
          const charWidth = doc.getTextWidth(char);
          if (tempWidth + charWidth > options.maxWidth) {
            lines.push([{ text: tempWord, style: segment.style }]);
            tempWord = char;
            tempWidth = charWidth;
          } else {
            tempWord += char;
            tempWidth += charWidth;
          }
        }
        if (tempWord) lines.push([{ text: tempWord, style: segment.style }]);
        continue;
      }

      if (currentLineWidth + wordWidth > options.maxWidth) {
        lines.push(currentLine);
        currentLine = [];
        currentLineWidth = 0;
      }

      currentLine.push({ text: textToAdd, style: segment.style });
      currentLineWidth += wordWidth;
    }
  }

  if (currentLine.length) lines.push(currentLine);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isLastLine = i === lines.length - 1;
    currentY = renderLine(doc, line, x, currentY, options, isLastLine);
    currentY += lineHeight;
  }

  doc.setFont('Roboto', 'normal');
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
      const plainTextMatch = remaining.match(/^[^*`[\]]+/);
      if (plainTextMatch) {
        segments.push({
          text: plainTextMatch[0],
          style: { isBold: false, isItalic: false, isUnderline: false },
        });
        currentIndex += plainTextMatch[0].length;
        matched = true;
      }
    }

    if (!matched) currentIndex++;
  }

  return segments;
}

function setFontStyle(doc: jsPDF, style: PDFTextStyle) {
  const fontStyle = `${style.isBold ? 'bold' : ''}${style.isItalic ? 'italic' : ''}`;
  doc.setFont('Roboto', fontStyle || 'normal');
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
    const extraSpace = options.maxWidth - totalWidth;
    const spaceWidth = extraSpace / totalSpaces;

    for (const segment of line) {
      setFontStyle(doc, segment.style);
      doc.text(segment.text, xPos, y);

      if (segment.style.isUnderline) {
        const textWidth = doc.getTextWidth(segment.text.trim());
        const underlineOffset = options.fontSize * 0.05; // Dynamic offset
        doc.setLineWidth(0.5)
          .line(
            xPos,
            y + underlineOffset,
            xPos + textWidth,
            y + underlineOffset
          );
      }

      const spacesInSegment = (segment.text.match(/ /g) || []).length;
      xPos += doc.getTextWidth(segment.text.trim()) + (spacesInSegment * spaceWidth);
    }

    return y;
  }

  for (const segment of line) {
    setFontStyle(doc, segment.style);
    doc.text(segment.text, xPos, y);

    if (segment.style.isUnderline) {
      const textWidth = doc.getTextWidth(segment.text.trim());
      const underlineOffset = options.fontSize * 0.05; // Dynamic offset
      doc.setLineWidth(0.5)
        .line(
          xPos,
          y + underlineOffset,
          xPos + textWidth,
          y + underlineOffset
        );
    }

    xPos += doc.getTextWidth(segment.text.trim());
  }

  return y;
}