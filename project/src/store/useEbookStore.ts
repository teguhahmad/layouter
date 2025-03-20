import { create } from 'zustand';
import type { Chapter, EbookSettings } from '../types';

interface EbookStore {
  chapters: Chapter[];
  settings: EbookSettings;
  addChapter: (chapter: Partial<Chapter>) => void;
  updateChapter: (id: string, chapter: Partial<Chapter>) => void;
  removeChapter: (id: string) => void;
  reorderChapters: (chapters: Chapter[]) => void;
  updateSettings: (settings: Partial<EbookSettings>) => void;
  calculatePageNumbers: () => void;
  addSubChapter: (chapterId: string, title: string) => void;
  removeSubChapter: (chapterId: string, subChapterId: string) => void;
}

const defaultSettings: EbookSettings = {
  title: '',
  author: '',
  description: '',
  coverImage: null,
  backCoverImage: null,
  paperSize: 'A4',
  margins: {
    top: 2.54,
    bottom: 2.54,
    left: 2.54,
    right: 2.54,
  },
  fonts: {
    title: {
      family: 'Helvetica',
      size: 24,
      alignment: 'center',
      lineHeight: 1.5,
    },
    subtitle: {
      family: 'Helvetica',
      size: 18,
      alignment: 'left',
      lineHeight: 1.5,
    },
    paragraph: {
      family: 'Helvetica',
      size: 12,
      alignment: 'justify',
      lineHeight: 1.5,
    },
    header: {
      family: 'Helvetica',
      size: 10,
      alignment: 'center',
      lineHeight: 1.2,
    },
    footer: {
      family: 'Helvetica',
      size: 10,
      alignment: 'center',
      lineHeight: 1.2,
    },
    frontmatterContent: {
      family: 'Helvetica',
      size: 12,
      alignment: 'justify',
      lineHeight: 1.5,
    },
    chapterContent: {
      family: 'Helvetica',
      size: 12,
      alignment: 'justify',
      lineHeight: 1.5,
    },
    subchapterContent: {
      family: 'Helvetica',
      size: 12,
      alignment: 'justify',
      lineHeight: 1.5,
    },
    backmatterContent: {
      family: 'Helvetica',
      size: 12,
      alignment: 'justify',
      lineHeight: 1.5,
    },
  },
  pageNumbering: {
    enabled: true,
    startFrom: 1,
    position: 'bottom',
    alignment: 'center',
    style: 'decimal',
  },
  tableOfContents: {
    enabled: true,
    title: 'Daftar Isi',
    includeSubChapters: true,
  },
  header: {
    enabled: false,
    text: '',
    alternateEvenOdd: false,
  },
  footer: {
    enabled: false,
    text: '',
    alternateEvenOdd: false,
  },
};

