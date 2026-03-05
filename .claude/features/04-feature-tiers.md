# Tercero — Feature Tiers & Plan Limitations
**Location**: `.claude/features/`  
**Last Updated**: March 2026  
**Purpose**: Defines which features are available on each plan, what limits apply, and the rationale behind each gating decision. Used for landing page pricing section, billing enforcement logic, and upsell copy.

---

## Plan Overview (Existing)

| | Free | Ignite | Velocity | Quantum |
|--|------|--------|----------|---------|
| **Price** | — | ₹1,999/mo | ₹5,999/mo | ₹12,999/mo |
| **Target** | Trial / Solo | Freelancers & solopreneurs | Boutique agencies | Scaling firms & enterprises |
| **Clients** | 1 | Up to 5 | Up to 15 | Up to 35 |
| **Storage** | 5 GB | 20 GB | 100 GB | 500 GB |
| **Extra Client** | ₹400/mo | ₹400/mo | ₹400/mo | ₹370/mo |
| **Whitelabeling** | ✗ | ✗ | Basic | Full Custom |
| **Finance Module** | Basic Ledger | Basic Ledger | Invoicing + Reports | Full CFO |
| **Support** | Email | Email | Priority Chat | VIP Concierge |

---

## Section 1 — Existing Features: Tier Breakdown

### 1.1 Dashboard
| Capability | Free | Ignite | Velocity | Quantum |
|-----------|------|--------|----------|---------|
| Agency health KPI bar | ✓ | ✓ | ✓ | ✓ |
| Workflow Health (post pipeline) | ✓ | ✓ | ✓ | ✓ |
| Week Timeline | ✓ | ✓ | ✓ | ✓ |
| Client Health Grid | ✓ | ✓ | ✓ | ✓ |
| Financial Snapshot | Basic | Basic | Full | Full |
| Lifetime Revenue chart | ✗ | ✓ | ✓ | ✓ |
| Profitability Trend chart | ✗ | ✓ | ✓ | ✓ |
| Recent Invoices widget | ✗ | ✗ | ✓ | ✓ |

**Rationale**: The dashboard is the first page every user lands on. Gating it completely hurts activation. Show everything structurally — gate the financial depth. Free and Ignite users see pipeline and health; financial charts unlock at Velocity and above where the finance module is fully unlocked.

---

### 1.2 Client Management
| Capability | Free | Ignite | Velocity | Quantum |
|-----------|------|--------|----------|---------|
| Max clients | 1 | 5 | 15 | 35 |
| Internal Workspace | ✓ | ✓ | ✓ | ✓ |
| Client tiers (Bronze/Silver/Gold etc.) | ✓ | ✓ | ✓ | ✓ |
| Client profitability metrics | ✗ | ✗ | ✓ | ✓ |
| Extra clients (add-on) | ₹400/mo | ₹400/mo | ₹400/mo | ₹370/mo |

**Rationale**: Client count is the primary plan differentiator. Profitability metrics per client require the finance module, so they unlock at Velocity.

---

### 1.3 Posts & Content Management
| Capability | Free | Ignite | Velocity | Quantum |
|-----------|------|--------|----------|---------|
| Post creation | ✓ | ✓ | ✓ | ✓ |
| Post versioning / history | ✓ | ✓ | ✓ | ✓ |
| All post statuses (Draft→Scheduled) | ✓ | ✓ | ✓ | ✓ |
| Platform previews (IG, LinkedIn etc.) | ✓ | ✓ | ✓ | ✓ |
| Media upload (images/video) | ✓ | ✓ | ✓ | ✓ |
| Public review link (client approval) | ✓ | ✓ | ✓ | ✓ |
| Admin notes on posts | ✓ | ✓ | ✓ | ✓ |
| Global posts page | ✓ | ✓ | ✓ | ✓ |
| Posts per client limit | Unlimited | Unlimited | Unlimited | Unlimited |

**Rationale**: Posts are the core value of the product. No meaningful gating here — this is what users pay for. The natural limit is client count, not post count. Gating posts would directly harm the core workflow and increase churn.

---

### 1.4 Content Calendar
| Capability | Free | Ignite | Velocity | Quantum |
|-----------|------|--------|----------|---------|
| Month view | ✓ | ✓ | ✓ | ✓ |
| Week view | ✓ | ✓ | ✓ | ✓ |
| Filter by client / platform / status | ✓ | ✓ | ✓ | ✓ |
| Create post from calendar | ✓ | ✓ | ✓ | ✓ |

