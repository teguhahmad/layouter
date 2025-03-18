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
  const lines = text.split('\n');
  let listCounter = 1;
  let isFirstLine = true;
  let inOrderedList = false;
  let orderedListItems: string[] = [];

  // First pass: collect ordered list items if they exist
  for (const line of lines) {
    const orderedListMatch = line.trim().match(/^(\d+)\.\s+(.+)$/);
    if (orderedListMatch) {
      orderedListItems.push(orderedListMatch[2]);
      inOrderedList = true;
    } else if (inOrderedList) {
      // If we find a non-list line after list items, process the list
      if (orderedListItems.length > 0) {
        currentY = processOrderedList(doc, orderedListItems, x, currentY, options);
        orderedListItems = [];
        inOrderedList = false;
      }
    }
  }

  // If we have remaining list items at the end, process them
  if (orderedListItems.length > 0) {
    return processOrderedList(doc, orderedListItems, x, currentY, options);
  }

  // Process non-list content
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Handle horizontal rule
    if (line.match(/^[-*_]{3,}$/)) {
      if (!isFirstLine) {
        currentY += lineHeight;
      }
      continue;
    }

    if (!line) {
      if (!isFirstLine) {
        currentY += lineHeight;
      }
      continue;
    }

    const { segments, style } = parseLine(line, listCounter);
    if (style.listType === 'ordered') listCounter++;

    let effectiveLineHeight = lineHeight;
    if (style.heading) {
      effectiveLineHeight *= 1.5;
    }

    // Adjust list indentation
    let effectiveX = x;
    const listIndent = 15;
    if (style.list) {
      effectiveX += listIndent;
    }

    const textLines = splitIntoLines(doc, segments, options.maxWidth - (effectiveX - x));

    for (const textLine of textLines) {
      if (currentY + effectiveLineHeight > doc.internal.pageSize.getHeight() - 20) {
        doc.addPage();
        currentY = 20;
        isFirstLine = true;
      }

      if (style.list && textLine === textLines[0]) {
        const markerX = effectiveX - 10;
        if (style.listType === 'unordered') {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(options.fontSize);
          doc.text('•', markerX, currentY);
        }
      }

      currentY = renderLine(doc, textLine, effectiveX, currentY, {
        ...options,
        maxWidth: options.maxWidth - (effectiveX - x),
        align: style.heading ? 'left' : (style.list ? 'left' : options.align)
      }, options.fontSize);

      currentY += effectiveLineHeight;
    }

    if (style.heading) {
      currentY += lineHeight * 0.5;
    }

    isFirstLine = false;
  }

  return currentY;
}

function processOrderedList(
  doc: jsPDF,
  items: string[],
  x: number,
  y: number,
  options: {
    maxWidth: number;
    align?: 'left' | 'center' | 'right' | 'justify';
    fontSize: number;
    lineSpacing: number;
  }
): number {
  let currentY = y;
  const lineHeight = options.fontSize * 0.352778 * options.lineSpacing;
  const listIndent = 15;
  const effectiveX = x + listIndent;

  items.forEach((item, index) => {
    const number = index + 1;
    const segments = processTextFormatting(item);
    const textLines = splitIntoLines(doc, segments, options.maxWidth - listIndent);

    // Draw list number
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(options.fontSize);
    doc.text(`${number}.`, x, currentY);

    // Draw list item content
    for (const textLine of textLines) {
      if (currentY + lineHeight > doc.internal.pageSize.getHeight() - 20) {
        doc.addPage();
        currentY = 20;
      }

      currentY = renderLine(doc, textLine, effectiveX, currentY, {
        ...options,
        maxWidth: options.maxWidth - listIndent,
        align: 'left'
      }, options.fontSize);

      currentY += lineHeight;
    }
  });

  return currentY;
}

