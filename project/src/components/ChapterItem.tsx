import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, Image, Plus, Minus, ChevronDown, ChevronRight } from 'lucide-react';
import { useEbookStore } from '../store/useEbookStore';
import type { Chapter, ChapterImage } from '../types';

interface ChapterItemProps {
  chapter: Chapter;
  index: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

export function ChapterItem({ chapter, index }: ChapterItemProps) {
  const { updateChapter, removeChapter, addSubChapter, removeSubChapter } = useEbookStore();
  const [isExpanded, setIsExpanded] = React.useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: chapter.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please upload an image file');
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const newImage: ChapterImage = {
          id: crypto.randomUUID(),
          url: e.target?.result as string,
          caption: '',
          alignment: 'center',
          width: 100,
        };
        updateChapter(chapter.id, {
          ...chapter,
          images: [...chapter.images, newImage],
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageCaptionChange = (imageId: string, caption: string) => {
    updateChapter(chapter.id, {
      ...chapter,
      images: chapter.images.map((img) =>
        img.id === imageId ? { ...img, caption } : img
      ),
    });
  };

  const handleImageAlignmentChange = (imageId: string, alignment: 'left' | 'center' | 'right') => {
    updateChapter(chapter.id, {
      ...chapter,
      images: chapter.images.map((img) =>
        img.id === imageId ? { ...img, alignment } : img
      ),
    });
  };

  const handleImageWidthChange = (imageId: string, width: number) => {
    updateChapter(chapter.id, {
      ...chapter,
      images: chapter.images.map((img) =>
        img.id === imageId ? { ...img, width } : img
      ),
    });
  };

  const handleAddSubChapter = () => {
    addSubChapter(chapter.id, `Subbab ${chapter.subChapters.length + 1}`);
  };

  const getChapterTypeColor = () => {
    switch (chapter.type) {
      case 'frontmatter':
        return 'bg-green-50 border-green-200 hover:bg-green-100';
      case 'backmatter':
        return 'bg-purple-50 border-purple-200 hover:bg-purple-100';
      default:
        return 'bg-white border-gray-200 hover:bg-gray-50';
    }
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    // Replace triple newlines with double newlines
    const formattedContent = newContent.replace(/\n{3,}/g, '\n\n');
    // Replace --- with double newlines
    const finalContent = formattedContent.replace(/---/g, '\n\n');
    updateChapter(chapter.id, { ...chapter, content: finalContent });
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border shadow-sm transition-colors ${getChapterTypeColor()}`}
    >
      <div className="p-4">
        <div className="flex items-center gap-2">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-100 rounded"
          >
            <GripVertical className="w-4 h-4 text-gray-400" />
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-gray-100 rounded"
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-400" />
            )}
          </button>
          <input
            type="text"
            value={chapter.title}
            onChange={(e) => updateChapter(chapter.id, { ...chapter, title: e.target.value })}
            className="flex-1 text-lg font-medium bg-transparent border-none focus:ring-0 p-0"
            placeholder="Judul"
          />
          <button
            onClick={() => removeChapter(chapter.id)}
            className="p-1 text-red-600 hover:bg-red-50 rounded"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {isExpanded && (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Indentasi (em)</label>
                <input
                  type="number"
                  value={chapter.indentation}
                  onChange={(e) => updateChapter(chapter.id, { ...chapter, indentation: parseFloat(e.target.value) })}
                  min="0"
                  step="0.5"
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Jarak Baris</label>
                <input
                  type="number"
                  value={chapter.lineSpacing}
                  onChange={(e) => updateChapter(chapter.id, { ...chapter, lineSpacing: parseFloat(e.target.value) })}
                  min="1"
                  step="0.1"
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Konten</label>
              <div className="text-xs text-gray-500 mb-1">
                Gunakan markdown: **tebal**, *miring*, # Judul, 1. Daftar bernomor, - Daftar bullet
              </div>
              <textarea
                value={chapter.content}
                onChange={handleContentChange}
                rows={10}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm font-mono"
                placeholder="Tulis konten di sini menggunakan markdown..."
              />
            </div>

            <div className="space-y-4">
              {chapter.images.map((image) => (
                <div key={image.id} className="space-y-2 border rounded-lg p-4">
                  <img
                    src={image.url}
                    alt={image.caption}
                    className="max-w-full h-auto rounded"
                  />
                  <div className="grid gap-4">
                    <input
                      type="text"
                      value={image.caption}
                      onChange={(e) => handleImageCaptionChange(image.id, e.target.value)}
                      className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      placeholder="Keterangan gambar..."
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Perataan</label>
                        <select
                          value={image.alignment}
                          onChange={(e) => handleImageAlignmentChange(
                            image.id,
                            e.target.value as 'left' | 'center' | 'right'
                          )}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        >
                          <option value="left">Kiri</option>
                          <option value="center">Tengah</option>
                          <option value="right">Kanan</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Lebar (%)</label>
                        <input
                          type="number"
                          value={image.width}
                          onChange={(e) => handleImageWidthChange(image.id, parseInt(e.target.value))}
                          min="10"
                          max="100"
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {chapter.type === 'chapter' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-gray-900">Subbab</h4>
                  <button
                    onClick={handleAddSubChapter}
                    className="inline-flex items-center px-2 py-1 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Tambah Subbab
                  </button>
                </div>
                {chapter.subChapters.map((subChapter) => (
                  <div key={subChapter.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={subChapter.title}
                        onChange={(e) => updateChapter(chapter.id, {
                          ...chapter,
                          subChapters: chapter.subChapters.map((sub) =>
                            sub.id === subChapter.id
                              ? { ...sub, title: e.target.value }
                              : sub
                          ),
                        })}
                        className="flex-1 text-sm font-medium bg-transparent border-none focus:ring-0 p-0"
                        placeholder="Judul Subbab"
                      />
                      <button
                        onClick={() => removeSubChapter(chapter.id, subChapter.id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                    </div>
                    <textarea
                      value={subChapter.content}
                      onChange={(e) => updateChapter(chapter.id, {
                        ...chapter,
                        subChapters: chapter.subChapters.map((sub) =>
                          sub.id === subChapter.id
                            ? { ...sub, content: e.target.value }
                            : sub
                        ),
                      })}
                      rows={3}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      placeholder="Konten subbab..."
                    />
                  </div>
                ))}
              </div>
            )}

            <div>
              <label className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer">
                <Image className="w-4 h-4 mr-2" />
                Tambah Gambar
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleImageUpload}
                />
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}