**Rationale**: Calendar is a core workflow tool. No meaningful gating needed — its utility is naturally bounded by client and post count.

---

### 1.5 Finance Module
| Capability | Free | Ignite | Velocity | Quantum |
|-----------|------|--------|----------|---------|
| Ledger (manual income/expense entries) | ✓ Basic | ✓ Basic | ✓ Full | ✓ Full |
| Invoices (create, send, mark paid) | ✗ | ✗ | ✓ | ✓ |
| Invoice PDF export | ✗ | ✗ | ✓ | ✓ |
| Subscriptions / recurring expenses | ✗ | ✗ | ✓ | ✓ |
| Finance overview dashboard | ✗ | ✗ | ✓ | ✓ |
| Profitability trend chart | ✗ | ✗ | ✓ | ✓ |
| Per-client profitability view | ✗ | ✗ | ✓ | ✓ |
| CFO analysis / advanced reports | ✗ | ✗ | ✗ | ✓ |
| Cash vs Accrual toggle | ✗ | ✗ | ✗ | ✓ |

**Rationale**: Finance is the clearest upsell from Ignite → Velocity. Basic ledger (recording transactions manually) is available from the start because it's table-stakes for any business. Full invoicing unlocks at Velocity — this is the feature most agencies cite as a reason to upgrade from scheduling tools.

---

### 1.6 Meetings
| Capability | Free | Ignite | Velocity | Quantum |
|-----------|------|--------|----------|---------|
| Create / manage meetings | ✓ | ✓ | ✓ | ✓ |
| Meeting link (Zoom/Meet URL) | ✓ | ✓ | ✓ | ✓ |
| In-app meeting reminders | ✓ | ✓ | ✓ | ✓ |
| Meetings per client limit | Unlimited | Unlimited | Unlimited | Unlimited |

**Rationale**: Meetings are a lightweight operational feature. No meaningful gating — bounded naturally by client count.

---

### 1.7 Notes & Reminders
| Capability | Free | Ignite | Velocity | Quantum |
|-----------|------|--------|----------|---------|
| Create / manage notes | ✓ | ✓ | ✓ | ✓ |
| Status cycling (Todo/Done/Archived) | ✓ | ✓ | ✓ | ✓ |
| Client assignment | ✓ | ✓ | ✓ | ✓ |
| Notes per client limit | Unlimited | Unlimited | Unlimited | Unlimited |

**Rationale**: Notes are a utility feature. No gating needed.

---

### 1.8 Whitelabeling & Branding
| Capability | Free | Ignite | Velocity | Quantum |
|-----------|------|--------|----------|---------|
| Agency logo in sidebar | ✓ | ✓ | ✓ | ✓ |
| Agency name in sidebar | ✓ | ✓ | ✓ | ✓ |
| Basic agency logo on client review page | ✗ | ✗ | ✓ | ✓ |
| Full custom domain for review links | ✗ | ✗ | ✗ | ✓ |
| Custom email domain for notifications | ✗ | ✗ | ✗ | ✓ |
| Remove "Powered by Tercero" branding | ✗ | ✗ | ✗ | ✓ |

**Rationale**: Internal branding (sidebar logo) is available to all — it's a setup requirement, not a premium feature. External-facing branding (what clients see on the review page) starts at Velocity. Full white-label (custom domain, custom email) is a clear Quantum differentiator — enterprises selling their agency as a premium brand need this.

---

## Section 2 — New Features: Tier Breakdown

---

### 2.1 Campaigns

| Capability | Free | Ignite | Velocity | Quantum |
|-----------|------|--------|----------|---------|
| Create campaigns | ✓ | ✓ | ✓ | ✓ |
| Associate posts to campaigns | ✓ | ✓ | ✓ | ✓ |
| Campaign list & detail view | ✓ | ✓ | ✓ | ✓ |
| Campaign status (Active/Completed/Archived) | ✓ | ✓ | ✓ | ✓ |
| Max active campaigns per client | 1 | 3 | Unlimited | Unlimited |
| Campaign analytics (delivery rate, timeline) | ✗ | ✗ | ✓ | ✓ |
| Campaign budget tracking | ✗ | ✗ | ✓ | ✓ |
| Campaign-level client approval link | ✗ | ✗ | ✓ | ✓ |
| Campaign templates | ✗ | ✗ | ✓ | ✓ |
| Campaign → invoice budget bridge | ✗ | ✗ | ✓ | ✓ |

**Rationale for campaign limits:**

