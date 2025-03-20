import { jsPDF } from "jspdf";

interface TextStyle {
  bold: boolean;
  italic: boolean;
  heading: number | null;
  list: boolean;
  listType: 'ordered' | 'unordered' | null;
  listLevel: number;
  indentation: number;
}

interface TextSegment {
  text: string;
  style: TextStyle;
}

interface PDFMarkdownOptions {
  maxWidth: number;
  align?: 'left' | 'center' | 'right' | 'justify';
  fontSize: number;
  lineHeight: number;
  font: string;
}

function applyStyle(doc: jsPDF, style: TextStyle, baseFontSize: number, font: string) {
  let fontStyle = 'normal';
  if (style.bold && style.italic) fontStyle = 'bolditalic';
  else if (style.bold) fontStyle = 'bold';
  else if (style.italic) fontStyle = 'italic';
  doc.setFont(font, fontStyle);

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
    listLevel: 0,
    indentation: 0
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

function calculateIndentation(text: string): number {
  let indentation = 0;
  
  const baseIndent = Math.floor((text.match(/^\s*/)?.[0].length || 0) / 2) * 0.25;
  indentation += baseIndent;
  
  const listMatch = text.match(/^(\s*(?:[-*]|\d+\.)\s+)/);
  if (listMatch) {
    indentation += 0.25;
  } else if (baseIndent > 0) {
    indentation += 0.75;
  } else if (text.trim().length > 0) {
    indentation += 0.25;
  }
  
  return indentation;
}

function renderJustifiedLine(
  doc: jsPDF,
  segments: TextSegment[],
  x: number,
  y: number,
  maxWidth: number,
  isLastLine: boolean
) {
  // Jika ini baris terakhir atau hanya ada satu segmen, ratakan ke kiri
  if (isLastLine || segments.length <= 1) {
    let currentX = x;
    segments.forEach(segment => {
      applyStyle(doc, segment.style, doc.getFontSize(), doc.getFont().fontName);
      doc.text(segment.text, currentX, y);
      currentX += doc.getTextWidth(segment.text);
    });
    return;
  }

  // Hitung total lebar teks dan jumlah spasi
  let totalTextWidth = 0;
  let wordCount = 0;
  let spaceSegments: number[] = [];

  segments.forEach((segment, index) => {
    applyStyle(doc, segment.style, doc.getFontSize(), doc.getFont().fontName);
    if (segment.text === ' ') {
      spaceSegments.push(index);
    } else {
      totalTextWidth += doc.getTextWidth(segment.text);
      wordCount++;
    }
  });

  // Hitung spasi tambahan yang diperlukan
  const remainingSpace = Math.max(0, maxWidth - totalTextWidth);
  const numberOfGaps = Math.max(1, spaceSegments.length);
  const extraSpacePerGap = remainingSpace / numberOfGaps;

  // Pastikan spasi tidak terlalu besar
  const maxExtraSpace = doc.getTextWidth('    '); // 4 spasi sebagai batas maksimal
  const actualExtraSpace = Math.min(extraSpacePerGap, maxExtraSpace);

  // Render teks dengan spasi yang sudah disesuaikan
  let currentX = x;
  segments.forEach((segment, index) => {
    applyStyle(doc, segment.style, doc.getFontSize(), doc.getFont().fontName);
    
    if (segment.text === ' ') {
      currentX += actualExtraSpace;
    } else {
      doc.text(segment.text, currentX, y);
      currentX += doc.getTextWidth(segment.text);
    }
  });
}

function splitWordIfNeeded(word: string, style: TextStyle, doc: jsPDF, maxWidth: number): TextSegment[] {
  const result: TextSegment[] = [];
  let currentPart = '';
  
  // Ensure we're using the correct font settings
  applyStyle(doc, style, doc.getFontSize(), doc.getFont().fontName);
  
  // If the word is already short enough, return it as is
  if (doc.getTextWidth(word) <= maxWidth) {
    return [{ text: word, style: { ...style } }];
  }
  
  // Split the word character by character if necessary
  for (let i = 0; i < word.length; i++) {
    const char = word[i];
    const testPart = currentPart + char;
    const testWidth = doc.getTextWidth(testPart);
    
    // If adding this character would make it too wide
    if (testWidth > maxWidth * 0.95) { // Using 95% of max width as a safety margin
      if (currentPart.length >= 2) {
        // Add hyphen only if we have at least 2 characters
        result.push({ text: currentPart + '-', style: { ...style } });
        currentPart = char;
      } else if (currentPart.length > 0) {
        // If we have just one character, add it without hyphen
        result.push({ text: currentPart, style: { ...style } });
        currentPart = char;
      } else {
        // If we can't even fit one character, force split it
        result.push({ text: char, style: { ...style } });
        currentPart = '';
      }
    } else {
      currentPart += char;
    }
  }
  
  // Add any remaining characters
  if (currentPart.length > 0) {
    result.push({ text: currentPart, style: { ...style } });
  }
  
  return result;
}

function splitTextToLines(
  doc: jsPDF,
  segments: TextSegment[],
  maxWidth: number,
  baseIndentation: number = 0,
  font: string
): TextSegment[][] {
  const lines: TextSegment[][] = [[]];
  let currentLine = 0;
  let currentLineWidth = 0;
  let currentLineSegments: TextSegment[] = [];
  
  const indentationWidth = baseIndentation * doc.getFontSize();
  const availableWidth = maxWidth - indentationWidth;
  const spaceWidth = doc.getTextWidth(' ');
  
  function commitLine() {
    if (currentLineSegments.length > 0) {
      lines[currentLine] = [...currentLineSegments];
      currentLine++;
      lines[currentLine] = [];
      currentLineSegments = [];
      currentLineWidth = 0;
    }
  }
  
  segments.forEach(segment => {
    const words = segment.text.split(/\s+/);
    
    words.forEach((word, wordIndex) => {
      if (!word) return;
      
      applyStyle(doc, segment.style, doc.getFontSize(), font);
      const wordWidth = doc.getTextWidth(word);
      
      // Calculate total width including space if needed
      const totalWidth = currentLineWidth + 
        (currentLineSegments.length > 0 ? spaceWidth : 0) + 
        wordWidth;
      
      if (totalWidth <= availableWidth) {
        // Add space before word if not first word in line
        if (currentLineSegments.length > 0) {
          currentLineSegments.push({ text: ' ', style: segment.style });
          currentLineWidth += spaceWidth;
        }
        
        currentLineSegments.push({ text: word, style: segment.style });
        currentLineWidth += wordWidth;
      } else {
        // Word doesn't fit on current line
        if (wordWidth <= availableWidth) {
          // Word can fit on a new line
          commitLine();
          currentLineSegments.push({ text: word, style: segment.style });
          currentLineWidth = wordWidth;
        } else {
          // Word needs to be split
          if (currentLineSegments.length > 0) {
            commitLine();
          }
          
          const parts = splitWordIfNeeded(word, segment.style, doc, availableWidth);
          parts.forEach((part, index) => {
            if (index > 0) {
              commitLine();
            }
            
            currentLineSegments.push(part);
            currentLineWidth = doc.getTextWidth(part.text);
          });
        }
      }
    });
  });
  
  // Commit any remaining segments
  if (currentLineSegments.length > 0) {
    commitLine();
  }
  
  // Remove empty lines and verify each line fits within margins
  return lines
    .filter(line => line.length > 0)
    .map(line => {
      let lineWidth = 0;
      line.forEach(segment => {
        applyStyle(doc, segment.style, doc.getFontSize(), font);
        lineWidth += doc.getTextWidth(segment.text);
      });
      
      // If line is still too wide, force split it
      if (lineWidth > availableWidth) {
        const newLine: TextSegment[] = [];
        let currentWidth = 0;
        
        line.forEach(segment => {
          if (segment.text === ' ') {
            if (currentWidth + spaceWidth <= availableWidth) {
              newLine.push(segment);
              currentWidth += spaceWidth;
            }
            return;
          }
          
          const parts = splitWordIfNeeded(segment.text, segment.style, doc, availableWidth - currentWidth);
          parts.forEach(part => {
            if (currentWidth + doc.getTextWidth(part.text) <= availableWidth) {
              newLine.push(part);
              currentWidth += doc.getTextWidth(part.text);
            }
          });
        });
        
        return newLine;
      }
      
      return line;
    });
}

export function parsePDFMarkdown(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  options: PDFMarkdownOptions
): number {
  if (!text) return y;

  text = text.replace(/---/g, '\n');
  text = text.replace(/\n{2,}/g, '\n');

  doc.setFont(options.font, 'normal');
  doc.setFontSize(options.fontSize);

  const lineHeight = options.fontSize * 0.352778 * options.lineHeight;
  let currentY = y;
  const textLines = text.split('\n');

  const pageHeight = doc.internal.pageSize.getHeight();
  const marginBottom = 20;
  const maxY = pageHeight - marginBottom;

  for (let i = 0; i < textLines.length; i++) {
    let line = textLines[i];
    const baseIndentation = calculateIndentation(line);
    line = line.trim();
    
    if (!line) {
      currentY += lineHeight;
      continue;
    }

    if (currentY + lineHeight > maxY) {
      return currentY;
    }

    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const content = headerMatch[2];
      
      currentY += lineHeight;
      if (currentY > maxY) return currentY;
      
      doc.setFontSize(options.fontSize * (2.5 - (level * 0.3)));
      doc.setFont(options.font, 'bold');
      
      const segments = parseInlineMarkdown(content);
      const lines = splitTextToLines(doc, segments, options.maxWidth, baseIndentation, options.font);
      
      lines.forEach((lineSegments, lineIndex) => {
        if (currentY > maxY) return;
        
        let xOffset = x + (baseIndentation * options.fontSize);
        
        if (options.align === 'justify') {
          renderJustifiedLine(
            doc,
            lineSegments,
            xOffset,
            currentY,
            options.maxWidth - (baseIndentation * options.fontSize),
            lineIndex === lines.length - 1
          );
        } else {
          let totalWidth = 0;
          lineSegments.forEach(segment => {
            applyStyle(doc, segment.style, options.fontSize, options.font);
            totalWidth += doc.getTextWidth(segment.text);
          });
          
          if (options.align === 'center') {
            xOffset = x + (options.maxWidth - totalWidth) / 2;
          } else if (options.align === 'right') {
            xOffset = x + options.maxWidth - totalWidth;
          }
          
          lineSegments.forEach(segment => {
            applyStyle(doc, segment.style, options.fontSize, options.font);
            doc.text(segment.text, xOffset, currentY);
            xOffset += doc.getTextWidth(segment.text);
          });
        }
        
        if (lineIndex < lines.length - 1) {
          currentY += lineHeight;
        }
      });
      
      doc.setFontSize(options.fontSize);
      doc.setFont(options.font, 'normal');
      continue;
    }

    const orderedListMatch = line.match(/^(\d+)\.\s+(.+)$/);
    if (orderedListMatch) {
      const content = orderedListMatch[2];
      const listNumber = orderedListMatch[1];
      const listIndent = baseIndentation * options.fontSize;
      
      currentY += lineHeight;
      if (currentY > maxY) return currentY;
      
      doc.text(`${listNumber}.`, x + listIndent, currentY);
      const segments = parseInlineMarkdown(content);
      const lines = splitTextToLines(doc, segments, options.maxWidth - (listIndent + 5), baseIndentation, options.font);
      
      lines.forEach((lineSegments, lineIndex) => {
        if (currentY > maxY) return;
        
        let xOffset = x + listIndent + 5;
        
        if (options.align === 'justify') {
          renderJustifiedLine(
            doc,
            lineSegments,
            xOffset,
            currentY,
            options.maxWidth - (listIndent + 5),
            lineIndex === lines.length - 1
          );
        } else {
          let totalWidth = 0;
          lineSegments.forEach(segment => {
            applyStyle(doc, segment.style, options.fontSize, options.font);
            totalWidth += doc.getTextWidth(segment.text);
          });
          
          if (options.align === 'center') {
            xOffset = x + listIndent + 5 + (options.maxWidth - listIndent - 5 - totalWidth) / 2;
          } else if (options.align === 'right') {
            xOffset = x + options.maxWidth - totalWidth;
          }
          
          lineSegments.forEach(segment => {
            applyStyle(doc, segment.style, options.fontSize, options.font);
            doc.text(segment.text, xOffset, currentY);
            xOffset += doc.getTextWidth(segment.text);
          });
        }
        
        if (lineIndex < lines.length - 1) {
          currentY += lineHeight;
        }
      });
      continue;
    }

    const unorderedListMatch = line.match(/^[-*]\s+(.+)$/);
    if (unorderedListMatch) {
      const content = unorderedListMatch[1];
      const listIndent = baseIndentation * options.fontSize;
      
      currentY += lineHeight;
      if (currentY > maxY) return currentY;
      
      doc.text('•', x + listIndent, currentY);
      const segments = parseInlineMarkdown(content);
      const lines = splitTextToLines(doc, segments, options.maxWidth - (listIndent + 5), baseIndentation, options.font);
      
      lines.forEach((lineSegments, lineIndex) => {
        if (currentY > maxY) return;
        
        let xOffset = x + listIndent + 5;
        
        if (options.align === 'justify') {
          renderJustifiedLine(
            doc,
            lineSegments,
            xOffset,
            currentY,
            options.maxWidth - (listIndent + 5),
            lineIndex === lines.length - 1
          );
        } else {
          let totalWidth = 0;
          lineSegments.forEach(segment => {
            applyStyle(doc, segment.style, options.fontSize, options.font);
            totalWidth += doc.getTextWidth(segment.text);
          });
          
          if (options.align === 'center') {
            xOffset = x + listIndent + 5 + (options.maxWidth - listIndent - 5 - totalWidth) / 2;
          } else if (options.align === 'right') {
            xOffset = x + options.maxWidth - totalWidth;
          }
          
          lineSegments.forEach(segment => {
            applyStyle(doc, segment.style, options.fontSize, options.font);
            doc.text(segment.text, xOffset, currentY);
            xOffset += doc.getTextWidth(segment.text);
          });
        }
        
        if (lineIndex < lines.length - 1) {
          currentY += lineHeight;
        }
      });
      continue;
    }

    currentY += lineHeight;
    if (currentY > maxY) return currentY;
    
    const segments = parseInlineMarkdown(line);
    const lines = splitTextToLines(doc, segments, options.maxWidth, baseIndentation, options.font);
    
    lines.forEach((lineSegments, lineIndex) => {
      if (currentY > maxY) return;
      
      let xOffset = x + (baseIndentation * options.fontSize);
      
      if (options.align === 'justify') {
        renderJustifiedLine(
          doc,
          lineSegments,
          xOffset,
          currentY,
          options.maxWidth - (baseIndentation * options.fontSize),
          lineIndex === lines.length - 1
        );
      } else {
        let totalWidth = 0;
        lineSegments.forEach(segment => {
          applyStyle(doc, segment.style, options.fontSize, options.font);
          totalWidth += doc.getTextWidth(segment.text);
        });
        
        if (options.align === 'center') {
          xOffset = x + (options.maxWidth - totalWidth) / 2;
        } else if (options.align === 'right') {
          xOffset = x + options.maxWidth - totalWidth;
        }
        
        lineSegments.forEach(segment => {
          applyStyle(doc, segment.style, options.fontSize, options.font);
          doc.text(segment.text, xOffset, currentY);
          xOffset += doc.getTextWidth(segment.text);
        });
      }
      
      if (lineIndex < lines.length - 1) {
        currentY += lineHeight;
      }
    });
  }

  return currentY;
}