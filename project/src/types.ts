export type PaperSize = 'A4' | 'Letter' | 'Legal';

export type FontAlignment = 'left' | 'right' | 'center' | 'justify';

export type Chapter = {
  id: string;
  title: string;
  content: string;
  images: ChapterImage[];
  type: 'frontmatter' | 'chapter' | 'backmatter';
  pageNumber?: number;
  indentation: number;
  lineSpacing: number;
  subChapters: SubChapter[];
};

export type SubChapter = {
  id: string;
  title: string;
  content: string;
  pageNumber?: number;
};

export type ChapterImage = {
  id: string;
  url: string;
  caption: string;
  alignment: 'left' | 'center' | 'right';
  width: number; // percentage of page width
};

export type FontSettings = {
  family: string;
  size: number;
  alignment: FontAlignment;
  lineHeight: number;
};

export type EbookSettings = {
  title: string;
  author: string;
  description: string;
  coverImage: string | null;
  backCoverImage: string | null;
  paperSize: PaperSize;
  margins: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  fonts: {
    title: FontSettings;
    subtitle: FontSettings;
    paragraph: FontSettings;
    header: FontSettings;
    footer: FontSettings;
    frontmatterContent: FontSettings;
    chapterContent: FontSettings;
    subchapterContent: FontSettings;
    backmatterContent: FontSettings;
  };
  pageNumbering: {
    enabled: boolean;
    startFrom: number;
    position: 'top' | 'bottom';
    alignment: 'left' | 'center' | 'right';
    style: 'decimal' | 'roman' | 'none';
  };
  tableOfContents: {
    enabled: boolean;
    title: string;
    includeSubChapters: boolean;
  };
  header: {
    enabled: boolean;
    text: string;
    alternateEvenOdd: boolean;
  };
  footer: {
    enabled: boolean;
    text: string;
    alternateEvenOdd: boolean;
  };
};