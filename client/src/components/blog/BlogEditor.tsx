import { useCallback, useEffect, useMemo } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { createLowlight, common } from 'lowlight';
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Redo,
  Strikethrough,
  Table as TableIcon,
  Undo,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { htmlToMarkdown, markdownToHtml } from '@/lib/blog/markdown';
import { SlashCommand } from './SlashCommand';
import 'tippy.js/dist/tippy.css';
import 'highlight.js/styles/github-dark.css';

const lowlight = createLowlight(common);

/**
 * BlogEditor — TipTap-based rich-text editor for the Posts surface (US-BLOG-008).
 *
 * Polished editor (post US-BLOG-009 autosave + US-BLOG-008 polish):
 *  - StarterKit (paragraphs, headings, lists, blockquote, horizontal rule)
 *  - CodeBlockLowlight (syntax-highlighted code, common langs preloaded)
 *  - Tables (resizable, header row, GFM round-trip)
 *  - Slash command menu (/ for headings, lists, tables, code, divider, image)
 *  - Link, Image, Placeholder, Typography
 *  - Markdown round-trip with GFM tables + strikethrough
 *  - Autosave wired by parent (BlogPostEditor → POST /blog-post-revisions)
 *
 * Still deferred:
 *  - Inline AI rewrite toolbar (needs _shared/blog/llm.ts helper first)
 *  - Footnotes + callouts/admonitions (custom node extensions)
 *  - Image upload via blog_assets (US-BLOG-010)
 *  - Style guide linting overlay (US-BLOG-005 + editor wiring)
 */

interface BlogEditorProps {
  /** Initial Markdown value. Editor renders converted HTML; round-trip on save. */
  value: string;
  /** Called with both representations every time the editor content changes. */
  onChange: (next: { markdown: string; html: string }) => void;
  /** Empty-state placeholder shown when the editor is empty. */
  placeholder?: string;
  /** Minimum visible height in px (default 360). */
  minHeight?: number;
  /** Hide the toolbar (read-only consumers). */
  readOnly?: boolean;
  /** Disable Tailwind border + padding when embedding in another card. */
  bare?: boolean;
}

