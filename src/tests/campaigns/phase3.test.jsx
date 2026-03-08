import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { createWrapper } from '../test-utils'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
  },
}))

// sonner toast mock
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

// ─── Shared test data ─────────────────────────────────────────────────────────

const baseCampaignData = {
  campaign_id: 'camp-1',
  campaign_name: 'Summer Launch',
  goal: 'Drive 500 sign-ups',
  agency_name: 'Test Agency',
  logo_url: 'https://example.com/logo.png',
  branding_agency_sidebar: true,
  branding_powered_by: true,
  posts: [
    {
      post_id: 'post-1',
      title: 'First Post',
      content: 'Content here',
      platform: ['instagram'],
      target_date: '2026-04-01T00:00:00Z',
      media_urls: [],
      status: 'PENDING_APPROVAL',
      version_number: 1,
      review_token: 'token-post-1',
    },
    {
      post_id: 'post-2',
      title: 'Second Post',
      content: null,
      platform: ['linkedin'],
      target_date: null,
      media_urls: ['https://example.com/image.jpg'],
      status: 'PENDING_APPROVAL',
      version_number: 1,
      review_token: 'token-post-2',
    },
  ],
}

// ─── Group A — Token RPC / useCampaignReview hook ────────────────────────────

describe('Group A — Token RPC / useCampaignReview hook', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns campaign data for a valid token', async () => {
    const { useCampaignReview } = await import('@/api/campaigns')
    supabase.rpc.mockResolvedValue({ data: [baseCampaignData], error: null })

    const { result } = renderHook(() => useCampaignReview('valid-token'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toMatchObject({ campaign_name: 'Summer Launch' })
    expect(supabase.rpc).toHaveBeenCalledWith('get_campaign_by_review_token', {
      p_token: 'valid-token',
    })
  })

  it('returns null for an invalid / unknown token (empty array)', async () => {
    const { useCampaignReview } = await import('@/api/campaigns')
    supabase.rpc.mockResolvedValue({ data: [], error: null })

    const { result } = renderHook(() => useCampaignReview('bad-token'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBeNull()
  })

  it('posts array contains only PENDING_APPROVAL posts (filtered by RPC)', async () => {
    const { useCampaignReview } = await import('@/api/campaigns')
    supabase.rpc.mockResolvedValue({ data: [baseCampaignData], error: null })

    const { result } = renderHook(() => useCampaignReview('valid-token'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    // All posts in the mock have status PENDING_APPROVAL — confirm length
    expect(result.current.data.posts).toHaveLength(2)
  })

  it('is not enabled when token is falsy', async () => {
    const { useCampaignReview } = await import('@/api/campaigns')

    const { result } = renderHook(() => useCampaignReview(''), {
      wrapper: createWrapper(),
    })

    // Should not have triggered a fetch
    expect(result.current.fetchStatus).toBe('idle')
    expect(supabase.rpc).not.toHaveBeenCalled()
  })
})

// ─── Group B — Page states ────────────────────────────────────────────────────

// We mock useCampaignReview to control page state in render tests
vi.mock('@/api/campaigns', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual }
})

function renderReview(token = 'test-token') {
  return render(
    <MemoryRouter initialEntries={[`/campaign-review/${token}`]}>
      <Routes>
        <Route path="/campaign-review/:token" element={<CampaignReview />} />
      </Routes>
    </MemoryRouter>,
  )
}

// Lazy import after mocks are established
let CampaignReview
beforeEach(async () => {
  vi.resetModules()
  CampaignReview = (await import('@/pages/campaigns/CampaignReview')).default
})

describe('Group B — Page states', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders loading skeleton while fetching', async () => {
    const { useCampaignReview } = await import('@/api/campaigns')
    vi.mocked(useCampaignReview).mockReturnValue({ isLoading: true, isError: false, data: undefined })

    renderReview()

    // Skeleton elements present (no main content rendered)
    const skeletons = document.querySelectorAll('[data-slot="skeleton"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('shows error state with refresh button on fetch error', async () => {
    const { useCampaignReview } = await import('@/api/campaigns')
    vi.mocked(useCampaignReview).mockReturnValue({ isLoading: false, isError: true, data: undefined })

    renderReview()

    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument()
  })

  it('shows invalid token state when data is null', async () => {
    const { useCampaignReview } = await import('@/api/campaigns')
    vi.mocked(useCampaignReview).mockReturnValue({ isLoading: false, isError: false, data: null })

    renderReview()

    expect(screen.getByText(/this link is not valid or has expired/i)).toBeInTheDocument()
  })

  it('shows "nothing to review" when posts array is empty', async () => {
    const { useCampaignReview } = await import('@/api/campaigns')
    vi.mocked(useCampaignReview).mockReturnValue({
      isLoading: false,
      isError: false,
      data: { ...baseCampaignData, posts: [] },
    })

    renderReview()

    expect(screen.getByText(/nothing to review right now/i)).toBeInTheDocument()
  })

  it('renders two-panel layout when posts are present', async () => {
    const { useCampaignReview } = await import('@/api/campaigns')
    vi.mocked(useCampaignReview).mockReturnValue({
      isLoading: false,
      isError: false,
      data: baseCampaignData,
    })

    renderReview()

    expect(screen.getByText('First Post')).toBeInTheDocument()
    expect(screen.getByText('Second Post')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /approve this post/i })).toBeInTheDocument()
  })
})

