# Tercero — Teams Feature
**Phase**: 1
**Status**: ✅ Complete
**Last Updated**: March 2026

---

## Overview

Teams allows agency owners to invite their team members into their Tercero workspace so everyone works from the same system. Phase 1 delivers collaborative access — the goal is not team management but getting the whole agency working from one place.

---

## Problem Statement

Tercero is built for agencies, not solo freelancers. Most agencies run with at least one other person — a content writer, designer, or account manager. Without Teams, every agency owner who evaluates Tercero hits the same wall: "How do I get my team in here?" Phase 1 answers that question.

---

## Phase 1 Scope

### What's included ✅

- Agency owner generates an invite link from Settings → Team
- Invite link leads to a public join page (`/join/:token`)
- Teammate fills in their details and creates their account
- Teammate gets full access to the agency workspace on login
- Owner sees a roster of all team members in Settings → Team (with avatar if set)
- Owner can remove a team member
- Owner can revoke a pending (unused) invite
- Real-time updates — team member list and pending invites refresh automatically across sessions via Supabase Realtime

### What's explicitly excluded (future phases)

- Role-based permissions (all members have full access in Phase 1)
- Team member detail pages
- Document uploads per member
- Internal approval workflows
- Notice board / internal communication
- Activity tracking per member
- Seat limits per subscription plan
- Email delivery of invite links (owner copies and sends manually)

---

## Roles

Two roles exist in Phase 1. These are **system roles** — for access control only, not displayed as the primary identity of the team member.

| System Role | Who | Access |
|-------------|-----|--------|
| `admin` | Account creator (workspace owner) | Full access to everything |
| `member` | Invited teammate | Full access to everything (same as admin for Phase 1) |

### Functional Role (separate from system role)

During onboarding, teammates provide their **functional role** — a display-only label describing what they do (e.g. Content Writer, Designer, Strategist). No effect on access or permissions. Stored in `agency_members.functional_role`, shown in the team member roster.

---

## Subscription Scoping

**None for Phase 1.** All plans (Ignite, Velocity, Quantum) allow unlimited team members. Real usage data from beta will inform seat limits.

> Post-Phase 1 plan: Ignite (5 seats), Velocity (15 seats), Quantum (unlimited). To be implemented after beta data is collected.

---

## User Flows

### Owner — Inviting a Team Member

1. Owner opens **Settings → Team**
2. Clicks **"Invite Team Member"**
3. System generates a unique invite token (7-day expiry) and inserts a row in `agency_invites`
4. Dialog shows the full invite URL (`https://tercerospace.com/join/:token`) with a copy button
5. Owner copies the link and sends it manually (WhatsApp, email, etc.)
6. Pending invite appears in the Team page until accepted or expired

### Teammate — Joining via Invite Link

1. Teammate opens `/join/:token` in their browser
2. Page validates the token via `get_invite_by_token` RPC (public, unauthenticated)
3. If token is expired or already used: error state — "This invite link is no longer valid."
4. If valid: join form is shown with agency branding (logo + name)
5. Teammate fills in: First name, Last name, Email, Password, Functional role (optional)
6. Clicks **"Create account & join"**
7. Supabase auth account is created
8. `join_team` RPC validates the token, inserts `agency_members` row, marks invite as accepted
9. Teammate is redirected to `/dashboard` — full access from this point

### Owner — Managing the Team

1. Owner opens **Settings → Team**
2. Sees active member cards (avatar if available, initials fallback) and pending invites section
3. Can **Remove** an active member (`is_active = false`)
4. Can **Revoke** a pending invite (`expires_at = now()`)
5. Both lists update in real-time without a page refresh

---

## Technical Implementation

### DB Tables

**`agency_members`**
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
agency_user_id  uuid REFERENCES auth.users NOT NULL  -- workspace owner UID
member_user_id  uuid REFERENCES auth.users NOT NULL  -- teammate UID
functional_role text                                  -- display only
system_role     text DEFAULT 'member' CHECK (system_role IN ('admin', 'member'))
joined_at       timestamptz DEFAULT now()
is_active       boolean DEFAULT true
UNIQUE (agency_user_id, member_user_id)
```

Owner row: `agency_user_id = member_user_id = owner.uid, system_role = 'admin'`
Member row: `agency_user_id = owner.uid, member_user_id = member.uid, system_role = 'member'`

**`agency_invites`**
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
agency_user_id  uuid REFERENCES auth.users NOT NULL
token           text UNIQUE NOT NULL
created_at      timestamptz DEFAULT now()
expires_at      timestamptz NOT NULL  -- created_at + 7 days
accepted_at     timestamptz           -- null until used
```

