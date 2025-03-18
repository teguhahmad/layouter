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

function parseInlineMarkdown(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let currentText = '';
  let currentStyle: TextStyle = {
    bold: false,
    italic: false,
    heading: null,
    list: false,
    listType: null,
    listLevel: 0
  };

  let i = 0;
  while (i < text.length) {
    if (text[i] === '*' || text[i] === '_') {
      const marker = text[i];
      const isDouble = text[i + 1] === marker;

      if (currentText) {
        segments.push({ text: currentText, style: { ...currentStyle } });
        currentText = '';
      }

      if (isDouble) {
        currentStyle.bold = !currentStyle.bold;
        i += 2;
      } else {
        currentStyle.italic = !currentStyle.italic;
        i++;
      }
    } else {
      currentText += text[i];
      i++;
    }
  }

  if (currentText) {
    segments.push({ text: currentText, style: { ...currentStyle } });
  }

  return segments;
}

function splitTextToLines(doc: jsPDF, segments: TextSegment[], maxWidth: number): TextSegment[][] {
  const lines: TextSegment[][] = [[]];
  let currentLine = 0;
  let currentLineWidth = 0;

  segments.forEach(segment => {
    const words = segment.text.split(' ');
    
    words.forEach((word, wordIndex) => {
      // Add the style to the current word
      const wordSegment = { text: word, style: segment.style };
      
      // Calculate word width with proper styling
      applyStyle(doc, segment.style, doc.getFontSize());
      const wordWidth = doc.getTextWidth(word);
      const spaceWidth = doc.getTextWidth(' ');
      
      // If this is not the first word, add space width
      if (lines[currentLine].length > 0) {
        currentLineWidth += spaceWidth;
      }

      // Check if word fits on current line
      if (currentLineWidth + wordWidth <= maxWidth) {
        // Add word to current line
        if (lines[currentLine].length > 0) {
          // Add space before word if not first word
          lines[currentLine].push({ text: ' ', style: segment.style });
        }
        lines[currentLine].push(wordSegment);
        currentLineWidth += wordWidth;
      } else {
        // Start new line
        currentLine++;
        lines[currentLine] = [wordSegment];
        currentLineWidth = wordWidth;
      }
    });
  });

  return lines;
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

  // Replace triple dashes with single newline
  text = text.replace(/---/g, '\n');
  // Remove multiple consecutive newlines
  text = text.replace(/\n{2,}/g, '\n');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(options.fontSize);

  const lineHeight = options.fontSize * 0.352778 * options.lineSpacing;
  let currentY = y;
  const textLines = text.split('\n');
  let listCounter = 1;
  let isFirstLine = true;

  for (let i = 0; i < textLines.length; i++) {
    let line = textLines[i].trim();
    
    if (!line) {
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
      
      const segments = parseInlineMarkdown(content);
      const lines = splitTextToLines(doc, segments, options.maxWidth);
      
      lines.forEach(lineSegments => {
        let xOffset = x;
        lineSegments.forEach(segment => {
          applyStyle(doc, segment.style, options.fontSize);
          const textWidth = doc.getTextWidth(segment.text);
          doc.text(segment.text, xOffset, currentY);
          xOffset += textWidth;
        });
        currentY += lineHeight;
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
      const segments = parseInlineMarkdown(content);
      const lines = splitTextToLines(doc, segments, options.maxWidth - 10);
      
      lines.forEach((lineSegments, lineIndex) => {
        let xOffset = x + 10;
        lineSegments.forEach(segment => {
          applyStyle(doc, segment.style, options.fontSize);
          const textWidth = doc.getTextWidth(segment.text);
          doc.text(segment.text, xOffset, currentY);
          xOffset += textWidth;
        });
        if (lineIndex < lines.length - 1) {
          currentY += lineHeight;
        }
      });
      
      currentY += lineHeight;
      listCounter++;
      continue;
    }

    // Unordered lists
    const unorderedListMatch = line.match(/^[-*]\s+(.+)$/);
    if (unorderedListMatch) {
      const content = unorderedListMatch[1];
      if (!isFirstLine) currentY += lineHeight * 0.5;
      
      doc.text('•', x, currentY);
      const segments = parseInlineMarkdown(content);
      const lines = splitTextToLines(doc, segments, options.maxWidth - 10);
      
      lines.forEach((lineSegments, lineIndex) => {
        let xOffset = x + 10;
        lineSegments.forEach(segment => {
          applyStyle(doc, segment.style, options.fontSize);
          const textWidth = doc.getTextWidth(segment.text);
          doc.text(segment.text, xOffset, currentY);
          xOffset += textWidth;
        });
        if (lineIndex < lines.length - 1) {
          currentY += lineHeight;
        }
      });
      
      currentY += lineHeight;
      continue;
    }

    // Regular paragraphs
    if (!isFirstLine) currentY += lineHeight;
    const segments = parseInlineMarkdown(line);
    const lines = splitTextToLines(doc, segments, options.maxWidth);
    
    lines.forEach((lineSegments, lineIndex) => {
      let xOffset = x;
      lineSegments.forEach(segment => {
        applyStyle(doc, segment.style, options.fontSize);
        const textWidth = doc.getTextWidth(segment.text);
        doc.text(segment.text, xOffset, currentY);
        xOffset += textWidth;
      });
      if (lineIndex < lines.length - 1) {
        currentY += lineHeight;
      }
    });
    
    currentY += lineHeight;
    isFirstLine = false;
  }

  return currentY;
}