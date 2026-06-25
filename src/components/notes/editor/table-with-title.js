import { Node } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

// A caption line above a table. Shows a muted "Untitled" placeholder while empty
// (always visible, not only when focused) via a scoped decoration plugin.
export const TableTitle = Node.create({
  name: 'tableTitle',
  group: 'block',
  content: 'inline*',
  selectable: false,

  parseHTML() {
    return [{ tag: 'div[data-type="table-title"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      { ...HTMLAttributes, 'data-type': 'table-title', class: 'table-title' },
      0,
    ]
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('tableTitlePlaceholder'),
        props: {
          decorations: (state) => {
            const decorations = []
            state.doc.descendants((node, pos) => {
              if (node.type.name === 'tableTitle' && node.content.size === 0) {
                decorations.push(
                  Decoration.node(pos, pos + node.nodeSize, {
                    class: 'is-table-title-empty',
                    'data-placeholder': 'Untitled',
                  }),
                )
              }
            })
            return DecorationSet.create(state.doc, decorations)
          },
        },
      }),
    ]
  },
})

// Wraps a title + a table so they move and delete together.
export const TableContainer = Node.create({
  name: 'tableContainer',
  group: 'block',
  content: 'tableTitle table',

  parseHTML() {
    return [{ tag: 'div[data-type="table-container"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      { ...HTMLAttributes, 'data-type': 'table-container', class: 'table-container' },
      0,
    ]
  },

  addCommands() {
    return {
      // Delete the whole container (title + table) — used by the table toolbar so
      // we never leave a title-only container that violates the schema.
      deleteTableContainer:
        () =>
        ({ state, dispatch }) => {
          const { $from } = state.selection
          for (let depth = $from.depth; depth > 0; depth--) {
            if ($from.node(depth).type.name === 'tableContainer') {
              if (dispatch) {
                dispatch(state.tr.delete($from.before(depth), $from.after(depth)))
              }
              return true
            }
          }
          return false
        },
    }
  },
})