- **Free (1 active campaign per client)**: Enough to experience the feature and understand the value. One active campaign at a time per client is a genuine limitation for a real agency — it creates natural upgrade pressure without making the product useless.
- **Ignite (3 active campaigns per client)**: Realistic for a freelancer or solopreneur managing a handful of clients. Might run a "monthly content" campaign + a "product launch" campaign + a "seasonal" campaign simultaneously. 3 feels generous but not unlimited.
- **Velocity/Quantum (Unlimited)**: Boutique and scaling agencies need to run campaigns freely without counting. Limiting here would actively hurt their workflow.

**Analytics and budget tracking gate at Velocity** because those features depend on the finance module which is also a Velocity unlock. Keeping the dependency consistent reduces confusion.

**Campaign-level review link** gates at Velocity for the same reason as whitelabeling — it's a client-facing feature that represents the agency's brand and professionalism.

---

### 2.2 Proposals & Client Pipeline

| Capability | Free | Ignite | Velocity | Quantum |
|-----------|------|--------|----------|---------|
| Prospect client status | ✓ | ✓ | ✓ | ✓ |
| Pipeline stages (Lead → Won/Lost) | ✓ | ✓ | ✓ | ✓ |
| Max active prospects | 3 | 10 | Unlimited | Unlimited |
| Prospect → Active Client conversion | ✓ | ✓ | ✓ | ✓ |
| Pipeline Kanban view | ✓ | ✓ | ✓ | ✓ |
| Pipeline value estimation | ✗ | ✓ | ✓ | ✓ |
| Prospect notes & meetings | ✓ | ✓ | ✓ | ✓ |
| **Proposal builder (Phase 2)** | | | | |
| Create proposal drafts | ✗ | ✓ | ✓ | ✓ |
| Shareable proposal preview link | ✗ | ✓ | ✓ | ✓ |
| Client accept/decline online | ✗ | ✓ | ✓ | ✓ |
| Max active proposals | — | 3 | Unlimited | Unlimited |
| Proposal templates | ✗ | ✗ | ✓ | ✓ |
| Agency branding on proposal | ✗ | Basic | Full | Full + Custom domain |
| Proposal → invoice line item import | ✗ | ✗ | ✓ | ✓ |
| E-signature (lightweight) | ✗ | ✗ | ✓ | ✓ |
| Proposal analytics (view tracking, time-to-accept) | ✗ | ✗ | ✗ | ✓ |

**Rationale for prospect limits:**

- **Free (3 prospects)**: Enough for a trial user to experience the pipeline. Free users aren't running a full agency — 3 prospects is realistic and generous for exploration.
- **Ignite (10 prospects)**: A freelancer actively pitching might have 5–10 active leads at any time. 10 feels comfortable without being unlimited.
- **Velocity/Quantum (Unlimited)**: A boutique agency with a business development function needs to track unlimited leads without friction.

**Proposal builder starts at Ignite (Phase 2)** — not Free — because:
1. A polished proposal is a core professional deliverable. Free-tier branding on a client-facing proposal actively undermines the agency's professionalism.
2. The proposal builder has enough value to be an Ignite retention/conversion driver. If a Free user starts building a proposal and hits the gate, the upgrade is obvious and justified.

**Proposal templates gate at Velocity** because templates imply a recurring, scaled workflow — that's a boutique agency concern, not a freelancer concern.

**Proposal analytics (view tracking — did the client open it? how long did they spend reading?)** is a Quantum exclusive. It's a sales intelligence feature that scaling firms with a proper BD function will value. For smaller tiers it's overkill.

---

### 2.3 Document Storage

| Capability | Free | Ignite | Velocity | Quantum |
|-----------|------|--------|----------|---------|
| Documents tab on client profile | ✓ | ✓ | ✓ | ✓ |
| Upload files (PDF, DOCX, images, etc.) | ✓ | ✓ | ✓ | ✓ |
| Document categories | ✓ | ✓ | ✓ | ✓ |
| Download documents | ✓ | ✓ | ✓ | ✓ |
| Max file size per upload | 10 MB | 25 MB | 100 MB | 250 MB |
| Max documents per client | 5 | 20 | Unlimited | Unlimited |
| Search documents by name | ✓ | ✓ | ✓ | ✓ |
| Document sharing (public link) | ✗ | ✗ | ✓ | ✓ |
| Document version history | ✗ | ✗ | ✓ | ✓ |
| **Document templates (Phase 2)** | | | | |
| Create document templates | ✗ | ✗ | ✓ | ✓ |
| Generate document from template | ✗ | ✗ | ✓ | ✓ |
| AI-assisted document generation | ✗ | ✗ | ✗ | ✓ |
| E-signature on shared documents | ✗ | ✗ | ✓ | ✓ |
| Document PDF export (generated docs) | ✗ | ✗ | ✓ | ✓ |
| Full-text search inside documents | ✗ | ✗ | ✗ | ✓ |

