# Tercero — Valuation & Year-1 Revenue Projection

_Prepared: 11 June 2026_

> All figures are illustrative planning estimates based on the live feature set and the pricing in [`subscription-features.md`](./subscription-features.md) (Ignite ₹1,999 · Velocity ₹4,999 · Quantum ₹12,999 /mo, +₹500 / extra client, 14-day trial). Not a formal appraisal or financial advice.

**Framing:** In Tercero the **customer** is a social-media agency; that agency's **clients** are the brands they manage. "Active clients" below = paying agencies subscribed to Tercero.

---

## 1. What the platform is (the value)

Tercero is a **vertical "agency OS"** that owns the entire lifecycle in one tool:

> **Prospect → Proposal → Client → Content/Campaigns → Client Review → Invoice → Payment tracking** — plus documents, calendar, teams, and multi-tenant white-label.

Most competitors cover one slice (Later/Buffer = scheduling; Bonsai/HoneyBook = proposals + invoicing; Trello/Asana = ops). The defensible value is **consolidation + white-label + India-first pricing**.

---

## 2. Valuation if sold

### A. Without active clients (asset / IP sale)
Valued on **cost-to-rebuild + time-to-market saved**, not revenue.

| Input | Estimate |
|---|---|
| Engineering effort to rebuild | ~18–24 quality dev-months |
| Rebuild cost (India team/agency rates) | ₹40–60 lakh |
| Rebuild cost (global contractor rates) | ₹1.2–1.6 crore |
| **Realistic asset-sale price** | **₹30 lakh – ₹1 crore** |

- **Quick / distressed flip** (Acquire/Flippa, no buyer urgency): ₹20–40 lakh.
- **Strategic buyer** (marketing SaaS, agency network, CRM/hosting player entering this vertical, valuing 12+ months saved): ₹70 lakh – ₹1 crore+.
- Biggest lever: a buyer who would *otherwise build it themselves* pays near rebuild cost; an opportunistic buyer pays well below.

### B. With active clients (going concern)
Valued on **ARR multiple** — revenue stream + the asset underneath it. Early-stage bootstrapped India SMB SaaS trades at **1.5×–4× ARR** (higher with strong growth + low churn).

Using the Base case below (exit ~₹3L MRR ≈ **₹36L ARR run-rate**):

| Multiple | Implied valuation |
|---|---|
| 1.5× ARR (conservative / churny) | ~₹54 lakh |
| 3× ARR (healthy growth) | ~₹1.08 crore |
| 4–5× ARR (fast growth, <4% churn) | ₹1.4–1.8 crore |

**Takeaway:** With ~75 paying agencies and clean growth, realistic band is **₹70 lakh – ₹1.8 crore** — roughly **double** the no-traction asset price. Traction converts "they could build this" into "they'd lose the market if they don't buy you."

> **Alternative monetization:** a one-time **enterprise white-label license** to a single corporate (agency network/holdco) to run internally — typically ₹15–40 lakh upfront + annual support, without giving up the IP.

---

## 3. Year-1 revenue projection (bottom-up)

### Assumptions (Base case — focused, founder-led, India, minimal ad budget)
- **Gross new agencies/month** ramps 3 → 13 as funnel and word-of-mouth improve.
- **Monthly logo churn: 5%** (realistic SMB SaaS early on).
- **Plan mix:** 60% Ignite, 30% Velocity, 10% Quantum → **blended ARPU ≈ ₹4,000/mo**.
- Extra-client add-ons (₹500) treated as upside, not counted.
- Pure subscription revenue; annual prepays would pull cash forward.

### Base case — month by month

| Month | New | Active (after churn) | MRR | Cumulative revenue |
|---|---|---|---|---|
| M1 | 3 | 3 | ₹12,000 | ₹12,000 |
| M2 | 3 | 6 | ₹24,000 | ₹36,000 |
| M3 | 4 | 10 | ₹40,000 | ₹76,000 |
| M4 | 5 | 14 | ₹56,000 | ₹1,32,000 |
| M5 | 6 | 19 | ₹76,000 | ₹2,08,000 |
| **M6** | 7 | **25** | **₹1,00,000** | **₹3,08,000** |
| M7 | 8 | 32 | ₹1,28,000 | ₹4,36,000 |
| M8 | 9 | 40 | ₹1,60,000 | ₹5,96,000 |
| M9 | 10 | 48 | ₹1,92,000 | ₹7,88,000 |
| M10 | 11 | 56 | ₹2,24,000 | ₹10,12,000 |
| M11 | 12 | 65 | ₹2,60,000 | ₹12,72,000 |
| **M12** | 13 | **75** | **₹3,00,000** | **₹15,72,000** |

### MRR growth (Base) — 1 block ≈ ₹15k

```
M1  ₹12k  █
M2  ₹24k  ██
M3  ₹40k  ███
M4  ₹56k  ████
M5  ₹76k  █████
M6  ₹1.0L ███████
M7  ₹1.3L █████████
M8  ₹1.6L ███████████
M9  ₹1.9L █████████████
M10 ₹2.2L ███████████████
M11 ₹2.6L █████████████████
M12 ₹3.0L ████████████████████
```

### Milestones
- **Month 1:** ~3 agencies, ₹12k MRR — proof of willingness to pay.
- **Month 6:** ~25 agencies, **₹1L MRR**, ₹3.08L collected — product-market-fit signal.
- **Month 12:** ~75 agencies, **₹3L MRR (₹36L ARR run-rate)**, **~₹15.7L collected** in the year.

### Scenario bracket

| Scenario | Exit MRR (M12) | ARR run-rate | Year-1 collected |
|---|---|---|---|
| Conservative (slower funnel, 7% churn) | ~₹1.6L | ~₹19L | ~₹8–9L |
| **Base (above)** | **~₹3.0L** | **~₹36L** | **~₹15.7L** |
| Optimistic (referrals + light paid, 4% churn) | ~₹4.5–5L | ~₹55–60L | ~₹24–28L |

Margins are high — infra (Supabase, email, hosting) runs ~₹5–15k/mo until real scale — so most revenue is gross profit, which is what makes the going-concern valuation in §2B compound.

---

## 4. Caveats
- Modeled estimates to plan against, not guarantees or formal valuation/financial advice.
- Biggest real-world variables: **distribution** (how you reach agencies) and **churn** — both swing the 12-month number more than pricing does.
