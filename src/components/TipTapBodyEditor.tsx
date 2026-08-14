import React, { useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold as BoldIcon,
  Italic as ItalicIcon,
  Underline as UnderlineIcon,
  List as ListIcon,
  ListOrdered as ListOrderedIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Image as ImageIcon,
  Trash2,
  Sparkles,
} from 'lucide-react';

// Extend TipTap Image extension to register style & width attributes in schema
const CustomImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      style: {
        default: 'max-width: 300px; width: 100%; height: auto; display: block; margin: 12px auto; border-radius: 4px;',
        parseHTML: (element) => element.getAttribute('style') || '',
        renderHTML: (attributes) => {
          if (!attributes.style) return {};
          return { style: attributes.style };
        },
      },
      width: {
        default: null,
        parseHTML: (element) => element.getAttribute('width'),
        renderHTML: (attributes) => {
          if (!attributes.width) return {};
          return { width: attributes.width };
        },
      },
    };
  },
});

/** Convert plain text newlines (\n\n or \n) to HTML <p> & <br> elements for TipTap */
export function parseToTipTapHtml(val: string): string {
  if (!val) return '<p style="margin-bottom: 16px;"><br></p>';
  // If it already contains HTML block tags, preserve as HTML
  if (/<(p|div|section|article|table|h[1-6])\b/i.test(val)) {
    return val;
  }
  // Convert double newlines to paragraphs, single newlines to <br/>
  return val
    .split(/\n{2,}/)
    .map((para) => `<p style="margin-bottom: 16px; line-height: 1.6;">${para.trim().replace(/\n/g, '<br/>')}</p>`)
    .join('');
}

interface TipTapBodyEditorProps {
  value: string;
  onChange: (html: string) => void;
  onInsertImageRequest: () => void;
  lastInsertedImageHtml: string | null;
  onImageInsertedHandled: () => void;
}