**Rationale for document limits:**

- **Free (5 documents per client, 10 MB per file)**: Enough to upload a contract and a brand brief per client. Gets the concept across. The 10 MB file size limit handles PDFs and images but not large video/design files — intentional.
- **Ignite (20 documents per client, 25 MB per file)**: A freelancer managing a client relationship fully can store all key documents (contract, NDA, brief, brand guidelines, a few asset files) within 20 per client. 25 MB covers most PDFs and mid-size image assets.
- **Velocity (Unlimited documents, 100 MB per file)**: Boutique agencies with 10–15 clients and active campaign work generate significant documentation. Unlimited is the right call — counting documents at this tier is friction without meaningful revenue protection. 100 MB covers large PDFs, Figma exports, and moderately sized video assets.
- **Quantum (Unlimited, 250 MB per file)**: Enterprise clients may have large brand packages, video files, or technical documents. 250 MB per file accommodates this without unlimited file size (which would be a storage cost risk).

**Document sharing (public link) gates at Velocity** — same rationale as whitelabeling. Sending a client a document link from a Tercero URL is a professional, client-facing action. At Velocity, the agency logo is on the review page; document sharing belongs in the same tier.

**AI-assisted document generation is Quantum-only** — it has real inference costs (Anthropic API calls) and represents a premium capability. Quantum clients generating contracts, briefs, and SOPs automatically is a clear enterprise-tier differentiator.

**Full-text search inside documents is Quantum-only** — requires text extraction from PDFs and indexing, which is meaningful infrastructure investment. Scaling firms with 35+ clients and hundreds of documents genuinely need this. Smaller tiers don't.

---

## Section 3 — Cross-Feature Tier Summary

The clearest way to communicate this on the landing page:

### What each tier is really about:

**Free** — Try the core. Posts, calendar, clients. See if Tercero fits your workflow.

**Ignite (₹1,999/mo)** — The solo operator's tool. Full content management, 5 clients, basic ledger, document storage, prospect tracking. Everything a freelancer running a small portfolio needs.

**Velocity (₹5,999/mo)** — The agency tool. Full finance (invoices, reports, profitability), unlimited campaigns, proposal builder, document templates and sharing, whitelabeling. Built for the agency that has a team and real clients to impress.

**Quantum (₹12,999/mo)** — The enterprise command center. Custom domain, full white-label, AI document generation, proposal analytics, CFO-level finance analysis, VIP support. Built for firms that sell their agency as a premium brand.

---

## Section 4 — Enforcement Implementation Notes

### Database: `agency_subscriptions` feature flags

The existing `agency_subscriptions` table should carry boolean and numeric flags for each gated feature. Suggested additions:

```sql
-- Existing (inferred from codebase)
max_clients          INTEGER
storage_limit_bytes  BIGINT
white_label_flag     BOOLEAN

-- New flags to add for new features
max_campaigns_per_client    INTEGER    -- NULL = unlimited
max_prospects               INTEGER    -- NULL = unlimited
max_proposals               INTEGER    -- NULL = unlimited
max_docs_per_client         INTEGER    -- NULL = unlimited
max_doc_file_size_bytes     BIGINT
campaigns_analytics         BOOLEAN DEFAULT FALSE
campaigns_budget            BOOLEAN DEFAULT FALSE
proposal_builder            BOOLEAN DEFAULT FALSE
proposal_templates          BOOLEAN DEFAULT FALSE
proposal_esignature         BOOLEAN DEFAULT FALSE
proposal_analytics          BOOLEAN DEFAULT FALSE
document_sharing            BOOLEAN DEFAULT FALSE
document_version_history    BOOLEAN DEFAULT FALSE
document_templates          BOOLEAN DEFAULT FALSE
document_ai_generation      BOOLEAN DEFAULT FALSE
document_fulltext_search    BOOLEAN DEFAULT FALSE
```

### Plan Seed Data

