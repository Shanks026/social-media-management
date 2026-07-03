import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createWrapper } from '../test-utils'

// ─── Mocks ───────────────────────────────────────────────────────────────────

let mockComments = []
let mockCreate = vi.fn()

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', email: 'me@x.com', user_metadata: { full_name: 'Me Myself' } },
  }),
}))

vi.mock('@/api/usePermissions', () => ({
  usePermissions: () => ({ isAdmin: true }),
}))

vi.mock('@/api/team', () => ({
  useTeamMembers: () => ({
    data: [
      { member_user_id: 'u2', full_name: 'Tanya Benedict', email: 't@x.com', avatar_url: null },
    ],
  }),
}))

vi.mock('@/api/comments', () => ({
  useComments: () => ({ data: mockComments, isLoading: false }),
  createComment: (...args) => mockCreate(...args),
  updateComment: vi.fn(),
  softDeleteComment: vi.fn(),
  commentKeys: { thread: () => ['comments'] },
}))

import { CommentThread } from '@/components/comments/CommentThread'

function renderThread() {
  const Wrapper = createWrapper()
  return render(
    <Wrapper>
      <CommentThread entityType="campaign" entityId="camp-1" />
    </Wrapper>,
  )
}

describe('CommentThread', () => {
  beforeEach(() => {
    mockComments = []
    mockCreate = vi.fn().mockResolvedValue({})
  })

  it('shows the empty state when there are no comments', () => {
    renderThread()
    expect(screen.getByText('No comments yet')).toBeInTheDocument()
  })

  it('renders a comment with its author name', () => {
    mockComments = [
      {
        id: 'c1',
        author_user_id: 'u2',
        body: 'looks good to me',
        mentioned_uids: [],
        created_at: new Date('2026-07-01T10:00:00Z').toISOString(),
      },
    ]
    renderThread()
    expect(screen.getByText('Tanya Benedict')).toBeInTheDocument()
    expect(screen.getByText('looks good to me')).toBeInTheDocument()
  })

  it('highlights an @mention resolved from mentioned_uids', () => {
    mockComments = [
      {
        id: 'c1',
        author_user_id: 'u1',
        body: 'hey @Tanya Benedict check this',
        mentioned_uids: ['u2'],
        created_at: new Date('2026-07-01T10:00:00Z').toISOString(),
      },
    ]
    renderThread()
    // The mention token renders in its own muted span
    const mention = screen.getByText('@Tanya Benedict')
    expect(mention).toBeInTheDocument()
    expect(mention.className).toMatch(/bg-muted/)
  })

  it('posts a comment via createComment with the entity context', async () => {
    const user = userEvent.setup()
    renderThread()

    const textarea = screen.getByLabelText('Write a comment')
    await user.type(textarea, 'my new comment')
    await user.click(screen.getByRole('button', { name: /comment/i }))

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1))
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'campaign',
        entityId: 'camp-1',
        body: 'my new comment',
        mentionedUids: [],
      }),
    )
  })

  it('shows a tombstone for a soft-deleted comment', () => {
    mockComments = [
      {
        id: 'c1',
        author_user_id: 'u2',
        body: 'gone',
        mentioned_uids: [],
        created_at: new Date('2026-07-01T10:00:00Z').toISOString(),
        deleted_at: new Date('2026-07-01T11:00:00Z').toISOString(),
      },
    ]
    renderThread()
    expect(screen.getByText('This comment was deleted.')).toBeInTheDocument()
    expect(screen.queryByText('gone')).not.toBeInTheDocument()
  })
})