export const useEbookStore = create<EbookStore>((set, get) => ({
  chapters: [],
  settings: defaultSettings,
  addChapter: (chapter) =>
    set((state) => {
      const newChapter = {
        id: crypto.randomUUID(),
        title: chapter.title || 'New Chapter',
        content: chapter.content || '',
        images: chapter.images || [],
        type: chapter.type || 'chapter',
        indentation: chapter.indentation || 0,
        lineSpacing: chapter.lineSpacing || 1.5,
        subChapters: chapter.subChapters || [],
      };

      // Insert chapter in the correct position based on type
      const updatedChapters = [...state.chapters];
      let insertIndex = 0;

      if (newChapter.type === 'frontmatter') {
        // Find the last frontmatter chapter
        while (insertIndex < updatedChapters.length && updatedChapters[insertIndex].type === 'frontmatter') {
          insertIndex++;
        }
      } else if (newChapter.type === 'chapter') {
        // Skip frontmatter chapters
        while (insertIndex < updatedChapters.length && updatedChapters[insertIndex].type === 'frontmatter') {
          insertIndex++;
        }
        // Skip existing chapters
        while (insertIndex < updatedChapters.length && updatedChapters[insertIndex].type === 'chapter') {
          insertIndex++;
        }
      } else { // backmatter
        insertIndex = updatedChapters.length;
      }

      updatedChapters.splice(insertIndex, 0, newChapter);

      // Update chapter numbers
      let chapterNumber = 1;
      const finalChapters = updatedChapters.map(ch => {
        if (ch.type === 'chapter') {
          return { ...ch, pageNumber: chapterNumber++ };
        }
        return ch;
      });

      return { chapters: finalChapters };
    }),
  updateChapter: (id, chapter) =>
    set((state) => {
      const updatedChapters = state.chapters.map((ch) =>
        ch.id === id ? { ...ch, ...chapter } : ch
      );

      // Maintain chapter numbers
      let chapterNumber = 1;
      const finalChapters = updatedChapters.map(ch => {
        if (ch.type === 'chapter') {
          return { ...ch, pageNumber: chapterNumber++ };
        }
        return ch;
      });

      return { chapters: finalChapters };
    }),
  removeChapter: (id) =>
    set((state) => {
      const filteredChapters = state.chapters.filter((ch) => ch.id !== id);
      
      // Update chapter numbers after removal
      let chapterNumber = 1;
      const finalChapters = filteredChapters.map(ch => {
        if (ch.type === 'chapter') {
          return { ...ch, pageNumber: chapterNumber++ };
        }
        return ch;
      });

      return { chapters: finalChapters };
    }),
  reorderChapters: (chapters) => {
    // Ensure proper ordering by type
    const frontmatterChapters = chapters.filter(ch => ch.type === 'frontmatter');
    const mainChapters = chapters.filter(ch => ch.type === 'chapter');
    const backmatterChapters = chapters.filter(ch => ch.type === 'backmatter');

    // Update chapter numbers
    let chapterNumber = 1;
    const numberedMainChapters = mainChapters.map(ch => ({
      ...ch,
      pageNumber: chapterNumber++
    }));

    // Combine all sections in the correct order
    const orderedChapters = [
      ...frontmatterChapters,
      ...numberedMainChapters,
      ...backmatterChapters
    ];
    
    set({ chapters: orderedChapters });
    get().calculatePageNumbers();
  },
  updateSettings: (settings) =>
    set((state) => ({
      settings: { ...state.settings, ...settings },
    })),
  calculatePageNumbers: () => {
    const { chapters, settings } = get();
    let romanPageCount = 1;
    let arabicPageCount = 1;

    // Calculate approximate characters per page
    const pageWidth = settings.paperSize === 'A4' ? 210 : 216; // mm
    const pageHeight = settings.paperSize === 'A4' ? 297 : 279; // mm
    const contentWidth = pageWidth - (settings.margins.left + settings.margins.right) * 10;
    const contentHeight = pageHeight - (settings.margins.top + settings.margins.bottom) * 10;
    const charsPerLine = Math.floor(contentWidth / (settings.fonts.paragraph.size * 0.352778));
    const linesPerPage = Math.floor(contentHeight / (settings.fonts.paragraph.size * settings.fonts.paragraph.lineHeight * 0.352778));
    const charsPerPage = charsPerLine * linesPerPage;

    // Add cover page if exists
    if (settings.coverImage) {
      arabicPageCount++;
    }

    // Add title page
    arabicPageCount++;

    const updatedChapters = chapters.map((chapter) => {
      const isPreContent = chapter.type === 'frontmatter';
      let pageCount = isPreContent ? romanPageCount : arabicPageCount;

      // Each chapter starts on a new page
      if (isPreContent) {
        romanPageCount++;
      } else {
        arabicPageCount++;
      }

      // Calculate content pages
      const contentLength = chapter.content.length;
      const contentPages = Math.ceil(contentLength / charsPerPage);

      // Calculate image pages
      const imagePages = chapter.images.reduce((total, image) => {
        // Large images (>50% width) take a full page
        if (image.width > 50) {
          return total + 1;
        }
        // Smaller images can be 2 per page
        return total + 0.5;
      }, 0);

      // Round up total image pages
      const totalImagePages = Math.ceil(imagePages);

      // Add pages for chapter content and images
      const totalPages = Math.max(1, contentPages + totalImagePages);

      if (isPreContent) {
        romanPageCount += totalPages;
      } else {
        arabicPageCount += totalPages;
      }

      // Calculate subchapter pages
      const subChapters = chapter.subChapters.map((sub) => {
        const subContentLength = sub.content.length;
        const subPages = Math.max(1, Math.ceil(subContentLength / charsPerPage));
        const subPageNumber = isPreContent ? romanPageCount : arabicPageCount;

        if (isPreContent) {
          romanPageCount += subPages;
        } else {
          arabicPageCount += subPages;
        }

        return {
          ...sub,
          pageNumber: subPageNumber
        };
      });

      return {
        ...chapter,
        pageNumber: pageCount,
        subChapters
      };
    });

    set({ chapters: updatedChapters });
  },
  addSubChapter: (chapterId, title) => {
    set((state) => ({
      chapters: state.chapters.map((ch) =>
        ch.id === chapterId
          ? {
              ...ch,
              subChapters: [
                ...ch.subChapters,
                {
                  id: crypto.randomUUID(),
                  title,
                  content: '',
                },
              ],
            }
          : ch
      ),
    }));
    get().calculatePageNumbers();
  },
  removeSubChapter: (chapterId, subChapterId) => {
    set((state) => ({
      chapters: state.chapters.map((ch) =>
        ch.id === chapterId
          ? {
              ...ch,
              subChapters: ch.subChapters.filter((sub) => sub.id !== subChapterId),
            }
          : ch
      ),
    }));
    get().calculatePageNumbers();
  },
}));