// ─── Group C — Per-post actions ───────────────────────────────────────────────

describe('Group C — Per-post actions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('approve calls submitCampaignPostReview with SCHEDULED and empty feedback', async () => {
    const { useCampaignReview, submitCampaignPostReview } = await import('@/api/campaigns')
    vi.mocked(useCampaignReview).mockReturnValue({
      isLoading: false,
      isError: false,
      data: baseCampaignData,
    })
    vi.mocked(submitCampaignPostReview).mockResolvedValue(undefined)

    renderReview()

    const approveBtn = screen.getByRole('button', { name: /approve this post/i })
    await act(async () => fireEvent.click(approveBtn))

    expect(submitCampaignPostReview).toHaveBeenCalledWith('token-post-1', 'SCHEDULED', '')
  })

  it('request revisions calls submitCampaignPostReview with NEEDS_REVISION and trimmed feedback', async () => {
    const { useCampaignReview, submitCampaignPostReview } = await import('@/api/campaigns')
    vi.mocked(useCampaignReview).mockReturnValue({
      isLoading: false,
      isError: false,
      data: baseCampaignData,
    })
    vi.mocked(submitCampaignPostReview).mockResolvedValue(undefined)

    renderReview()

    const textarea = screen.getByPlaceholderText(/describe what needs to change/i)
    fireEvent.change(textarea, { target: { value: '  needs fixing  ' } })

    const reviseBtn = screen.getByRole('button', { name: /request revisions/i })
    await act(async () => fireEvent.click(reviseBtn))

    expect(submitCampaignPostReview).toHaveBeenCalledWith(
      'token-post-1',
      'NEEDS_REVISION',
      'needs fixing',
    )
  })

  it('request revisions button is disabled when feedback is empty', async () => {
    const { useCampaignReview } = await import('@/api/campaigns')
    vi.mocked(useCampaignReview).mockReturnValue({
      isLoading: false,
      isError: false,
      data: baseCampaignData,
    })

    renderReview()

    const reviseBtn = screen.getByRole('button', { name: /request revisions/i })
    expect(reviseBtn).toBeDisabled()
  })

  it('shows toast.error and keeps post in list when RPC fails', async () => {
    const { useCampaignReview, submitCampaignPostReview } = await import('@/api/campaigns')
    vi.mocked(useCampaignReview).mockReturnValue({
      isLoading: false,
      isError: false,
      data: baseCampaignData,
    })
    vi.mocked(submitCampaignPostReview).mockRejectedValue(new Error('DB error'))

    renderReview()

    const approveBtn = screen.getByRole('button', { name: /approve this post/i })
    await act(async () => fireEvent.click(approveBtn))

    expect(toast.error).toHaveBeenCalledWith('Failed to submit — please try again')
    // Post is still shown in the left panel
    expect(screen.getByText('First Post')).toBeInTheDocument()
  })
})

