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
  
  result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  result = result.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  result = result.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  result = result.replace(/_([^_]+)_/g, '<em>$1</em>');
  result = result.replace(/`([^`]+)`/g, '<code>$1</code>');
  result = result.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  
  return result;
}

function addIndent(level: number): string {
  return level > 0 ? ` style="margin-left: ${level * 0.25}em;"` : '';
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
  
  markdown = markdown.replace(/---/g, '\n');
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
    let line = lines[i];
    const indentLevel = Math.floor((line.match(/^\s*/)?.[0].length || 0) / 2);
    line = line.trim();
    
    if (!line) {
      closeList();
      continue;
    }

    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch) {
      closeList();
      const level = headerMatch[1].length;
      const content = formatInlineMarkdown(headerMatch[2]);
      html += `<h${level}${addIndent(indentLevel)}>${content}</h${level}>`;
      continue;
    }

    const orderedListMatch = line.match(/^(\d+)\.\s+(.+)$/);
    if (orderedListMatch) {
      const content = formatInlineMarkdown(orderedListMatch[2]);
      if (!inOrderedList) {
        closeList();
        inOrderedList = true;
        listLevel = indentLevel;
      }
      currentListItems.push(`<li${addIndent(1)}>${content}</li>`);
      continue;
    }

    const unorderedListMatch = line.match(/^[-*]\s+(.+)$/);
    if (unorderedListMatch) {
      const content = formatInlineMarkdown(unorderedListMatch[1]);
      if (!inUnorderedList) {
        closeList();
        inUnorderedList = true;
        listLevel = indentLevel;
      }
      currentListItems.push(`<li${addIndent(1)}>${content}</li>`);
      continue;
    }

    closeList();
    const content = formatInlineMarkdown(line);
    html += `<p${addIndent(indentLevel)} style="text-indent: 0.25em;">${content}</p>`;
  }

  closeList();
  return html;
}

export function useMarkdownParser(markdown: string): string {
  return useMemo(() => parseMarkdown(markdown), [markdown]);
}