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
  
  // Process code blocks first to prevent interference with other patterns
  result = result.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // Bold with both ** and __ (non-greedy match)
  result = result.replace(/(\*\*|__)((?:(?!\1).)+)\1/g, '<strong>$2</strong>');
  
  // Italic with both * and _ (non-greedy match)
  result = result.replace(/(\*|_)((?:(?!\1).)+)\1/g, '<em>$2</em>');
  
  // Strikethrough (non-greedy match)
  result = result.replace(/~~((?:(?!~~).)+)~~/g, '<del>$1</del>');
  
  // Links (non-greedy match)
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  
  return result;
}

function addIndent(level: number): string {
  return level > 0 ? ` style="margin-left: ${level * 20}px;"` : '';
}

export function parseMarkdown(markdown: string): string {
  if (!markdown) return '';
  
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
      html += `<h${level}>${content}</h${level}>`;
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
      currentListItems.push(`<li>${content}</li>`);
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
      currentListItems.push(`<li>${content}</li>`);
      continue;
    }

    // Regular paragraphs
    closeList();
    const content = formatInlineMarkdown(line);
    html += `<p>${content}</p>`;
  }

  closeList(); // Close any remaining lists
  return html;
}

export function useMarkdownParser(markdown: string): string {
  return useMemo(() => parseMarkdown(markdown), [markdown]);
}