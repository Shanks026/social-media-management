import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowUp, Pencil, Plus, SmilePlus, Trash2, X, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { usePermissions } from '@/api/usePermissions'
import {
  useChannelMessages,
  useMemberMap,
  sendMessage,
  editMessage,
  softDeleteMessage,
  toggleChatReaction,
  markChannelRead,
  CHAT_REACTION_EMOJIS,
  chatKeys,
} from '@/api/chat'
import { formatCompactTimeAgo } from '@/lib/helper'
import { splitMentions, detectMention, MENTION_CLASS, MENTION_TEXT_CLASS, MY_MENTION_TEXT_CLASS } from '@/lib/mentions'
import { MemberAvatar } from '@/components/chat/MemberAvatar'
import { Message, MessageAvatar as MessageAvatarSlot, MessageContent, MessageHeader } from '@/components/ui/message'
import { Bubble, BubbleContent, BubbleReactions } from '@/components/ui/bubble'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from '@/components/ui/input-group'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

// Mentions inside your own (colored, bg-chat-self) bubble need a lighter
// treatment — MENTION_TEXT_CLASS/MY_MENTION_TEXT_CLASS assume a neutral
// background (comments, and other people's messages here).
const OWN_MENTION_CLASS = 'font-semibold'

function MentionedMessageBody({ body, mentionNames, myMentionName, isOwn }) {
  const segments = splitMentions(body, mentionNames)
  return (
    <>
      {segments.map((seg, i) => {
        if (!seg.isMention) return <span key={i}>{seg.text}</span>
        if (isOwn) {
          return (
            <span key={i} className={OWN_MENTION_CLASS}>
              {seg.text}
            </span>
          )
        }
        return (
          <span key={i} className={myMentionName && seg.text === myMentionName ? MY_MENTION_TEXT_CLASS : MENTION_TEXT_CLASS}>
            {seg.text}
          </span>
        )
      })}
    </>
  )
}

// ─── Reactions — near-literal copy of CommentThread's, pointed at chat's
// own toggle RPC/emoji set (independent DB constraint from comments). ─────────

function groupReactions(reactions, memberMap, currentUserId) {
  const map = new Map()
  for (const r of reactions) {
    if (!map.has(r.emoji)) map.set(r.emoji, [])
    map.get(r.emoji).push(r.user_id)
  }
  return Array.from(map.entries()).map(([emoji, userIds]) => ({
    emoji,
    count: userIds.length,
    reactedByMe: userIds.includes(currentUserId),
    reactorNames: userIds
      .map((uid) => memberMap[uid]?.full_name || memberMap[uid]?.email || 'Someone')
      .join(', '),
  }))
}

