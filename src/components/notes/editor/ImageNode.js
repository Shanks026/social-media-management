import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import ImageNodeView from './ImageNodeView.jsx'

export const ImageNode = Node.create({
  name: 'noteImage',
  group: 'block',
  atom: true,
  draggable: true,

  addOptions() {
    return { noteId: null }
  },

  addAttributes() {
    return {
      src: { default: null },
      width: { default: null },
      alt: { default: '' },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="note-image"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'note-image' })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView)
  },
})
