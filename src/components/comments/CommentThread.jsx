import { useMemo, useState, useRef, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { Pencil, Trash2, X, Check, Plus, ArrowUp, SmilePlus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { usePermissions } from '@/api/usePermissions'
import { useTeamMembers } from '@/api/team'
import {
  useComments,
  createComment,
  updateComment,
  softDeleteComment,
  toggleReaction,
  REACTION_EMOJIS,
  commentKeys,
} from '@/api/comments'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from '@/components/ui/input-group'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { splitMentions, detectMention, MENTION_CLASS, MY_MENTION_CLASS, MENTION_TEXT_CLASS, MY_MENTION_TEXT_CLASS } from '@/lib/mentions'
import { formatCompactTimeAgo } from '@/lib/helper'
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

// ─── Avatar ────────────────────────────────────────────────────────────────────

function MemberAvatar({ member, size = 'size-7' }) {
  if (member?.avatar_url) {
    return (
      <img
        src={member.avatar_url}
        alt=""
        className={cn(size, 'rounded-full object-cover shrink-0 ring-1 ring-border')}
      />
    )
  }
  return (
    <div className={cn(size, 'rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-semibold text-primary shrink-0')}>
      {(member?.full_name || member?.name || member?.email || '?')[0].toUpperCase()}
    </div>
  )
}


// ─── Reactions ─────────────────────────────────────────────────────────────────

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

// Lives in the action-icon row (with edit/delete) — just opens the emoji grid.
// Not gated by canModify: any workspace member can react to any comment.
function ReactionTriggerButton({ commentId, onReacted }) {
  const [pickerOpen, setPickerOpen] = useState(false)

  async function handlePick(emoji) {
    setPickerOpen(false)
    try {
      await toggleReaction(commentId, emoji)
      onReacted()
    } catch (err) {
      toast.error(err.message || 'Failed to react')
    }
  }

  return (
    <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
      <PopoverTrigger asChild>
        <button
          className="text-muted-foreground hover:text-foreground p-1"
          title="Add reaction"
          aria-label="Add reaction"
        >
          <SmilePlus className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-1.5">
        <div className="grid grid-cols-6 gap-0.5">
          {REACTION_EMOJIS.map((emoji) => (
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

// Renders nothing (no wrapper, no spacing) when a comment has zero reactions —
// only comments that actually have reactions get the extra row.
function ReactionPillsRow({ commentId, reactions, memberMap, currentUserId, onReacted }) {
  const grouped = useMemo(
    () => groupReactions(reactions || [], memberMap, currentUserId),
    [reactions, memberMap, currentUserId],
  )

  if (grouped.length === 0) return null

  async function handleToggle(emoji) {
    try {
      await toggleReaction(commentId, emoji)
      onReacted()
    } catch (err) {
      toast.error(err.message || 'Failed to react')
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1 mt-1">
      {grouped.map((r) => (
        <Tooltip key={r.emoji}>
          <TooltipTrigger asChild>
            <button
              onClick={() => handleToggle(r.emoji)}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border border-transparent bg-muted px-1.5 py-0.5 text-[13px] transition-colors',
                r.reactedByMe
                  ? 'ring-2 ring-indigo-400'
                  : 'hover:border-border',
              )}
            >
              <span>{r.emoji}</span>
              {r.count > 1 && <span className="tabular-nums">{r.count}</span>}
            </button>
          </TooltipTrigger>
          <TooltipContent>{r.reactorNames}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  )
}

// ─── Single comment ──────────────────────────────────────────────────────────

function MentionedBody({ body, mentionNames, myMentionName }) {
  const segments = splitMentions(body, mentionNames)
  return (
    <p className="text-sm leading-relaxed text-foreground/80 mt-0.5 whitespace-pre-wrap wrap-break-word">
      {segments.map((seg, i) =>
        seg.isMention ? (
          <span
            key={i}
            className={myMentionName && seg.text === myMentionName ? MY_MENTION_TEXT_CLASS : MENTION_TEXT_CLASS}
          >
            {seg.text}
          </span>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </p>
  )
}

function CommentRow({ comment, author, mentionNames, myMentionName, memberMap, canModify, currentUserId, highlighted, onEdited, onDeleted }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(comment.body)
  const [saving, setSaving] = useState(false)
  const isDeleted = !!comment.deleted_at
  const isAuthor = comment.author_user_id === currentUserId
  const name = author?.full_name || author?.email || 'Unknown'

  async function handleSaveEdit() {
    const trimmed = draft.trim()
    if (!trimmed || trimmed === comment.body) {
      setEditing(false)
      setDraft(comment.body)
      return
    }
    setSaving(true)
    try {
      await updateComment(comment.id, trimmed)
      onEdited()
      setEditing(false)
    } catch (err) {
      toast.error(err.message || 'Failed to update comment')
    } finally {
      setSaving(false)
    }
  }

  if (isDeleted) {
    return (
      <div id={`comment-${comment.id}`} className="flex gap-3 pb-5">
        <div className="size-7 rounded-full bg-muted shrink-0" />
        <p className="text-sm text-muted-foreground/60 italic self-center">
          This comment was deleted.
        </p>
      </div>
    )
  }

  return (
    <div
      id={`comment-${comment.id}`}
      className={cn(
        'flex gap-3 pb-5 group rounded-lg transition-colors duration-1000 -mx-2 px-2',
        highlighted && 'bg-indigo-50 dark:bg-indigo-950/40',
      )}
    >
      <MemberAvatar member={author} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium truncate">{name}</span>
          {isAuthor && (
            <span className="text-[10px] text-muted-foreground bg-muted rounded px-1 py-px shrink-0">
              You
            </span>
          )}
          <span className="text-[11px] text-muted-foreground/80 shrink-0 whitespace-nowrap">
            {formatCompactTimeAgo(comment.created_at)}
            {comment.updated_at && ' · edited'}
          </span>

          {/* Actions — react is open to everyone; edit/delete gated by canModify/isAuthor */}
          {!editing && (
            <span className="ml-auto flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <ReactionTriggerButton commentId={comment.id} onReacted={onEdited} />
              {canModify && isAuthor && (
                <button
                  onClick={() => { setDraft(comment.body); setEditing(true) }}
                  className="text-muted-foreground hover:text-foreground p-1"
                  title="Edit"
                  aria-label="Edit comment"
                >
                  <Pencil className="size-3.5" />
                </button>
              )}
              {canModify && (
                <button
                  onClick={() => onDeleted(comment)}
                  className="text-muted-foreground hover:text-destructive p-1"
                  title="Delete"
                  aria-label="Delete comment"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </span>
          )}
        </div>

        {editing ? (
          <div className="mt-1.5 space-y-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
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
                onClick={() => { setEditing(false); setDraft(comment.body) }}
              >
                <X className="size-3" />
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <MentionedBody body={comment.body} mentionNames={mentionNames} myMentionName={myMentionName} />
        )}

        {!editing && (
          <ReactionPillsRow
            commentId={comment.id}
            reactions={comment.reactions}
            memberMap={memberMap}
            currentUserId={currentUserId}
            onReacted={onEdited}
          />
        )}
      </div>
    </div>
  )
}

// ─── Thread ────────────────────────────────────────────────────────────────────

export function CommentThread({ entityType, entityId }) {
  const { user } = useAuth()
  const { isAdmin } = usePermissions()
  const queryClient = useQueryClient()
  const { data: comments = [], isLoading } = useComments({ entityType, entityId })
  const { data: teamMembers = [] } = useTeamMembers()
  const [searchParams, setSearchParams] = useSearchParams()

  const taRef = useRef(null)
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [pendingMentions, setPendingMentions] = useState([]) // [{ id, name, avatar_url }]
  const [mention, setMention] = useState(null) // { at, caret, query } | null
  const [activeIdx, setActiveIdx] = useState(0)

  // Deep-link from a comment_added notification (?comment=id) — scroll to and
  // briefly highlight the target comment once the thread has loaded, then clean
  // the query param off the URL so a refresh doesn't keep re-triggering it.
  const deepLinkedId = searchParams.get('comment')
  const [highlightedId, setHighlightedId] = useState(null)

  useEffect(() => {
    if (!deepLinkedId || isLoading) return
    if (!comments.some((c) => c.id === deepLinkedId)) return

    const el = document.getElementById(`comment-${deepLinkedId}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setHighlightedId(deepLinkedId)

    const timeout = setTimeout(() => {
      setHighlightedId(null)
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.delete('comment')
          return next
        },
        { replace: true },
      )
    }, 2500)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkedId, isLoading, comments.length])

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: commentKeys.thread(entityType, entityId) })

  const memberMap = useMemo(() => {
    const map = Object.fromEntries(teamMembers.map((m) => [m.member_user_id, m]))
    if (user && !map[user.id]) {
      map[user.id] = {
        member_user_id: user.id,
        full_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
        email: user.email,
        avatar_url: user.user_metadata?.avatar_url || null,
      }
    }
    return map
  }, [teamMembers, user])

  // "@Full Name" (or email) token for the current user — used to distinguish
  // mentions of me from mentions of anyone else when rendering comment bodies.
  const myMentionName = useMemo(() => {
    const me = memberMap[user?.id]
    return me ? `@${me.full_name || me.email}` : null
  }, [memberMap, user?.id])

  // Members available to @mention (everyone but the current user)
  const mentionCandidates = useMemo(
    () =>
      Object.values(memberMap)
        .filter((m) => m.member_user_id !== user?.id)
        .map((m) => ({
          id: m.member_user_id,
          name: m.full_name || m.email || 'Unknown',
          avatar_url: m.avatar_url || null,
        })),
    [memberMap, user?.id],
  )

  const mentionQuery = mention?.query ?? ''
  const filteredMentions = mention
    ? mentionCandidates.filter((c) =>
        c.name.toLowerCase().includes(mentionQuery.toLowerCase()),
      )
    : []
  const mentionMenuOpen = !!mention && filteredMentions.length > 0

  function mentionNamesFor(comment) {
    return (comment.mentioned_uids || [])
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
    setPendingMentions((prev) =>
      prev.some((p) => p.id === member.id) ? prev : [...prev, member],
    )
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
    const mentionedUids = pendingMentions
      .filter((m) => trimmed.includes(`@${m.name}`))
      .map((m) => m.id)
    setSending(true)
    try {
      await createComment({ entityType, entityId, body: trimmed, mentionedUids })
      setBody('')
      setPendingMentions([])
      invalidate()
    } catch (err) {
      toast.error(err.message || 'Failed to post comment')
    } finally {
      setSending(false)
    }
  }

  async function handleDelete() {
    if (!deleting) return
    try {
      await softDeleteComment(deleting.id)
      invalidate()
      toast.success('Comment deleted')
    } catch (err) {
      toast.error(err.message || 'Failed to delete comment')
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
    <div className="flex flex-col h-full min-h-0">
      {/* Feed */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-1" aria-label="Comments">
          {isLoading ? (
            <div className="space-y-4 py-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="size-7 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-3.5 w-full" />
                    <Skeleton className="h-3.5 w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-14 gap-2">
              <div className="text-4xl leading-none select-none mb-1">💬</div>
              <p className="text-base font-normal text-foreground">No comments yet</p>
              <p className="text-sm text-muted-foreground">
                Start the discussion — leave a note for your team.
              </p>
            </div>
          ) : (
            comments.map((c) => (
              <CommentRow
                key={c.id}
                comment={c}
                author={memberMap[c.author_user_id]}
                mentionNames={mentionNamesFor(c)}
                myMentionName={myMentionName}
                memberMap={memberMap}
                currentUserId={user?.id}
                canModify={c.author_user_id === user?.id || isAdmin}
                highlighted={c.id === highlightedId}
                onEdited={invalidate}
                onDeleted={setDeleting}
              />
            ))
          )}
        </div>
      </ScrollArea>

      {/* Composer */}
      <div className="shrink-0 pt-3 mt-1">
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
                    <MemberAvatar member={m} size="size-5" />
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
            placeholder="Write a comment… (@ to mention)"
            rows={2}
            aria-label="Write a comment"
            className="min-h-14"
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
              className="ml-auto rounded-full"
              disabled={sending || !body.trim()}
              onClick={handleSend}
              title={`Post comment (${navigator.platform?.includes('Mac') ? '⌘' : 'Ctrl'} + Enter)`}
              aria-label="Post comment"
            >
              <ArrowUp className="size-4" />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </div>

      {/* Delete confirm */}
      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete comment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the comment from the thread. This cannot be undone.
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

export default CommentThread
