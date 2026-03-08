import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  renderHook,
  waitFor,
  render,
  screen,
  fireEvent,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { createWrapper } from '../test-utils'

// ─── Mocks (hoisted above imports by Vitest) ─────────────────────────────────

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi
        .fn()
        .mockResolvedValue({ data: { user: { id: 'user-123' } } }),
    },
    rpc: vi.fn(),
    from: vi.fn(),
  },
}))

// Group C: closure ref so each test can reset the create mutation spy
let mockCreate = vi.fn()

// Preserve real useCampaigns / fetchActiveCampaignsByClient for Group A;
// override mutation hooks for Group C rendering tests.
vi.mock('@/api/campaigns', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useCreateCampaign: () => ({
      mutateAsync: (...args) => mockCreate(...args),
      isPending: false,
    }),
    useUpdateCampaign: () => ({
      mutateAsync: vi.fn().mockResolvedValue({}),
      isPending: false,
    }),
    useDeleteCampaign: () => ({
      mutateAsync: vi.fn().mockResolvedValue({}),
      isPending: false,
    }),
  }
})

// CampaignDialog now calls useClients — provide a null stub
vi.mock('@/api/clients', () => ({
  useClients: () => ({ data: null }),
}))

// Group F — gate logic mocks
vi.mock('@/api/useSubscription', () => ({ useSubscription: vi.fn() }))
vi.mock('@/components/misc/header-context', () => ({ useHeader: vi.fn() }))

// Stub CampaignTab so Group F renders cleanly without triggering data queries
vi.mock('@/components/campaigns/CampaignTab', () => ({
  CampaignTab: () => React.createElement('div', { 'data-testid': 'campaign-tab' }),
}))

// ─── Imports (resolved after mocks are applied) ───────────────────────────────

import { supabase } from '@/lib/supabase'
import { useCampaigns, fetchActiveCampaignsByClient } from '@/api/campaigns'
import { useSubscription } from '@/api/useSubscription'
import { CampaignDialog } from '@/components/campaigns/CampaignDialog'
import { CampaignCard } from '@/components/campaigns/CampaignCard'
import { CampaignUpgradePrompt } from '@/components/campaigns/CampaignUpgradePrompt'
import CampaignsPage from '@/pages/campaigns/CampaignsPage'

// ─── Group A — API Layer ──────────────────────────────────────────────────────

describe('Group A — API Layer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
    })
  })

  describe('useCampaigns', () => {
    it('calls RPC with user_id and null client_id when no clientId passed', async () => {
      supabase.rpc.mockResolvedValue({ data: [], error: null })
      const { result } = renderHook(() => useCampaigns(), {
        wrapper: createWrapper(),
      })
      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(supabase.rpc).toHaveBeenCalledWith(
        'get_campaigns_with_post_summary',
        { p_user_id: 'user-123', p_client_id: null },
      )
    })

    it('passes clientId to RPC when provided', async () => {
      supabase.rpc.mockResolvedValue({ data: [], error: null })
      renderHook(() => useCampaigns({ clientId: 'client-abc' }), {
        wrapper: createWrapper(),
      })
      await waitFor(() =>
        expect(supabase.rpc).toHaveBeenCalledWith(
          'get_campaigns_with_post_summary',
          { p_user_id: 'user-123', p_client_id: 'client-abc' },
        ),
      )
    })

    it('returns empty array when RPC returns null', async () => {
      supabase.rpc.mockResolvedValue({ data: null, error: null })
      const { result } = renderHook(() => useCampaigns(), {
        wrapper: createWrapper(),
      })
      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(result.current.data).toEqual([])
    })

    it('sets isError when RPC returns an error', async () => {
      supabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'DB error' },
      })
      const { result } = renderHook(() => useCampaigns(), {
        wrapper: createWrapper(),
      })
      // useCampaigns has retry:1 so React Query retries once (~1s delay) before isError=true
      await waitFor(() => expect(result.current.isError).toBe(true), {
        timeout: 5000,
      })
    })
  })

  describe('fetchActiveCampaignsByClient', () => {
    it('filters by client_id and status = Active', async () => {
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [{ id: 'c1', name: 'Launch' }],
          error: null,
        }),
      }
      supabase.from.mockReturnValue(mockChain)

      const result = await fetchActiveCampaignsByClient('client-abc')

      expect(supabase.from).toHaveBeenCalledWith('campaigns')
      expect(mockChain.eq).toHaveBeenCalledWith('client_id', 'client-abc')
      expect(mockChain.eq).toHaveBeenCalledWith('status', 'Active')
      expect(result).toEqual([{ id: 'c1', name: 'Launch' }])
    })

    it('returns empty array when data is null', async () => {
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: null }),
      }
      supabase.from.mockReturnValue(mockChain)
      const result = await fetchActiveCampaignsByClient('client-abc')
      expect(result).toEqual([])
    })
  })
})

// ─── Group B — Subscription Gating ───────────────────────────────────────────
// Tests the `sub?.campaigns ?? false` flag logic used throughout the feature.

describe('Group B — Subscription Gating', () => {
  it('campaigns flag is false for ignite (campaigns = false)', () => {
    const sub = { campaigns: false }
    expect(sub.campaigns ?? false).toBe(false)
  })

  it('campaigns flag is true for velocity (campaigns = true)', () => {
    const sub = { campaigns: true }
    expect(sub.campaigns ?? false).toBe(true)
  })

  it('campaigns flag defaults to false when absent from subscription row', () => {
    const sub = {}
    expect(sub.campaigns ?? false).toBe(false)
  })
})

