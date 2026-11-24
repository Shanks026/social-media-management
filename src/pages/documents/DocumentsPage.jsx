import { useEffect } from 'react'

import { useHeader } from '@/components/misc/header-context'
import { useDocuments } from '@/api/documents'
import DocumentsTab from '@/components/documents/DocumentsTab'

// The Documents page is its heading around the one Documents list with no
// scope (spec #208). The list owns the toolbar, filters, tabs, empty states
// and dialogs. The heading's count is the workspace's active documents, read
// from the same cached list, so it does not move as the filters change.
export default function DocumentsPage() {
  const { setHeader } = useHeader()
  useEffect(() => {
    setHeader({
      title: 'Documents',
      breadcrumbs: [
        { label: 'Operations', href: '/operations' },
        { label: 'Documents', href: '/documents' },
      ],
    })
  }, [setHeader])

  const { data: documents, isLoading } = useDocuments()
  const activeCount = (documents ?? []).filter((d) => d.status !== 'ARCHIVED').length

  return (
    <div className="min-h-full bg-background selection:bg-primary/10">
      <div className="px-8 pt-8 pb-20 space-y-6 max-w-[1400px] mx-auto animate-in fade-in duration-500">
        <div className="space-y-1">
          <h1 className="text-3xl font-normal tracking-tight text-foreground bricolage">
            Documents{' '}
            {!isLoading && activeCount > 0 && (
              <span className="text-muted-foreground/50 ml-2 font-extralight">
                {activeCount}
              </span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground font-normal">
            All documents across your clients and workspace.
          </p>
        </div>

        <DocumentsTab />
      </div>
    </div>
  )
}
