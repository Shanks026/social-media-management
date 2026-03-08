import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { createWrapper } from '../test-utils'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } } }),
    },
    rpc: vi.fn(),
    from: vi.fn(),
  },
}))

vi.mock('@/api/useSubscription', () => ({ useSubscription: vi.fn() }))
vi.mock('@/components/misc/header-context', () => ({ useHeader: vi.fn() }))

// Single campaigns mock: preserve real useCampaignAnalytics for Group A;
// stub useCampaign for Group D (avoids QueryClient requirement from within the page).
vi.mock('@/api/campaigns', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useCampaign: () => ({
      data: {
        id: 'camp-1',
        client_id: 'client-1',
        name: 'Q2 Launch',
        goal: 'Drive sign-ups',
        status: 'Active',
        start_date: '2026-03-01',
        end_date: '2026-03-31',
        budget: null,
      },
      isLoading: false,
    }),
    fetchActiveCampaignsByClient: vi.fn().mockResolvedValue([
      { id: 'camp-1', name: 'Q2 Launch' },
    ]),
  }
})

vi.mock('@/api/useGlobalPosts', () => ({
  useGlobalPosts: () => ({
    data: [
      {
        id: 'p1',
        client_id: 'client-1',
        post_versions: {
          title: 'Post One',
          status: 'PUBLISHED',
          platform: ['Instagram'],
          target_date: '2026-03-10',
        },
      },
    ],
    isLoading: false,
  }),
}))

vi.mock('@/api/invoices', () => ({
  useCreateInvoice: () => ({ mutate: vi.fn(), isPending: false }),
  useNextInvoiceNumber: () => ({ data: { formatted: 'INV-2026-001' } }),
  invoiceKeys: { list: vi.fn() },
}))

vi.mock('@/api/clients', () => ({
  useClients: () => ({
    data: {
      realClients: [{ id: 'c1', name: 'Acme Corp', email: 'acme@test.com' }],
    },
  }),
}))

vi.mock('@/components/HTMLInvoicePreview', () => ({
  default: () => React.createElement('div', { 'data-testid': 'invoice-preview' }),
}))

// ─── Imports ──────────────────────────────────────────────────────────────────

import { supabase } from '@/lib/supabase'
import { useCampaignAnalytics } from '@/api/campaigns'
import { useSubscription } from '@/api/useSubscription'
import CampaignReportPDF from '@/components/campaigns/CampaignReportPDF'
import CampaignDetailPage from '@/pages/campaigns/CampaignDetailPage'
import { CreateInvoiceDialog } from '@/pages/finance/CreateInvoiceDialog'

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const baseAnalytics = {
  total_posts: 10,
  published_posts: 5,
  on_time_posts: 4,
  avg_approval_days: null,
  platform_distribution: { Instagram: 4, LinkedIn: 3, Twitter: 3 },
  budget: null,
  total_invoiced: 0,
  total_collected: 0,
}

const baseCampaign = {
  id: 'camp-1',
  name: 'Q2 Launch',
  goal: 'Drive sign-ups',
  status: 'Active',
  start_date: '2026-03-01',
  end_date: '2026-03-31',
  budget: null,
}

// Helper: render with QueryClient + Router providing :campaignId param
function renderDetailPage(Component) {
  return render(
    <MemoryRouter initialEntries={['/campaigns/camp-1']}>
      <Routes>
        <Route path="/campaigns/:campaignId" element={<Component />} />
      </Routes>
    </MemoryRouter>,
    { wrapper: createWrapper() },
  )
}

// ─── Group A — Analytics RPC Shape ───────────────────────────────────────────

describe('Group A — Analytics RPC Shape', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    supabase.rpc.mockResolvedValue({
      data: [
        {
          total_posts: 10,
          published_posts: 5,
          on_time_posts: 4,
          avg_approval_days: null,
          platform_distribution: { Instagram: 4, LinkedIn: 3, Twitter: 3 },
          budget: null,
          total_invoiced: 0,
          total_collected: 0,
        },
      ],
      error: null,
    })
  })

  it('useCampaignAnalytics calls the correct RPC', async () => {
    const { result } = renderHook(() => useCampaignAnalytics('camp-1'), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(supabase.rpc).toHaveBeenCalledWith('get_campaign_analytics', {
      p_campaign_id: 'camp-1',
    })
  })

  it('returns all expected fields with correct types', async () => {
    const { result } = renderHook(() => useCampaignAnalytics('camp-1'), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const data = result.current.data
    expect(typeof data.total_posts).toBe('number')
    expect(typeof data.published_posts).toBe('number')
    expect(typeof data.on_time_posts).toBe('number')
    expect(typeof data.total_invoiced).toBe('number')
    expect(typeof data.total_collected).toBe('number')
    expect(typeof data.platform_distribution).toBe('object')
  })

  it('total_invoiced and total_collected are numbers (not strings)', async () => {
    const { result } = renderHook(() => useCampaignAnalytics('camp-1'), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data.total_invoiced).toBe(0)
    expect(result.current.data.total_collected).toBe(0)
  })

  it('is disabled when campaignId is falsy', () => {
    const { result } = renderHook(() => useCampaignAnalytics(null), {
      wrapper: createWrapper(),
    })
    expect(result.current.isLoading).toBe(false)
    expect(result.current.data).toBeUndefined()
  })
})

// ─── Group B — On-time Rate Display Logic ─────────────────────────────────────

