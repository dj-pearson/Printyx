import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { sanitizeRichHtml } from '@/lib/sanitize-html';
import { 
  Bold, 
  Italic, 
  Underline, 
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  List, 
  ListOrdered,
  Link,
  Image,
  Type,
  Palette,
  Minus,
  Quote,
  Code,
  Undo,
  Redo
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
}

const RichTextEditor = ({ value, onChange, placeholder = "Start typing...", className = "", minHeight = "200px" }: RichTextEditorProps) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');

  useEffect(() => {
    if (editorRef.current) {
      const sanitizedValue = sanitizeRichHtml(value);
      if (editorRef.current.innerHTML !== sanitizedValue) {
        editorRef.current.innerHTML = sanitizedValue;
      }
    }
  }, [value]);

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    handleInput();
  };

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Handle keyboard shortcuts
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 'b':
          e.preventDefault();
          execCommand('bold');
          break;
        case 'i':
          e.preventDefault();
          execCommand('italic');
          break;
        case 'u':
          e.preventDefault();
          execCommand('underline');
          break;
        case 'z':
          e.preventDefault();
          execCommand(e.shiftKey ? 'redo' : 'undo');
          break;
      }
    }
  };

  const insertLink = () => {
    if (linkUrl && linkText) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        const link = document.createElement('a');
        link.href = linkUrl;
        link.textContent = linkText;
        link.className = 'text-blue-600 underline';
        range.insertNode(link);
        selection.removeAllRanges();
        handleInput();
      }
    }
    setIsLinkDialogOpen(false);
    setLinkUrl('');
    setLinkText('');
  };

  const insertImage = () => {
    const url = prompt('Enter image URL:');
    if (url) {
      execCommand('insertImage', url);
    }
  };

  const setFontSize = (size: string) => {
    execCommand('fontSize', size);
  };

  const setTextColor = (color: string) => {
    execCommand('foreColor', color);
  };

  const setBackgroundColor = (color: string) => {
    execCommand('backColor', color);
  };

  const formatBlock = (tag: string) => {
    execCommand('formatBlock', tag);
  };

  return (
    <div className={`border rounded-lg overflow-hidden ${className}`}>
      {/* Toolbar */}
      <div className="bg-gray-50 border-b p-2 sm:p-3 flex flex-wrap items-center gap-1 sm:gap-2">
        {/* Undo/Redo */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => execCommand('undo')}
          className="h-10 w-10 p-0 touch-manipulation active:scale-[0.98]"
        >
          <Undo className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => execCommand('redo')}
          className="h-10 w-10 p-0 touch-manipulation active:scale-[0.98]"
        >
          <Redo className="h-4 w-4" />
        </Button>

        <Separator orientation="vertical" className="mx-1 h-6 hidden sm:block" />

        {/* Text Format */}
        <Select onValueChange={formatBlock}>
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
        <Select onValueChange={setFontSize}>
          <SelectTrigger className="w-14 sm:w-16 h-10 touch-manipulation text-xs sm:text-sm">
            <SelectValue placeholder="12" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">8pt</SelectItem>
            <SelectItem value="2">10pt</SelectItem>
            <SelectItem value="3">12pt</SelectItem>
            <SelectItem value="4">14pt</SelectItem>
            <SelectItem value="5">18pt</SelectItem>
            <SelectItem value="6">24pt</SelectItem>
            <SelectItem value="7">36pt</SelectItem>
          </SelectContent>
        </Select>

        <Separator orientation="vertical" className="mx-1 h-6 hidden sm:block" />

        {/* Text Styling */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => execCommand('bold')}
          className="h-10 w-10 p-0 touch-manipulation active:scale-[0.98]"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => execCommand('italic')}
          className="h-10 w-10 p-0 touch-manipulation active:scale-[0.98]"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => execCommand('underline')}
          className="h-10 w-10 p-0 touch-manipulation active:scale-[0.98]"
        >
          <Underline className="h-4 w-4" />
        </Button>

        <Separator orientation="vertical" className="mx-1 h-6 hidden sm:block" />

        {/* Text Color */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-10 w-10 p-0 touch-manipulation active:scale-[0.98]"
            >
              <Type className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full sm:w-48">
            <div className="space-y-2">
              <Label>Text Color</Label>
              <div className="flex gap-1 flex-wrap">
                {[
                  '#000000', '#333333', '#666666', '#999999',
                  '#FF0000', '#00FF00', '#0000FF', '#FFFF00',
                  '#FF00FF', '#00FFFF', '#FFA500', '#800080'
                ].map(color => (
                  <button
                    key={color}
                    className="w-8 h-8 sm:w-6 sm:h-6 rounded border-2 border-gray-300 touch-manipulation active:scale-[0.95]"
                    style={{ backgroundColor: color }}
                    onClick={() => setTextColor(color)}
                  />
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Background Color */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-10 w-10 p-0 touch-manipulation active:scale-[0.98]"
            >
              <Palette className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full sm:w-48">
            <div className="space-y-2">
              <Label>Background Color</Label>
              <div className="flex gap-1 flex-wrap">
                {[
                  '#FFFFFF', '#F0F0F0', '#D0D0D0', '#B0B0B0',
                  '#FFE0E0', '#E0FFE0', '#E0E0FF', '#FFFFE0',
                  '#FFE0FF', '#E0FFFF', '#FFEAA7', '#DDA0DD'
                ].map(color => (
                  <button
                    key={color}
                    className="w-8 h-8 sm:w-6 sm:h-6 rounded border-2 border-gray-300 touch-manipulation active:scale-[0.95]"
                    style={{ backgroundColor: color }}
                    onClick={() => setBackgroundColor(color)}
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
          onClick={() => execCommand('justifyLeft')}
          className="h-10 w-10 p-0 touch-manipulation active:scale-[0.98]"
        >
          <AlignLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => execCommand('justifyCenter')}
          className="h-10 w-10 p-0 touch-manipulation active:scale-[0.98]"
        >
          <AlignCenter className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => execCommand('justifyRight')}
          className="h-10 w-10 p-0 touch-manipulation active:scale-[0.98]"
        >
          <AlignRight className="h-4 w-4" />
        </Button>

        <Separator orientation="vertical" className="mx-1 h-6 hidden sm:block" />

        {/* Lists */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => execCommand('insertUnorderedList')}
          className="h-10 w-10 p-0 touch-manipulation active:scale-[0.98]"
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => execCommand('insertOrderedList')}
          className="h-10 w-10 p-0 touch-manipulation active:scale-[0.98]"
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
              className="h-10 w-10 p-0 touch-manipulation active:scale-[0.98]"
            >
              <Link className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full max-w-[90vw] sm:w-80">
            <div className="space-y-2">
              <Label>Insert Link</Label>
              <Input
                placeholder="Link text"
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
          className="h-10 w-10 p-0 touch-manipulation active:scale-[0.98]"
        >
          <Image className="h-4 w-4" />
        </Button>

        <Separator orientation="vertical" className="mx-1 h-6 hidden sm:block" />

        {/* Special */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => execCommand('insertHorizontalRule')}
          className="h-10 w-10 p-0 touch-manipulation active:scale-[0.98]"
        >
          <Minus className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => formatBlock('blockquote')}
          className="h-10 w-10 p-0 touch-manipulation active:scale-[0.98]"
        >
          <Quote className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => execCommand('formatBlock', 'pre')}
          className="h-10 w-10 p-0 touch-manipulation active:scale-[0.98]"
        >
          <Code className="h-4 w-4" />
        </Button>
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        className="p-4 focus:outline-none"
        style={{ minHeight }}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(value) }}
        data-placeholder={placeholder}
      />

      <style jsx>{`
        div[contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #9CA3AF;
          pointer-events: none;
        }
        div[contenteditable] h1 {
          font-size: 2rem;
          font-weight: bold;
          margin: 1rem 0;
        }
        div[contenteditable] h2 {
          font-size: 1.5rem;
          font-weight: bold;
          margin: 0.875rem 0;
        }
        div[contenteditable] h3 {
          font-size: 1.25rem;
          font-weight: bold;
          margin: 0.75rem 0;
        }
        div[contenteditable] h4 {
          font-size: 1.125rem;
          font-weight: bold;
          margin: 0.625rem 0;
        }
        div[contenteditable] p {
          margin: 0.5rem 0;
        }
        div[contenteditable] blockquote {
          border-left: 4px solid #E5E7EB;
          padding-left: 1rem;
          margin: 1rem 0;
          color: #6B7280;
          font-style: italic;
        }
        div[contenteditable] pre {
          background: #F3F4F6;
          padding: 1rem;
          border-radius: 0.375rem;
          font-family: 'Courier New', monospace;
          overflow-x: auto;
        }
        div[contenteditable] ul, div[contenteditable] ol {
          margin: 0.5rem 0;
          padding-left: 1.5rem;
        }
        div[contenteditable] li {
          margin: 0.25rem 0;
        }
        div[contenteditable] img {
          max-width: 100%;
          height: auto;
          border-radius: 0.375rem;
          margin: 0.5rem 0;
        }
        div[contenteditable] a {
          color: #3B82F6;
          text-decoration: underline;
        }
        div[contenteditable] hr {
          border: none;
          border-top: 1px solid #E5E7EB;
          margin: 1rem 0;
        }
      `}</style>
    </div>
  );
};

export default RichTextEditor;