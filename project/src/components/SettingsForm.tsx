import React from 'react';
import { useEbookStore } from '../store/useEbookStore';
import { PaperSize, FontAlignment } from '../types';

const paperSizes: PaperSize[] = ['A4', 'Letter', 'Legal'];
const alignments: FontAlignment[] = ['left', 'right', 'center', 'justify'];
const fontFamilies = ['Helvetica', 'Times New Roman', 'Arial', 'Georgia'];
const pageNumberPositions = ['top', 'bottom'];
const pageNumberAlignments = ['left', 'center', 'right'];

export function SettingsForm() {
  const { settings, updateSettings } = useEbookStore();

  const handleCoverImageChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'front' | 'back') => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please upload an image file');
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        if (type === 'front') {
          updateSettings({ coverImage: e.target?.result as string });
        } else {
          updateSettings({ backCoverImage: e.target?.result as string });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h4 className="font-medium text-gray-900">Basic Information</h4>
        <div className="grid gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Title</label>
            <input
              type="text"
              value={settings.title}
              onChange={(e) => updateSettings({ title: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Author</label>
            <input
              type="text"
              value={settings.author}
              onChange={(e) => updateSettings({ author: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={settings.description}
              onChange={(e) => updateSettings({ description: e.target.value })}
              rows={3}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Front Cover Image</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleCoverImageChange(e, 'front')}
              className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Back Cover Image</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleCoverImageChange(e, 'back')}
              className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium text-gray-900">Page Settings</h4>
        <div className="grid gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Paper Size</label>
            <select
              value={settings.paperSize}
              onChange={(e) => updateSettings({ paperSize: e.target.value as PaperSize })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              {paperSizes.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Top Margin (cm)</label>
              <input
                type="number"
                value={settings.margins.top}
                onChange={(e) => updateSettings({
                  margins: { ...settings.margins, top: parseFloat(e.target.value) }
                })}
                step="0.1"
                min="0"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Bottom Margin (cm)</label>
              <input
                type="number"
                value={settings.margins.bottom}
                onChange={(e) => updateSettings({
                  margins: { ...settings.margins, bottom: parseFloat(e.target.value) }
                })}
                step="0.1"
                min="0"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Left Margin (cm)</label>
              <input
                type="number"
                value={settings.margins.left}
                onChange={(e) => updateSettings({
                  margins: { ...settings.margins, left: parseFloat(e.target.value) }
                })}
                step="0.1"
                min="0"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Right Margin (cm)</label>
              <input
                type="number"
                value={settings.margins.right}
                onChange={(e) => updateSettings({
                  margins: { ...settings.margins, right: parseFloat(e.target.value) }
                })}
                step="0.1"
                min="0"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium text-gray-900">Page Numbering</h4>
        <div className="space-y-4">
          <div className="flex items-center">
            <input
              type="checkbox"
              checked={settings.pageNumbering.enabled}
              onChange={(e) => updateSettings({
                pageNumbering: { ...settings.pageNumbering, enabled: e.target.checked }
              })}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label className="ml-2 block text-sm text-gray-900">
              Enable page numbering
            </label>
          </div>
          {settings.pageNumbering.enabled && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Position</label>
                <select
                  value={settings.pageNumbering.position}
                  onChange={(e) => updateSettings({
                    pageNumbering: { ...settings.pageNumbering, position: e.target.value as 'top' | 'bottom' }
                  })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                >
                  {pageNumberPositions.map((pos) => (
                    <option key={pos} value={pos}>
                      {pos.charAt(0).toUpperCase() + pos.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Alignment</label>
                <select
                  value={settings.pageNumbering.alignment}
                  onChange={(e) => updateSettings({
                    pageNumbering: { ...settings.pageNumbering, alignment: e.target.value as 'left' | 'center' | 'right' }
                  })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                >
                  {pageNumberAlignments.map((align) => (
                    <option key={align} value={align}>
                      {align.charAt(0).toUpperCase() + align.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Start From</label>
                <input
                  type="number"
                  value={settings.pageNumbering.startFrom}
                  onChange={(e) => updateSettings({
                    pageNumbering: { ...settings.pageNumbering, startFrom: parseInt(e.target.value) }
                  })}
                  min="1"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium text-gray-900">Table of Contents</h4>
        <div className="space-y-4">
          <div className="flex items-center">
            <input
              type="checkbox"
              checked={settings.tableOfContents.enabled}
              onChange={(e) => updateSettings({
                tableOfContents: { ...settings.tableOfContents, enabled: e.target.checked }
              })}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label className="ml-2 block text-sm text-gray-900">
              Include table of contents
            </label>
          </div>
          {settings.tableOfContents.enabled && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Title</label>
              <input
                type="text"
                value={settings.tableOfContents.title}
                onChange={(e) => updateSettings({
                  tableOfContents: { ...settings.tableOfContents, title: e.target.value }
                })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium text-gray-900">Font Settings</h4>
        {(['title', 'subtitle', 'paragraph', 'header', 'footer', 'frontmatterContent', 'chapterContent', 'subchapterContent', 'backmatterContent'] as const).map((type) => (
          <div key={type} className="space-y-2">
            <h5 className="text-sm font-medium text-gray-700 capitalize">{type.replace(/([A-Z])/g, ' $1').toLowerCase()} Font</h5>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-xs text-gray-500">Family</label>
                <select
                  value={settings.fonts[type].family}
                  onChange={(e) => updateSettings({
                    fonts: {
                      ...settings.fonts,
                      [type]: { ...settings.fonts[type], family: e.target.value }
                    }
                  })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                >
                  {fontFamilies.map((font) => (
                    <option key={font} value={font}>
                      {font}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500">Size (pt)</label>
                <input
                  type="number"
                  value={settings.fonts[type].size}
                  onChange={(e) => updateSettings({
                    fonts: {
                      ...settings.fonts,
                      [type]: { ...settings.fonts[type], size: parseInt(e.target.value) }
                    }
                  })}
                  min="6"
                  max="72"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500">Line Height</label>
                <input
                  type="number"
                  value={settings.fonts[type].lineHeight}
                  onChange={(e) => updateSettings({
                    fonts: {
                      ...settings.fonts,
                      [type]: { ...settings.fonts[type], lineHeight: parseFloat(e.target.value) }
                    }
                  })}
                  min="1"
                  max="3"
                  step="0.1"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500">Alignment</label>
                <select
                  value={settings.fonts[type].alignment}
                  onChange={(e) => updateSettings({
                    fonts: {
                      ...settings.fonts,
                      [type]: { ...settings.fonts[type], alignment: e.target.value as FontAlignment }
                    }
                  })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                >
                  {alignments.map((alignment) => (
                    <option key={alignment} value={alignment}>
                      {alignment}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}