// Lives in the hover action-icon row (with edit/delete) — just opens the
// emoji grid. Not gated by canModify: any channel member can react.
function ReactionTriggerButton({ messageId, onReacted }) {
  const [pickerOpen, setPickerOpen] = useState(false)

  async function handlePick(emoji) {
    setPickerOpen(false)
    try {
      await toggleChatReaction(messageId, emoji)
      onReacted()
    } catch (err) {
      toast.error(err.message || 'Failed to react')
    }
  }

  return (
    <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
      <PopoverTrigger asChild>
        <button
          className="text-muted-foreground hover:text-foreground p-0.5"
          title="Add reaction"
          aria-label="Add reaction"
        >
          <SmilePlus className="size-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-1.5">
        <div className="grid grid-cols-6 gap-0.5">
          {CHAT_REACTION_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => handlePick(emoji)}
              className="flex items-center justify-center size-8 rounded-md text-lg hover:bg-muted transition-colors"
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

// Renders nothing when a message has zero reactions. Otherwise sits inside
// <BubbleReactions>, which positions this whole cluster overlapping the
// bubble's bottom edge (shadcn's intended chat-bubble reaction treatment).
function BubbleReactionsRow({ messageId, reactions, memberMap, currentUserId, onReacted, isOwn }) {
  const grouped = useMemo(
    () => groupReactions(reactions || [], memberMap, currentUserId),
    [reactions, memberMap, currentUserId],
  )

  if (grouped.length === 0) return null

  async function handleToggle(emoji) {
    try {
      await toggleChatReaction(messageId, emoji)
      onReacted()
    } catch (err) {
      toast.error(err.message || 'Failed to react')
    }
  }

  return (
    <BubbleReactions align={isOwn ? 'end' : 'start'}>
      {grouped.map((r) => (
        <Tooltip key={r.emoji}>
          <TooltipTrigger asChild>
            <button
              onClick={() => handleToggle(r.emoji)}
              className={cn(
                'flex items-center gap-0.5 rounded-full px-1 transition-colors',
                r.reactedByMe ? 'ring-2 ring-indigo-400' : 'hover:bg-background/60',
              )}
            >
              <span>{r.emoji}</span>
              {r.count > 1 && <span className="text-xs tabular-nums">{r.count}</span>}
            </button>
          </TooltipTrigger>
          <TooltipContent>{r.reactorNames}</TooltipContent>
        </Tooltip>
      ))}
    </BubbleReactions>
  )
}

function ChatMessageRow({ message, author, isOwn, canModify, canDelete, mentionNames, myMentionName, memberMap, currentUserId, highlighted, onReacted, onDeleted }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(message.body)
  const [saving, setSaving] = useState(false)
  const isDeleted = !!message.deleted_at
  const name = author?.full_name || author?.email || 'Unknown'

  async function handleSaveEdit() {
    const trimmed = draft.trim()
    if (!trimmed || trimmed === message.body) {
      setEditing(false)
      setDraft(message.body)
      return
    }
    setSaving(true)
    try {
      await editMessage(message.id, trimmed)
      setEditing(false)
    } catch (err) {
      toast.error(err.message || 'Failed to update message')
    } finally {
      setSaving(false)
    }
  }

  if (isDeleted) {
    return (
      <Message id={`chat-message-${message.id}`} align={isOwn ? 'end' : 'start'}>
        <MessageContent>
          <p className="w-fit max-w-full rounded-2xl bg-muted/60 px-3 py-2 text-sm italic text-muted-foreground">
            This message was deleted.
          </p>
        </MessageContent>
      </Message>
    )
  }

  return (
    <Message
      id={`chat-message-${message.id}`}
      align={isOwn ? 'end' : 'start'}
      className={cn('group/row -mx-2 rounded-lg px-2 transition-colors duration-1000', highlighted && 'bg-indigo-50 dark:bg-indigo-950/40')}
    >
      {!isOwn && (
        <MessageAvatarSlot className="size-7 min-w-7 bg-transparent">
          <MemberAvatar member={author} />
        </MessageAvatarSlot>
      )}
      <MessageContent className="max-w-[70%]">
        <MessageHeader className={cn(isOwn && 'flex-row-reverse')}>
          {!isOwn && <span className="font-medium text-foreground">{name}</span>}
          <span className="whitespace-nowrap">
            {formatCompactTimeAgo(message.created_at)}
            {message.updated_at && ' · edited'}
          </span>
          {!editing && (
            <span className="flex items-center gap-1 opacity-0 transition-opacity group-hover/row:opacity-100">
              <ReactionTriggerButton messageId={message.id} onReacted={onReacted} />
              {canModify && (
                <button
                  onClick={() => { setDraft(message.body); setEditing(true) }}
                  className="text-muted-foreground hover:text-foreground p-0.5"
                  title="Edit"
                  aria-label="Edit message"
                >
                  <Pencil className="size-3" />
                </button>
              )}
              {canDelete && (
                <button
                  onClick={() => onDeleted(message)}
                  className="text-muted-foreground hover:text-destructive p-0.5"
                  title="Delete"
                  aria-label="Delete message"
                >
                  <Trash2 className="size-3" />
                </button>
              )}
            </span>
          )}
        </MessageHeader>

        {editing ? (
          <div className="w-full space-y-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
              className="resize-none text-sm"
              autoFocus
            />
            <div className="flex items-center gap-2">
              <Button size="sm" className="h-7 gap-1 text-xs" disabled={saving} onClick={handleSaveEdit}>
                <Check className="size-3" />
                {saving ? 'Saving…' : 'Save'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 text-xs text-muted-foreground"
                onClick={() => { setEditing(false); setDraft(message.body) }}
              >
                <X className="size-3" />
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Bubble align={isOwn ? 'end' : 'start'} variant={isOwn ? 'self' : 'muted'}>
            <BubbleContent className="rounded-2xl text-sm whitespace-pre-wrap wrap-break-word">
              <MentionedMessageBody body={message.body} mentionNames={mentionNames} myMentionName={myMentionName} isOwn={isOwn} />
            </BubbleContent>
            <BubbleReactionsRow
              messageId={message.id}
              reactions={message.reactions}
              memberMap={memberMap}
              currentUserId={currentUserId}
              onReacted={onReacted}
              isOwn={isOwn}
            />
          </Bubble>
        )}
      </MessageContent>
    </Message>
  )
}

// Renders the message list + composer for one channel. Used for both the
// workspace channel and DMs — the caller just passes a different channelId.
// channelType gates admin-delete-override: admins can moderate the shared
// workspace room, but never reach into a private DM they aren't part of
// (enforced server-side in soft_delete_chat_message; canDelete here just
// keeps the UI consistent with what the RPC will actually allow).
export function ChatThread({ channelId, channelType }) {
  const { user } = useAuth()
  const { isAdmin } = usePermissions()
  const queryClient = useQueryClient()
  const { data: messages = [], isLoading } = useChannelMessages(channelId)
  const memberMap = useMemberMap()
  const [searchParams, setSearchParams] = useSearchParams()

  const taRef = useRef(null)
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [pendingMentions, setPendingMentions] = useState([]) // [{ id, name, avatar_url }]
  const [mention, setMention] = useState(null) // { at, caret, query } | null
  const [activeIdx, setActiveIdx] = useState(0)
  const bottomRef = useRef(null)

  // Reset the composer when switching channels so a half-typed DM doesn't
  // leak into the team channel.
  useEffect(() => {
    setBody('')
    setPendingMentions([])
  }, [channelId])

  // Stick-to-bottom on new messages / channel switch. Deliberately a plain
  // effect rather than adopting @shadcn/message-scroller (a new npm
  // dependency, not copy-paste source like normal shadcn components) — chat
  // threads here are small with no pagination yet, so scroll-to-bottom-on-
  // change is the simplest correct behavior. Revisit if threads grow long.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [channelId, messages.length])

  // Keep the unread badge cleared while this channel is actually open — not
  // just at the moment it's clicked (ChatSidebar already does that for
  // instant feedback). Without this, a message arriving while you're already
  // looking at the conversation would flip the badge back on even though
  // you're staring right at it.
  useEffect(() => {
    if (!channelId || isLoading) return
    markChannelRead(channelId).catch(() => {})
  }, [channelId, isLoading, messages.length])

  // Deep-link from a chat notification (?message=id) — scroll to and briefly
  // highlight the target message once the thread has loaded, then clean the
  // query param off the URL. Mirrors CommentThread's ?comment= pattern.
  const deepLinkedId = searchParams.get('message')
  const [highlightedId, setHighlightedId] = useState(null)

  useEffect(() => {
    if (!deepLinkedId || isLoading) return
    if (!messages.some((m) => m.id === deepLinkedId)) return

    const el = document.getElementById(`chat-message-${deepLinkedId}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setHighlightedId(deepLinkedId)

    const timeout = setTimeout(() => {
      setHighlightedId(null)
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.delete('message')
          return next
        },
        { replace: true },
      )
    }, 2500)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkedId, isLoading, messages.length])

  const invalidate = () => queryClient.invalidateQueries({ queryKey: chatKeys.messages(channelId) })

  // "@Full Name" (or email) token for the current user — distinguishes
  // mentions of me from mentions of anyone else when rendering message bodies.
  const myMentionName = useMemo(() => {
    const me = memberMap[user?.id]
    return me ? `@${me.full_name || me.email}` : null
  }, [memberMap, user?.id])

  // Members available to @mention (everyone but the current user)
  const mentionCandidates = useMemo(
    () =>
      Object.values(memberMap)
        .filter((m) => m.id !== user?.id)
        .map((m) => ({ id: m.id, name: m.full_name || m.email || 'Unknown', avatar_url: m.avatar_url || null })),
    [memberMap, user?.id],
  )

  const mentionQuery = mention?.query ?? ''
  const filteredMentions = mention
    ? mentionCandidates.filter((c) => c.name.toLowerCase().includes(mentionQuery.toLowerCase()))
    : []
  const mentionMenuOpen = !!mention && filteredMentions.length > 0

  function mentionNamesFor(message) {
    return (message.mentioned_uids || [])
      .map((uid) => memberMap[uid])
      .filter(Boolean)
      .map((m) => `@${m.full_name || m.email}`)
  }

  function handleBodyChange(e) {
    const value = e.target.value
    setBody(value)
    const caret = e.target.selectionStart ?? value.length
    setMention(detectMention(value, caret))
    setActiveIdx(0)
  }

  function selectMention(member) {
    if (!member || !mention) return
    const insert = `@${member.name} `
    const newBody = body.slice(0, mention.at) + insert + body.slice(mention.caret)
    setBody(newBody)
    setPendingMentions((prev) => (prev.some((p) => p.id === member.id) ? prev : [...prev, member]))
    setMention(null)
    requestAnimationFrame(() => {
      const el = taRef.current
      if (el) {
        const pos = mention.at + insert.length
        el.focus()
        el.setSelectionRange(pos, pos)
      }
    })
  }

  function removeMention(member) {
    setPendingMentions((prev) => prev.filter((p) => p.id !== member.id))
    setBody((b) => b.replace(`@${member.name}`, '').replace(/[ \t]{2,}/g, ' '))
  }

  // "+" button: insert "@" at the caret, same as if the user typed it — opens the mention menu.
  function handleMentionButtonClick() {
    const el = taRef.current
    const caret = el ? (el.selectionStart ?? body.length) : body.length
    const before = body[caret - 1]
    const needsSpace = caret > 0 && before && !/\s/.test(before)
    const insert = `${needsSpace ? ' ' : ''}@`
    const newBody = body.slice(0, caret) + insert + body.slice(caret)
    const newCaret = caret + insert.length
    setBody(newBody)
    setMention(detectMention(newBody, newCaret))
    setActiveIdx(0)
    requestAnimationFrame(() => {
      if (el) {
        el.focus()
        el.setSelectionRange(newCaret, newCaret)
      }
    })
  }

  async function handleSend() {
    const trimmed = body.trim()
    if (!trimmed) return
    const mentionedUids = pendingMentions.filter((m) => trimmed.includes(`@${m.name}`)).map((m) => m.id)
    setSending(true)
    try {
      await sendMessage({ channelId, body: trimmed, mentionedUids })
      setBody('')
      setPendingMentions([])
      invalidate()
    } catch (err) {
      toast.error(err.message || 'Failed to send message')
    } finally {
      setSending(false)
    }
  }

  async function handleDelete() {
    if (!deleting) return
    try {
      await softDeleteMessage(deleting.id)
      invalidate()
      toast.success('Message deleted')
    } catch (err) {
      toast.error(err.message || 'Failed to delete message')
    } finally {
      setDeleting(null)
    }
  }

  function handleKeyDown(e) {
    if (mentionMenuOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIdx((i) => Math.min(i + 1, filteredMentions.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIdx((i) => Math.max(i - 1, 0))
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        selectMention(filteredMentions[activeIdx])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setMention(null)
        return
      }
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <ScrollArea className="flex-1 min-h-0">
        <div className="flex flex-col gap-4 max-w-5xl mx-auto px-4 pt-6 pb-3" aria-label="Messages">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="size-7 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-8 w-2/3 rounded-2xl" />
                </div>
              </div>
            ))
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
              <div className="mb-1 text-4xl leading-none select-none">👋</div>
              <p className="text-base font-normal text-foreground">No messages yet</p>
              <p className="text-sm text-muted-foreground">Say hello to get the conversation started.</p>
            </div>
          ) : (
            messages.map((m) => {
              const isOwn = m.author_user_id === user?.id
              return (
                <ChatMessageRow
                  key={m.id}
                  message={m}
                  author={memberMap[m.author_user_id]}
                  isOwn={isOwn}
                  canModify={isOwn}
                  canDelete={isOwn || (isAdmin && channelType === 'workspace')}
                  mentionNames={mentionNamesFor(m)}
                  myMentionName={myMentionName}
                  memberMap={memberMap}
                  currentUserId={user?.id}
                  highlighted={m.id === highlightedId}
                  onReacted={invalidate}
                  onDeleted={setDeleting}
                />
              )
            })
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="shrink-0 border-t p-3">
        <div className="max-w-5xl mx-auto">
          {/* Pending mention chips */}
          {pendingMentions.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {pendingMentions.map((m) => (
                <span key={m.id} className={cn(MENTION_CLASS, 'inline-flex items-center gap-1 text-xs')}>
                  @{m.name}
                  <button
                    onClick={() => removeMention(m)}
                    className="hover:text-destructive"
                    aria-label={`Remove mention ${m.name}`}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <InputGroup className="rounded-2xl">
            {/* @mention autocomplete menu (opens above the composer) */}
            {mentionMenuOpen && (
              <div className="absolute bottom-full mb-2 left-0 z-50 w-64 rounded-md border bg-popover shadow-lg p-1">
                <div className="max-h-56 overflow-y-auto">
                  {filteredMentions.map((m, i) => (
                    <button
                      key={m.id}
                      onMouseDown={(e) => { e.preventDefault(); selectMention(m) }}
                      onMouseEnter={() => setActiveIdx(i)}
                      className={cn(
                        'w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-left transition-colors',
                        i === activeIdx ? 'bg-muted' : 'hover:bg-muted/60',
                      )}
                    >
                      <MemberAvatar member={m} className="size-5" />
                      <span className="truncate">{m.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <InputGroupTextarea
              ref={taRef}
              value={body}
              onChange={handleBodyChange}
              onKeyDown={handleKeyDown}
              placeholder="Message the team… (@ to mention)"
              rows={1}
              aria-label="Write a message"
              className="min-h-10 max-h-40 field-sizing-content overflow-y-auto"
            />

            <InputGroupAddon align="block-end">
              <InputGroupButton
                variant="outline"
                size="icon-sm"
                className="rounded-full"
                onClick={handleMentionButtonClick}
                title="Mention a teammate"
                aria-label="Mention a teammate"
              >
                <Plus className="size-4" />
              </InputGroupButton>
              <InputGroupButton
                variant="default"
                size="icon-sm"
                className="ml-auto rounded-full bg-chat-self text-chat-self-foreground hover:bg-chat-self/90"
                disabled={sending || !body.trim()}
                onClick={handleSend}
                title={`Send (${navigator.platform?.includes('Mac') ? '⌘' : 'Ctrl'} + Enter)`}
                aria-label="Send message"
              >
                <ArrowUp className="size-4" />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </div>
      </div>

      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete message?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the message from the conversation. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default ChatThread