### RLS — `get_my_agency_user_id()` Helper

All affected tables use a SECURITY DEFINER helper to resolve the workspace:

```sql
CREATE OR REPLACE FUNCTION get_my_agency_user_id()
RETURNS UUID AS $$
  SELECT COALESCE(
    (SELECT user_id FROM agency_subscriptions WHERE user_id = auth.uid()),
    (SELECT agency_user_id FROM agency_members
     WHERE member_user_id = auth.uid() AND is_active = true LIMIT 1)
  )
$$ LANGUAGE SQL SECURITY DEFINER STABLE;
```

RLS SELECT policies on all scoped tables use:
```sql
get_my_agency_user_id() = user_id
```

Tables updated: `clients`, `campaigns`, `invoices`, `invoice_items`, `recurring_invoices`, `expenses`, `transactions`, `client_notes`, `client_documents`, `document_collections`, `agency_subscriptions`, `post_versions`, `meetings`.

### Bootstrap Migration

```sql
INSERT INTO agency_members (agency_user_id, member_user_id, system_role)
SELECT user_id, user_id, 'admin'
FROM agency_subscriptions
ON CONFLICT (agency_user_id, member_user_id) DO NOTHING;
```

Ran once. All existing owners have an explicit admin row.

### RPCs

| RPC | Auth | Purpose |
|-----|------|---------|
| `get_team_members(p_agency_user_id)` | SECURITY DEFINER | Returns members with `full_name`, `email`, `functional_role`, `system_role`, `joined_at`, `avatar_url` (from `raw_user_meta_data`) |
| `get_invite_by_token(p_token)` | Public, SECURITY DEFINER | Validates token, returns `valid`, `error`, `agency_name`, `logo_url`, `logo_horizontal_url` |
| `join_team(p_token, p_first_name, p_last_name, p_functional_role)` | Public, SECURITY DEFINER | Validates token, inserts `agency_members` row, marks invite accepted |

### AuthContext

Added `workspaceUserId` and `userRole` to the auth context, resolved from `agency_members` on every auth state change. For owners `workspaceUserId === user.id`; for members it is the owner's UID. All API hooks use `workspaceUserId` instead of `user.id`.

### API Module — `src/api/team.js`

| Export | Type | Description |
|--------|------|-------------|
| `useTeamMembers()` | React Query hook | Active members via `get_team_members` RPC + Realtime subscription |
| `usePendingInvites()` | React Query hook | Unused, non-expired invites + Realtime subscription |
| `useGenerateInvite()` | Mutation hook | Inserts invite row, returns full URL (`VITE_APP_URL/join/:token`) |
| `useRevokeInvite()` | Mutation hook | Sets `expires_at = now()` |
| `useRemoveMember()` | Mutation hook | Sets `is_active = false` |
| `fetchInviteByToken(token)` | Plain async fn | Public — used on `/join/:token` before auth |
| `joinTeam({ token, firstName, lastName, functionalRole })` | Plain async fn | Public — calls `join_team` RPC after Supabase signup |

### Key Files

| File | Role |
|------|------|
| `src/context/AuthContext.jsx` | Resolves `workspaceUserId` + `userRole` on login |
| `src/api/team.js` | All team API hooks and public helpers |
| `src/api/useSubscription.js` | Uses `workspaceUserId` |
| `src/pages/settings/TeamSettings.jsx` | Team tab UI — member list, invite dialog, pending invites |
| `src/pages/JoinTeam.jsx` | Public `/join/:token` join page |
| `src/pages/Settings.jsx` | Team tab added alongside Profile and Agency |
| `src/App.jsx` | `/join/:token` public route added |
| `src/components/misc/AppShell.jsx` | Scroll-to-top on route change |

### Environment

```
VITE_APP_URL=https://tercerospace.com   # used for invite link generation
```

---

## Out of Scope (Future Phases)

- Seat limits per subscription plan
- Role-based permission restrictions
- Internal approval workflow for teammate posts
- Notice board / team communication
- Team member detail pages
- Per-member document storage
- Activity logs per member
- Client-specific access restrictions
- Email delivery of invite links
