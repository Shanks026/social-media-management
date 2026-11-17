import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

function bar(variant) {
  return (
    <Tabs defaultValue="a">
      <TabsList variant={variant}>
        <TabsTrigger value="a">Alpha</TabsTrigger>
        <TabsTrigger value="b">Beta</TabsTrigger>
      </TabsList>
    </Tabs>
  )
}

describe('Tabs variants', () => {
  it('underline list and its triggers share one look', () => {
    render(bar('underline'))
    const list = screen.getByRole('tablist')
    expect(list.getAttribute('data-variant')).toBe('underline')
    expect(list.className).toContain('border-b')
    expect(list.className).toContain('gap-8')
    for (const tab of screen.getAllByRole('tab')) {
      expect(tab.className).toContain('border-b-2')
      expect(tab.className).toContain('text-sm')
    }
  })

  it('leaves the default pill variant unchanged', () => {
    render(bar(undefined))
    const list = screen.getByRole('tablist')
    expect(list.getAttribute('data-variant')).toBe('default')
    expect(list.className).toContain('bg-muted')
    expect(list.className).not.toContain('border-b')
    for (const tab of screen.getAllByRole('tab')) {
      expect(tab.className).not.toContain('border-b-2')
      expect(tab.className).toContain('rounded-md')
    }
  })
})
