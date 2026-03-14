# Tercero — Manual Test Cases

> **App**: Tercero — Social Media Agency Management SaaS
> **Base URL**: Set `BASE_URL` to your local or staging URL (e.g. `http://localhost:5173`)
> **Last Updated**: 2026-03-14
> **Format**: Each test has a unique ID, preconditions, steps, and expected result.

---

## Table of Contents

1. [Authentication & Onboarding](#1-authentication--onboarding)
2. [Dashboard](#2-dashboard)
3. [Client Management](#3-client-management)
4. [Post Management](#4-post-management)
5. [Content Calendar](#5-content-calendar)
6. [Campaigns](#6-campaigns)
7. [Campaign Public Review](#7-campaign-public-review)
8. [Proposals](#8-proposals)
9. [Proposal Public Review](#9-proposal-public-review)
10. [Finance — Invoices](#10-finance--invoices)
11. [Finance — Ledger & Transactions](#11-finance--ledger--transactions)
12. [Finance — Subscriptions](#12-finance--subscriptions)
13. [Finance — Overview](#13-finance--overview)
14. [Documents](#14-documents)
15. [Operations — Meetings](#15-operations--meetings)
16. [Operations — Notes & Reminders](#16-operations--notes--reminders)
17. [Settings — Profile](#17-settings--profile)
18. [Settings — Agency Branding](#18-settings--agency-branding)
19. [Settings — Team Management](#19-settings--team-management)
20. [Team Invite — Join Flow](#20-team-invite--join-flow)
21. [Billing & Usage](#21-billing--usage)
22. [Feature Gating & Subscription Plans](#22-feature-gating--subscription-plans)
23. [Public Post Review](#23-public-post-review)
24. [Navigation & Routing](#24-navigation--routing)
25. [Dark / Light Mode](#25-dark--light-mode)

---

## 1. Authentication & Onboarding

### AUTH-001 — Successful Login
**Preconditions**: Valid account exists.
**Steps**:
1. Navigate to `/login`
2. Enter valid email and password
3. Click "Sign In"

**Expected**: Redirected to `/dashboard`. Sidebar visible with user name. No error toast.

---

### AUTH-002 — Login with Invalid Credentials
**Preconditions**: None.
**Steps**:
1. Navigate to `/login`
2. Enter wrong email or password
3. Click "Sign In"

**Expected**: Error message shown (e.g. "Invalid login credentials"). User stays on `/login`.

---

### AUTH-003 — Login with Empty Fields
**Preconditions**: None.
**Steps**:
1. Navigate to `/login`
2. Leave email/password blank
3. Click "Sign In"

**Expected**: Validation errors shown on empty fields. No API call made.

---

### AUTH-004 — Signup — New Agency Owner
**Preconditions**: Unused email address.
**Steps**:
1. Navigate to `/signup`
2. Fill in name, email, password
3. Click "Create Account"

**Expected**: Account created. Redirected to `/onboarding` or `/dashboard`. Welcome state visible.

---

### AUTH-005 — Signup with Existing Email
**Preconditions**: Email is already registered.
**Steps**:
1. Navigate to `/signup`
2. Enter existing email with any password
3. Submit

**Expected**: Error toast "User already registered" or similar. No duplicate account created.

---

### AUTH-006 — Onboarding Flow
**Preconditions**: New account with no agency setup.
**Steps**:
1. Complete signup
2. Fill in agency name, optional logo, select platforms
3. Click through all onboarding steps
4. Submit final step

**Expected**: Agency record created. Redirected to `/dashboard` with welcome state. Agency name visible in sidebar.

---

### AUTH-007 — Forgot Password
**Preconditions**: Valid account.
**Steps**:
1. On `/login`, click "Forgot Password"
2. Enter email in dialog
3. Submit

**Expected**: Success toast "Password reset email sent". Email delivered (check inbox).

---

### AUTH-008 — Logout
**Preconditions**: Logged in.
**Steps**:
1. Click user menu (bottom of sidebar)
2. Click "Logout"

**Expected**: Redirected to `/login`. Session cleared. Navigating to `/dashboard` redirects back to `/login`.

---

### AUTH-009 — Protected Route Redirect
**Preconditions**: Not logged in.
**Steps**:
1. Navigate directly to `/dashboard`

**Expected**: Redirected to `/login`.

---

## 2. Dashboard

### DASH-001 — Dashboard Loads with Data
**Preconditions**: Agency has clients, posts, invoices, and meetings.
**Steps**:
1. Log in and navigate to `/dashboard`

**Expected**: All dashboard widgets render: KPI bar, pipeline status, upcoming meetings, financial snapshot, content timeline, client health grid.

---

### DASH-002 — Dashboard Empty State
**Preconditions**: New workspace with no data.
**Steps**:
1. Log in as fresh agency owner
2. Navigate to `/dashboard`

**Expected**: Empty states shown in each widget (e.g. "No clients yet", "No scheduled posts"). No errors.

---

### DASH-003 — Dashboard KPI Bar Accuracy
**Preconditions**: Workspace has at least 3 clients and 5 posts in various statuses.
**Steps**:
1. Navigate to `/dashboard`
2. Note KPI counts (total clients, scheduled posts, pending review, etc.)
3. Cross-check by visiting `/clients` and `/posts`

**Expected**: Numbers match counts on their respective pages.

---

## 3. Client Management

### CLT-001 — Create Client
**Preconditions**: Logged in, below client limit.
**Steps**:
1. Navigate to `/clients/create`
2. Fill in: Name, industry, tier, platforms, contact info
3. Click "Create Client"

**Expected**: Client created. Redirected to `/clients` or client detail. Success toast. Client appears in list.

---

### CLT-002 — Create Client — Required Field Validation
**Preconditions**: Logged in.
**Steps**:
1. Navigate to `/clients/create`
2. Leave required fields blank
3. Submit

**Expected**: Validation errors shown on required fields. Client not created.

---

### CLT-003 — Edit Client
**Preconditions**: At least one client exists.
**Steps**:
1. Open client detail
2. Click "Edit" or navigate to `/clients/:clientId/edit`
3. Change name, tier, or industry
4. Save

**Expected**: Changes saved. Updated values visible in client detail and list.

---

### CLT-004 — Delete Client
**Preconditions**: At least one non-internal client exists.
**Steps**:
1. Open client from list
2. Click delete/archive action
3. Confirm dialog

**Expected**: Client removed from list. Success toast.

---

### CLT-005 — Client Detail — Tabs Load
**Preconditions**: Client exists with posts, documents, campaigns, proposals.
**Steps**:
1. Open client detail `/clients/:clientId`
2. Click through each tab: Overview, Management, Workflow, Campaigns, Documents, Proposals

**Expected**: Each tab loads without error. Relevant data shown. Empty states shown when no data.

---

### CLT-006 — Client Filters
**Preconditions**: Multiple clients with different industries and tiers.
**Steps**:
1. Navigate to `/clients`
2. Apply industry filter
3. Apply tier filter
4. Apply urgency filter
5. Type in search box

**Expected**: Client list filters correctly for each applied filter. Results update dynamically.

---

### CLT-007 — Client Search
**Preconditions**: 3+ clients with distinct names.
**Steps**:
1. Navigate to `/clients`
2. Type partial client name in search box

**Expected**: Matching clients shown. Non-matching clients hidden.

---

### CLT-008 — Internal Account Flag
**Preconditions**: Agency has internal account.
**Steps**:
1. Navigate to `/clients`
2. Look for internal account badge

**Expected**: Internal account visible but excluded from client count in billing/subscription.

---

### CLT-009 — Client Limit Gate
**Preconditions**: Workspace is at or above `max_clients` limit (e.g. Ignite plan with 10 clients).
**Steps**:
1. Attempt to create a new client

**Expected**: "Create Client" button disabled or upgrade prompt shown. Cannot create new client.

---

## 4. Post Management

### POST-001 — Create Draft Post
**Preconditions**: At least one client exists.
**Steps**:
1. Click "New Post" or navigate via Posts page
2. Select client, fill in title, content, platform, target date
3. Click "Save Draft"

**Expected**: Post created in DRAFT status. Appears in posts list. Success toast.

---

### POST-002 — Create Post with Media
**Preconditions**: At least one client.
**Steps**:
1. Open DraftPostForm
2. Upload image/video file
3. Save

**Expected**: Media uploaded to Supabase storage. Preview visible in form and post detail.

---

### POST-003 — Create Post with Campaign Assignment
**Preconditions**: Active campaign exists for the client.
**Steps**:
1. Open DraftPostForm
2. Select a campaign from dropdown
3. Save

**Expected**: Post linked to selected campaign. Campaign posts count incremented.

---

### POST-004 — Submit Post for Review
**Preconditions**: DRAFT post exists.
**Steps**:
1. Open post detail
2. Click "Submit for Review" (or equivalent)
3. Confirm

**Expected**: Post status changes to PENDING. Action buttons update accordingly.

---

### POST-005 — Request Revision on Post
**Preconditions**: PENDING post exists.
**Steps**:
1. Open post detail
2. Click "Request Revisions"
3. Add revision notes
4. Confirm

**Expected**: Post status → REVISIONS. New revision version created. Version history updated in sidebar.

---

### POST-006 — Schedule Post
**Preconditions**: PENDING post exists.
**Steps**:
1. Open post detail
2. Click "Schedule"
3. Confirm

**Expected**: Post status → SCHEDULED. Target date locked. No further edits to content allowed.

---

### POST-007 — Archive Post
**Preconditions**: Post exists in any status.
**Steps**:
1. Open post
2. Archive it

**Expected**: Post status → ARCHIVED. Removed from active feed but visible under ARCHIVED filter.

---

### POST-008 — Post Version History
**Preconditions**: Post has multiple revisions.
**Steps**:
1. Open post detail
2. Click through version history in sidebar

**Expected**: Older versions viewable. Content, status, and version number shown correctly per version.

---

### POST-009 — Post Filters on Posts Page
**Preconditions**: Posts exist in multiple statuses with multiple clients/platforms.
**Steps**:
1. Navigate to `/posts`
2. Filter by: status, platform, client, campaign, date range
3. Switch between Grid and Table views

**Expected**: Filtered results accurate. View modes render correctly.

---

### POST-010 — Post Search
**Preconditions**: Posts with distinct titles.
**Steps**:
1. Navigate to `/posts`
2. Type title in search box

**Expected**: Matching posts shown. Non-matching hidden.

---

### POST-011 — Platform-Specific Preview
**Preconditions**: Post exists for Instagram, LinkedIn, Twitter, or YouTube.
**Steps**:
1. Open post detail
2. Click platform preview tab (Instagram/LinkedIn/Twitter/YouTube)

**Expected**: Platform-specific preview rendered showing how post will look on that platform.

---

### POST-012 — Media Deletion Safety
**Preconditions**: Post with media that has multiple versions referencing same media.
**Steps**:
1. Edit post and remove media
2. Save

**Expected**: Media file NOT deleted from storage (still referenced by other versions). Only removed from current version's URL list.

---

## 5. Content Calendar

### CAL-001 — Calendar Month View
**Preconditions**: Posts scheduled for current month.
**Steps**:
1. Navigate to `/calendar`
2. Verify month view is default

**Expected**: Scheduled posts appear on correct dates. Status colors match legend.

---

### CAL-002 — Calendar Week View
**Preconditions**: Posts scheduled for current week.
**Steps**:
1. Navigate to `/calendar`
2. Switch to Week view

**Expected**: Posts appear in correct day column. No layout breakage.

---

### CAL-003 — Calendar Platform Filter
**Preconditions**: Posts for multiple platforms.
**Steps**:
1. Navigate to `/calendar`
2. Filter by a specific platform (e.g. Instagram)

**Expected**: Only Instagram posts shown on calendar.

---

### CAL-004 — Calendar Client Filter
**Preconditions**: Posts for multiple clients.
**Steps**:
1. Navigate to `/calendar`
2. Select a client from filter

**Expected**: Only that client's posts shown.

---

### CAL-005 — Calendar Navigate Months/Weeks
**Preconditions**: Posts in adjacent months.
**Steps**:
1. Navigate to `/calendar`
2. Click forward/backward navigation arrows

**Expected**: Calendar updates to correct month/week. Posts for that period shown.

---

### CAL-006 — Calendar Post Detail Popup
**Preconditions**: Post on calendar.
**Steps**:
1. Click on a post in the calendar

**Expected**: Post detail popup shows: title, content snippet, platform, status, client.

---

### CAL-007 — Calendar PDF Export (Velocity+)
**Preconditions**: Velocity or Quantum plan.
**Steps**:
1. Navigate to `/calendar`
2. Click "Export PDF"

**Expected**: PDF downloads with calendar view and all visible posts.

---

### CAL-008 — Calendar PDF Export Locked (Trial/Ignite)
**Preconditions**: Trial or Ignite plan.
**Steps**:
1. Navigate to `/calendar`
2. Look for Export PDF button

**Expected**: Button visible but disabled with lock icon. Tooltip/upgrade prompt shown on hover.

---

## 6. Campaigns

### CAMP-001 — Campaigns Gate (Trial/Ignite)
**Preconditions**: Trial or Ignite plan.
**Steps**:
1. Navigate to `/campaigns`

**Expected**: Upgrade prompt shown. Cannot create campaigns.

---

### CAMP-002 — Create Campaign (Velocity+)
**Preconditions**: Velocity/Quantum plan, at least one client.
**Steps**:
1. Navigate to `/campaigns`
2. Click "New Campaign"
3. Fill in name, client, dates, budget
4. Save

**Expected**: Campaign created. Appears in list. Success toast.

---

### CAMP-003 — Campaign Detail Page Loads
**Preconditions**: Campaign with posts exists.
**Steps**:
1. Click on a campaign
2. Navigate to `/campaigns/:campaignId`

**Expected**: KPI bar, post list, platform distribution chart, budget tracker, and linked invoices all render.

---

### CAMP-004 — Link Posts to Campaign
**Preconditions**: Campaign and unlinked posts exist for same client.
**Steps**:
1. Open campaign detail
2. Click "Link Posts"
3. Select posts from dialog
4. Confirm

**Expected**: Posts appear in campaign post list. Post records updated with `campaign_id`.

---

### CAMP-005 — Unlink Post from Campaign
**Preconditions**: Campaign has linked posts.
**Steps**:
1. Open campaign detail
2. Find a post and click unlink

**Expected**: Post removed from campaign. Post's `campaign_id` cleared.

---

### CAMP-006 — Set Posts to Pending Approval
**Preconditions**: Campaign has linked DRAFT posts.
**Steps**:
1. Open campaign detail
2. Select posts and set to PENDING_APPROVAL

**Expected**: Post statuses update. "Share Review Link" button becomes active.

---

### CAMP-007 — Generate Review Link
**Preconditions**: Campaign has at least one PENDING_APPROVAL post.
**Steps**:
1. Open campaign detail
2. Click "Share Review Link"

**Expected**: Dialog opens with copyable URL. URL has format `/campaign-review/:token`.

---

### CAMP-008 — Email Review Link
**Preconditions**: Campaign has review token. Client has email address.
**Steps**:
1. Open "Share Review Link" dialog
2. Click "Send via Email"

**Expected**: Email sent to client. `last_review_sent_at` updated. Success toast.

---

### CAMP-009 — Regenerate Review Token
**Preconditions**: Campaign has existing token.
**Steps**:
1. Open campaign detail
2. Regenerate token

**Expected**: New token generated. Old token link no longer works. New URL available.

---

### CAMP-010 — Campaign Analytics Tab
**Preconditions**: Campaign with posts in multiple statuses.
**Steps**:
1. Open campaign detail
2. Click Analytics tab

**Expected**: Platform distribution chart, approval timeline, on-time metrics rendered.

---

### CAMP-011 — Link Invoice to Campaign
**Preconditions**: Campaign and invoice both exist.
**Steps**:
1. Open campaign detail → Invoices tab
2. Link an existing invoice to the campaign

**Expected**: Invoice appears in campaign invoices tab. Budget tracker updates.

---

### CAMP-012 — Campaign Notes and Meetings Tabs
**Preconditions**: Campaign with linked notes or meetings.
**Steps**:
1. Open campaign detail
2. Click Notes tab, then Meetings tab

**Expected**: Notes and meetings scoped to the campaign shown.

---

## 7. Campaign Public Review

### CAMPREVIEW-001 — Public Campaign Review Loads
**Preconditions**: Valid campaign review token exists.
**Steps**:
1. Navigate to `/campaign-review/:token` (unauthenticated or in incognito)

**Expected**: Two-panel UI loads. Left panel shows PENDING_APPROVAL posts. Right panel shows selected post.

---

### CAMPREVIEW-002 — Approve Post via Review
**Preconditions**: Campaign review open with PENDING_APPROVAL post.
**Steps**:
1. Select a post in the left panel
2. Click "Approve"

**Expected**: Post status → SCHEDULED. Post removed from review list. Success state shown.

---

### CAMPREVIEW-003 — Request Revisions via Review
**Preconditions**: Campaign review open with PENDING_APPROVAL post.
**Steps**:
1. Select a post
2. Click "Request Revisions"
3. Enter feedback message
4. Submit

**Expected**: Post status → NEEDS_REVISION. Post removed from review queue. Feedback saved.

---

### CAMPREVIEW-004 — Invalid Review Token
**Preconditions**: None.
**Steps**:
1. Navigate to `/campaign-review/invalid-token-xyz`

**Expected**: Error state shown ("Campaign not found" or similar). No post data exposed.

---

### CAMPREVIEW-005 — Branding on Review Page
**Preconditions**: Agency has sidebar branding enabled (Velocity+).
**Steps**:
1. Open campaign review link

**Expected**: Agency name/logo shown. "Powered by Tercero" shown based on plan.

---

## 8. Proposals

### PROP-001 — Create Proposal (Under Limit)
**Preconditions**: Agency under 5-proposal limit (Trial/Ignite) or Velocity+.
**Steps**:
1. Navigate to `/proposals`
2. Click "New Proposal"
3. Fill in name, client, value, valid until date
4. Save

**Expected**: Proposal created with DRAFT status. Appears in list.

---

### PROP-002 — Proposal Limit Gate (Trial/Ignite)
**Preconditions**: Trial/Ignite plan with exactly 5 proposals.
**Steps**:
1. Navigate to `/proposals`
2. Click "New Proposal"

**Expected**: Upgrade prompt shown. Proposal not created.

---

### PROP-003 — Add Line Items to Proposal
**Preconditions**: DRAFT proposal exists.
**Steps**:
1. Open proposal detail
2. Add 3 line items (description, amount)
3. Observe auto-save

**Expected**: Line items saved automatically on blur. Total updates. No manual save button needed.

---

### PROP-004 — Reorder Line Items
**Preconditions**: Proposal with 3+ line items.
**Steps**:
1. Open proposal detail
2. Drag line items to reorder

**Expected**: Order saved. Reordered on refresh.

---

### PROP-005 — Upload Proposal File
**Preconditions**: DRAFT proposal exists.
**Steps**:
1. Open proposal detail
2. Upload a PDF file

**Expected**: File uploaded to `proposal-files` bucket. Stored URL linked to proposal. Storage usage incremented.

---

### PROP-006 — Replace Proposal File
**Preconditions**: Proposal with uploaded file.
**Steps**:
1. Open proposal detail
2. Click "Replace File"
3. Upload new PDF

**Expected**: Old file deleted. New file linked. Storage usage stays accurate.

---

### PROP-007 — Generate Share Link (Draft → Sent)
**Preconditions**: DRAFT proposal exists.
**Steps**:
1. Open proposal detail
2. Click "Share Review Link"

**Expected**: Token generated. Status advances to SENT. Link URL shown. `last_review_sent_at` updated.

---

### PROP-008 — Download Proposal PDF
**Preconditions**: Proposal with line items exists.
**Steps**:
1. Open proposal detail
2. Click "Download PDF"

**Expected**: PDF downloads with: agency branding, client name, line items, totals, valid until date.

---

### PROP-009 — Archive Proposal
**Preconditions**: Accepted or declined proposal.
**Steps**:
1. Open proposal
2. Click "Archive"

**Expected**: Status → ARCHIVED. Removed from active list.

---

### PROP-010 — Delete Draft Proposal
**Preconditions**: DRAFT proposal.
**Steps**:
1. Select proposal
2. Delete

**Expected**: Hard deleted from DB. Removed from list.

---

### PROP-011 — Proposal Inline Edit Auto-Save
**Preconditions**: DRAFT proposal open.
**Steps**:
1. Click on proposal name field
2. Type a new name
3. Click away

**Expected**: Name saved automatically. No manual save needed. Success indicator shown briefly.

---

### PROP-012 — Proposal Status Timeline
**Preconditions**: Proposal that has been sent and viewed.
**Steps**:
1. Open proposal detail
2. Look at status timeline section

**Expected**: Timeline shows: Created → Sent (with timestamp) → Viewed (with timestamp) → current status.

---

### PROP-013 — Per-Client Proposals Tab
**Preconditions**: Client with proposals.
**Steps**:
1. Open client detail
2. Click Proposals tab

**Expected**: Only proposals for that client shown. Create button pre-fills client.

---

## 9. Proposal Public Review

### PROPREVIEW-001 — Public Proposal Page Loads
**Preconditions**: Valid proposal token.
**Steps**:
1. Navigate to `/proposal/:token` (incognito)

**Expected**: Proposal details shown: name, line items, totals, valid until date, agency branding.

---

### PROPREVIEW-002 — Mark as Viewed
**Preconditions**: Proposal in SENT status with token.
**Steps**:
1. Open the public proposal URL

**Expected**: `viewed_at` timestamp set. Status advances to VIEWED on agency side.

---

### PROPREVIEW-003 — Accept Proposal
**Preconditions**: Proposal in SENT/VIEWED status.
**Steps**:
1. Open public proposal
2. Click "Accept"

**Expected**: Status → ACCEPTED. `accepted_at` timestamp set. Agency notified.

---

### PROPREVIEW-004 — Decline Proposal
**Preconditions**: Proposal in SENT/VIEWED status.
**Steps**:
1. Open public proposal
2. Click "Decline"
3. Enter reason
4. Confirm

**Expected**: Status → DECLINED. `declined_at` timestamp set. Reason saved.

---

### PROPREVIEW-005 — Expired Proposal
**Preconditions**: Proposal where `valid_until` date is in the past.
**Steps**:
1. Open public proposal

**Expected**: Proposal shows as EXPIRED. Accept/Decline buttons disabled or hidden.

---

### PROPREVIEW-006 — Invalid Proposal Token
**Preconditions**: None.
**Steps**:
1. Navigate to `/proposal/invalid-token`

**Expected**: Error state shown. No proposal data exposed.

---

## 10. Finance — Invoices

### FIN-INV-001 — Create Invoice
**Preconditions**: At least one client exists.
**Steps**:
1. Navigate to `/finance/invoices`
2. Click "New Invoice"
3. Fill in: client, line items (description, quantity, price), due date, notes
4. Save

**Expected**: Invoice created. Appears in invoice list with status DRAFT. Auto-generated invoice number assigned.

---

### FIN-INV-002 — Edit Invoice
**Preconditions**: DRAFT invoice exists.
**Steps**:
1. Open edit dialog for invoice
2. Change line item amount
3. Save

**Expected**: Updated values saved. Total recalculated. Timestamp updated.

---

### FIN-INV-003 — Delete Invoice
**Preconditions**: Invoice exists.
**Steps**:
1. Click delete on invoice
2. Confirm

**Expected**: Invoice removed from list.

---

### FIN-INV-004 — Download Invoice PDF
**Preconditions**: Invoice with line items.
**Steps**:
1. Click "Download PDF" on invoice

**Expected**: PDF downloads. Contains agency branding, client info, line items, totals, payment details.

---

### FIN-INV-005 — Invoice Status Flow
**Preconditions**: DRAFT invoice.
**Steps**:
1. Change status: DRAFT → SENT → PAID

**Expected**: Status badge updates. Date timestamps set correctly per status change.

---

### FIN-INV-006 — Recurring Invoice Template (Velocity+)
**Preconditions**: Velocity/Quantum plan.
**Steps**:
1. Navigate to `/finance/invoices`
2. Click Recurring Templates tab
3. Create recurring template

**Expected**: Template created. Can generate invoices from template on schedule.

---

### FIN-INV-007 — Recurring Invoice Locked (Trial/Ignite)
**Preconditions**: Trial/Ignite plan.
**Steps**:
1. Navigate to `/finance/invoices`

**Expected**: Recurring Templates tab visible but locked with icon. Upgrade prompt on click.

---

## 11. Finance — Ledger & Transactions

### FIN-LED-001 — View Transaction Ledger
**Preconditions**: Transactions exist.
**Steps**:
1. Navigate to `/finance/ledger`

**Expected**: All transactions listed. Sortable by date, amount, type.

---

### FIN-LED-002 — Add Transaction
**Preconditions**: Logged in with finance access.
**Steps**:
1. Navigate to `/finance/ledger`
2. Click "Add Transaction"
3. Fill in: description, amount, type (income/expense), date, client
4. Save

**Expected**: Transaction appears in ledger. Finance overview totals updated.

---

### FIN-LED-003 — Edit Transaction
**Preconditions**: Transaction exists.
**Steps**:
1. Open edit dialog for transaction
2. Change amount
3. Save

**Expected**: Amount updated. Totals recalculated.

---

### FIN-LED-004 — Delete Transaction
**Preconditions**: Transaction exists.
**Steps**:
1. Delete transaction
2. Confirm

**Expected**: Transaction removed from ledger.

---

### FIN-LED-005 — Filter Ledger by Client
**Preconditions**: Transactions for multiple clients.
**Steps**:
1. Navigate to `/finance/ledger`
2. Filter by specific client

**Expected**: Only that client's transactions shown.

---

### FIN-LED-006 — Filter Ledger by Date Range
**Preconditions**: Transactions across multiple months.
**Steps**:
1. Select a date range on ledger

**Expected**: Only transactions within range shown.

---

## 12. Finance — Subscriptions

### FIN-SUB-001 — View Subscriptions Tab (Velocity+)
**Preconditions**: Velocity/Quantum plan.
**Steps**:
1. Navigate to `/finance/subscriptions`

**Expected**: Expense subscriptions list shown. Monthly burn rate visible.

---

### FIN-SUB-002 — Subscriptions Locked (Trial/Ignite)
**Preconditions**: Trial/Ignite plan.
**Steps**:
1. Navigate to `/finance/subscriptions`

**Expected**: Lock state shown. Upgrade prompt visible.

---

### FIN-SUB-003 — Add Subscription
**Preconditions**: Velocity+ plan.
**Steps**:
1. Navigate to `/finance/subscriptions`
2. Click "Add Subscription"
3. Fill in name, amount, billing cycle, start date
4. Save

**Expected**: Subscription created. Monthly burn rate updated.

---

## 13. Finance — Overview

### FIN-OVR-001 — Finance Overview Loads
**Preconditions**: Invoice, expense, and transaction data exists.
**Steps**:
1. Navigate to `/finance/overview`

**Expected**: Income, expenses, net profit shown. Charts render. No errors.

---

### FIN-OVR-002 — Finance Totals Accuracy
**Preconditions**: Known set of transactions.
**Steps**:
1. Add specific amounts via transactions
2. Check overview totals

**Expected**: Totals match sum of entered transactions.

---

## 14. Documents

### DOC-001 — Upload Document
**Preconditions**: At least one client.
**Steps**:
1. Navigate to `/documents`
2. Click upload or drag a file
3. Fill in display name, category, client
4. Confirm upload

**Expected**: Document uploaded to `client-documents` bucket. Appears in list. Storage usage incremented.

---

### DOC-002 — Download / View Document
**Preconditions**: Document exists.
**Steps**:
1. Click on a document

**Expected**: Document preview opens (PDF, image). Signed URL used. No access without auth.

---

### DOC-003 — Delete Document
**Preconditions**: Document exists.
**Steps**:
1. Click delete on document
2. Confirm

**Expected**: File removed from storage. DB record deleted. Storage usage decremented.

---

### DOC-004 — Rename Document
**Preconditions**: Document exists.
**Steps**:
1. Edit document display name

**Expected**: Name updated without re-uploading file.

---

### DOC-005 — Filter Documents by Client
**Preconditions**: Documents for multiple clients.
**Steps**:
1. Navigate to `/documents`
2. Select client from filter dropdown

**Expected**: Only that client's documents shown.

---

### DOC-006 — Filter Documents by Category
**Preconditions**: Documents with different categories.
**Steps**:
1. Filter by "Contract", then "Brief", etc.

**Expected**: Only documents of selected category shown.

---

### DOC-007 — Document Collections (Velocity+)
**Preconditions**: Velocity/Quantum plan.
**Steps**:
1. Navigate to `/documents` → Collections tab
2. Create a new collection
3. Move a document to the collection

**Expected**: Collection created. Document moved. Document visible inside collection.

---

### DOC-008 — Document Collections Locked (Trial/Ignite)
**Preconditions**: Trial/Ignite plan.
**Steps**:
1. Navigate to `/documents`

**Expected**: Collections tab visible but locked. Upgrade prompt on click.

---

### DOC-009 — Document Size Limit
**Preconditions**: File larger than 50 MB.
**Steps**:
1. Attempt to upload oversized file

**Expected**: Upload rejected with error "File too large" or similar. No partial upload.

---

### DOC-010 — Client-Scoped Documents Tab
**Preconditions**: Client with documents.
**Steps**:
1. Open client detail → Documents tab

**Expected**: Only documents belonging to that client shown. No cross-client data visible.

---

## 15. Operations — Meetings

### MTG-001 — Create Meeting
**Preconditions**: At least one client.
**Steps**:
1. Navigate to `/operations/meetings`
2. Click "New Meeting"
3. Fill in title, client, date/time, location
4. Save

**Expected**: Meeting created. Appears in calendar grid on correct date.

---

### MTG-002 — Edit Meeting
**Preconditions**: Meeting exists.
**Steps**:
1. Click edit on meeting
2. Change date or location
3. Save

**Expected**: Changes saved. Calendar reflects update.

---

### MTG-003 — Delete Meeting
**Preconditions**: Meeting exists.
**Steps**:
1. Delete meeting and confirm

**Expected**: Meeting removed from calendar.

---

### MTG-004 — Meetings by Client
**Preconditions**: Meetings for multiple clients.
**Steps**:
1. Filter by client

**Expected**: Only meetings for selected client shown.

---

## 16. Operations — Notes & Reminders

### NOTE-001 — Create Note
**Preconditions**: Logged in.
**Steps**:
1. Navigate to `/operations/notes`
2. Click "New Note"
3. Fill in title, content, due date, client (optional), status
4. Save

**Expected**: Note created. Appears in list with correct urgency color based on due date.

---

### NOTE-002 — Complete Note
**Preconditions**: Open note exists.
**Steps**:
1. Mark note as completed

**Expected**: Status changes to COMPLETED. Moved to completed section or styled differently.

---

### NOTE-003 — Edit Note
**Preconditions**: Note exists.
**Steps**:
1. Open edit dialog
2. Change content
3. Save

**Expected**: Changes saved. No duplicate created.

---

### NOTE-004 — Delete Note
**Preconditions**: Note exists.
**Steps**:
1. Delete note and confirm

**Expected**: Note removed from list.

---

### NOTE-005 — Note Urgency Indicators
**Preconditions**: Notes with different due dates (overdue, today, tomorrow, future).
**Steps**:
1. Navigate to notes page
2. Observe color indicators

**Expected**:
- Overdue: rose/red with pulse animation
- < 24h: red with pulse
- < 48h: amber
- Healthy: green

---

## 17. Settings — Profile

### SETT-001 — Update Display Name
**Preconditions**: Logged in.
**Steps**:
1. Navigate to `/settings` → Profile tab
2. Change display name
3. Save

**Expected**: Name updated. Reflected in sidebar user menu.

---

### SETT-002 — Change Password
**Preconditions**: Logged in.
**Steps**:
1. Navigate to `/settings` → Profile tab
2. Click "Change Password"
3. Enter current password, new password, confirm
4. Save

**Expected**: Password changed. Success toast. Confirmation email sent.

---

### SETT-003 — Upload Profile Avatar
**Preconditions**: Logged in.
**Steps**:
1. Navigate to Profile settings
2. Upload avatar image

**Expected**: Avatar uploaded. Preview updated. Shown in user menu.

---

## 18. Settings — Agency Branding

### SETT-AGN-001 — Update Agency Name
**Preconditions**: Logged in as admin.
**Steps**:
1. Navigate to `/settings` → Agency tab
2. Change agency name
3. Save

**Expected**: Agency name updated. Reflected in sidebar (if branding enabled).

---

### SETT-AGN-002 — Upload Square Logo
**Preconditions**: Logged in as admin.
**Steps**:
1. Navigate to Agency settings
2. Upload a square logo image
3. Save

**Expected**: Logo uploaded. Shown in sidebar (if Velocity+). Used in PDFs.

---

### SETT-AGN-003 — Upload Horizontal Logo with Crop
**Preconditions**: Logged in as admin.
**Steps**:
1. Navigate to Agency settings
2. Upload image for horizontal logo
3. Use crop tool to adjust
4. Save

**Expected**: Cropped horizontal logo saved. Used in sidebar if branding enabled.

---

### SETT-AGN-004 — Agency Branding Sidebar (Velocity+)
**Preconditions**: Velocity/Quantum plan with logo uploaded.
**Steps**:
1. Navigate to `/settings` → Agency
2. Enable sidebar branding

**Expected**: Agency logo and name appear in sidebar header. Tercero branding replaced.

---

## 19. Settings — Team Management

### TEAM-001 — Generate Invite Link
**Preconditions**: Logged in as admin.
**Steps**:
1. Navigate to `/settings` → Team tab
2. Click "Generate Invite Link"

**Expected**: Link generated. Visible in pending invites section with expiry (7 days).

---

### TEAM-002 — Revoke Invite
**Preconditions**: Pending invite exists.
**Steps**:
1. Click "Revoke" on invite

**Expected**: Invite expires immediately. Link no longer usable.

---

### TEAM-003 — View Active Members
**Preconditions**: Team members exist.
**Steps**:
1. Navigate to Team tab

**Expected**: All active members listed with name, email, role, and joined date.

---

### TEAM-004 — Remove Team Member
**Preconditions**: Active team member exists.
**Steps**:
1. Click remove on member
2. Confirm

**Expected**: Member soft-deleted. Moved to removed members list. Cannot log in.

---

### TEAM-005 — Restore Removed Member
**Preconditions**: Soft-deleted member exists.
**Steps**:
1. Click restore on removed member

**Expected**: Member restored. Can log in again. Appears in active list.

---

### TEAM-006 — Permanently Delete Member
**Preconditions**: Soft-deleted member exists.
**Steps**:
1. Click permanent delete
2. Confirm

**Expected**: Member record fully deleted. Cannot be restored.

---

## 20. Team Invite — Join Flow

### JOIN-001 — Accept Valid Invite
**Preconditions**: Valid, non-expired invite link.
**Steps**:
1. Open invite link `/join/:token` (in incognito / different browser)
2. Fill in name, email, password, role
3. Submit

**Expected**: New auth user created. `agency_members` row created. Redirected to `/dashboard` in the agency workspace.

---

### JOIN-002 — Expired Invite Link
**Preconditions**: Invite that was generated >7 days ago or revoked.
**Steps**:
1. Navigate to `/join/:token`

**Expected**: Error shown ("This invite has expired or is no longer valid"). Cannot proceed.

---

### JOIN-003 — Already Used Invite
**Preconditions**: Invite already accepted by another user.
**Steps**:
1. Try to use the same invite link again

**Expected**: Error shown. Link cannot be reused.

---

### JOIN-004 — Team Member Workspace Access
**Preconditions**: Newly joined team member.
**Steps**:
1. Log in as team member
2. Navigate through all sections

**Expected**: All agency data visible (same as owner's workspace). No cross-tenant data visible.

---

## 21. Billing & Usage

### BILL-001 — Billing Page Loads
**Preconditions**: Logged in.
**Steps**:
1. Navigate to `/billing`

**Expected**: Current plan name displayed. Feature checklist visible. Storage and client usage shown.

---

### BILL-002 — Storage Usage Display
**Preconditions**: Agency has uploaded documents/files.
**Steps**:
1. Navigate to `/billing` → Usage tab

**Expected**: Storage bar shows accurate usage. Values match total of uploaded files.

---

### BILL-003 — Client Count vs Limit
**Preconditions**: Agency has clients.
**Steps**:
1. Navigate to `/billing` → Usage tab

**Expected**: Client count shown vs max_clients for current plan. Internal account excluded from count.

---

### BILL-004 — Internal Invoices Tab
**Preconditions**: Tercero has issued internal invoices to agency.
**Steps**:
1. Navigate to `/billing` → Invoices tab

**Expected**: Internal Tercero billing invoices shown.

---

## 22. Feature Gating & Subscription Plans

### GATE-001 — Trial Plan — Feature Restrictions
**Preconditions**: Account on Trial plan.
**Steps**:
1. Check: Campaigns nav item hidden or locked
2. Check: Finance → Subscriptions locked
3. Check: Calendar Export locked
4. Check: Documents Collections locked
5. Check: Recurring Invoices locked
6. Check: Sidebar branding locked
7. Check: Proposals limit = 5

**Expected**: All above features locked/hidden. Lock icons shown where applicable. Upgrade prompts shown on attempt.

---

### GATE-002 — Ignite Plan — Feature Restrictions
**Preconditions**: Account on Ignite plan.
**Steps**:
1. Verify same features as GATE-001 (Campaigns, Collections, Calendar Export locked)
2. Verify "Powered by Tercero" visible in footer

**Expected**: Ignite has same restricted features as Trial but higher client/storage limits.

---

### GATE-003 — Velocity Plan — Feature Access
**Preconditions**: Account on Velocity plan.
**Steps**:
1. Verify: Campaigns visible and functional
2. Verify: Finance → Subscriptions accessible
3. Verify: Calendar Export works
4. Verify: Document Collections available
5. Verify: Recurring Invoices tab visible
6. Verify: Agency sidebar branding toggleable
7. Verify: Proposals unlimited

**Expected**: All features accessible. "Powered by Tercero" still shown in footer.

---

### GATE-004 — Quantum Plan — Full Access
**Preconditions**: Account on Quantum plan.
**Steps**:
1. Verify all Velocity features
2. Verify "Powered by Tercero" NOT shown (full white-label)

**Expected**: Complete white-label experience. No Tercero branding in footer.

---

## 23. Public Post Review

### REVIEW-001 — Public Review Page Loads
**Preconditions**: PENDING post with share token.
**Steps**:
1. Navigate to `/review/:token` in incognito

**Expected**: Post detail shown: title, content, media, platform, target date.

---

### REVIEW-002 — Invalid Post Review Token
**Preconditions**: None.
**Steps**:
1. Navigate to `/review/invalid-token`

**Expected**: Error state. No post data exposed.

---

## 24. Navigation & Routing

### NAV-001 — All Nav Links Work
**Preconditions**: Logged in.
**Steps**:
1. Click each sidebar nav link: Dashboard, Clients, Posts, Calendar, Campaigns, Proposals, Finance (all sub-items), Operations (Meetings, Notes), Documents, Settings, Billing

**Expected**: Each link navigates to correct page without 404 or blank screen.

---

### NAV-002 — Breadcrumbs Update Correctly
**Preconditions**: Logged in.
**Steps**:
1. Navigate to a deep page (e.g. `/clients/:id/posts/:postId`)
2. Observe header breadcrumbs

**Expected**: Breadcrumbs show correct hierarchy: Dashboard > Clients > [Client Name] > Posts > [Post Title].

---

### NAV-003 — Catch-All Redirect
**Preconditions**: Logged in.
**Steps**:
1. Navigate to a non-existent route (e.g. `/nonexistent`)

**Expected**: Redirected to `/dashboard`.

---

### NAV-004 — Sidebar Collapsed State
**Preconditions**: Logged in.
**Steps**:
1. Toggle sidebar collapse
2. Navigate to another page

**Expected**: Sidebar state persists across navigation.

---

## 25. Dark / Light Mode

### THEME-001 — Toggle Dark Mode
**Preconditions**: Logged in.
**Steps**:
1. Click the mode toggle in the header
2. Switch between Light and Dark

**Expected**: Theme changes immediately. All components use correct colors (no hardcoded white/black bleeding through).

---

### THEME-002 — Theme Persists After Refresh
**Preconditions**: Dark mode enabled.
**Steps**:
1. Enable dark mode
2. Refresh page

**Expected**: Dark mode still active after refresh.

---

## Regression Checklist (Run After Any Major Change)

| Area | What to Check |
|------|--------------|
| Auth | Login, logout, session persistence, protected route redirect |
| Clients | CRUD, filters, limit gating |
| Posts | Create, submit, revise, schedule, media upload |
| Campaigns | Create, link posts, review flow, analytics |
| Proposals | Create, line items, share, accept, decline |
| Finance | Invoice CRUD, ledger, overview totals |
| Documents | Upload, delete, storage tracking |
| Calendar | Month/week view, post visibility, PDF export (Velocity+) |
| Settings | Password change, agency branding, team management |
| Feature gates | All locked features show lock state, not 404 |
| Dark mode | No color bleed, persists after refresh |
| Public pages | Campaign review, proposal review, post review — all unauthenticated |
| Multi-tenant | Team member sees same data as owner, no cross-workspace leakage |
