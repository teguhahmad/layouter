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
  if (isLastLine || segments.length <= 1) {
    // Don't justify last line or single-word lines
    let currentX = x;
    segments.forEach(segment => {
      applyStyle(doc, segment.style, doc.getFontSize(), doc.getFont().fontName);
      doc.text(segment.text, currentX, y);
      currentX += doc.getTextWidth(segment.text + (segment.text === ' ' ? '' : ' '));
    });
    return;
  }

  // Calculate total text width and number of spaces
  let totalTextWidth = 0;
  let numberOfSpaces = 0;
  segments.forEach(segment => {
    applyStyle(doc, segment.style, doc.getFontSize(), doc.getFont().fontName);
    totalTextWidth += doc.getTextWidth(segment.text);
    if (segment.text === ' ') numberOfSpaces++;
  });

  // Calculate additional space between words
  const remainingSpace = maxWidth - totalTextWidth;
  const extraSpacePerGap = numberOfSpaces > 0 ? remainingSpace / numberOfSpaces : 0;

  // Render text with justified spacing
  let currentX = x;
  segments.forEach((segment, index) => {
    applyStyle(doc, segment.style, doc.getFontSize(), doc.getFont().fontName);
    doc.text(segment.text, currentX, y);
    
    if (segment.text === ' ' && index < segments.length - 1) {
      currentX += doc.getTextWidth(' ') + extraSpacePerGap;
    } else {
      currentX += doc.getTextWidth(segment.text);
    }
  });
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
  let currentLineWords: TextSegment[] = [];
  
  const indentationWidth = baseIndentation * doc.getFontSize();
  const availableWidth = maxWidth - indentationWidth;
  const spaceWidth = doc.getTextWidth(' ');

  function commitCurrentLine() {
    if (currentLineWords.length > 0) {
      lines[currentLine] = [...currentLineWords];
      currentLine++;
      lines[currentLine] = [];
      currentLineWords = [];
      currentLineWidth = 0;
    }
  }

  function addWordToLine(wordSegment: TextSegment, width: number) {
    if (currentLineWords.length > 0) {
      currentLineWords.push({ text: ' ', style: wordSegment.style });
      currentLineWidth += spaceWidth;
    }
    currentLineWords.push(wordSegment);
    currentLineWidth += width;
  }

  function splitWordIfNeeded(word: string, style: TextStyle): TextSegment[] {
    const result: TextSegment[] = [];
    let currentPart = '';
    const chars = word.split('');
    
    for (let i = 0; i < chars.length; i++) {
      const testPart = currentPart + chars[i];
      applyStyle(doc, style, doc.getFontSize(), font);
      const testWidth = doc.getTextWidth(testPart);
      
      if (testWidth > availableWidth) {
        if (currentPart) {
          result.push({ text: currentPart, style });
          currentPart = chars[i];
        } else {
          currentPart = chars[i];
        }
      } else {
        currentPart += chars[i];
      }
    }
    
    if (currentPart) {
      result.push({ text: currentPart, style });
    }
    
    return result;
  }

  segments.forEach(segment => {
    const words = segment.text.split(' ');
    
    words.forEach((word) => {
      if (!word) return;
      
      const wordSegment = { 
        text: word, 
        style: { ...segment.style, indentation: baseIndentation }
      };
      
      applyStyle(doc, wordSegment.style, doc.getFontSize(), font);
      const wordWidth = doc.getTextWidth(word);
      
      // Check if word fits in current line
      if (currentLineWidth + (currentLineWords.length > 0 ? spaceWidth : 0) + wordWidth <= availableWidth) {
        addWordToLine(wordSegment, wordWidth);
      } else {
        // If current line has words, commit it and try to fit word in new line
        if (currentLineWords.length > 0) {
          commitCurrentLine();
          
          // Try to fit word in new line
          if (wordWidth <= availableWidth) {
            addWordToLine(wordSegment, wordWidth);
          } else {
            // Split word if it's too long for a single line
            const parts = splitWordIfNeeded(word, wordSegment.style);
            parts.forEach((part, index) => {
              if (index > 0) {
                commitCurrentLine();
              }
              applyStyle(doc, part.style, doc.getFontSize(), font);
              const partWidth = doc.getTextWidth(part.text);
              addWordToLine(part, partWidth);
            });
          }
        } else {
          // Current line is empty, must split word
          const parts = splitWordIfNeeded(word, wordSegment.style);
          parts.forEach((part, index) => {
            if (index > 0) {
              commitCurrentLine();
            }
            applyStyle(doc, part.style, doc.getFontSize(), font);
            const partWidth = doc.getTextWidth(part.text);
            addWordToLine(part, partWidth);
          });
        }
      }
    });
  });

  // Commit any remaining words
  if (currentLineWords.length > 0) {
    lines[currentLine] = [...currentLineWords];
  }

  // Remove empty lines
  return lines.filter(line => line.length > 0);
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