export function BlogEditor({
  value,
  onChange,
  placeholder = 'Start writing your post…',
  minHeight = 360,
  readOnly = false,
  bare = false,
}: BlogEditorProps) {
  const initialHtml = useMemo(() => markdownToHtml(value ?? ''), [value]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        // We bring our own code block (lowlight-wrapped) below.
        codeBlock: false,
      }),
      CodeBlockLowlight.configure({
        lowlight,
        defaultLanguage: 'plaintext',
        HTMLAttributes: {
          class: 'rounded-md bg-zinc-900 dark:bg-zinc-950 text-zinc-100 p-3 overflow-x-auto',
        },
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: 'border-collapse table-auto w-full my-3 border border-border text-sm',
        },
      }),
      TableRow,
      TableHeader.configure({
        HTMLAttributes: {
          class: 'border border-border bg-muted/50 px-2 py-1 text-left font-semibold',
        },
      }),
      TableCell.configure({
        HTMLAttributes: {
          class: 'border border-border px-2 py-1 align-top',
        },
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          class: 'underline underline-offset-2 text-primary hover:text-primary/80',
          rel: 'noopener noreferrer nofollow',
          target: '_blank',
        },
      }),
      Image.configure({
        inline: false,
        allowBase64: false,
        HTMLAttributes: {
          class: 'rounded-md max-w-full h-auto',
        },
      }),
      Placeholder.configure({ placeholder }),
      Typography,
      SlashCommand,
    ],
    content: initialHtml,
    editable: !readOnly,
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-sm sm:prose dark:prose-invert max-w-none focus:outline-none',
          bare ? '' : 'p-4',
        ),
        spellcheck: 'true',
      },
      // Convert pasted Markdown into rich nodes (US-BLOG-008 AC #2)
      handlePaste: (view, event) => {
        const text = event.clipboardData?.getData('text/plain');
        const html = event.clipboardData?.getData('text/html');
        // If the clipboard has HTML, let TipTap handle it natively.
        if (html && html.trim()) return false;
        // Plain text that looks like Markdown? Convert.
        if (text && looksLikeMarkdown(text)) {
          const converted = markdownToHtml(text);
          view.dispatch(
            view.state.tr.replaceSelectionWith(
              view.state.schema.text(''), // clear selection placeholder
            ),
          );
          // Insert converted HTML
          const editorInstance = (view as unknown as { tiptapEditor?: Editor }).tiptapEditor;
          editorInstance?.commands.insertContent(converted);
          event.preventDefault();
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: e }) => {
      const html = e.getHTML();
      const markdown = htmlToMarkdown(html);
      onChange({ markdown, html });
    },
  });

  // If `value` changes externally (e.g., parent reset / hydration), update.
  useEffect(() => {
    if (!editor) return;
    const currentMarkdown = htmlToMarkdown(editor.getHTML());
    if ((value ?? '') !== currentMarkdown) {
      editor.commands.setContent(markdownToHtml(value ?? ''), { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  // Cleanup on unmount handled by useEditor

  const setLink = useCallback(() => {
    if (!editor) return;
    const previous = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Link URL', previous ?? 'https://');
    if (url === null) return; // cancelled
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  const insertImage = useCallback(() => {
    if (!editor) return;
    const url = window.prompt('Image URL');
    if (!url) return;
    const alt = window.prompt('Alt text (for accessibility + SEO)') ?? '';
    editor.chain().focus().setImage({ src: url, alt }).run();
  }, [editor]);

  if (!editor) {
    return (
      <div
        className={cn('rounded-md border bg-muted/20 animate-pulse', bare ? '' : 'min-h-[200px]')}
        style={{ minHeight }}
      />
    );
  }

  return (
    <div className={cn('flex flex-col', bare ? '' : 'rounded-md border bg-background')}>
      {!readOnly ? (
        <EditorToolbar editor={editor} onSetLink={setLink} onInsertImage={insertImage} />
      ) : null}
      <div className="flex-1" style={{ minHeight }}>
        <EditorContent editor={editor} />
      </div>
      {!readOnly ? (
        <div className="px-3 py-1.5 border-t bg-muted/20 text-[11px] text-muted-foreground">
          Tip: type <kbd className="px-1 py-0.5 rounded border bg-background font-mono">/</kbd> for
          block commands (headings, lists, tables, code, divider, image)
        </div>
      ) : null}
    </div>
  );
}

interface EditorToolbarProps {
  editor: Editor;
  onSetLink: () => void;
  onInsertImage: () => void;
}

function EditorToolbar({ editor, onSetLink, onInsertImage }: EditorToolbarProps) {
  const isActive = (name: string, attrs?: Record<string, unknown>) => editor.isActive(name, attrs);

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b p-1.5 bg-muted/30">
      <ToolbarBtn
        label="Bold"
        icon={Bold}
        active={isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <ToolbarBtn
        label="Italic"
        icon={Italic}
        active={isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <ToolbarBtn
        label="Strikethrough"
        icon={Strikethrough}
        active={isActive('strike')}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      />
      <ToolbarSeparator />
      <ToolbarBtn
        label="Heading 1"
        icon={Heading1}
        active={isActive('heading', { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      />
      <ToolbarBtn
        label="Heading 2"
        icon={Heading2}
        active={isActive('heading', { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      />
      <ToolbarBtn
        label="Heading 3"
        icon={Heading3}
        active={isActive('heading', { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      />
      <ToolbarSeparator />
      <ToolbarBtn
        label="Bullet list"
        icon={List}
        active={isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      />
      <ToolbarBtn
        label="Numbered list"
        icon={ListOrdered}
        active={isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      />
      <ToolbarBtn
        label="Quote"
        icon={Quote}
        active={isActive('blockquote')}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      />
      <ToolbarBtn
        label="Code block"
        icon={Code}
        active={isActive('codeBlock')}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      />
      <ToolbarBtn
        label="Table (3×3)"
        icon={TableIcon}
        active={isActive('table')}
        onClick={() =>
          editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
        }
      />
      <ToolbarSeparator />
      <ToolbarBtn label="Link" icon={LinkIcon} active={isActive('link')} onClick={onSetLink} />
      <ToolbarBtn label="Image" icon={ImageIcon} onClick={onInsertImage} />
      <ToolbarSeparator />
      <ToolbarBtn
        label="Undo"
        icon={Undo}
        disabled={!editor.can().chain().focus().undo().run()}
        onClick={() => editor.chain().focus().undo().run()}
      />
      <ToolbarBtn
        label="Redo"
        icon={Redo}
        disabled={!editor.can().chain().focus().redo().run()}
        onClick={() => editor.chain().focus().redo().run()}
      />
    </div>
  );
}

interface ToolbarBtnProps {
  label: string;
  icon: typeof Bold;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}

function ToolbarBtn({ label, icon: Icon, onClick, active, disabled }: ToolbarBtnProps) {
  return (
    <Button
      type="button"
      variant={active ? 'secondary' : 'ghost'}
      size="sm"
      className="h-7 w-7 p-0"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon className="h-3.5 w-3.5" />
    </Button>
  );
}

function ToolbarSeparator() {
  return <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />;
}

/**
 * Heuristic for "looks like Markdown so should be converted to HTML on paste."
 * Conservative — only triggers on patterns rich text can't represent natively.
 */
function looksLikeMarkdown(text: string): boolean {
  if (!text) return false;
  // Multi-line text with at least one Markdown-ish marker
  const markers = [
    /^#{1,6}\s+\S/m, // # heading
    /^[-*+]\s+\S/m, // - bullet
    /^\d+\.\s+\S/m, // 1. ordered
    /^>\s+\S/m, // > quote
    /^```/m, // ``` fence
    /\[[^\]]+\]\([^)]+\)/, // [text](url)
    /\*\*[^*\n]+\*\*/, // **bold**
    /(?<!\*)\*[^*\n]+\*(?!\*)/, // *italic*
  ];
  return markers.some((re) => re.test(text));
}

export default BlogEditor;
