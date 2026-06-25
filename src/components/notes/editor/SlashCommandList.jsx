import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'

const SlashCommandList = forwardRef(function SlashCommandList({ items, command }, ref) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const containerRef = useRef(null)

  // Clamp so a narrowing list never points out of bounds (avoids a reset effect).
  const safeIndex = items.length ? Math.min(selectedIndex, items.length - 1) : 0

  // Keep the highlighted row visible as the user arrows through a long list.
  useEffect(() => {
    const el = containerRef.current?.querySelector(`[data-index="${safeIndex}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [safeIndex])

  const selectItem = (index) => {
    const item = items[index]
    if (item) command(item)
  }

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === 'ArrowUp') {
        setSelectedIndex((i) => {
          const cur = Math.min(i, items.length - 1)
          return (cur + items.length - 1) % items.length
        })
        return true
      }
      if (event.key === 'ArrowDown') {
        setSelectedIndex((i) => {
          const cur = Math.min(i, items.length - 1)
          return (cur + 1) % items.length
        })
        return true
      }
      if (event.key === 'Enter') {
        selectItem(safeIndex)
        return true
      }
      return false
    },
  }))

  if (!items.length) {
    return (
      <div className="rounded-lg border bg-popover text-popover-foreground shadow-md p-2 text-sm text-muted-foreground">
        No results
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="w-64 max-h-80 overflow-y-auto rounded-lg border bg-popover text-popover-foreground shadow-md p-1"
    >
      {items.map((item, index) => {
        const Icon = item.icon
        return (
          <button
            key={item.title}
            type="button"
            data-index={index}
            onClick={() => selectItem(index)}
            onMouseMove={() => setSelectedIndex(index)}
            className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
              index === safeIndex
                ? 'bg-accent text-accent-foreground'
                : 'text-foreground'
            }`}
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md border bg-background">
              {Icon && <Icon className="size-4" />}
            </span>
            <span className="flex flex-col">
              <span className="font-medium leading-tight">{item.title}</span>
              {item.subtitle && (
                <span className="text-xs text-muted-foreground">{item.subtitle}</span>
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
})

export default SlashCommandList
