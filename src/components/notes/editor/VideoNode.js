import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import VideoNodeView from './VideoNodeView.jsx'

export const VideoNode = Node.create({
  name: 'noteVideo',
  group: 'block',
  atom: true,
  draggable: true,

  addOptions() {
    return { noteId: null }
  },

  addAttributes() {
    return {
      src: { default: null },
      width: { default: 100 },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="note-video"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'note-video' })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(VideoNodeView)
  },
})
