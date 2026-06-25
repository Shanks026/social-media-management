import { useState, useEffect } from 'react'
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import { TableContainer, TableTitle } from './editor/table-with-title'
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Link as LinkIcon,
  Check,
  X,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Rows3,
  Columns3,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import SlashCommand from './editor/slash-command'
import './editor/editor.css'

function normalizeUrl(url) {
  const trimmed = url.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed) || /^mailto:/i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

export default function RichTextEditor({ content, onChange, editable = true, editorRef }) {
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')

  const editor = useEditor({
    editable,
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({
        placeholder: "Type '/' for commands, or just start writing…",
      }),
      Link.configure({
        openOnClick: true,
        autolink: true,
        HTMLAttributes: { class: 'note-link', rel: 'noopener noreferrer', target: '_blank' },
      }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TableContainer,
      TableTitle,
      SlashCommand,
    ],
    content: content || '',
    onUpdate: ({ editor }) => onChange?.(JSON.stringify(editor.getJSON())),
    editorProps: {
      attributes: { class: 'focus:outline-none' },
    },
  })

  useEffect(() => {
    if (editorRef) editorRef.current = editor
  }, [editor, editorRef])

  if (!editor) return null

  const btn = (active) =>
    cn(
      'flex size-7 items-center justify-center rounded-md transition-colors hover:bg-accent',
      active ? 'bg-accent text-accent-foreground' : 'text-foreground',
    )

  const openLinkEditor = () => {
    setLinkUrl(editor.getAttributes('link').href || '')
    setLinkOpen(true)
  }

  const applyLink = () => {
    const url = normalizeUrl(linkUrl)
    if (url) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
    } else {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
    }
    setLinkOpen(false)
  }

  const removeLink = () => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run()
    setLinkOpen(false)
  }

  return (
    <div className="tiptap-content">
      <BubbleMenu
        editor={editor}
        pluginKey="formatBubble"
        tippyOptions={{ duration: 100, onHidden: () => setLinkOpen(false) }}
        shouldShow={({ editor, from, to }) => linkOpen || (from !== to && editor.isEditable)}
        className="flex items-center gap-0.5 rounded-lg border bg-popover p-1 shadow-md"
      >
        {linkOpen ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              type="text"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  applyLink()
                } else if (e.key === 'Escape') {
                  setLinkOpen(false)
                }
              }}
              placeholder="Paste or type a link…"
              className="h-7 w-52 rounded-md bg-background px-2 text-sm outline-none ring-1 ring-border focus:ring-2 focus:ring-ring"
            />
            <button type="button" onClick={applyLink} className={btn(false)} title="Apply">
              <Check className="size-4" />
            </button>
            <button type="button" onClick={removeLink} className={btn(false)} title="Remove link">
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              className={btn(editor.isActive('heading', { level: 1 }))}
              title="Heading 1"
            >
              <Heading1 className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              className={btn(editor.isActive('heading', { level: 2 }))}
              title="Heading 2"
            >
              <Heading2 className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              className={btn(editor.isActive('heading', { level: 3 }))}
              title="Heading 3"
            >
              <Heading3 className="size-4" />
            </button>
            <span className="mx-0.5 h-5 w-px bg-border" />
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={btn(editor.isActive('bold'))}
              title="Bold"
            >
              <Bold className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={btn(editor.isActive('italic'))}
              title="Italic"
            >
              <Italic className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleStrike().run()}
              className={btn(editor.isActive('strike'))}
              title="Strikethrough"
            >
              <Strikethrough className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleCode().run()}
              className={btn(editor.isActive('code'))}
              title="Inline code"
            >
              <Code className="size-4" />
            </button>
            <span className="mx-0.5 h-5 w-px bg-border" />
            <button
              type="button"
              onClick={openLinkEditor}
              className={btn(editor.isActive('link'))}
              title="Link"
            >
              <LinkIcon className="size-4" />
            </button>
          </>
        )}
      </BubbleMenu>

      <BubbleMenu
        editor={editor}
        pluginKey="tableBubble"
        tippyOptions={{ duration: 100, placement: 'top' }}
        shouldShow={({ editor, from, to }) => editor.isActive('table') && from === to}
        className="flex items-center gap-0.5 rounded-lg border bg-popover p-1 shadow-md"
      >
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().addColumnBefore().run()}
          className={btn(false)}
          title="Insert column left"
        >
          <ArrowLeft className="size-4" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().addColumnAfter().run()}
          className={btn(false)}
          title="Insert column right"
        >
          <ArrowRight className="size-4" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().addRowBefore().run()}
          className={btn(false)}
          title="Insert row above"
        >
          <ArrowUp className="size-4" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().addRowAfter().run()}
          className={btn(false)}
          title="Insert row below"
        >
          <ArrowDown className="size-4" />
        </button>
        <span className="mx-0.5 h-5 w-px bg-border" />
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().deleteColumn().run()}
          className="flex size-7 items-center justify-center rounded-md text-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          title="Delete column"
        >
          <Columns3 className="size-4" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().deleteRow().run()}
          className="flex size-7 items-center justify-center rounded-md text-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          title="Delete row"
        >
          <Rows3 className="size-4" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (!editor.chain().focus().deleteTableContainer().run()) {
              editor.chain().focus().deleteTable().run()
            }
          }}
          className="flex size-7 items-center justify-center rounded-md text-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          title="Delete table"
        >
          <Trash2 className="size-4" />
        </button>
      </BubbleMenu>

      <EditorContent editor={editor} />
    </div>
  )
}
