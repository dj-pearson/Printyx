// Slash command menu for the blog editor (US-BLOG-008 AC #4).
//
// Custom TipTap extension that wires @tiptap/suggestion to a tippy.js
// dropdown. Typing "/" at the start of a line or after whitespace opens a
// palette of block-level commands. Selecting a command consumes the slash
// trigger and runs the action.
//
// The command list is rendered by a separate React component
// (SlashCommandList.tsx) returned by `render()` below.

import { Extension, type Editor, type Range } from '@tiptap/core';
import Suggestion, { type SuggestionOptions } from '@tiptap/suggestion';
import { ReactRenderer } from '@tiptap/react';
import tippy, { type Instance as TippyInstance } from 'tippy.js';
import {
  Code,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  List,
  ListOrdered,
  Minus,
  Quote,
  Table as TableIcon,
} from 'lucide-react';
import { SlashCommandList, type SlashCommandListRef } from './SlashCommandList';

export interface SlashCommandItem {
  title: string;
  description: string;
  keywords: string[];
  icon: typeof Code;
  command: (params: { editor: Editor; range: Range }) => void;
}

const COMMANDS: SlashCommandItem[] = [
  {
    title: 'Heading 1',
    description: 'Big section heading',
    keywords: ['h1', 'heading', 'title'],
    icon: Heading1,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleHeading({ level: 1 }).run(),
  },
  {
    title: 'Heading 2',
    description: 'Medium section heading',
    keywords: ['h2', 'heading', 'subtitle'],
    icon: Heading2,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleHeading({ level: 2 }).run(),
  },
  {
    title: 'Heading 3',
    description: 'Small section heading',
    keywords: ['h3', 'heading'],
    icon: Heading3,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleHeading({ level: 3 }).run(),
  },
  {
    title: 'Bullet list',
    description: 'Unordered list',
    keywords: ['ul', 'list', 'bullet'],
    icon: List,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    title: 'Numbered list',
    description: 'Ordered list',
    keywords: ['ol', 'list', 'numbered', 'ordered'],
    icon: ListOrdered,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    title: 'Quote',
    description: 'Pull quote / blockquote',
    keywords: ['blockquote', 'quote'],
    icon: Quote,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
  },
  {
    title: 'Code block',
    description: 'Syntax-highlighted code',
    keywords: ['code', 'pre', 'snippet'],
    icon: Code,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },
  {
    title: 'Table',
    description: '3×3 table with header row',
    keywords: ['table', 'grid'],
    icon: TableIcon,
    command: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run(),
  },
  {
    title: 'Divider',
    description: 'Horizontal rule',
    keywords: ['hr', 'divider', 'separator'],
    icon: Minus,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
  {
    title: 'Image',
    description: 'Insert image from URL',
    keywords: ['img', 'image', 'picture'],
    icon: ImageIcon,
    command: ({ editor, range }) => {
      const url = window.prompt('Image URL');
      if (!url) return;
      const alt = window.prompt('Alt text (for accessibility + SEO)') ?? '';
      editor.chain().focus().deleteRange(range).setImage({ src: url, alt }).run();
    },
  },
];

function filterCommands(query: string): SlashCommandItem[] {
  if (!query) return COMMANDS;
  const q = query.toLowerCase();
  return COMMANDS.filter(
    (cmd) => cmd.title.toLowerCase().includes(q) || cmd.keywords.some((kw) => kw.includes(q)),
  ).slice(0, 8);
}

const suggestion: Omit<SuggestionOptions<SlashCommandItem>, 'editor'> = {
  char: '/',
  startOfLine: false,
  // Allow trailing space after "/" + a word but bail if the word grew beyond
  // a reasonable token — prevents the menu from staying open when the user
  // gives up and types a sentence.
  allowSpaces: false,
  items: ({ query }) => filterCommands(query),
  command: ({ editor, range, props }) => {
    props.command({ editor, range });
  },
  render: () => {
    let component: ReactRenderer<SlashCommandListRef> | null = null;
    let popup: TippyInstance | null = null;

    return {
      onStart: (props) => {
        component = new ReactRenderer(SlashCommandList, {
          props,
          editor: props.editor,
        });
        if (!props.clientRect) return;
        popup = tippy(document.body, {
          getReferenceClientRect: () => props.clientRect?.() ?? new DOMRect(),
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'bottom-start',
        });
      },
      onUpdate: (props) => {
        component?.updateProps(props);
        if (!props.clientRect || !popup) return;
        popup.setProps({
          getReferenceClientRect: () => props.clientRect?.() ?? new DOMRect(),
        });
      },
      onKeyDown: (props) => {
        if (props.event.key === 'Escape') {
          popup?.hide();
          return true;
        }
        return component?.ref?.onKeyDown(props) ?? false;
      },
      onExit: () => {
        popup?.destroy();
        component?.destroy();
        popup = null;
        component = null;
      },
    };
  },
};

export const SlashCommand = Extension.create({
  name: 'slashCommand',
  addOptions() {
    return { suggestion };
  },
  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});