function parseLine(line: string, listCounter: number): { segments: TextSegment[], style: TextStyle } {
  const defaultStyle: TextStyle = {
    bold: false,
    italic: false,
    heading: null,
    list: false,
    listType: null,
    listLevel: 0
  };

  const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
  if (headingMatch) {
    // Process formatting within heading text
    const headingLevel = headingMatch[1].length;
    const headingText = headingMatch[2];
    const processedSegments = processTextFormatting(headingText);
    
    // Apply heading style to all segments
    const headingSegments = processedSegments.map(segment => ({
      ...segment,
      style: {
        ...segment.style,
        heading: headingLevel,
        bold: true
      }
    }));

    return {
      segments: headingSegments,
      style: { ...defaultStyle, heading: headingLevel, bold: true }
    };
  }

  const ulMatch = line.match(/^(\s*[-*])\s+(.+)$/);
  if (ulMatch) {
    return {
      segments: processTextFormatting(ulMatch[2]),
      style: { ...defaultStyle, list: true, listType: 'unordered', listLevel: 0 }
    };
  }

  const olMatch = line.match(/^(\s*\d+\.)\s+(.+)$/);
  if (olMatch) {
    return {
      segments: processTextFormatting(olMatch[2]),
      style: { ...defaultStyle, list: true, listType: 'ordered', listLevel: 0 }
    };
  }

  return {
    segments: processTextFormatting(line),
    style: defaultStyle
  };
}

function processTextFormatting(text: string): TextSegment[] {
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
      if (text[i + 1] === text[i]) {
        if (currentText) {
          segments.push({ text: currentText, style: { ...currentStyle } });
        }
        currentText = '';
        currentStyle.bold = !currentStyle.bold;
        i += 2;
        if (!currentStyle.bold && i < text.length && text[i] !== ' ') {
          currentText = ' ';
        }
        continue;
      } else {
        if (currentText) {
          segments.push({ text: currentText, style: { ...currentStyle } });
        }
        currentText = '';
        currentStyle.italic = !currentStyle.italic;
        i++;
        if (!currentStyle.italic && i < text.length && text[i] !== ' ') {
          currentText = ' ';
        }
        continue;
      }
    }
    currentText += text[i];
    i++;
  }

  if (currentText) {
    segments.push({ text: currentText, style: { ...currentStyle } });
  }

  return segments;
}

function splitIntoLines(doc: jsPDF, segments: TextSegment[], maxWidth: number): TextSegment[][] {
  const lines: TextSegment[][] = [];
  let currentLine: TextSegment[] = [];
  let currentWidth = 0;

  for (const segment of segments) {
    const words = segment.text.split(' ').filter(w => w.length > 0);

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      applyStyle(doc, segment.style, doc.getFontSize());
      const wordWidth = doc.getTextWidth(word);
      const spaceWidth = doc.getTextWidth(' ');

      if (currentWidth + wordWidth + spaceWidth > maxWidth && currentLine.length > 0) {
        lines.push(currentLine);
        currentLine = [];
        currentWidth = 0;
      }

      if (currentLine.length === 0) {
        currentLine.push({
          text: word,
          style: segment.style
        });
        currentWidth = wordWidth;
      } else {
        const lastSegment = currentLine[currentLine.length - 1];
        if (lastSegment.style.bold === segment.style.bold &&
            lastSegment.style.italic === segment.style.italic) {
          lastSegment.text += ' ' + word;
        } else {
          currentLine.push({
            text: ' ' + word,
            style: segment.style
          });
        }
        currentWidth += spaceWidth + wordWidth;
      }
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  return lines;
}

function renderLine(
  doc: jsPDF,
  segments: TextSegment[],
  x: number,
  y: number,
  options: {
    maxWidth: number;
    align?: 'left' | 'center' | 'right' | 'justify';
    fontSize: number;
    lineSpacing: number;
  },
  baseFontSize: number
): number {
  let totalWidth = 0;
  for (const segment of segments) {
    applyStyle(doc, segment.style, baseFontSize);
    totalWidth += doc.getTextWidth(segment.text);
  }

  let startX = x;
  if (options.align === 'center') {
    startX = x + (options.maxWidth - totalWidth) / 2;
  } else if (options.align === 'right') {
    startX = x + options.maxWidth - totalWidth;
  }

  let currentX = startX;
  segments.forEach((segment) => {
    applyStyle(doc, segment.style, baseFontSize);
    doc.text(segment.text, currentX, y);
    currentX += doc.getTextWidth(segment.text);
  });

  return y;
}