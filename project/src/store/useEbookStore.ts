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
    title: 'Table of Contents',
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
    set((state) => ({
      chapters: [
        ...state.chapters,
        {
          id: crypto.randomUUID(),
          title: chapter.title || 'New Chapter',
          content: chapter.content || '',
          images: chapter.images || [],
          type: chapter.type || 'chapter',
          indentation: chapter.indentation || 0,
          lineSpacing: chapter.lineSpacing || 1.5,
          subChapters: chapter.subChapters || [],
        },
      ],
    })),
  updateChapter: (id, chapter) =>
    set((state) => ({
      chapters: state.chapters.map((ch) =>
        ch.id === id ? { ...ch, ...chapter } : ch
      ),
    })),
  removeChapter: (id) =>
    set((state) => ({
      chapters: state.chapters.filter((ch) => ch.id !== id),
    })),
  reorderChapters: (chapters) => {
    set({ chapters });
    get().calculatePageNumbers();
  },
  updateSettings: (settings) =>
    set((state) => ({
      settings: { ...state.settings, ...settings },
    })),
  calculatePageNumbers: () => {
    const { chapters, settings } = get();
    let romanPageCount = 1; // Start with i
    let arabicPageCount = 1; // Start with 1

    // Calculate approximate characters per page
    const pageWidth = settings.paperSize === 'A4' ? 210 : 216; // mm
    const pageHeight = settings.paperSize === 'A4' ? 297 : 279; // mm
    const contentWidth = pageWidth - (settings.margins.left + settings.margins.right) * 10;
    const contentHeight = pageHeight - (settings.margins.top + settings.margins.bottom) * 10;
    const charsPerLine = Math.floor(contentWidth / (settings.fonts.paragraph.size * 0.352778));
    const linesPerPage = Math.floor(contentHeight / (settings.fonts.paragraph.size * settings.fonts.paragraph.lineHeight * 0.352778));
    const charsPerPage = charsPerLine * linesPerPage;

    const updatedChapters = chapters.map((chapter) => {
      const isPreContent = chapter.type === 'frontmatter';
      let pageCount = isPreContent ? romanPageCount : arabicPageCount;

      // Calculate pages for chapter content
      const contentLength = chapter.content.length;
      const imageCount = chapter.images.length;
      const contentPages = Math.ceil(contentLength / charsPerPage);
      const imagePages = Math.ceil(imageCount / 2); // Assume 2 images per page
      
      // Add pages for chapter title and spacing
      const totalPages = contentPages + imagePages + 1;

      // Update page number
      const pageNumber = pageCount;

      // Update counters
      if (isPreContent) {
        romanPageCount += totalPages;
      } else {
        arabicPageCount += totalPages;
      }

      // Calculate subchapter page numbers
      const subChapters = chapter.subChapters.map((sub) => {
        const subContentLength = sub.content.length;
        const subPages = Math.ceil(subContentLength / charsPerPage);
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
        pageNumber,
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