export default function TipTapBodyEditor({
  value,
  onChange,
  onInsertImageRequest,
  lastInsertedImageHtml,
  onImageInsertedHandled,
}: TipTapBodyEditorProps) {
  const [selectedImgAttrs, setSelectedImgAttrs] = useState<{
    src: string;
    alt: string;
    style: string;
    width: number;
    alignment: 'inline' | 'left' | 'center' | 'right';
  } | null>(null);

  const initialContent = parseToTipTapHtml(
    value ||
    'Dear {{guest_name}},\n\nWe are delighted to invite you to {{event_name}}!\n\nYour reserved seating details:\nTable: {{table_name}}\n\nPlease let us know if you have any questions.\n\nWarm regards,\nEvent Host'
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: {},
        orderedList: {},
      }),
      Underline,
      Link.configure({
        openOnClick: false,
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      CustomImage.configure({
        inline: true,
        allowBase64: true,
      }),
      Placeholder.configure({
        placeholder: 'Dear {{guest_name}},\n\nType your email body here...',
      }),
    ],
    content: initialContent,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    onSelectionUpdate: ({ editor }) => {
      // Check if current selection is an image
      if (editor.isActive('image')) {
        const attrs = editor.getAttributes('image');
        if (attrs && attrs.src) {
          const style = attrs.style || '';
          let width = attrs.width ? parseInt(attrs.width, 10) : 300;
          const matchW = style.match(/max-width:\s*(\d+)px/i) || style.match(/width:\s*(\d+)px/i);
          if (matchW) width = parseInt(matchW[1], 10);

          let alignment: 'inline' | 'left' | 'center' | 'right' = 'center';
          if (style.includes('display: inline') || style.includes('display:inline')) {
            alignment = 'inline';
          } else if (style.includes('float: left') || style.includes('float:left')) {
            alignment = 'left';
          } else if (style.includes('float: right') || style.includes('float:right')) {
            alignment = 'right';
          }

          setSelectedImgAttrs({
            src: attrs.src,
            alt: attrs.alt || '',
            style,
            width,
            alignment,
          });
        }
      } else {
        setSelectedImgAttrs(null);
      }
    },
  });

  // Sync content when value changes externally (e.g. initial load or template swap)
  useEffect(() => {
    if (!editor) return;
    const currentHtml = editor.getHTML();
    const formattedVal = parseToTipTapHtml(value);
    if (formattedVal && formattedVal !== currentHtml && value !== editor.getText()) {
      editor.commands.setContent(formattedVal);
    }
  }, [value, editor]);

  // Handle inserted image from ImageCropModal
  useEffect(() => {
    if (!lastInsertedImageHtml || !editor) return;

    const temp = document.createElement('div');
    temp.innerHTML = lastInsertedImageHtml;
    const img = temp.querySelector('img');

    if (img) {
      const src = img.getAttribute('src') || '';
      const alt = img.getAttribute('alt') || '';
      const style = img.getAttribute('style') || 'max-width: 300px; width: 100%; height: auto; display: block; margin: 12px auto; border-radius: 4px;';
      const widthMatch = style.match(/max-width:\s*(\d+)px/i);
      const widthVal = widthMatch ? widthMatch[1] : '300';

      editor
        .chain()
        .focus()
        .setImage({
          src,
          alt,
          style,
          width: widthVal,
        } as any)
        .run();
    } else {
      editor.chain().focus().insertContent(lastInsertedImageHtml).run();
    }

    onImageInsertedHandled();
  }, [lastInsertedImageHtml, editor, onImageInsertedHandled]);

  if (!editor) return null;

  // Insert variable chip into TipTap editor at cursor
  const insertVariableChip = (chip: string) => {
    editor.chain().focus().insertContent(` ${chip} `).run();
  };

  // Update selected image style & alignment in TipTap
  const updateImageAttributes = (
    newAlignment?: 'inline' | 'left' | 'center' | 'right',
    newWidth?: number
  ) => {
    if (!selectedImgAttrs) return;

    const align = newAlignment !== undefined ? newAlignment : selectedImgAttrs.alignment;
    const width = newWidth !== undefined ? newWidth : selectedImgAttrs.width;

    let styleString = `max-width: ${width}px; width: 100%; height: auto; border-radius: 4px;`;
    if (align === 'inline') {
      styleString += ' display: inline-block; vertical-align: middle; margin: 0 4px; float: none;';
    } else if (align === 'left') {
      styleString += ' display: block; float: left; margin: 4px 12px 8px 0;';
    } else if (align === 'right') {
      styleString += ' display: block; float: right; margin: 4px 0 8px 12px;';
    } else {
      styleString += ' display: block; float: none; margin: 12px auto;';
    }

    editor
      .chain()
      .focus()
      .updateAttributes('image', {
        style: styleString,
        width: String(width),
      })
      .run();

    setSelectedImgAttrs({
      ...selectedImgAttrs,
      alignment: align,
      width,
      style: styleString,
    });
  };

  // Delete selected image
  const deleteSelectedImage = () => {
    editor.chain().focus().deleteSelection().run();
    setSelectedImgAttrs(null);
  };

  return (
    <div className="border border-gilded-border bg-white shadow-2xs space-y-0">
      {/* Editor Control Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-gilded-border bg-gilded-bg select-none">
        <div className="flex items-center gap-1 flex-wrap">
          {/* Text Formatting Controls */}
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`p-1.5 border text-xs cursor-pointer transition-colors ${editor.isActive('bold')
              ? 'bg-gilded-accent text-gilded-ink border-gilded-border font-bold'
              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'
              }`}
            title="Bold"
          >
            <BoldIcon size={13} />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`p-1.5 border text-xs cursor-pointer transition-colors ${editor.isActive('italic')
              ? 'bg-gilded-accent text-gilded-ink border-gilded-border font-bold'
              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'
              }`}
            title="Italic"
          >
            <ItalicIcon size={13} />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={`p-1.5 border text-xs cursor-pointer transition-colors ${editor.isActive('underline')
              ? 'bg-gilded-accent text-gilded-ink border-gilded-border font-bold'
              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'
              }`}
            title="Underline"
          >
            <UnderlineIcon size={13} />
          </button>

          <div className="h-4 w-[1px] bg-gray-300 mx-1" />

          {/* List Controls */}
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`p-1.5 border text-xs cursor-pointer transition-colors ${editor.isActive('bulletList')
              ? 'bg-gilded-accent text-gilded-ink border-gilded-border font-bold'
              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'
              }`}
            title="Bullet List"
          >
            <ListIcon size={13} />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`p-1.5 border text-xs cursor-pointer transition-colors ${editor.isActive('orderedList')
              ? 'bg-gilded-accent text-gilded-ink border-gilded-border font-bold'
              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'
              }`}
            title="Numbered List"
          >
            <ListOrderedIcon size={13} />
          </button>

          <div className="h-4 w-[1px] bg-gray-300 mx-1" />

          {/* Text Alignment */}
          <button
            type="button"
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            className={`p-1.5 border text-xs cursor-pointer transition-colors ${editor.isActive({ textAlign: 'left' })
              ? 'bg-gilded-accent text-gilded-ink border-gilded-border font-bold'
              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'
              }`}
            title="Align Left"
          >
            <AlignLeft size={13} />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            className={`p-1.5 border text-xs cursor-pointer transition-colors ${editor.isActive({ textAlign: 'center' })
              ? 'bg-gilded-accent text-gilded-ink border-gilded-border font-bold'
              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'
              }`}
            title="Align Center"
          >
            <AlignCenter size={13} />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            className={`p-1.5 border text-xs cursor-pointer transition-colors ${editor.isActive({ textAlign: 'right' })
              ? 'bg-gilded-accent text-gilded-ink border-gilded-border font-bold'
              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'
              }`}
            title="Align Right"
          >
            <AlignRight size={13} />
          </button>
        </div>

        {/* Insert Image Button */}
        <button
          type="button"
          onClick={onInsertImageRequest}
          className="inline-flex items-center gap-1.5 px-3 py-1 bg-gilded-ink hover:bg-black text-gilded-accent text-xs font-mono font-bold uppercase tracking-wider border border-gilded-border transition-colors cursor-pointer"
          title="Upload, crop and insert image into template"
        >
          <ImageIcon size={13} />
          <span>Insert Image</span>
        </button>
      </div>

      {/* Selected Image Toolbar & Resizer */}
      {selectedImgAttrs && (
        <div className="bg-amber-50 border-b border-amber-200 p-2.5 px-3 flex flex-wrap items-center justify-between gap-3 animate-fade-in text-xs font-mono select-none">
          <div className="flex items-center gap-2">
            <span className="font-bold text-amber-900 flex items-center gap-1">
              <Sparkles size={13} className="text-gilded-accent" /> Selected Image:
            </span>

            {/* Alignment toggles */}
            <div className="flex items-center gap-1 bg-white border border-amber-300 p-0.5">
              {(
                [
                  { id: 'inline', label: 'Inline' },
                  { id: 'left', label: 'Wrap Left' },
                  { id: 'center', label: 'Center Block' },
                  { id: 'right', label: 'Wrap Right' },
                ] as const
              ).map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => updateImageAttributes(mode.id)}
                  className={`px-2 py-0.5 text-[10px] font-mono transition-colors cursor-pointer ${selectedImgAttrs.alignment === mode.id
                    ? 'bg-gilded-accent text-gilded-ink font-bold'
                    : 'text-gray-600 hover:bg-gray-100'
                    }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          {/* Width slider & preset buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-amber-800 uppercase font-semibold">
              Width ({selectedImgAttrs.width}px):
            </span>
            <input
              type="range"
              min={24}
              max={600}
              step={10}
              value={selectedImgAttrs.width}
              onChange={(e) => updateImageAttributes(undefined, Number(e.target.value))}
              className="w-28 accent-gilded-accent cursor-pointer"
            />

            {/* Quick Preset Buttons */}
            <div className="flex items-center gap-1">
              {[120, 250, 400, 600].map((presetW) => (
                <button
                  key={presetW}
                  type="button"
                  onClick={() => updateImageAttributes(undefined, presetW)}
                  className={`px-1.5 py-0.5 text-[9px] font-mono border ${selectedImgAttrs.width === presetW
                    ? 'bg-gilded-accent text-gilded-ink border-gilded-border font-bold'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'
                    }`}
                >
                  {presetW}px
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={deleteSelectedImage}
              className="ml-2 px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Trash2 size={11} /> Delete
            </button>
          </div>
        </div>
      )}

      {/* TipTap Main Content Area */}
      <div className="p-4 relative">
        <style>{`
          .tiptap { outline: none; }
          .tiptap p { margin-top: 0 !important; margin-bottom: 1rem !important; line-height: 1.625 !important; min-height: 1.25em; display: block; }
          .tiptap p:last-child { margin-bottom: 0 !important; }
          .tiptap ul { list-style-type: disc; padding-left: 1.25rem; margin-bottom: 1rem; }
          .tiptap ol { list-style-type: decimal; padding-left: 1.25rem; margin-bottom: 1rem; }
          .tiptap img { cursor: pointer; transition: all 0.15s ease; }
          .tiptap img:hover { outline: 2px dashed #d97706; }
        `}</style>
        <EditorContent
          editor={editor}
          className="min-h-[220px] max-h-[480px] overflow-y-auto text-xs font-sans text-gilded-ink outline-none"
        />
      </div>

      {/* Variable Chips Footer */}
      <div className="px-3 py-2 border-t border-gilded-border/40 bg-gilded-faint/20 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-gray-500 font-bold uppercase">Insert Variable:</span>
          {(['{{guest_name}}', '{{event_name}}', '{{table_name}}'] as const).map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => insertVariableChip(chip)}
              className="px-2 py-0.5 bg-white hover:bg-gilded-accent/20 border border-gilded-border text-gilded-ink text-[11px] font-mono font-semibold transition-colors cursor-pointer"
            >
              {chip}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
