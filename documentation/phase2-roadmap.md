# Phase 2 Roadmap

Features actively in planning. These will roll out progressively across existing plans.

---

## 01 — OAuth & Auto Social Media Publishing

Connect Instagram, LinkedIn, X, and YouTube accounts directly to Tercero. Any post that gets approved and scheduled publishes automatically at the set time. The entire workflow from brief to live happens without leaving the platform.

**Scope:**
- OAuth connection flow per platform per client
- Scheduled publish queue (edge function / cron)
- Publish status feedback → `platform_schedules` on `post_versions`
- Error handling and retry logic for failed publishes
- UI to connect/disconnect accounts in client settings

---

## 02 — WhatsApp Integration

Approval requests, review links, and proposal updates sent directly to a client's WhatsApp instead of (or alongside) email. Clients respond faster on WhatsApp and nothing sits unread.

**Scope:**
- WhatsApp Business API integration (per client setup)
- Replace/supplement `send-approval-email` and `send-campaign-review-email` edge functions with WhatsApp delivery
- One-time setup per client in their profile
- Delivery status tracking

---

## 03 — Deep Team Management

Each team member gets their own profile with documents, a salary and payments tracker, and internal notes — mirroring how clients are managed today, all inside the same workspace.

**Scope:**
- Extended `agency_members` profile: role, documents, salary/payment records, notes
- Team member detail page (similar structure to client profile)
- Salary tracker with payment history
- Document storage per team member (reuse `client-documents` bucket pattern)
- Internal notes per member

---

## 04 — Client Portal

Each client gets their own login to a branded workspace. They can browse their content calendar, approve posts, download invoices, and follow campaigns — without the agency needing to send anything manually.

**Scope:**
- Client-side auth (separate from agency auth)
- Branded portal under agency name (uses `branding_agency_sidebar` / `branding_powered_by` flags)
- Read-only content calendar view
- Post approval flow (inline, no token required)
- Invoice download
- Campaign progress view

---

## 05 — Tercero Mobile Application

Native iOS and Android app focused on what's needed on the go: reviewing posts, checking the calendar, tracking approvals, and staying on top of the pipeline.

**Scope:**
- React Native (or equivalent) app targeting the existing Supabase backend
- Auth with existing credentials
- Post review and approval
- Content calendar view
- Pipeline / prospects overview
- Push notifications for approvals and status changes

---

## 06 — AI Integration

AI built into the parts of Tercero where it saves real time: drafting captions, rewriting posts for different platforms, flagging campaigns behind on approvals, and surfacing top-performing content types per client.

**Scope:**
- Caption drafting inside `DraftPostForm`
- Platform-specific rewrites (tone/length adaptation per platform)
- Campaign health flagging (overdue approvals, stalled posts)
- Content performance insights (once Analytics is live)
- AI suggestions gated at Velocity+ tier

---

## 07 — Social Media Analytics

Once publishing is live, performance data pulls back in automatically. Reach, impressions, and engagement per post and per client — inside Tercero, without logging into each platform separately.

**Scope:**
- Scheduled data ingestion from platform APIs (Instagram Graph, LinkedIn, X, YouTube)
- Per-post metrics stored and linked to `post_versions`
- Analytics dashboard per client
- Aggregate agency-level reporting
- Data available in Reports page (extends existing `reports` feature flag)

---

## Delivery Notes

- Features 01 and 07 are coupled — publishing must ship before analytics can pull data back
- Feature 04 (Client Portal) depends on Feature 01 for the calendar to be most useful
- Feature 06 (AI) can ship incrementally — drafting first, insights after analytics are live
- Feature 05 (Mobile) can be developed in parallel; it consumes the same Supabase backend