```
Free:
  max_clients = 1, max_campaigns_per_client = 1,
  max_prospects = 3, proposal_builder = false,
  max_docs_per_client = 5, max_doc_file_size_bytes = 10485760 (10MB)

Ignite:
  max_clients = 5, max_campaigns_per_client = 3,
  max_prospects = 10, proposal_builder = true, max_proposals = 3,
  max_docs_per_client = 20, max_doc_file_size_bytes = 26214400 (25MB)

Velocity:
  max_clients = 15, max_campaigns_per_client = NULL (unlimited),
  max_prospects = NULL, proposal_builder = true, max_proposals = NULL,
  proposal_templates = true, proposal_esignature = true,
  campaigns_analytics = true, campaigns_budget = true,
  max_docs_per_client = NULL, max_doc_file_size_bytes = 104857600 (100MB),
  document_sharing = true, document_version_history = true,
  document_templates = true

Quantum:
  max_clients = 35, max_campaigns_per_client = NULL,
  max_prospects = NULL, proposal_builder = true, max_proposals = NULL,
  proposal_templates = true, proposal_esignature = true,
  proposal_analytics = true,
  campaigns_analytics = true, campaigns_budget = true,
  max_docs_per_client = NULL, max_doc_file_size_bytes = 262144000 (250MB),
  document_sharing = true, document_version_history = true,
  document_templates = true, document_ai_generation = true,
  document_fulltext_search = true
```

### Guard Pattern (Frontend)

Every gated action should follow the existing plan limit pattern already used for client count:

```javascript
// Example: Check before creating a new campaign
const canCreateCampaign = () => {
  const { max_campaigns_per_client } = subscription;
  if (max_campaigns_per_client === null) return true; // unlimited
  return activeCampaignsForClient < max_campaigns_per_client;
};

// If false → show upgrade nudge dialog
// "You've reached the campaign limit on your Ignite plan.
//  Upgrade to Velocity for unlimited campaigns."
```

### Upgrade Nudge Copy Guidelines

| Context | Nudge Copy |
|---------|-----------|
| Campaign limit hit | "Upgrade to Velocity for unlimited campaigns per client." |
| Campaign analytics locked | "Campaign analytics are available on Velocity and above." |
| Proposal builder locked | "Send professional proposals to clients — upgrade to Ignite to unlock." |
| Proposal templates locked | "Save time with reusable proposal templates — available on Velocity." |
| Document limit hit | "You've reached the document limit for this plan. Upgrade for unlimited document storage." |
| Document sharing locked | "Share documents with clients via a secure link — available on Velocity and above." |
| AI document generation locked | "Generate contracts and briefs automatically — available on Quantum." |

---

## Section 5 — Feature Tier Visual (Landing Page Reference)

This is the suggested structure for the pricing comparison table on the landing page:

```
                        Free    Ignite  Velocity  Quantum
── CONTENT ──────────────────────────────────────────────
Clients                  1        5       15        35
Posts & versioning       ✓        ✓        ✓         ✓
Public review links      ✓        ✓        ✓         ✓
Calendar                 ✓        ✓        ✓         ✓
Campaigns (active/client) 1       3       ∞         ∞
Campaign analytics        ✗        ✗        ✓         ✓

── PIPELINE ──────────────────────────────────────────────
Prospects                3        10       ∞         ∞
Proposal builder         ✗        ✓        ✓         ✓
Proposal templates       ✗        ✗        ✓         ✓
E-signature              ✗        ✗        ✓         ✓
Proposal analytics       ✗        ✗        ✗         ✓

── DOCUMENTS ─────────────────────────────────────────────
Docs per client          5        20       ∞         ∞
Max file size           10MB     25MB    100MB      250MB
Document sharing         ✗        ✗        ✓         ✓
Document templates       ✗        ✗        ✓         ✓
AI document generation   ✗        ✗        ✗         ✓

── FINANCE ───────────────────────────────────────────────
Ledger                   ✓        ✓        ✓         ✓
Invoicing                ✗        ✗        ✓         ✓
Profitability reports    ✗        ✗        ✓         ✓
CFO analysis             ✗        ✗        ✗         ✓

── BRANDING ──────────────────────────────────────────────
Agency logo (internal)   ✓        ✓        ✓         ✓
Logo on client pages     ✗        ✗        ✓         ✓
Custom domain            ✗        ✗        ✗         ✓
Remove Tercero branding  ✗        ✗        ✗         ✓

── STORAGE ───────────────────────────────────────────────
Total storage            5 GB    20 GB   100 GB    500 GB
Extra client            ₹400    ₹400     ₹400      ₹370
```