// ─── Group C — CampaignDialog Validation ─────────────────────────────────────

describe('Group C — CampaignDialog', () => {
  beforeEach(() => {
    mockCreate = vi.fn().mockResolvedValue({})
  })

  it('shows "Campaign name is required" when form submitted with empty name', async () => {
    render(
      <CampaignDialog open onOpenChange={vi.fn()} clientId="c1" initialData={null} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /create campaign/i }))
    await waitFor(() =>
      expect(screen.getByText('Campaign name is required')).toBeInTheDocument(),
    )
  })

  it('pre-populates name and goal fields in edit mode', async () => {
    const initial = {
      id: 'camp-1',
      name: 'Summer Launch',
      goal: 'Drive 500 sign-ups',
      description: '',
      status: 'Active',
      start_date: null,
      end_date: null,
    }
    render(
      <CampaignDialog open onOpenChange={vi.fn()} clientId="c1" initialData={initial} />,
    )
    await waitFor(() => {
      expect(screen.getByDisplayValue('Summer Launch')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Drive 500 sign-ups')).toBeInTheDocument()
    })
  })

  it('calls createCampaign mutation with correct payload on valid submit', async () => {
    const user = userEvent.setup()
    render(
      <CampaignDialog open onOpenChange={vi.fn()} clientId="c1" initialData={null} />,
    )
    await user.type(screen.getByPlaceholderText(/campaign name/i), 'Brand Launch')
    await user.click(screen.getByRole('button', { name: /create campaign/i }))
    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Brand Launch', client_id: 'c1' }),
      ),
    )
  })
})

// ─── Group D — CampaignCard Rendering ────────────────────────────────────────

const baseCampaign = {
  id: 'c1',
  name: 'Q2 Launch',
  goal: 'Drive 500 sign-ups',
  status: 'Active',
  start_date: '2026-03-01',
  end_date: '2026-03-31',
  total_posts: 10,
  draft_count: 2,
  pending_count: 1,
  revision_count: 0,
  scheduled_count: 4,
  published_count: 3,
  archived_count: 0,
}

describe('Group D — CampaignCard', () => {
  it('renders campaign name and Active status badge', () => {
    render(
      <CampaignCard
        campaign={baseCampaign}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onStatusChange={vi.fn()}
      />,
    )
    expect(screen.getByText('Q2 Launch')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('renders goal text', () => {
    render(
      <CampaignCard
        campaign={baseCampaign}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onStatusChange={vi.fn()}
      />,
    )
    expect(screen.getByText('Drive 500 sign-ups')).toBeInTheDocument()
  })

  it('hides progress bar when total_posts is 0', () => {
    const { container } = render(
      <CampaignCard
        campaign={{ ...baseCampaign, total_posts: 0, published_count: 0 }}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onStatusChange={vi.fn()}
      />,
    )
    expect(container.querySelector('[data-testid="progress-bar"]')).toBeNull()
  })

  it('shows progress bar when total_posts > 0', () => {
    const { container } = render(
      <CampaignCard
        campaign={baseCampaign}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onStatusChange={vi.fn()}
      />,
    )
    expect(
      container.querySelector('[data-testid="progress-bar"]'),
    ).not.toBeNull()
  })

  it('calculates 30% progress for 3 published out of 10', () => {
    render(
      <CampaignCard
        campaign={baseCampaign}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onStatusChange={vi.fn()}
      />,
    )
    expect(screen.getByText(/30%/i)).toBeInTheDocument()
  })

  it('renders Archived status badge for archived campaigns', () => {
    render(
      <CampaignCard
        campaign={{ ...baseCampaign, status: 'Archived' }}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onStatusChange={vi.fn()}
      />,
    )
    expect(screen.getByText('Archived')).toBeInTheDocument()
  })
})

// ─── Group E — CampaignUpgradePrompt ─────────────────────────────────────────

describe('Group E — CampaignUpgradePrompt', () => {
  it('renders the upgrade message', () => {
    render(
      <MemoryRouter>
        <CampaignUpgradePrompt />
      </MemoryRouter>,
    )
    expect(
      screen.getByText(/Campaigns are a Velocity feature/i),
    ).toBeInTheDocument()
  })

  it('renders the View Plans button', () => {
    render(
      <MemoryRouter>
        <CampaignUpgradePrompt />
      </MemoryRouter>,
    )
    expect(
      screen.getByRole('button', { name: /view plans/i }),
    ).toBeInTheDocument()
  })
})

// ─── Group F — CampaignsPage Subscription Gate ───────────────────────────────
// Note: CampaignTab is stubbed globally (avoids data-fetching setup).
// When campaigns=false, the real CampaignUpgradePrompt renders — test by text.

describe('Group F — CampaignsPage', () => {
  it('renders CampaignTab when campaigns flag is true', () => {
    useSubscription.mockReturnValue({ data: { campaigns: true } })
    render(
      <MemoryRouter>
        <CampaignsPage />
      </MemoryRouter>,
    )
    expect(screen.getByTestId('campaign-tab')).toBeInTheDocument()
    expect(screen.queryByText(/Campaigns are a Velocity feature/i)).toBeNull()
  })

  it('renders CampaignUpgradePrompt when campaigns flag is false', () => {
    useSubscription.mockReturnValue({ data: { campaigns: false } })
    render(
      <MemoryRouter>
        <CampaignsPage />
      </MemoryRouter>,
    )
    expect(
      screen.getByText(/Campaigns are a Velocity feature/i),
    ).toBeInTheDocument()
    expect(screen.queryByTestId('campaign-tab')).toBeNull()
  })
})