// ─── Group D — Progress + auto-advance ───────────────────────────────────────

describe('Group D — Progress + auto-advance', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows "0 of 2 posts reviewed" initially', async () => {
    const { useCampaignReview } = await import('@/api/campaigns')
    vi.mocked(useCampaignReview).mockReturnValue({
      isLoading: false,
      isError: false,
      data: baseCampaignData,
    })

    renderReview()

    expect(screen.getByText(/0 of 2 posts reviewed/i)).toBeInTheDocument()
  })

  it('shows "1 of 2 posts reviewed" after approving the first post', async () => {
    const { useCampaignReview, submitCampaignPostReview } = await import('@/api/campaigns')
    vi.mocked(useCampaignReview).mockReturnValue({
      isLoading: false,
      isError: false,
      data: baseCampaignData,
    })
    vi.mocked(submitCampaignPostReview).mockResolvedValue(undefined)

    renderReview()

    const approveBtn = screen.getByRole('button', { name: /approve this post/i })
    await act(async () => fireEvent.click(approveBtn))

    expect(screen.getByText(/1 of 2 posts reviewed/i)).toBeInTheDocument()
  })

  it('shows completion screen after all posts are actioned', async () => {
    const { useCampaignReview, submitCampaignPostReview } = await import('@/api/campaigns')
    vi.mocked(useCampaignReview).mockReturnValue({
      isLoading: false,
      isError: false,
      data: { ...baseCampaignData, posts: [baseCampaignData.posts[0]] },
    })
    vi.mocked(submitCampaignPostReview).mockResolvedValue(undefined)

    renderReview()

    const approveBtn = screen.getByRole('button', { name: /approve this post/i })
    await act(async () => fireEvent.click(approveBtn))

    expect(screen.getByText(/all posts reviewed/i)).toBeInTheDocument()
    expect(
      screen.getByText(/your feedback has been sent to the agency/i),
    ).toBeInTheDocument()
  })
})

// ─── Group E — Branding ───────────────────────────────────────────────────────

describe('Group E — Branding', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows agency logo when branding_agency_sidebar=true and logo_url set', async () => {
    const { useCampaignReview } = await import('@/api/campaigns')
    vi.mocked(useCampaignReview).mockReturnValue({
      isLoading: false,
      isError: false,
      data: { ...baseCampaignData, branding_agency_sidebar: true, logo_url: 'https://example.com/logo.png' },
    })

    renderReview()

    const logoImg = screen.getByAltText('Test Agency')
    expect(logoImg).toBeInTheDocument()
    expect(logoImg).toHaveAttribute('src', 'https://example.com/logo.png')
  })

  it('shows agency name text only when branding_agency_sidebar=true and no logo_url', async () => {
    const { useCampaignReview } = await import('@/api/campaigns')
    vi.mocked(useCampaignReview).mockReturnValue({
      isLoading: false,
      isError: false,
      data: { ...baseCampaignData, branding_agency_sidebar: true, logo_url: null },
    })

    renderReview()

    expect(screen.getByText('Test Agency')).toBeInTheDocument()
  })

  it('hides "Powered by Tercero" when branding_powered_by=false', async () => {
    const { useCampaignReview } = await import('@/api/campaigns')
    vi.mocked(useCampaignReview).mockReturnValue({
      isLoading: false,
      isError: false,
      data: { ...baseCampaignData, branding_powered_by: false },
    })

    renderReview()

    expect(screen.queryByText(/powered by tercero/i)).not.toBeInTheDocument()
  })

  it('shows "Powered by Tercero" when branding_powered_by=true', async () => {
    const { useCampaignReview } = await import('@/api/campaigns')
    vi.mocked(useCampaignReview).mockReturnValue({
      isLoading: false,
      isError: false,
      data: { ...baseCampaignData, branding_powered_by: true },
    })

    renderReview()

    expect(screen.getByText(/powered by tercero/i)).toBeInTheDocument()
  })
})

