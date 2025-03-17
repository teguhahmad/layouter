import React from 'react';
import { useEbookStore } from '../store/useEbookStore';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { ChapterItem } from './ChapterItem';
import { Plus } from 'lucide-react';

export function ChapterList() {
  const { chapters, addChapter, reorderChapters } = useEbookStore();
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleAddChapter = (type: 'frontmatter' | 'chapter' | 'backmatter') => {
    const defaultTitles = {
      frontmatter: 'Kata Pengantar',
      chapter: `Bab ${chapters.filter(c => c.type === 'chapter').length + 1}`,
      backmatter: 'Penutup'
    };

    addChapter({
      id: crypto.randomUUID(),
      title: defaultTitles[type],
      content: '',
      images: [],
      type,
      indentation: 0,
      lineSpacing: 1.5,
      subChapters: [],
    });
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      const oldIndex = chapters.findIndex((chapter) => chapter.id === active.id);
      const newIndex = chapters.findIndex((chapter) => chapter.id === over.id);
      reorderChapters(arrayMove(chapters, oldIndex, newIndex));
    }
  };

  const buttonClass = "w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500";

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900">Daftar Konten</h3>
        <p className="mt-1 text-sm text-gray-500">
          Kelola konten buku Anda termasuk kata pengantar, bab-bab, dan penutup.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <button
          onClick={() => handleAddChapter('frontmatter')}
          className={buttonClass}
        >
          <Plus className="w-4 h-4 mr-2" />
          Tambah Kata Pengantar
        </button>

        <button
          onClick={() => handleAddChapter('chapter')}
          className={buttonClass}
        >
          <Plus className="w-4 h-4 mr-2" />
          Tambah Bab
        </button>

        <button
          onClick={() => handleAddChapter('backmatter')}
          className={buttonClass}
        >
          <Plus className="w-4 h-4 mr-2" />
          Tambah Penutup
        </button>
      </div>

      <div className="space-y-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={chapters.map((chapter) => chapter.id)}
            strategy={verticalListSortingStrategy}
          >
            {chapters.map((chapter, index) => (
              <ChapterItem
                key={chapter.id}
                chapter={chapter}
                index={index}
                isExpanded={false}
                onToggleExpand={() => {}}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}