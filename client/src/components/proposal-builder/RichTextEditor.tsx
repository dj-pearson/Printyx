import React, { useEffect, useRef } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { sanitizeRichHtml } from '@/lib/sanitize-html';
import { MERGE_FIELDS, MERGE_FIELD_GROUPS } from '@shared/proposal-merge-fields';
import { buildRichTextExtensions } from './rich-text-extensions';
import {
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Link as LinkIcon,
  Image as ImageIcon,
  Type,
  Palette,
  Minus,
  Quote,
  Code,
  Undo,
  Redo,
  Braces,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
}

const TEXT_COLORS = [
  '#000000',
  '#333333',
  '#666666',
  '#999999',
  '#FF0000',
  '#00FF00',
  '#0000FF',
  '#FFFF00',
  '#FF00FF',
  '#00FFFF',
  '#FFA500',
  '#800080',
];

const BACKGROUND_COLORS = [
  '#FFFFFF',
  '#F0F0F0',
  '#D0D0D0',
  '#B0B0B0',
  '#FFE0E0',
  '#E0FFE0',
  '#E0E0FF',
  '#FFFFE0',
  '#FFE0FF',
  '#E0FFFF',
  '#FFEAA7',
  '#DDA0DD',
];

const FONT_SIZES: Array<{ value: string; label: string }> = [
  { value: '11px', label: '8pt' },
  { value: '13px', label: '10pt' },
  { value: '16px', label: '12pt' },
  { value: '19px', label: '14pt' },
  { value: '24px', label: '18pt' },
  { value: '32px', label: '24pt' },
  { value: '48px', label: '36pt' },
];

