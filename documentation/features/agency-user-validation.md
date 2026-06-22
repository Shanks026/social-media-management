# Agency User — Validation Questions

**Purpose**: Open workflow questions that must be answered by the real agency user testing Tercero *before* finalizing the finance model and scope for the Phase 2 features (Ads, then Partnerships). These features encode how a specific agency actually moves money and makes decisions — there is no "correct" schema derivable from convention, so we validate before building. Guessing wrong pollutes the ledger with mis-tagged data that is expensive to unwind.

**Status**: ⏳ Awaiting answers
**Last Updated**: June 2026
**Related**: `feature-ads-plan.md`, `feature-ads.md`, `feature-partnerships.md`

---

## Why we're asking (context)

The Ads plan currently assumes one workflow: the **agency fronts the ad spend** (logs it as an agency expense) and **bills the client back** + a management fee — a "dual-sided" finance model. That assumption may not match how this agency actually operates. Two things hinge on his answers:

1. **Whose money is the ad budget** → determines whether ad spend is an agency *expense* (hits the ledger) or just an informational number (client's money, never touches our books).
2. **Whether paid ads and organic content belong together** → determines whether the optional ad→campaign link is worth building.

Cheap to design in now; expensive to retrofit later.

---

## ADS — Questions to ask

> Terminology trap: "campaign" means two things — in Tercero it's an organic *content* initiative; in Meta/Google it's the *ad* itself. Ask about the **workflow**, not the word, to avoid "are ads related to ads?" confusion.

### A. Who funds the ad spend (the critical one)

1. **When you run ads for a client, whose account/card pays the platform — yours or the client's?**
   *(This single answer picks the whole finance model.)*
2. **If yours:** do you bill the client back for the exact spend *plus* a fee, or bundle it into a flat retainer?
3. **If theirs:** you just charge a management fee, right? Is that fee a **% of spend** or a **flat amount**?

**What each answer changes:**
- *Agency pays* → keep the dual-sided model exactly as planned (spend = EXPENSE transaction, bill back via invoice).
- *Client pays* → ad spend must **not** be logged as an agency expense (it would corrupt Finance Overview / burn numbers). Spend becomes an informational tracked number; only the management fee is an agency invoice. We'd add a **"who funds this?" toggle** on each ad before Phase 1.

### B. Agency's own ads

4. **Do you also run ads for your own agency (to get clients)? How often — enough to need tracking?**

**Changes:** confirms whether the internal-account (spend-only, no client billing) path matters or is an edge case.

### C. Ads ↔ content relationship

5. *(Scenario)* **"Say you're doing a product launch for a client — a batch of organic posts going out, plus some paid Meta ads for the same launch. Are those one initiative you'd track together, or separate things you manage on their own?"**
6. **If we let you optionally tag an ad to one of your content campaigns — just so they show up together in reporting — would you actually use it, or would it just be clutter?**
7. **Do you ever run paid ads for a client when there's no matching content campaign at all (e.g. always-on lead-gen)?**

**What each answer changes:**
- *Track together / would use the tag* → keep the optional `campaign_id` link.
- *Separate / clutter* → drop the link from Phase 1, simplify.
- *Often no campaign* → confirms the link must stay **optional**, never required (already planned that way).

### D. Scope / depth

8. **What do you actually want to see — just the money (budget / spend / billed), or also performance (results, leads, ROAS)?**
9. **Today, how do you track all this — per ad, per platform, per month? In what tool (spreadsheet, platform dashboard, nothing)?**

**Changes:** confirms Phase 1 (money only) is the right MVP vs. pulling performance forward; reveals the spreadsheet we're replacing.

---

## PARTNERSHIPS — Questions to ask (when we get to it)

*Not urgent — Ads is first. Captured here so they aren't lost.*

1. **Is the agency actually co-owned / does it have investors or equity partners?** (If solo-owned, this whole feature may be low priority for him.)
2. **Where does ownership info live today** — spreadsheet, legal docs, an accountant, nowhere?
3. **Do you need to track money paid *to* partners (distributions, dividends, buyouts), or just who owns what %?**
4. **Should invited team members ever see this, or strictly owner-only?**

---

## Decision log (fill in as answers arrive)

| # | Question | Answer | Plan impact |
|---|---|---|---|
| A1 | Who pays the platform | _pending_ | _pending_ |
| A3 | Management fee: % or flat | _pending_ | _pending_ |
| B4 | Runs own agency ads | _pending_ | _pending_ |
| C6 | Would use ad→campaign tag | _pending_ | _pending_ |
| D8 | Money only vs performance | _pending_ | _pending_ |
