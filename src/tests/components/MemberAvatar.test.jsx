import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemberAvatar } from '@/components/MemberAvatar'

describe('MemberAvatar', () => {
  it('shows initials from the full name when there is no picture', () => {
    render(<MemberAvatar member={{ full_name: 'Olivia Owner' }} />)
    expect(screen.getByText('OO')).toBeTruthy()
  })

  it('accepts name and avatarUrl style members', () => {
    render(<MemberAvatar member={{ name: 'Adam Admin' }} />)
    expect(screen.getByText('AA')).toBeTruthy()
  })

  it('falls back to the email, then to ?', () => {
    const { unmount } = render(<MemberAvatar member={{ email: 'mia@example.com' }} />)
    expect(screen.getByText('M')).toBeTruthy()
    unmount()
    render(<MemberAvatar member={null} />)
    expect(screen.getByText('?')).toBeTruthy()
  })

  it('shows initials while an image has not loaded (broken URL)', () => {
    render(<MemberAvatar member={{ full_name: 'Mia Member', avatar_url: 'https://invalid.example/x.png' }} />)
    expect(screen.getByText('MM')).toBeTruthy()
  })
})