const RichTextEditor = ({
  value,
  onChange,
  placeholder = 'Start typing...',
  className = '',
  minHeight = '200px',
}: RichTextEditorProps) => {
  const [isLinkDialogOpen, setIsLinkDialogOpen] = React.useState(false);
  const [linkUrl, setLinkUrl] = React.useState('');
  const [linkText, setLinkText] = React.useState('');
  const [fieldToInsert, setFieldToInsert] = React.useState('');

  // Placeholder is read through a ref so the extension always sees the latest
  // prop value without rebuilding the editor schema.
  const placeholderRef = useRef(placeholder);
  placeholderRef.current = placeholder;

  const editor = useEditor({
    extensions: buildRichTextExtensions(() => placeholderRef.current),
    content: sanitizeRichHtml(value),
    editorProps: {
      attributes: {
        class: 'rte-content focus:outline-none p-4',
        style: `min-height:${minHeight}`,
        'data-placeholder': placeholder,
      },
    },
    onUpdate: ({ editor: ed }) => {
      // Preserve the legacy sanitizeRichHtml output pathway and normalize the
      // empty document to '' (TipTap serializes an empty doc as "<p></p>").
      onChange(ed.isEmpty ? '' : sanitizeRichHtml(ed.getHTML()));
    },
  });

  // Sync external value changes (e.g. switching the selected section) without
  // clobbering the user's caret while they type into this same instance.
  useEffect(() => {
    if (!editor) return;
    const incoming = sanitizeRichHtml(value);
    const current = editor.isEmpty ? '' : editor.getHTML();
    if (incoming !== current && incoming !== sanitizeRichHtml(current)) {
      editor.commands.setContent(incoming, { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) {
    return (
      <div
        className={`border rounded-lg overflow-hidden ${className}`}
        style={{ minHeight }}
        aria-busy="true"
      />
    );
  }

  const insertLink = () => {
    if (!linkUrl) {
      setIsLinkDialogOpen(false);
      return;
    }
    const chain = editor.chain().focus();
    if (linkText) {
      chain
        .insertContent({
          type: 'text',
          text: linkText,
          marks: [{ type: 'link', attrs: { href: linkUrl } }],
        })
        .run();
    } else {
      chain.extendMarkRange('link').setLink({ href: linkUrl }).run();
    }
    setIsLinkDialogOpen(false);
    setLinkUrl('');
    setLinkText('');
  };

  const insertImage = () => {
    const url = prompt('Enter image URL:');
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  const handleFormatBlock = (val: string) => {
    const chain = editor.chain().focus();
    if (val === 'p') chain.setParagraph().run();
    else if (val === 'blockquote') chain.toggleBlockquote().run();
    else chain.toggleHeading({ level: Number(val.slice(1)) as 1 | 2 | 3 | 4 }).run();
  };

  const insertMergeField = (token: string) => {
    if (!token) return;
    editor.chain().focus().insertMergeToken(token).run();
    setFieldToInsert('');
  };

  const tb = (active: boolean) =>
    `h-10 w-10 p-0 touch-manipulation active:scale-[0.98] ${active ? 'bg-gray-200' : ''}`;

  return (
    <div className={`border rounded-lg overflow-hidden ${className}`}>
      {/* Toolbar */}
      <div className="bg-gray-50 border-b p-2 sm:p-3 flex flex-wrap items-center gap-1 sm:gap-2">
        {/* Undo/Redo */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className={tb(false)}
          aria-label="Undo"
        >
          <Undo className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className={tb(false)}
          aria-label="Redo"
        >
          <Redo className="h-4 w-4" />
        </Button>

        <Separator orientation="vertical" className="mx-1 h-6 hidden sm:block" />

        {/* Text Format */}
        <Select onValueChange={handleFormatBlock}>
          <SelectTrigger className="w-24 sm:w-32 h-10 touch-manipulation text-xs sm:text-sm">
            <SelectValue placeholder="Format" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="p">Paragraph</SelectItem>
            <SelectItem value="h1">Heading 1</SelectItem>
            <SelectItem value="h2">Heading 2</SelectItem>
            <SelectItem value="h3">Heading 3</SelectItem>
            <SelectItem value="h4">Heading 4</SelectItem>
            <SelectItem value="blockquote">Quote</SelectItem>
          </SelectContent>
        </Select>

        {/* Font Size */}
        <Select onValueChange={(v) => editor.chain().focus().setFontSize(v).run()}>
          <SelectTrigger className="w-14 sm:w-16 h-10 touch-manipulation text-xs sm:text-sm">
            <SelectValue placeholder="12" />
          </SelectTrigger>
          <SelectContent>
            {FONT_SIZES.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Separator orientation="vertical" className="mx-1 h-6 hidden sm:block" />

        {/* Text Styling */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={tb(editor.isActive('bold'))}
          aria-label="Bold"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={tb(editor.isActive('italic'))}
          aria-label="Italic"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={tb(editor.isActive('underline'))}
          aria-label="Underline"
        >
          <Underline className="h-4 w-4" />
        </Button>

        <Separator orientation="vertical" className="mx-1 h-6 hidden sm:block" />

        {/* Text Color */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className={tb(false)} aria-label="Text color">
              <Type className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full sm:w-48">
            <div className="space-y-2">
              <Label>Text Color</Label>
              <div className="flex gap-1 flex-wrap">
                {TEXT_COLORS.map((color) => (
                  <button
                    key={color}
                    className="w-8 h-8 sm:w-6 sm:h-6 rounded border-2 border-gray-300 touch-manipulation active:scale-[0.95]"
                    style={{ backgroundColor: color }}
                    onClick={() => editor.chain().focus().setColor(color).run()}
                    aria-label={`Text color ${color}`}
                  />
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Background Color */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className={tb(false)} aria-label="Background color">
              <Palette className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full sm:w-48">
            <div className="space-y-2">
              <Label>Background Color</Label>
              <div className="flex gap-1 flex-wrap">
                {BACKGROUND_COLORS.map((color) => (
                  <button
                    key={color}
                    className="w-8 h-8 sm:w-6 sm:h-6 rounded border-2 border-gray-300 touch-manipulation active:scale-[0.95]"
                    style={{ backgroundColor: color }}
                    onClick={() => editor.chain().focus().setBackgroundColor(color).run()}
                    aria-label={`Background color ${color}`}
                  />
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <Separator orientation="vertical" className="mx-1 h-6 hidden sm:block" />

        {/* Alignment */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          className={tb(editor.isActive({ textAlign: 'left' }))}
          aria-label="Align left"
        >
          <AlignLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          className={tb(editor.isActive({ textAlign: 'center' }))}
          aria-label="Align center"
        >
          <AlignCenter className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          className={tb(editor.isActive({ textAlign: 'right' }))}
          aria-label="Align right"
        >
          <AlignRight className="h-4 w-4" />
        </Button>

        <Separator orientation="vertical" className="mx-1 h-6 hidden sm:block" />

        {/* Lists */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={tb(editor.isActive('bulletList'))}
          aria-label="Bullet list"
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={tb(editor.isActive('orderedList'))}
          aria-label="Numbered list"
        >
          <ListOrdered className="h-4 w-4" />
        </Button>

        <Separator orientation="vertical" className="mx-1 h-6 hidden sm:block" />

        {/* Link */}
        <Popover open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={tb(editor.isActive('link'))}
              aria-label="Insert link"
            >
              <LinkIcon className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full max-w-[90vw] sm:w-80">
            <div className="space-y-2">
              <Label>Insert Link</Label>
              <Input
                placeholder="Link text (optional)"
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
                className="touch-manipulation min-h-[44px]"
              />
              <Input
                placeholder="https://example.com"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                className="touch-manipulation min-h-[44px]"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={insertLink}
                  className="touch-manipulation active:scale-[0.98] min-h-[44px] flex-1"
                >
                  Insert
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsLinkDialogOpen(false)}
                  className="touch-manipulation active:scale-[0.98] min-h-[44px] flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Image */}
        <Button
          variant="ghost"
          size="sm"
          onClick={insertImage}
          className={tb(false)}
          aria-label="Insert image"
        >
          <ImageIcon className="h-4 w-4" />
        </Button>

        <Separator orientation="vertical" className="mx-1 h-6 hidden sm:block" />

        {/* Special */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          className={tb(false)}
          aria-label="Horizontal rule"
        >
          <Minus className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={tb(editor.isActive('blockquote'))}
          aria-label="Blockquote"
        >
          <Quote className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={tb(editor.isActive('codeBlock'))}
          aria-label="Code block"
        >
          <Code className="h-4 w-4" />
        </Button>

        <Separator orientation="vertical" className="mx-1 h-6 hidden sm:block" />

        {/* Merge token insertion (PROP-004) */}
        <Select value={fieldToInsert} onValueChange={insertMergeField}>
          <SelectTrigger
            className="w-32 sm:w-40 h-10 touch-manipulation text-xs sm:text-sm"
            aria-label="Insert merge field"
          >
            <span className="flex items-center gap-1">
              <Braces className="h-4 w-4" />
              <SelectValue placeholder="Merge field" />
            </span>
          </SelectTrigger>
          <SelectContent>
            {MERGE_FIELD_GROUPS.map((g) => (
              <div key={g.group}>
                <div className="px-2 py-1 text-[10px] font-semibold uppercase text-muted-foreground">
                  {g.label}
                </div>
                {MERGE_FIELDS.filter((f) => f.group === g.group).map((f) => (
                  <SelectItem key={f.token} value={f.token} className="text-xs">
                    {f.label}
                  </SelectItem>
                ))}
              </div>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Editor */}
      <EditorContent editor={editor} />

      <style>{`
        .rte-content {
          outline: none;
        }
        .rte-content p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          color: #9ca3af;
          float: left;
          height: 0;
          pointer-events: none;
        }
        .rte-content h1 { font-size: 2rem; font-weight: bold; margin: 1rem 0; }
        .rte-content h2 { font-size: 1.5rem; font-weight: bold; margin: 0.875rem 0; }
        .rte-content h3 { font-size: 1.25rem; font-weight: bold; margin: 0.75rem 0; }
        .rte-content h4 { font-size: 1.125rem; font-weight: bold; margin: 0.625rem 0; }
        .rte-content p { margin: 0.5rem 0; }
        .rte-content blockquote {
          border-left: 4px solid #e5e7eb;
          padding-left: 1rem;
          margin: 1rem 0;
          color: #6b7280;
          font-style: italic;
        }
        .rte-content pre {
          background: #f3f4f6;
          padding: 1rem;
          border-radius: 0.375rem;
          font-family: 'Courier New', monospace;
          overflow-x: auto;
        }
        .rte-content ul, .rte-content ol { margin: 0.5rem 0; padding-left: 1.5rem; }
        .rte-content ul { list-style: disc; }
        .rte-content ol { list-style: decimal; }
        .rte-content li { margin: 0.25rem 0; }
        .rte-content img.rte-image {
          max-width: 100%;
          height: auto;
          border-radius: 0.375rem;
          margin: 0.5rem 0;
        }
        .rte-content a { color: #3b82f6; text-decoration: underline; }
        .rte-content hr { border: none; border-top: 1px solid #e5e7eb; margin: 1rem 0; }
        .rte-content .merge-token-chip {
          display: inline-block;
          background: #eef2ff;
          color: #4338ca;
          border: 1px solid #c7d2fe;
          border-radius: 0.25rem;
          padding: 0 0.25rem;
          font-size: 0.85em;
          font-family: ui-monospace, monospace;
          white-space: nowrap;
        }
      `}</style>
    </div>
  );
};

export type { Editor };
export default RichTextEditor;
