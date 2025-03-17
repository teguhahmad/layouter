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
  
  // Process code blocks first
  result = result.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // Bold with both ** and __
  result = result.replace(/(\*\*|__)(.*?)\1/g, '<strong>$2</strong>');
  
  // Italic with both * and _
  result = result.replace(/(\*|_)(.*?)\1/g, '<em>$2</em>');
  
  // Strikethrough
  result = result.replace(/~~(.*?)~~/g, '<del>$1</del>');
  
  // Links
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  
  return result;
}

function addIndent(level: number): string {
  return level > 0 ? ` style="margin-left: ${level * 20}px;"` : '';
}

export function parseMarkdown(markdown: string): string {
  if (!markdown) return '';
  
  const lines = markdown.split('\n');
  const state: ParserState = { ...initialParserState };
  let html = '';
  let currentList: string[] = [];
  let inCodeBlock = false;
  let codeBlockContent = '';

  function closeCurrentList() {
    if (state.inOrderedList) {
      html += `<ol${addIndent(state.currentListLevel - 1)}>${currentList.join('')}</ol>`;
    } else if (state.inUnorderedList) {
      html += `<ul${addIndent(state.currentListLevel - 1)}>${currentList.join('')}</ul>`;
    }
    currentList = [];
    state.inOrderedList = false;
    state.inUnorderedList = false;
    state.orderedListCounter = 1;
  }

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const originalIndent = line.length - line.trimLeft().length;
    line = line.trim();
    
    // Skip empty lines unless in code block
    if (!line && !inCodeBlock) {
      if (state.inOrderedList || state.inUnorderedList) {
        closeCurrentList();
      }
      continue;
    }

    // Handle code blocks
    if (line.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockContent = '';
        continue;
      } else {
        inCodeBlock = false;
        html += `<pre><code>${codeBlockContent.trim()}</code></pre>`;
        continue;
      }
    }

    if (inCodeBlock) {
      codeBlockContent += line + '\n';
      continue;
    }

    // Calculate indentation level
    const indentLevel = Math.floor(originalIndent / 2);

    // Horizontal rule
    if (line === '---' || line === '***' || line === '___') {
      if (state.inOrderedList || state.inUnorderedList) {
        closeCurrentList();
      }
      html += '<hr>';
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s(.+)/);
    if (headingMatch) {
      if (state.inOrderedList || state.inUnorderedList) {
        closeCurrentList();
      }
      const level = headingMatch[1].length;
      const text = formatInlineMarkdown(headingMatch[2]);
      html += `<h${level}${addIndent(indentLevel)}>${text}</h${level}>`;
      continue;
    }

    // Ordered list
    const orderedListMatch = line.match(/^(\d+)\.\s(.+)/);
    if (orderedListMatch) {
      const content = formatInlineMarkdown(orderedListMatch[2]);
      if (!state.inOrderedList) {
        if (state.inUnorderedList) {
          closeCurrentList();
        }
        state.inOrderedList = true;
        state.currentListLevel = indentLevel + 1;
      }
      currentList.push(`<li${addIndent(indentLevel)}>${content}</li>`);
      continue;
    }

    // Unordered list
    if (line.startsWith('- ') || line.startsWith('* ')) {
      const content = formatInlineMarkdown(line.slice(2));
      if (!state.inUnorderedList) {
        if (state.inOrderedList) {
          closeCurrentList();
        }
        state.inUnorderedList = true;
        state.currentListLevel = indentLevel + 1;
      }
      currentList.push(`<li${addIndent(indentLevel)}>${content}</li>`);
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      if (state.inOrderedList || state.inUnorderedList) {
        closeCurrentList();
      }
      const content = formatInlineMarkdown(line.slice(2));
      html += `<blockquote${addIndent(indentLevel)}>${content}</blockquote>`;
      continue;
    }

    // Regular paragraph
    if (state.inOrderedList || state.inUnorderedList) {
      closeCurrentList();
    }
    const content = formatInlineMarkdown(line);
    html += `<p${addIndent(indentLevel)}>${content}</p>`;
  }

  // Close any remaining lists
  if (state.inOrderedList || state.inUnorderedList) {
    closeCurrentList();
  }

  return html;
}

export function useMarkdownParser(markdown: string): string {
  return useMemo(() => parseMarkdown(markdown), [markdown]);
}