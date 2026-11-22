import { useEffect } from 'react'

import { useHeader } from '@/components/misc/header-context'
import { useProposals, useProposalLimit } from '@/api/proposals'
import { ProposalTab } from '@/components/proposals/ProposalTab'

// The Proposals page is its heading around the one Proposals list with no
// scope (spec #200). The list owns the toolbar, filters, tabs, empty state and
// dialogs; the heading's count comes from the Plan-limit hook, so it always
// matches the list's "X of Y used" counter.
export default function ProposalsPage() {
  const { setHeader } = useHeader()
  useEffect(() => {
    setHeader({ title: 'Proposals', breadcrumbs: [{ label: 'Proposals' }] })
  }, [setHeader])

  const { used: activeCount } = useProposalLimit()
  const { isLoading } = useProposals()

  return (
    <div className="min-h-full bg-background">
      <div className="px-8 pt-8 pb-20 space-y-6 max-w-[1400px] mx-auto animate-in fade-in duration-700">
        <div className="space-y-1">
          <h1 className="text-3xl font-normal tracking-tight text-foreground bricolage">
            Proposals{' '}
            {!isLoading && activeCount > 0 && (
              <span className="text-muted-foreground/50 ml-2 font-extralight">
                {activeCount}
              </span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground font-normal">
            Upload and track proposals sent to clients and prospects.
          </p>
        </div>

        <ProposalTab />
      </div>
    </div>
  )
}
