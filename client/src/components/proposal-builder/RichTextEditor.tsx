/**
 * RichTextEditor (PROP-009) — TipTap-based rich text editor for proposal
 * template/section content. Replaces the previous `document.execCommand`
 * implementation (deprecated, inconsistent across browsers) while preserving
 * the toolbar feature set: headings, bold/italic/underline, text + highlight
 * colors, alignment, ordered/unordered lists, links, images, horizontal rule,
 * blockquote, and code. Merge tokens (PROP-004) are inserted as a dedicated
 * TipTap node and the editor's HTML always passes through `sanitizeRichHtml`
 * before being emitted, matching the previous output pathway so stored content
 * round-trips without corruption.
 */
import { useEffect, useMemo, useState } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
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
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
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
import { sanitizeRichHtml } from '@/lib/sanitize-html';
import { MergeToken } from './merge-token-node';
import { MERGE_FIELDS } from '@shared/proposal-merge-fields';

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
  '#00AA00',
  '#0000FF',
  '#FF8800',
  '#FF00FF',
  '#00AAAA',
  '#800080',
  '#B45309',
];
const HIGHLIGHT_COLORS = [
  '#FEF08A',
  '#BBF7D0',
  '#BFDBFE',
  '#FBCFE8',
  '#FED7AA',
  '#E9D5FF',
  '#FECACA',
  '#A7F3D0',
];

const iconBtn = 'h-10 w-10 p-0 touch-manipulation active:scale-[0.98]';

