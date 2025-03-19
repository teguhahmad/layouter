import React from 'react';
import { useEbookStore } from '../store/useEbookStore';
import { jsPDF } from 'jspdf';
import { PDFDocument } from 'pdf-lib';
import { parsePDFMarkdown } from '../utils/pdfMarkdownParser';
import { parseMarkdown } from '../utils/markdownParser';

export function Preview() {
  const { settings, chapters } = useEbookStore();
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);

  const loadImage = async (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = url;
    });
  };

  const generateCoverPDF = async (imageUrl: string): Promise<Uint8Array> => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: settings.paperSize,
        compress: true
      });

      const img = await loadImage(imageUrl);
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      
      const imgRatio = img.width / img.height;
      const pageRatio = pageWidth / pageHeight;
      
      let drawWidth = pageWidth;
      let drawHeight = pageHeight;
      
      if (imgRatio > pageRatio) {
        drawHeight = pageWidth / imgRatio;
      } else {
        drawWidth = pageHeight * imgRatio;
      }
      
      const x = (pageWidth - drawWidth) / 2;
      const y = (pageHeight - drawHeight) / 2;
      
      doc.addImage(img, 'JPEG', x, y, drawWidth, drawHeight);
      return new Uint8Array(doc.output('arraybuffer'));
    } catch (err) {
      console.error('Error generating cover PDF:', err);
      throw err;
    }
  };

  function romanize(num: number): string {
    if (!num || num <= 0) return '';
    
    const romanNumerals = [
      { value: 1000, numeral: 'M' },
      { value: 900, numeral: 'CM' },
      { value: 500, numeral: 'D' },
      { value: 400, numeral: 'CD' },
      { value: 100, numeral: 'C' },
      { value: 90, numeral: 'XC' },
      { value: 50, numeral: 'L' },
      { value: 40, numeral: 'XL' },
      { value: 10, numeral: 'X' },
      { value: 9, numeral: 'IX' },
      { value: 5, numeral: 'V' },
      { value: 4, numeral: 'IV' },
      { value: 1, numeral: 'I' }
    ];
    
    let result = '';
    let remaining = num;
    
    for (const { value, numeral } of romanNumerals) {
      while (remaining >= value) {
        result += numeral;
        remaining -= value;
      }
    }
    
    return result.toLowerCase();
  }

  const generatePdf = async () => {
    try {
      setIsGenerating(true);
      setError(null);

      const doc = new jsPDF({
        unit: 'mm',
        format: settings.paperSize,
        orientation: 'portrait',
        compress: true
      });

      const imagePromises: Promise<void>[] = [];
      chapters.forEach(chapter => {
        chapter.images.forEach(image => {
          imagePromises.push(loadImage(image.url).then());
        });
      });
      await Promise.all(imagePromises);

      doc.setFont('Helvetica');
      doc.setR2L(false);

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const marginLeft = settings.margins.left * 10;
      const marginRight = settings.margins.right * 10;
      const marginTop = settings.margins.top * 10;
      const marginBottom = settings.margins.bottom * 10;
      const contentWidth = pageWidth - marginLeft - marginRight;

      let romanPageCount = 1;
      let arabicPageCount = 1;
      let currentY = marginTop;

      const addPageNumber = (isRoman: boolean, skipNumber = false) => {
        if (settings.pageNumbering.enabled && !skipNumber) {
          const pageNum = isRoman 
            ? romanize(romanPageCount)
            : arabicPageCount.toString();
          
          const x = settings.pageNumbering.alignment === 'center' 
            ? pageWidth / 2
            : settings.pageNumbering.alignment === 'right'
              ? pageWidth - marginRight
              : marginLeft;
          
          const y = settings.pageNumbering.position === 'top'
            ? marginTop - 5
            : pageHeight - (marginBottom / 2);

          doc.setFont(settings.fonts.footer.family);
          doc.setFontSize(settings.fonts.footer.size);
          doc.text(pageNum, x, y, { align: settings.pageNumbering.alignment });
          doc.setFont(settings.fonts.paragraph.family);
          doc.setFontSize(settings.fonts.paragraph.size);
        }
      };

      doc.addPage();
      doc.setFont(settings.fonts.title.family);
      doc.setFontSize(settings.fonts.title.size);
      const titleY = pageHeight / 2 - (settings.fonts.title.size * settings.fonts.title.lineHeight);
      doc.text(settings.title || 'Untitled', pageWidth / 2, titleY, { align: 'center' });
      
      doc.setFont(settings.fonts.subtitle.family);
      doc.setFontSize(settings.fonts.subtitle.size);
      const subtitleY = pageHeight / 2 + (settings.fonts.subtitle.size * settings.fonts.subtitle.lineHeight);
      doc.text(settings.author || '', pageWidth / 2, subtitleY, { align: 'center' });

      romanPageCount++;
      doc.addPage();
      currentY = marginTop;

      const frontmatterChapters = chapters.filter(ch => ch.type === 'frontmatter');
      for (const chapter of frontmatterChapters) {
        doc.setFont(settings.fonts.subtitle.family);
        doc.setFontSize(settings.fonts.subtitle.size);
        doc.text(chapter.title, pageWidth / 2, currentY, { align: 'center' });

        currentY += settings.fonts.subtitle.lineHeight * settings.fonts.subtitle.size * 0.352778;
        doc.setFont(settings.fonts.paragraph.family);
        doc.setFontSize(settings.fonts.paragraph.size);

        const paragraphs = chapter.content.split('\n\n').filter(p => p.trim());
        for (const paragraph of paragraphs) {
          if (currentY > pageHeight - marginBottom - 20) {
            addPageNumber(true);
            romanPageCount++;
            doc.addPage();
            currentY = marginTop;
          }

          currentY = parsePDFMarkdown(doc, paragraph, marginLeft, currentY, {
            maxWidth: contentWidth,
            align: settings.fonts.paragraph.alignment,
            fontSize: settings.fonts.paragraph.size,
            lineHeight: settings.fonts.paragraph.lineHeight
          });
        }

        addPageNumber(true);
        romanPageCount++;
        doc.addPage();
        currentY = marginTop;
      }

      if (settings.tableOfContents.enabled) {
        doc.setFont(settings.fonts.subtitle.family);
        doc.setFontSize(settings.fonts.subtitle.size);
        doc.text(settings.tableOfContents.title, pageWidth / 2, currentY, { align: 'center' });

        doc.setFont(settings.fonts.paragraph.family);
        doc.setFontSize(settings.fonts.paragraph.size);
        currentY += settings.fonts.subtitle.lineHeight * settings.fonts.subtitle.size * 0.352778;

        const mainChapters = chapters.filter(ch => ch.type === 'chapter');
        const backmatterChapters = chapters.filter(ch => ch.type === 'backmatter');

        for (const chapter of [...mainChapters, ...backmatterChapters]) {
          if (currentY > pageHeight - marginBottom - 20) {
            addPageNumber(true);
            romanPageCount++;
            doc.addPage();
            currentY = marginTop;
          }

          const prefix = chapter.type === 'chapter' ? `${chapter.pageNumber}. ` : '';
          doc.text(`${prefix}${chapter.title}`, marginLeft, currentY);
          
          const pageNum = chapter.type === 'chapter' 
            ? String(chapter.pageNumber || arabicPageCount)
            : String(chapter.pageNumber || arabicPageCount);
            
          doc.text(pageNum, pageWidth - marginRight, currentY, { align: 'right' });
          currentY += settings.fonts.paragraph.lineHeight * settings.fonts.paragraph.size * 0.352778;

          if (chapter.subChapters.length > 0) {
            for (const sub of chapter.subChapters) {
              if (currentY > pageHeight - marginBottom - 20) {
                addPageNumber(true);
                romanPageCount++;
                doc.addPage();
                currentY = marginTop;
              }

              doc.text(`  ${sub.title}`, marginLeft + 10, currentY);
              doc.text(String(sub.pageNumber || arabicPageCount), pageWidth - marginRight, currentY, { align: 'right' });
              currentY += settings.fonts.paragraph.lineHeight * settings.fonts.paragraph.size * 0.352778;
            }
          }
        }

        addPageNumber(true);
        romanPageCount++;
        doc.addPage();
        currentY = marginTop;
      }

      const mainChapters = chapters.filter(ch => ch.type === 'chapter');
      for (const chapter of mainChapters) {
        doc.setFont(settings.fonts.title.family);
        doc.setFontSize(settings.fonts.title.size);
        
        const chapterTitle = `Bab ${chapter.pageNumber}\n${chapter.title}`;
        const titleLines = doc.splitTextToSize(chapterTitle, contentWidth);
        const titleHeight = titleLines.length * settings.fonts.title.size * settings.fonts.title.lineHeight;
        const titleY = (pageHeight - titleHeight) / 2;
        
        doc.text(chapterTitle, pageWidth / 2, titleY, { 
          align: 'center',
          maxWidth: contentWidth
        });
        
        arabicPageCount++;
        doc.addPage();
        currentY = marginTop;

        doc.setFont(settings.fonts.paragraph.family);
        doc.setFontSize(settings.fonts.paragraph.size);

        const paragraphs = chapter.content.split('\n\n').filter(p => p.trim());
        for (const paragraph of paragraphs) {
          if (currentY > pageHeight - marginBottom - 20) {
            addPageNumber(false);
            arabicPageCount++;
            doc.addPage();
            currentY = marginTop;
          }

          currentY = parsePDFMarkdown(doc, paragraph, marginLeft + (chapter.indentation * 10), currentY, {
            maxWidth: contentWidth,
            align: settings.fonts.paragraph.alignment,
            fontSize: settings.fonts.paragraph.size,
            lineHeight: settings.fonts.paragraph.lineHeight
          });
        }

        for (const image of chapter.images) {
          if (currentY > pageHeight - marginBottom - 40) {
            addPageNumber(false);
            arabicPageCount++;
            doc.addPage();
            currentY = marginTop;
          }

          const imgWidth = (contentWidth * image.width) / 100;
          const img = await loadImage(image.url);
          const imgHeight = (imgWidth * img.height) / img.width;

          let x = marginLeft;
          if (image.alignment === 'center') {
            x = (pageWidth - imgWidth) / 2;
          } else if (image.alignment === 'right') {
            x = pageWidth - marginRight - imgWidth;
          }

          doc.addImage(img, 'JPEG', x, currentY, imgWidth, imgHeight);
          currentY += imgHeight + settings.fonts.paragraph.lineHeight * settings.fonts.paragraph.size * 0.352778;

          if (image.caption) {
            doc.setFontSize(settings.fonts.paragraph.size * 0.8);
            doc.text(image.caption, pageWidth / 2, currentY, { align: 'center' });
            currentY += settings.fonts.paragraph.lineHeight * settings.fonts.paragraph.size * 0.352778;
          }
        }

        for (const subChapter of chapter.subChapters) {
          if (currentY > pageHeight - marginBottom - 20) {
            addPageNumber(false);
            arabicPageCount++;
            doc.addPage();
            currentY = marginTop;
          }

          doc.setFont(settings.fonts.subtitle.family);
          doc.setFontSize(settings.fonts.subtitle.size * 0.8);
          currentY += settings.fonts.subtitle.lineHeight * settings.fonts.subtitle.size * 0.352778;
          doc.text(subChapter.title, marginLeft, currentY);

          doc.setFont(settings.fonts.paragraph.family);
          doc.setFontSize(settings.fonts.paragraph.size);
          currentY += settings.fonts.paragraph.lineHeight * settings.fonts.paragraph.size * 0.352778;

          const subParagraphs = subChapter.content.split('\n\n').filter(p => p.trim());
          for (const paragraph of subParagraphs) {
            if (currentY > pageHeight - marginBottom - 20) {
              addPageNumber(false);
              arabicPageCount++;
              doc.addPage();
              currentY = marginTop;
            }

            currentY = parsePDFMarkdown(doc, paragraph, marginLeft + (chapter.indentation * 10), currentY, {
              maxWidth: contentWidth,
              align: settings.fonts.paragraph.alignment,
              fontSize: settings.fonts.paragraph.size,
              lineHeight: settings.fonts.paragraph.lineHeight
            });
          }
        }

        addPageNumber(false);
        arabicPageCount++;
        doc.addPage();
        currentY = marginTop;
      }

      const backmatterChapters = chapters.filter(ch => ch.type === 'backmatter');
      for (const chapter of backmatterChapters) {
        doc.setFont(settings.fonts.subtitle.family);
        doc.setFontSize(settings.fonts.subtitle.size);
        doc.text(chapter.title, pageWidth / 2, currentY, { align: 'center' });

        currentY += settings.fonts.subtitle.lineHeight * settings.fonts.subtitle.size * 0.352778;
        doc.setFont(settings.fonts.paragraph.family);
        doc.setFontSize(settings.fonts.paragraph.size);

        const paragraphs = chapter.content.split('\n\n').filter(p => p.trim());
        for (const paragraph of paragraphs) {
          if (currentY > pageHeight - marginBottom - 20) {
            addPageNumber(false);
            arabicPageCount++;
            doc.addPage();
            currentY = marginTop;
          }

          currentY = parsePDFMarkdown(doc, paragraph, marginLeft, currentY, {
            maxWidth: contentWidth,
            align: settings.fonts.paragraph.alignment,
            fontSize: settings.fonts.paragraph.size,
            lineHeight: settings.fonts.paragraph.lineHeight
          });
        }

        if (backmatterChapters.indexOf(chapter) < backmatterChapters.length - 1) {
          addPageNumber(false);
          arabicPageCount++;
          doc.addPage();
          currentY = marginTop;
        }
      }

      const contentPdfBytes = doc.output('arraybuffer');

      let coverPdfBytes: Uint8Array | null = null;
      if (settings.coverImage) {
        try {
          coverPdfBytes = await generateCoverPDF(settings.coverImage);
        } catch (err) {
          console.error('Error generating cover PDF:', err);
        }
      }

      let backCoverPdfBytes: Uint8Array | null = null;
      if (settings.backCoverImage) {
        try {
          backCoverPdfBytes = await generateCoverPDF(settings.backCoverImage);
        } catch (err) {
          console.error('Error generating back cover PDF:', err);
        }
      }

      const mergedPdf = await PDFDocument.create();
      
      if (coverPdfBytes) {
        const coverDoc = await PDFDocument.load(coverPdfBytes);
        const coverPages = await mergedPdf.copyPages(coverDoc, coverDoc.getPageIndices());
        coverPages.forEach(page => mergedPdf.addPage(page));
      }

      const contentDoc = await PDFDocument.load(contentPdfBytes);
      const contentPages = await mergedPdf.copyPages(contentDoc, contentDoc.getPageIndices());
      contentPages.forEach(page => mergedPdf.addPage(page));

      if (backCoverPdfBytes) {
        const backCoverDoc = await PDFDocument.load(backCoverPdfBytes);
        const backCoverPages = await mergedPdf.copyPages(backCoverDoc, backCoverDoc.getPageIndices());
        backCoverPages.forEach(page => mergedPdf.addPage(page));
      }

      const mergedPdfBytes = await mergedPdf.save();
      const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${settings.title || 'ebook'}.pdf`;
      link.click();
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Error generating PDF:', error);
      setError('Failed to generate PDF. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <button
        id="generate-pdf-btn"
        onClick={generatePdf}
        disabled={isGenerating}
        className="hidden"
      />

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded-md mb-4">
          {error}
        </div>
      )}

      {isGenerating && (
        <div className="bg-blue-50 border border-blue-200 text-blue-600 px-4 py-2 rounded-md mb-4">
          Generating PDF, please wait...
        </div>
      )}

      <div className="flex-1 overflow-auto">
        <div ref={contentRef} className="p-8 max-w-[800px] mx-auto">
          <div className="mb-16 text-center">
            <h1 style={{
              fontSize: `${settings.fonts.title.size}pt`,
              fontFamily: settings.fonts.title.family,
              textAlign: settings.fonts.title.alignment,
              lineHeight: settings.fonts.title.lineHeight,
            }}>
              {settings.title}
            </h1>
            <p style={{
              fontSize: `${settings.fonts.subtitle.size}pt`,
              fontFamily: settings.fonts.subtitle.family,
              textAlign: settings.fonts.subtitle.alignment,
              lineHeight: settings.fonts.subtitle.lineHeight,
            }}>
              {settings.author}
            </p>
          </div>

          {settings.tableOfContents.enabled && (
            <div className="mb-16">
              <h2 style={{
                fontSize: `${settings.fonts.subtitle.size}pt`,
                fontFamily: settings.fonts.subtitle.family,
                textAlign: 'center',
                lineHeight: settings.fonts.subtitle.lineHeight,
              }}>
                {settings.tableOfContents.title}
              </h2>
              <div className="space-y-2">
                {chapters.map((chapter, index) => (
                  <div key={chapter.id}>
                    <div className="flex items-center">
                      <span className="mr-2">{chapter.type === 'chapter' ? `${index + 1}.` : ''}</span>
                      <span className="flex-1">{chapter.title}</span>
                      <span className="ml-2">
                        {chapter.type === 'frontmatter' 
                          ? romanize(chapter.pageNumber || index + 1)
                          : chapter.pageNumber}
                      </span>
                    </div>
                    {chapter.subChapters.map((sub, subIndex) => (
                      <div key={sub.id} className="flex items-center ml-8 mt-1">
                        <span className="flex-1">{sub.title}</span>
                        <span className="ml-2">
                          {chapter.type === 'frontmatter'
                            ? romanize(sub.pageNumber || index + subIndex + 2)
                            : sub.pageNumber}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {chapters.map((chapter) => (
            <div key={chapter.id} className="mb-16">
              {chapter.type === 'chapter' ? (
                <div className="mb-8 text-center">
                  <h2 style={{
                    fontSize: `${settings.fonts.title.size}pt`,
                    fontFamily: settings.fonts.title.family,
                    lineHeight: settings.fonts.title.lineHeight,
                  }}>
                    Bab {chapter.pageNumber}
                  </h2>
                  <h3 style={{
                    fontSize: `${settings.fonts.subtitle.size}pt`,
                    fontFamily: settings.fonts.subtitle.family,
                    lineHeight: settings.fonts.subtitle.lineHeight,
                  }}>
                    {chapter.title}
                  </h3>
                </div>
              ) : (
                <h2 style={{
                  fontSize: `${settings.fonts.subtitle.size}pt`,
                  fontFamily: settings.fonts.subtitle.family,
                  textAlign: 'center',
                  lineHeight: settings.fonts.subtitle.lineHeight,
                }}>
                  {chapter.title}
                </h2>
              )}

              <div style={{
                fontSize: `${settings.fonts.paragraph.size}pt`,
                fontFamily: settings.fonts.paragraph.family,
                textAlign: settings.fonts.paragraph.alignment as any,
                lineHeight: settings.fonts.paragraph.lineHeight,
              }}>
                {chapter.content.split('\n\n').map((paragraph, idx) => (
                  <p
                    key={idx}
                    style={{
                      textIndent: `${chapter.indentation}em`,
                    }}
                    dangerouslySetInnerHTML={{ __html: parseMarkdown(paragraph) }}
                  />
                ))}
              </div>

              {chapter.images.map((image) => (
                <div
                  key={image.id}
                  style={{ textAlign: image.alignment }}
                >
                  <img
                    src={image.url}
                    alt={image.caption}
                    style={{ width: `${image.width}%`, margin: '0 auto' }}
                  />
                  {image.caption && (
                    <p style={{
                      fontSize: `${settings.fonts.paragraph.size * 0.8}pt`,
                      textAlign: 'center',
                      lineHeight: settings.fonts.paragraph.lineHeight,
                    }}>
                      {image.caption}
                    </p>
                  )}
                </div>
              ))}

              {chapter.subChapters.map((subChapter) => (
                <div key={subChapter.id}>
                  <h3 style={{
                    fontSize: `${settings.fonts.subtitle.size * 0.8}pt`,
                    fontFamily: settings.fonts.subtitle.family,
                    lineHeight: settings.fonts.subtitle.lineHeight,
                  }}>
                    {subChapter.title}
                  </h3>
                  <div style={{
                    fontSize: `${settings.fonts.paragraph.size}pt`,
                    fontFamily: settings.fonts.paragraph.family,
                    textAlign: settings.fonts.paragraph.alignment as any,
                    lineHeight: settings.fonts.paragraph.lineHeight,
                  }}>
                    {subChapter.content.split('\n\n').map((paragraph, idx) => (
                      <p
                        key={idx}
                        style={{
                          textIndent: `${chapter.indentation}em`,
                        }}
                        dangerouslySetInnerHTML={{ __html: parseMarkdown(paragraph) }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}