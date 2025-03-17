import React from 'react';
import { useEbookStore } from '../store/useEbookStore';
import { jsPDF } from 'jspdf';
import { PDFDocument } from 'pdf-lib';
import { parseMarkdown } from '../utils/markdownParser';
import { parsePDFMarkdown } from '../utils/pdfMarkdownParser';

export function Preview() {
  const { settings, chapters } = useEbookStore();
  const [isGenerating, setIsGenerating] = React.useState(false);
  const contentRef = React.useRef<HTMLDivElement>(null);

  const generateCoverPDF = async (imageUrl: string): Promise<Uint8Array> => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: settings.paperSize,
      compress: true
    });

    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.src = imageUrl;
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = 2480;
        canvas.height = 3508;
        
        if (ctx) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          const imgRatio = img.width / img.height;
          const pageRatio = canvas.width / canvas.height;
          
          let drawWidth = canvas.width;
          let drawHeight = canvas.height;
          
          if (imgRatio > pageRatio) {
            drawHeight = canvas.width / imgRatio;
          } else {
            drawWidth = canvas.height * imgRatio;
          }
          
          const x = (canvas.width - drawWidth) / 2;
          const y = (canvas.height - drawHeight) / 2;
          
          ctx.drawImage(img, x, y, drawWidth, drawHeight);
          
          const imgData = canvas.toDataURL('image/jpeg', 1.0);
          doc.addImage(imgData, 'JPEG', 0, 0, 210, 297);
          
          resolve(doc.output('arraybuffer'));
        }
      };
    });
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
    if (!contentRef.current) return;

    try {
      setIsGenerating(true);

      let coverPdfBytes: Uint8Array | null = null;
      if (settings.coverImage) {
        coverPdfBytes = new Uint8Array(await generateCoverPDF(settings.coverImage));
      }

      let backCoverPdfBytes: Uint8Array | null = null;
      if (settings.backCoverImage) {
        backCoverPdfBytes = new Uint8Array(await generateCoverPDF(settings.backCoverImage));
      }

      const doc = new jsPDF({
        unit: 'mm',
        format: settings.paperSize,
        orientation: 'portrait'
      });

      // Set font
      doc.setFont(settings.fonts.paragraph.family);
      doc.setFontSize(settings.fonts.paragraph.size);

      // Calculate page dimensions in mm
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const marginLeft = settings.margins.left * 10;
      const marginRight = settings.margins.right * 10;
      const marginTop = settings.margins.top * 10;
      const marginBottom = settings.margins.bottom * 10;
      const contentWidth = pageWidth - marginLeft - marginRight;

      let romanPageCount = 1;
      let arabicPageCount = 1;

      const addPageNumber = (isRoman: boolean) => {
        if (settings.pageNumbering.enabled) {
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

      // Add title page
      doc.setFont(settings.fonts.title.family);
      doc.setFontSize(settings.fonts.title.size);
      doc.text(settings.title, pageWidth / 2, marginTop + 40, { align: settings.fonts.title.alignment });
      
      doc.setFont(settings.fonts.subtitle.family);
      doc.setFontSize(settings.fonts.subtitle.size);
      doc.text(settings.author, pageWidth / 2, marginTop + 60, { align: settings.fonts.subtitle.alignment });

      addPageNumber(true);
      romanPageCount++;
      doc.addPage();

      // Add table of contents if enabled
      if (settings.tableOfContents.enabled) {
        doc.setFont(settings.fonts.subtitle.family);
        doc.setFontSize(settings.fonts.subtitle.size);
        doc.text(settings.tableOfContents.title, marginLeft, marginTop + 20);

        doc.setFont(settings.fonts.paragraph.family);
        doc.setFontSize(settings.fonts.paragraph.size);
        let tocY = marginTop + 40;

        chapters.forEach((chapter) => {
          const prefix = chapter.type === 'chapter' ? `${chapter.pageNumber}. ` : '';
          doc.text(`${prefix}${chapter.title}`, marginLeft, tocY);
          
          const pageNum = chapter.type === 'frontmatter' 
            ? romanize(chapter.pageNumber || romanPageCount)
            : String(chapter.pageNumber || arabicPageCount);
            
          doc.text(pageNum, pageWidth - marginRight, tocY, { align: 'right' });
          tocY += 10;

          if (chapter.subChapters.length > 0) {
            chapter.subChapters.forEach((sub) => {
              tocY += 8;
              doc.text(`  ${sub.title}`, marginLeft + 10, tocY);
              const subPageNum = chapter.type === 'frontmatter'
                ? romanize(sub.pageNumber || romanPageCount)
                : String(sub.pageNumber || arabicPageCount);
              doc.text(subPageNum, pageWidth - marginRight, tocY, { align: 'right' });
            });
          }
        });

        addPageNumber(true);
        romanPageCount++;
        doc.addPage();
      }

      // Add chapters
      chapters.forEach((chapter) => {
        const isPreContent = chapter.type === 'frontmatter';
        
        // Chapter title
        doc.setFont(settings.fonts.subtitle.family);
        doc.setFontSize(settings.fonts.subtitle.size);
        let y = marginTop + 20;
        doc.text(chapter.title, marginLeft, y, { align: settings.fonts.subtitle.alignment });

        // Chapter content
        doc.setFont(settings.fonts.paragraph.family);
        doc.setFontSize(settings.fonts.paragraph.size);
        y += 20;

        // Split content into paragraphs and process each one
        const paragraphs = chapter.content.split('\n\n').filter(p => p.trim());
        
        for (const paragraph of paragraphs) {
          if (y > pageHeight - marginBottom) {
            addPageNumber(isPreContent);
            if (isPreContent) {
              romanPageCount++;
            } else {
              arabicPageCount++;
            }
            doc.addPage();
            y = marginTop;
          }

          y = parsePDFMarkdown(doc, paragraph, marginLeft + (chapter.indentation * 10), y, {
            maxWidth: contentWidth,
            align: settings.fonts.paragraph.alignment,
            fontSize: settings.fonts.paragraph.size,
            lineSpacing: chapter.lineSpacing
          });
          
          // Add extra space between paragraphs
          y += settings.fonts.paragraph.size * 0.352778;
        }

        // Add images
        for (const image of chapter.images) {
          if (y > pageHeight - marginBottom - 40) {
            addPageNumber(isPreContent);
            if (isPreContent) {
              romanPageCount++;
            } else {
              arabicPageCount++;
            }
            doc.addPage();
            y = marginTop;
          }

          const imgWidth = (contentWidth * image.width) / 100;
          const img = new Image();
          img.src = image.url;
          const imgHeight = (imgWidth * img.height) / img.width;

          let x = marginLeft;
          if (image.alignment === 'center') {
            x = (pageWidth - imgWidth) / 2;
          } else if (image.alignment === 'right') {
            x = pageWidth - marginRight - imgWidth;
          }

          doc.addImage(image.url, 'JPEG', x, y, imgWidth, imgHeight);
          y += imgHeight + 10;

          if (image.caption) {
            doc.setFontSize(settings.fonts.paragraph.size * 0.8);
            doc.text(image.caption, pageWidth / 2, y, { align: 'center' });
            y += 15;
          }
        }

        // Add subchapters
        for (const subChapter of chapter.subChapters) {
          if (y > pageHeight - marginBottom - 20) {
            addPageNumber(isPreContent);
            if (isPreContent) {
              romanPageCount++;
            } else {
              arabicPageCount++;
            }
            doc.addPage();
            y = marginTop;
          }

          doc.setFont(settings.fonts.subtitle.family);
          doc.setFontSize(settings.fonts.subtitle.size * 0.8);
          y += 20;
          doc.text(subChapter.title, marginLeft, y);

          doc.setFont(settings.fonts.paragraph.family);
          doc.setFontSize(settings.fonts.paragraph.size);
          y += 15;

          const subParagraphs = subChapter.content.split('\n\n').filter(p => p.trim());
          
          for (const paragraph of subParagraphs) {
            if (y > pageHeight - marginBottom) {
              addPageNumber(isPreContent);
              if (isPreContent) {
                romanPageCount++;
              } else {
                arabicPageCount++;
              }
              doc.addPage();
              y = marginTop;
            }

            y = parsePDFMarkdown(doc, paragraph, marginLeft + (chapter.indentation * 10), y, {
              maxWidth: contentWidth,
              align: settings.fonts.paragraph.alignment,
              fontSize: settings.fonts.paragraph.size,
              lineSpacing: chapter.lineSpacing
            });
            
            // Add extra space between paragraphs
            y += settings.fonts.paragraph.size * 0.352778;
          }
        }

        if (chapters.indexOf(chapter) < chapters.length - 1) {
          addPageNumber(isPreContent);
          if (isPreContent) {
            romanPageCount++;
          } else {
            arabicPageCount++;
          }
          doc.addPage();
        }
      });

      // Add final page number
      addPageNumber(chapters[chapters.length - 1]?.type !== 'frontmatter');

      const contentPdfBytes = new Uint8Array(doc.output('arraybuffer'));

      // Merge PDFs
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
      link.download = settings.title || 'ebook.pdf';
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating PDF:', error);
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

      <div className="flex-1 overflow-auto">
        <div ref={contentRef} className="p-8 max-w-[800px] mx-auto">
          {/* Title Page */}
          <div className="mb-16 text-center">
            <h1 style={{
              fontSize: `${settings.fonts.title.size}pt`,
              fontFamily: settings.fonts.title.family,
              textAlign: settings.fonts.title.alignment,
              lineHeight: settings.fonts.title.lineHeight,
            }} className="mb-4">
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

          {/* Table of Contents */}
          {settings.tableOfContents.enabled && (
            <div className="mb-16">
              <h2 style={{
                fontSize: `${settings.fonts.subtitle.size}pt`,
                fontFamily: settings.fonts.subtitle.family,
                textAlign: 'left',
                marginBottom: '1em',
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

          {/* Chapters */}
          {chapters.map((chapter) => (
            <div key={chapter.id} className="mb-16">
              <h2 style={{
                fontSize: `${settings.fonts.subtitle.size}pt`,
                fontFamily: settings.fonts.subtitle.family,
                textAlign: settings.fonts.subtitle.alignment,
                lineHeight: settings.fonts.subtitle.lineHeight,
                marginBottom: '1em',
              }}>
                {chapter.title}
              </h2>
              <div style={{
                fontSize: `${settings.fonts.paragraph.size}pt`,
                fontFamily: settings.fonts.paragraph.family,
                textAlign: settings.fonts.paragraph.alignment as any,
                lineHeight: chapter.lineSpacing,
              }}>
                {chapter.content.split('\n\n').map((paragraph, idx) => (
                  <p
                    key={idx}
                    style={{
                      marginBottom: '1em',
                      textIndent: `${chapter.indentation}em`,
                    }}
                    dangerouslySetInnerHTML={{ __html: parseMarkdown(paragraph) }}
                  />
                ))}
              </div>

              {/* Chapter Images */}
              {chapter.images.map((image) => (
                <div
                  key={image.id}
                  className="my-8"
                  style={{ textAlign: image.alignment }}
                >
                  <img
                    src={image.url}
                    alt={image.caption}
                    style={{ width: `${image.width}%`, margin: '0 auto' }}
                  />
                  {image.caption && (
                    <p className="mt-2 text-sm text-gray-600 text-center">
                      {image.caption}
                    </p>
                  )}
                </div>
              ))}

              {/* Subchapters */}
              {chapter.subChapters.map((subChapter) => (
                <div key={subChapter.id} className="mt-8">
                  <h3 style={{
                    fontSize: `${settings.fonts.subtitle.size * 0.8}pt`,
                    fontFamily: settings.fonts.subtitle.family,
                    textAlign: settings.fonts.subtitle.alignment,
                    lineHeight: settings.fonts.subtitle.lineHeight,
                    marginBottom: '0.5em',
                  }}>
                    {subChapter.title}
                  </h3>
                  <div style={{
                    fontSize: `${settings.fonts.paragraph.size}pt`,
                    fontFamily: settings.fonts.paragraph.family,
                    textAlign: settings.fonts.paragraph.alignment as any,
                    lineHeight: chapter.lineSpacing,
                  }}>
                    {subChapter.content.split('\n\n').map((paragraph, idx) => (
                      <p
                        key={idx}
                        style={{
                          marginBottom: '1em',
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