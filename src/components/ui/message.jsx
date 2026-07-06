import { cn } from '@/lib/utils'

function MessageGroup({ className, ...props }) {
  return (
    <div
      data-slot="message-group"
      className={cn('flex min-w-0 flex-col gap-2', className)}
      {...props}
    />
  )
}

function Message({ className, align = 'start', ...props }) {
  return (
    <div
      data-slot="message"
      data-align={align}
      className={cn(
        'group/message relative flex w-full min-w-0 gap-2 text-sm data-[align=end]:flex-row-reverse',
        className,
      )}
      {...props}
    />
  )
}

function MessageAvatar({ className, ...props }) {
  return (
    <div
      data-slot="message-avatar"
      className={cn(
        'flex w-fit min-w-8 shrink-0 items-center justify-center self-end overflow-hidden rounded-full bg-muted',
        className,
      )}
      {...props}
    />
  )
}

function MessageContent({ className, ...props }) {
  return (
    <div
      data-slot="message-content"
      className={cn(
        'flex w-full min-w-0 flex-col gap-1.5 wrap-break-word group-data-[align=end]/message:items-end',
        className,
      )}
      {...props}
    />
  )
}

function MessageHeader({ className, ...props }) {
  return (
    <div
      data-slot="message-header"
      className={cn(
        'flex max-w-full min-w-0 items-center gap-2 px-1 text-xs font-medium text-muted-foreground',
        className,
      )}
      {...props}
    />
  )
}

export { MessageGroup, Message, MessageAvatar, MessageContent, MessageHeader }