// ─── Group F — Share button (CampaignDetailPage) ──────────────────────────────

vi.mock('@/components/misc/header-context', () => ({
  useHeader: vi.fn().mockReturnValue({ setHeader: vi.fn() }),
}))
vi.mock('@/api/useSubscription', () => ({
  useSubscription: vi.fn().mockReturnValue({ data: { agency_name: 'Test Agency', logo_url: null } }),
}))

const baseCampaignRow = {
  id: 'camp-1',
  client_id: 'client-1',
  name: 'Q2 Launch',
  goal: 'Drive sign-ups',
  status: 'Active',
  start_date: null,
  end_date: null,
  budget: null,
  review_token: 'campaign-review-token-abc',
}

describe('Group F — Share Review Link button', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows Share Review Link button when PENDING_APPROVAL posts exist', async () => {
    const campaigns = await import('@/api/campaigns')
    vi.mocked(campaigns.useCampaign).mockReturnValue({ data: baseCampaignRow, isLoading: false })
    vi.mocked(campaigns.useCampaignAnalytics).mockReturnValue({ data: { total_posts: 1, published_posts: 0, on_time_posts: 0, avg_approval_days: null, platform_distribution: {}, budget: null, total_invoiced: 0, total_collected: 0 }, isLoading: false })
    vi.mocked(campaigns.useCampaignInvoices).mockReturnValue({ data: [], isLoading: false })
    const { useGlobalPosts } = await import('@/api/useGlobalPosts')
    vi.mocked(useGlobalPosts).mockReturnValue({ data: [{ id: 'p1', status: 'PENDING_APPROVAL', campaign_id: 'camp-1', title: 'Post', platform: [], target_date: null, media_urls: [] }], isLoading: false })

    const CampaignDetailPage = (await import('@/pages/campaigns/CampaignDetailPage')).default
    render(
      <MemoryRouter initialEntries={['/campaigns/camp-1']}>
        <Routes>
          <Route path="/campaigns/:campaignId" element={<CampaignDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByRole('button', { name: /share review link/i })).toBeInTheDocument()
  })

  it('hides Share Review Link button when no PENDING_APPROVAL posts', async () => {
    const campaigns = await import('@/api/campaigns')
    vi.mocked(campaigns.useCampaign).mockReturnValue({ data: baseCampaignRow, isLoading: false })
    vi.mocked(campaigns.useCampaignAnalytics).mockReturnValue({ data: { total_posts: 1, published_posts: 1, on_time_posts: 1, avg_approval_days: null, platform_distribution: {}, budget: null, total_invoiced: 0, total_collected: 0 }, isLoading: false })
    vi.mocked(campaigns.useCampaignInvoices).mockReturnValue({ data: [], isLoading: false })
    const { useGlobalPosts } = await import('@/api/useGlobalPosts')
    vi.mocked(useGlobalPosts).mockReturnValue({ data: [{ id: 'p1', status: 'PUBLISHED', campaign_id: 'camp-1', title: 'Post', platform: [], target_date: null, media_urls: [] }], isLoading: false })

    const CampaignDetailPage = (await import('@/pages/campaigns/CampaignDetailPage')).default
    render(
      <MemoryRouter initialEntries={['/campaigns/camp-1']}>
        <Routes>
          <Route path="/campaigns/:campaignId" element={<CampaignDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.queryByRole('button', { name: /share review link/i })).not.toBeInTheDocument()
  })

  it('hides Share Review Link button when campaign.review_token is null', async () => {
    const campaigns = await import('@/api/campaigns')
    vi.mocked(campaigns.useCampaign).mockReturnValue({
      data: { ...baseCampaignRow, review_token: null },
      isLoading: false,
    })
    vi.mocked(campaigns.useCampaignAnalytics).mockReturnValue({ data: { total_posts: 1, published_posts: 0, on_time_posts: 0, avg_approval_days: null, platform_distribution: {}, budget: null, total_invoiced: 0, total_collected: 0 }, isLoading: false })
    vi.mocked(campaigns.useCampaignInvoices).mockReturnValue({ data: [], isLoading: false })
    const { useGlobalPosts } = await import('@/api/useGlobalPosts')
    vi.mocked(useGlobalPosts).mockReturnValue({ data: [{ id: 'p1', status: 'PENDING_APPROVAL', campaign_id: 'camp-1', title: 'Post', platform: [], target_date: null, media_urls: [] }], isLoading: false })

    const CampaignDetailPage = (await import('@/pages/campaigns/CampaignDetailPage')).default
    render(
      <MemoryRouter initialEntries={['/campaigns/camp-1']}>
        <Routes>
          <Route path="/campaigns/:campaignId" element={<CampaignDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.queryByRole('button', { name: /share review link/i })).not.toBeInTheDocument()
  })

  it('calls clipboard.writeText with the correct URL on share click', async () => {
    const writeMock = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeMock },
      writable: true,
      configurable: true,
    })

    const campaigns = await import('@/api/campaigns')
    vi.mocked(campaigns.useCampaign).mockReturnValue({ data: baseCampaignRow, isLoading: false })
    vi.mocked(campaigns.useCampaignAnalytics).mockReturnValue({ data: { total_posts: 1, published_posts: 0, on_time_posts: 0, avg_approval_days: null, platform_distribution: {}, budget: null, total_invoiced: 0, total_collected: 0 }, isLoading: false })
    vi.mocked(campaigns.useCampaignInvoices).mockReturnValue({ data: [], isLoading: false })
    const { useGlobalPosts } = await import('@/api/useGlobalPosts')
    vi.mocked(useGlobalPosts).mockReturnValue({ data: [{ id: 'p1', status: 'PENDING_APPROVAL', campaign_id: 'camp-1', title: 'Post', platform: [], target_date: null, media_urls: [] }], isLoading: false })

    const CampaignDetailPage = (await import('@/pages/campaigns/CampaignDetailPage')).default
    render(
      <MemoryRouter initialEntries={['/campaigns/camp-1']}>
        <Routes>
          <Route path="/campaigns/:campaignId" element={<CampaignDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )

    const shareBtn = screen.getByRole('button', { name: /share review link/i })
    await act(async () => fireEvent.click(shareBtn))

    expect(writeMock).toHaveBeenCalledWith(
      expect.stringContaining('/campaign-review/campaign-review-token-abc'),
    )
    expect(toast.success).toHaveBeenCalledWith('Review link copied to clipboard')
  })

  it('opens fallback dialog when clipboard write fails', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
      writable: true,
      configurable: true,
    })

    const campaigns = await import('@/api/campaigns')
    vi.mocked(campaigns.useCampaign).mockReturnValue({ data: baseCampaignRow, isLoading: false })
    vi.mocked(campaigns.useCampaignAnalytics).mockReturnValue({ data: { total_posts: 1, published_posts: 0, on_time_posts: 0, avg_approval_days: null, platform_distribution: {}, budget: null, total_invoiced: 0, total_collected: 0 }, isLoading: false })
    vi.mocked(campaigns.useCampaignInvoices).mockReturnValue({ data: [], isLoading: false })
    const { useGlobalPosts } = await import('@/api/useGlobalPosts')
    vi.mocked(useGlobalPosts).mockReturnValue({ data: [{ id: 'p1', status: 'PENDING_APPROVAL', campaign_id: 'camp-1', title: 'Post', platform: [], target_date: null, media_urls: [] }], isLoading: false })

    const CampaignDetailPage = (await import('@/pages/campaigns/CampaignDetailPage')).default
    render(
      <MemoryRouter initialEntries={['/campaigns/camp-1']}>
        <Routes>
          <Route path="/campaigns/:campaignId" element={<CampaignDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )

    const shareBtn = screen.getByRole('button', { name: /share review link/i })
    await act(async () => fireEvent.click(shareBtn))

    expect(screen.getByText(/campaign review link/i)).toBeInTheDocument()
    expect(screen.getByDisplayValue(expect.stringContaining('/campaign-review/'))).toBeInTheDocument()
  })
})