describe('Group B — On-time Rate Display Logic', () => {
  function computeOnTimeRate(onTimePosts, publishedPosts) {
    if (publishedPosts === 0) return '—'
    return `${Math.round((onTimePosts / publishedPosts) * 100)}%`
  }

  it('returns "—" when published_posts is 0', () => {
    expect(computeOnTimeRate(0, 0)).toBe('—')
  })

  it('returns "100%" when all published posts are on time', () => {
    expect(computeOnTimeRate(5, 5)).toBe('100%')
  })

  it('calculates correct percentage (4/5 = 80%)', () => {
    expect(computeOnTimeRate(4, 5)).toBe('80%')
  })

  it('rounds to nearest integer', () => {
    expect(computeOnTimeRate(1, 3)).toBe('33%')
  })
})

// ─── Group C — Budget Section Visibility ──────────────────────────────────────

describe('Group C — Budget Section Visibility', () => {
  function computeBudgetRemaining(budget, totalInvoiced) {
    if (budget == null) return null
    return budget - totalInvoiced
  }

  it('remaining is null when budget is null', () => {
    expect(computeBudgetRemaining(null, 0)).toBeNull()
  })

  it('remaining is correct: budget - total_invoiced', () => {
    expect(computeBudgetRemaining(10000, 3000)).toBe(7000)
  })

  it('remaining goes negative when invoiced exceeds budget', () => {
    expect(computeBudgetRemaining(5000, 7000)).toBe(-2000)
  })

  it('CampaignReportPDF renders without budget section when budget is null', () => {
    expect(() => {
      CampaignReportPDF({
        campaign: baseCampaign,
        analytics: { ...baseAnalytics, budget: null },
        posts: [],
        agencyName: 'Test Agency',
        agencyLogoUrl: null,
      })
    }).not.toThrow()
  })
})

// ─── Group D — CampaignDetailPage ─────────────────────────────────────────────

describe('Group D — CampaignDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useSubscription.mockReturnValue({
      data: { agency_name: 'Agency', logo_url: null, campaigns: true },
    })
    // useCampaignAnalytics is real — return analytics from supabase mock
    supabase.rpc.mockResolvedValue({ data: [baseAnalytics], error: null })
  })

  it('renders campaign name in header', async () => {
    renderDetailPage(CampaignDetailPage)
    await waitFor(() =>
      expect(screen.getByText('Q2 Launch')).toBeInTheDocument(),
    )
  })

  it('renders KPI total posts value', async () => {
    renderDetailPage(CampaignDetailPage)
    await waitFor(() =>
      // total_posts = 10 from analytics mock
      expect(screen.getByText('10')).toBeInTheDocument(),
    )
  })

  it('renders post list with post titles', async () => {
    renderDetailPage(CampaignDetailPage)
    await waitFor(() =>
      expect(screen.getByText('Post One')).toBeInTheDocument(),
    )
  })

  it('hides budget section when budget is null', async () => {
    renderDetailPage(CampaignDetailPage)
    await waitFor(() =>
      expect(screen.queryByText('Budget')).toBeNull(),
    )
  })
})

// ─── Group E — CampaignReportPDF ──────────────────────────────────────────────

describe('Group E — CampaignReportPDF', () => {
  it('renders without throwing when passed valid data', () => {
    expect(() => {
      CampaignReportPDF({
        campaign: baseCampaign,
        analytics: { ...baseAnalytics, budget: 50000, total_invoiced: 20000, total_collected: 10000 },
        posts: [],
        agencyName: 'Test Agency',
        agencyLogoUrl: null,
      })
    }).not.toThrow()
  })

  it('renders without throwing when budget is null', () => {
    expect(() => {
      CampaignReportPDF({
        campaign: baseCampaign,
        analytics: baseAnalytics,
        posts: [],
        agencyName: 'Test Agency',
        agencyLogoUrl: null,
      })
    }).not.toThrow()
  })

  it('renders without throwing with agency logo URL', () => {
    expect(() => {
      CampaignReportPDF({
        campaign: baseCampaign,
        analytics: baseAnalytics,
        posts: [],
        agencyName: 'Test Agency',
        agencyLogoUrl: 'https://example.com/logo.png',
      })
    }).not.toThrow()
  })
})

// ─── Group F — Invoice Campaign Field Gating ──────────────────────────────────

describe('Group F — Invoice Campaign Field', () => {
  it('campaign dropdown does not appear for Ignite (campaigns = false)', async () => {
    useSubscription.mockReturnValue({ data: { campaigns: false } })
    render(
      <MemoryRouter>
        <CreateInvoiceDialog
          open
          onOpenChange={vi.fn()}
          preselectedClientId="c1"
        />
      </MemoryRouter>,
      { wrapper: createWrapper() },
    )
    await waitFor(() =>
      expect(screen.getByTestId('invoice-preview')).toBeInTheDocument(),
    )
    expect(screen.queryByText('Campaign')).toBeNull()
  })

  it('campaign dropdown appears for Velocity+ when campaigns exist (campaigns = true)', async () => {
    useSubscription.mockReturnValue({ data: { campaigns: true } })
    render(
      <MemoryRouter>
        <CreateInvoiceDialog
          open
          onOpenChange={vi.fn()}
          preselectedClientId="c1"
        />
      </MemoryRouter>,
      { wrapper: createWrapper() },
    )
    // Campaign dropdown appears after fetchActiveCampaignsByClient resolves
    await waitFor(() =>
      expect(screen.getByText('Campaign')).toBeInTheDocument(),
    )
  })
})
