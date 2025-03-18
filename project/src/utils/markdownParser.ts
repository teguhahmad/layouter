import { useMemo } from 'react';

interface ParserState {
  currentHeadingLevel: number;
  currentListLevel: number;
  inOrderedList: boolean;
  inUnorderedList: boolean;
  orderedListCounter: number;
}

const initialParserState: ParserState = {
  currentHeadingLevel: 0,
  currentListLevel: 0,
  inOrderedList: false,
  inUnorderedList: false,
  orderedListCounter: 1,
};

function formatInlineMarkdown(text: string): string {
  let result = text;
  
  // Bold with ** (non-greedy match)
  result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  
  // Italic with * (non-greedy match)
  result = result.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  
  // Bold with __ (non-greedy match)
  result = result.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  
  // Italic with _ (non-greedy match)
  result = result.replace(/_([^_]+)_/g, '<em>$1</em>');
  
  // Code blocks
  result = result.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // Strikethrough (non-greedy match)
  result = result.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  
  // Links (non-greedy match)
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  
  return result;
}

function addIndent(level: number): string {
  return level > 0 ? ` style="margin-left: ${level * 20}px;"` : '';
}

function wrapText(text: string, maxWidth: number = 80): string {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  words.forEach(word => {
    if (currentLine.length + word.length + 1 <= maxWidth) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.join('\n');
}

export function parseMarkdown(markdown: string): string {
  if (!markdown) return '';
  
  // Replace horizontal rules (---) with single newline
  markdown = markdown.replace(/---/g, '\n');
  // Remove multiple consecutive newlines
  markdown = markdown.replace(/\n{2,}/g, '\n');
  
  const lines = markdown.split('\n');
  let html = '';
  let currentListItems: string[] = [];
  let listLevel = 0;
  let inOrderedList = false;
  let inUnorderedList = false;
  let orderedListCounter = 1;

  function closeList() {
    if (currentListItems.length > 0) {
      const listTag = inOrderedList ? 'ol' : 'ul';
      html += `<${listTag}${addIndent(listLevel)}>${currentListItems.join('')}</${listTag}>`;
      currentListItems = [];
      inOrderedList = false;
      inUnorderedList = false;
      orderedListCounter = 1;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    
    if (!line) {
      closeList();
      continue;
    }

    // Headers
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch) {
      closeList();
      const level = headerMatch[1].length;
      const content = formatInlineMarkdown(headerMatch[2]);
      html += `<h${level} style="white-space: pre-wrap; word-wrap: break-word;">${content}</h${level}>`;
      continue;
    }

    // Ordered lists
    const orderedListMatch = line.match(/^(\d+)\.\s+(.+)$/);
    if (orderedListMatch) {
      const content = formatInlineMarkdown(orderedListMatch[2]);
      if (!inOrderedList) {
        closeList();
        inOrderedList = true;
        listLevel = 0;
      }
      currentListItems.push(`<li style="white-space: pre-wrap; word-wrap: break-word;">${content}</li>`);
      continue;
    }

    // Unordered lists
    const unorderedListMatch = line.match(/^[-*]\s+(.+)$/);
    if (unorderedListMatch) {
      const content = formatInlineMarkdown(unorderedListMatch[1]);
      if (!inUnorderedList) {
        closeList();
        inUnorderedList = true;
        listLevel = 0;
      }
      currentListItems.push(`<li style="white-space: pre-wrap; word-wrap: break-word;">${content}</li>`);
      continue;
    }

    // Regular paragraphs
    closeList();
    const content = formatInlineMarkdown(line);
    html += `<p style="white-space: pre-wrap; word-wrap: break-word;">${content}</p>`;
  }

  closeList(); // Close any remaining lists
  return html;
}

export function useMarkdownParser(markdown: string): string {
  return useMemo(() => parseMarkdown(markdown), [markdown]);
}