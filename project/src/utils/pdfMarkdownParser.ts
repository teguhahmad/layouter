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
      const wordSegment = { text: word, style: segment.style };
      
      applyStyle(doc, segment.style, doc.getFontSize());
      const wordWidth = doc.getTextWidth(word);
      const spaceWidth = doc.getTextWidth(' ');
      
      if (lines[currentLine].length > 0) {
        currentLineWidth += spaceWidth;
      }

      if (currentLineWidth + wordWidth <= maxWidth) {
        if (lines[currentLine].length > 0) {
          lines[currentLine].push({ text: ' ', style: segment.style });
        }
        lines[currentLine].push(wordSegment);
        currentLineWidth += wordWidth;
      } else {
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
    lineHeight: number;
  }
): number {
  if (!text) return y;

  text = text.replace(/---/g, '\n');
  text = text.replace(/\n{2,}/g, '\n');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(options.fontSize);

  const lineHeight = options.fontSize * 0.352778 * options.lineHeight;
  let currentY = y;
  const textLines = text.split('\n');

  for (let i = 0; i < textLines.length; i++) {
    let line = textLines[i].trim();
    
    if (!line) {
      currentY += lineHeight;
      continue;
    }

    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const content = headerMatch[2];
      
      currentY += lineHeight;
      doc.setFontSize(options.fontSize * (2.5 - (level * 0.3)));
      doc.setFont('helvetica', 'bold');
      
      const segments = parseInlineMarkdown(content);
      const lines = splitTextToLines(doc, segments, options.maxWidth);
      
      lines.forEach((lineSegments, lineIndex) => {
        let xOffset = x;
        let totalWidth = 0;
        
        if (options.align === 'center' || options.align === 'right') {
          lineSegments.forEach(segment => {
            applyStyle(doc, segment.style, options.fontSize);
            totalWidth += doc.getTextWidth(segment.text);
          });
          
          if (options.align === 'center') {
            xOffset = x + (options.maxWidth - totalWidth) / 2;
          } else if (options.align === 'right') {
            xOffset = x + options.maxWidth - totalWidth;
          }
        }
        
        lineSegments.forEach(segment => {
          applyStyle(doc, segment.style, options.fontSize);
          doc.text(segment.text, xOffset, currentY);
          xOffset += doc.getTextWidth(segment.text);
        });
        
        if (lineIndex < lines.length - 1) {
          currentY += lineHeight;
        }
      });
      
      doc.setFontSize(options.fontSize);
      doc.setFont('helvetica', 'normal');
      continue;
    }

    const orderedListMatch = line.match(/^(\d+)\.\s+(.+)$/);
    if (orderedListMatch) {
      const content = orderedListMatch[2];
      const listNumber = orderedListMatch[1];
      
      currentY += lineHeight;
      doc.text(`${listNumber}.`, x, currentY);
      const segments = parseInlineMarkdown(content);
      const lines = splitTextToLines(doc, segments, options.maxWidth - 10);
      
      lines.forEach((lineSegments, lineIndex) => {
        let xOffset = x + 10;
        let totalWidth = 0;
        
        if (options.align === 'center' || options.align === 'right') {
          lineSegments.forEach(segment => {
            applyStyle(doc, segment.style, options.fontSize);
            totalWidth += doc.getTextWidth(segment.text);
          });
          
          if (options.align === 'center') {
            xOffset = x + 10 + (options.maxWidth - 10 - totalWidth) / 2;
          } else if (options.align === 'right') {
            xOffset = x + options.maxWidth - totalWidth;
          }
        }
        
        lineSegments.forEach(segment => {
          applyStyle(doc, segment.style, options.fontSize);
          doc.text(segment.text, xOffset, currentY);
          xOffset += doc.getTextWidth(segment.text);
        });
        
        if (lineIndex < lines.length - 1) {
          currentY += lineHeight;
        }
      });
      continue;
    }

    const unorderedListMatch = line.match(/^[-*]\s+(.+)$/);
    if (unorderedListMatch) {
      const content = unorderedListMatch[1];
      
      currentY += lineHeight;
      doc.text('•', x, currentY);
      const segments = parseInlineMarkdown(content);
      const lines = splitTextToLines(doc, segments, options.maxWidth - 10);
      
      lines.forEach((lineSegments, lineIndex) => {
        let xOffset = x + 10;
        let totalWidth = 0;
        
        if (options.align === 'center' || options.align === 'right') {
          lineSegments.forEach(segment => {
            applyStyle(doc, segment.style, options.fontSize);
            totalWidth += doc.getTextWidth(segment.text);
          });
          
          if (options.align === 'center') {
            xOffset = x + 10 + (options.maxWidth - 10 - totalWidth) / 2;
          } else if (options.align === 'right') {
            xOffset = x + options.maxWidth - totalWidth;
          }
        }
        
        lineSegments.forEach(segment => {
          applyStyle(doc, segment.style, options.fontSize);
          doc.text(segment.text, xOffset, currentY);
          xOffset += doc.getTextWidth(segment.text);
        });
        
        if (lineIndex < lines.length - 1) {
          currentY += lineHeight;
        }
      });
      continue;
    }

    currentY += lineHeight;
    const segments = parseInlineMarkdown(line);
    const lines = splitTextToLines(doc, segments, options.maxWidth);
    
    lines.forEach((lineSegments, lineIndex) => {
      let xOffset = x;
      let totalWidth = 0;
      
      if (options.align === 'center' || options.align === 'right') {
        lineSegments.forEach(segment => {
          applyStyle(doc, segment.style, options.fontSize);
          totalWidth += doc.getTextWidth(segment.text);
        });
        
        if (options.align === 'center') {
          xOffset = x + (options.maxWidth - totalWidth) / 2;
        } else if (options.align === 'right') {
          xOffset = x + options.maxWidth - totalWidth;
        }
      }
      
      lineSegments.forEach(segment => {
        applyStyle(doc, segment.style, options.fontSize);
        doc.text(segment.text, xOffset, currentY);
        xOffset += doc.getTextWidth(segment.text);
      });
      
      if (lineIndex < lines.length - 1) {
        currentY += lineHeight;
      }
    });
  }

  return currentY;
}