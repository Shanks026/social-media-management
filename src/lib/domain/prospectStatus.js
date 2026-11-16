// Prospect stage vocabulary: ADR 0006. STATUSES mirrors prospects_status_check.
import { labeler } from './labeler'

/** The stored stages, in pipeline order. */
export const STATUSES = [
  'NEW',
  'CONTACTED',
  'FOLLOW_UP',
  'DISCOVERY_CALL',
  'PROPOSAL_SENT',
  'CHANGES_REQUESTED',
  'PROPOSAL_ACCEPTED',
  'CONTRACT_SENT',
  'WON',
  'LOST',
]

/**
 * Stages that sending a Proposal moves past (to PROPOSAL_SENT). Includes
 * CHANGES_REQUESTED, so a resend after a rework records the response again.
 * A Prospect already further along is never moved backwards.
 */
export const STAGES_BEFORE_PROPOSAL_SENT = [
  'NEW',
  'CONTACTED',
  'FOLLOW_UP',
  'DISCOVERY_CALL',
  'CHANGES_REQUESTED',
]

export const statusLabel = labeler({
  NEW: 'New',
  CONTACTED: 'Contacted',
  FOLLOW_UP: 'Follow-Up',
  DISCOVERY_CALL: 'Discovery Call',
  PROPOSAL_SENT: 'Proposal Sent',
  CHANGES_REQUESTED: 'Changes Requested',
  PROPOSAL_ACCEPTED: 'Proposal Accepted',
  CONTRACT_SENT: 'Contract Sent',
  WON: 'Won',
  LOST: 'Lost',
})