const RichTextEditor = ({
  value,
  onChange,
  placeholder = 'Start typing...',
  className = '',
  minHeight = '200px',
}: RichTextEditorProps) => {
  const [isLinkOpen, setIsLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
        // Link is configured separately below for openOnClick control.
        link: false,
      }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Image.configure({ inline: false, allowBase64: false }),
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener' } }),
      Placeholder.configure({ placeholder }),
      MergeToken,
    ],
    content: sanitizeRichHtml(value || ''),
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none p-4 focus:outline-none',
        style: `min-height:${minHeight}`,
      },
    },
    onUpdate: ({ editor: e }) => {
      onChange(sanitizeRichHtml(e.getHTML()));
    },
  });

  // Sync external value changes (e.g. switching sections / reload recovery)
  // without clobbering the user's in-progress edits.
  useEffect(() => {
    if (!editor) return;
    const incoming = sanitizeRichHtml(value || '');
    if (incoming !== sanitizeRichHtml(editor.getHTML())) {
      editor.commands.setContent(incoming, { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  const grouped = useMemo(() => {
    const groups: Record<string, typeof MERGE_FIELDS> = {};
    for (const f of MERGE_FIELDS) (groups[f.group] ??= []).push(f);
    return groups;
  }, []);

  if (!editor) {
    return (
      <div className={`border rounded-lg p-4 text-sm text-muted-foreground ${className}`}>
        Loading editor…
      </div>
    );
  }

  const applyLink = () => {
    if (linkUrl) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run();
    } else {
      editor.chain().focus().unsetLink().run();
    }
    setIsLinkOpen(false);
    setLinkUrl('');
  };

  const insertImage = () => {
    const url = window.prompt('Enter image URL:');
    if (url) editor.chain().focus().setImage({ src: url }).run();
  };

  const setBlockFormat = (format: string) => {
    const chain = editor.chain().focus();
    if (format === 'p') chain.setParagraph().run();
    else if (format === 'blockquote') chain.toggleBlockquote().run();
    else chain.toggleHeading({ level: Number(format.replace('h', '')) as 1 | 2 | 3 | 4 }).run();
  };

  const active = (name: string, attrs?: Record<string, unknown>) =>
    editor.isActive(name, attrs) ? 'bg-gray-200' : '';

  return (
    <div className={`border rounded-lg overflow-hidden ${className}`}>
      <div className="bg-gray-50 border-b p-2 sm:p-3 flex flex-wrap items-center gap-1 sm:gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().undo().run()}
          className={iconBtn}
          aria-label="Undo"
        >
          <Undo className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().redo().run()}
          className={iconBtn}
          aria-label="Redo"
        >
          <Redo className="h-4 w-4" />
        </Button>

        <Separator orientation="vertical" className="mx-1 h-6 hidden sm:block" />

        <Select onValueChange={setBlockFormat}>
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

        <Separator orientation="vertical" className="mx-1 h-6 hidden sm:block" />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`${iconBtn} ${active('bold')}`}
          aria-label="Bold"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`${iconBtn} ${active('italic')}`}
          aria-label="Italic"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`${iconBtn} ${active('underline')}`}
          aria-label="Underline"
        >
          <UnderlineIcon className="h-4 w-4" />
        </Button>

        <Separator orientation="vertical" className="mx-1 h-6 hidden sm:block" />

        {/* Text color */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={iconBtn}
              aria-label="Text color"
            >
              <Type className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full sm:w-48">
            <div className="space-y-2">
              <Label>Text Color</Label>
              <div className="flex gap-1 flex-wrap">
                {TEXT_COLORS.map((color) => (
                  <button
                    type="button"
                    key={color}
                    className="w-8 h-8 sm:w-6 sm:h-6 rounded border-2 border-gray-300 touch-manipulation active:scale-[0.95]"
                    style={{ backgroundColor: color }}
                    onClick={() => editor.chain().focus().setColor(color).run()}
                    aria-label={`Set text color ${color}`}
                  />
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => editor.chain().focus().unsetColor().run()}
              >
                Reset
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {/* Highlight (background) color */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={iconBtn}
              aria-label="Highlight color"
            >
              <Palette className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full sm:w-48">
            <div className="space-y-2">
              <Label>Highlight</Label>
              <div className="flex gap-1 flex-wrap">
                {HIGHLIGHT_COLORS.map((color) => (
                  <button
                    type="button"
                    key={color}
                    className="w-8 h-8 sm:w-6 sm:h-6 rounded border-2 border-gray-300 touch-manipulation active:scale-[0.95]"
                    style={{ backgroundColor: color }}
                    onClick={() => editor.chain().focus().toggleHighlight({ color }).run()}
                    aria-label={`Highlight ${color}`}
                  />
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => editor.chain().focus().unsetHighlight().run()}
              >
                Clear
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        <Separator orientation="vertical" className="mx-1 h-6 hidden sm:block" />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          className={`${iconBtn} ${active('paragraph', { textAlign: 'left' })}`}
          aria-label="Align left"
        >
          <AlignLeft className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          className={iconBtn}
          aria-label="Align center"
        >
          <AlignCenter className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          className={iconBtn}
          aria-label="Align right"
        >
          <AlignRight className="h-4 w-4" />
        </Button>

        <Separator orientation="vertical" className="mx-1 h-6 hidden sm:block" />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`${iconBtn} ${active('bulletList')}`}
          aria-label="Bullet list"
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`${iconBtn} ${active('orderedList')}`}
          aria-label="Numbered list"
        >
          <ListOrdered className="h-4 w-4" />
        </Button>

        <Separator orientation="vertical" className="mx-1 h-6 hidden sm:block" />

        {/* Link */}
        <Popover open={isLinkOpen} onOpenChange={setIsLinkOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={`${iconBtn} ${active('link')}`}
              aria-label="Link"
            >
              <LinkIcon className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full max-w-[90vw] sm:w-80">
            <div className="space-y-2">
              <Label>Insert / edit link</Label>
              <Input
                placeholder="https://example.com"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                className="touch-manipulation min-h-[44px]"
              />
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={applyLink} className="min-h-[44px] flex-1">
                  Apply
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setIsLinkOpen(false)}
                  className="min-h-[44px] flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={insertImage}
          className={iconBtn}
          aria-label="Image"
        >
          <ImageIcon className="h-4 w-4" />
        </Button>

        <Separator orientation="vertical" className="mx-1 h-6 hidden sm:block" />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          className={iconBtn}
          aria-label="Horizontal rule"
        >
          <Minus className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`${iconBtn} ${active('blockquote')}`}
          aria-label="Blockquote"
        >
          <Quote className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={`${iconBtn} ${active('codeBlock')}`}
          aria-label="Code block"
        >
          <Code className="h-4 w-4" />
        </Button>

        <Separator orientation="vertical" className="mx-1 h-6 hidden sm:block" />

        {/* Merge tokens (PROP-004) */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-10 px-2 gap-1 touch-manipulation text-xs sm:text-sm"
              aria-label="Insert merge field"
            >
              <Braces className="h-4 w-4" />
              <span className="hidden sm:inline">Field</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 max-h-80 overflow-auto">
            <div className="space-y-3">
              {Object.entries(grouped).map(([group, fields]) => (
                <div key={group} className="space-y-1">
                  <Label className="text-xs uppercase text-muted-foreground">{group}</Label>
                  <div className="flex flex-col">
                    {fields.map((f) => (
                      <button
                        type="button"
                        key={f.token}
                        className="text-left text-sm px-2 py-1.5 rounded hover:bg-gray-100 touch-manipulation"
                        onClick={() => editor.chain().focus().insertMergeToken(f.token).run()}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <EditorContent editor={editor} />

      <style>{`
        .merge-token-chip {
          display: inline-block;
          background: #eef2ff;
          color: #4338ca;
          border: 1px solid #c7d2fe;
          border-radius: 0.375rem;
          padding: 0 0.35rem;
          font-size: 0.85em;
          font-family: ui-monospace, monospace;
          white-space: nowrap;
        }
        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          color: #9ca3af;
          float: left;
          height: 0;
          pointer-events: none;
        }
        .ProseMirror blockquote {
          border-left: 4px solid #e5e7eb;
          padding-left: 1rem;
          color: #6b7280;
          font-style: italic;
        }
        .ProseMirror pre {
          background: #f3f4f6;
          padding: 1rem;
          border-radius: 0.375rem;
          font-family: 'Courier New', monospace;
          overflow-x: auto;
        }
        .ProseMirror img { max-width: 100%; height: auto; border-radius: 0.375rem; }
        .ProseMirror a { color: #3b82f6; text-decoration: underline; }
      `}</style>
    </div>
  );
};

export type { Editor };
export default RichTextEditor;
