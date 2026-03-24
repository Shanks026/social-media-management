import { ProposalTab } from '@/components/proposals/ProposalTab'

/**
 * Proposals tab scoped to a single prospect.
 * Wraps the shared ProposalTab with prospect context so all dialogs
 * pre-fill and lock the prospect fields.
 */
export default function ProspectProposalsTab({ prospect }) {
  return (
    <ProposalTab
      prospectId={prospect.id}
      prospectName={prospect.business_name}
      prospectEmail={prospect.email ?? null}
    />
  )
}
