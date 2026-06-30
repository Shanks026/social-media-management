const PRINT_CSS = `
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
  font-size: 14px;
  line-height: 1.7;
  color: #0f172a;
  padding: 2.5cm 2.5cm 3cm;
  max-width: 100%;
}
h1.note-print-title {
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 0.75rem;
  line-height: 1.2;
}
.note-print-meta {
  font-size: 0.8rem;
  color: #64748b;
  margin-bottom: 1.75rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid #e2e8f0;
}
h1 { font-size: 1.6rem; font-weight: 700; line-height: 1.2; margin: 1.2em 0 0.4em; }
h2 { font-size: 1.3rem; font-weight: 700; line-height: 1.25; margin: 1em 0 0.35em; }
h3 { font-size: 1.1rem; font-weight: 600; margin: 0.8em 0 0.3em; }
p { margin: 0.35em 0; }
* + * { margin-top: 0.5em; }
p + p { margin-top: 0.35em; }
ul { list-style: disc; padding-left: 1.4rem; margin: 0.4em 0; }
ol { list-style: decimal; padding-left: 1.4rem; margin: 0.4em 0; }
li { margin: 0.15em 0; }
li p { margin: 0; }
blockquote {
  border-left: 3px solid #cbd5e1;
  padding-left: 1rem;
  color: #64748b;
  font-style: italic;
  margin: 0.6em 0;
}
pre {
  background: #f1f5f9;
  border-radius: 4px;
  padding: 0.75rem 1rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.85rem;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0.5em 0;
}
code {
  background: #f1f5f9;
  border-radius: 3px;
  padding: 0.1rem 0.35rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.85em;
}
pre code { background: none; padding: 0; }
a { color: #3b82f6; text-decoration: underline; }
hr { border: none; border-top: 1px solid #e2e8f0; margin: 1.25rem 0; }
/* Task lists */
ul[data-type='taskList'] { list-style: none; padding-left: 0; }
ul[data-type='taskList'] li { display: flex; align-items: flex-start; gap: 0.5rem; }
ul[data-type='taskList'] li > label { margin-top: 0.2rem; flex-shrink: 0; }
ul[data-type='taskList'] li > div { flex: 1; min-width: 0; }
ul[data-type='taskList'] li[data-checked='true'] p {
  text-decoration: line-through;
  color: #94a3b8;
}
/* Tables */
[data-type='table-container'] { margin: 0.75rem 0; }
[data-type='table-title'] {
  font-weight: 600;
  font-size: 0.95rem;
  margin-bottom: 0.35rem;
}
.tableWrapper { overflow: visible; }
table { border-collapse: collapse; width: 100%; }
td, th {
  border: 1px solid #cbd5e1;
  padding: 0.4rem 0.6rem;
  vertical-align: top;
  text-align: left;
  min-width: 4rem;
}
th { background: #f1f5f9; font-weight: 600; }
td p, th p { margin: 0; }
/* Media nodes */
[data-node-view-wrapper] { display: block; margin: 0.75rem 0; }
[data-node-view-wrapper] img { max-width: 100%; border-radius: 6px; display: block; }
[data-node-view-wrapper] video { max-width: 100%; border-radius: 6px; display: block; }
[data-media-controls] { display: none !important; }
/* Dropzone placeholders hidden in print */
[data-node-view-wrapper] [style*="border-dashed"] { display: none !important; }
@media print {
  body { padding: 0; }
  a { color: #3b82f6; }
  [data-media-controls] { display: none !important; }
}
`

export function printNote(title, html, clientName) {
  const meta = clientName
    ? `Linked to ${clientName}`
    : 'Agency-wide note'

  const iframe = document.createElement('iframe')
  iframe.style.cssText =
    'position:fixed;top:0;left:0;width:0;height:0;border:none;visibility:hidden'
  document.body.appendChild(iframe)

  const doc = iframe.contentDocument || iframe.contentWindow.document
  doc.open()
  doc.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title || 'Untitled')}</title>
  <style>${PRINT_CSS}</style>
</head>
<body>
  <h1 class="note-print-title">${escapeHtml(title || 'Untitled')}</h1>
  <p class="note-print-meta">${escapeHtml(meta)}</p>
  ${html}
</body>
</html>`)
  doc.close()

  iframe.contentWindow.focus()
  iframe.contentWindow.print()

  setTimeout(() => {
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe)
  }, 1500)
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
