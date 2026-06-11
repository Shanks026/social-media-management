# Tercero — Phase 2 Valuation & Revenue Projection

_Prepared: 11 June 2026_

> Companion to [`revenue-projection-jun011.md`](./revenue-projection-jun011.md). Models the business **after Phase 2 is implemented**. All figures are illustrative planning estimates, not a formal appraisal or financial advice.

**Framing:** the **customer** is a social-media agency; that agency's **clients** are the brands they manage. "Active clients" = paying agencies on Tercero.

---

## 0. What Phase 2 changes (category shift)

Phase 2 re-categorizes the product. Today Tercero is an agency **management** tool (competes with proposal / PM / invoicing apps). After Phase 2 it is a full **publish + analyze + client-portal platform** competing with Sprout Social, Hootsuite, Sendible, Agorapulse — a much larger TAM, a bigger pool of acquirers, and far higher willingness to pay.

**Phase 2 feature set:**
1. OAuth & auto social publishing (IG, LinkedIn, X, YouTube) — _Velocity+_
2. WhatsApp integration (approvals, review links, proposal updates) — _Velocity+_
3. Deep team management (profiles, salary/payments tracker, internal notes) — _Quantum_
4. Client portal (branded client login: calendar, approvals, invoices, campaigns) — _Velocity+_
5. Tercero mobile app (native iOS + Android) — review, calendar, approvals, pipeline
6. AI integration (caption drafting, cross-platform rewrites, approval-risk flagging, content insights) — _Velocity+_
7. Social media analytics (reach/impressions/engagement per post & client) — _Velocity+_

The headline features live in the upper tiers → mix and ARPU structurally move up.

---

## 1. Pricing power (the biggest lever)

A product that *publishes and reports* replaces the agency's scheduler (Later/Buffer), analytics tool, and portal — commanding a real price increase.

| Plan | Now | Post-Phase-2 | What unlocks the jump |
|---|---|---|---|
| Ignite | ₹1,999 | **₹2,499** | management only (no publishing) — stays the entry tier |
| Velocity | ₹4,999 | **₹8,999** | publishing, analytics, client portal, AI, WhatsApp |
| Quantum | ₹12,999 | **₹19,999** | + deep team mgmt, full whitelabel, VIP |

Because publishing/portal/AI require Velocity, mix shifts up (~30% Ignite / 50% Velocity / 20% Quantum):

**Blended ARPU ≈ ₹9,000/mo — about 2.25× the Phase-1 ARPU (₹4,000).**

---

## 2. Retention & adoption shift

- **Churn 5% → ~3%/mo.** Publishing connections + a client-facing portal + mobile + WhatsApp create real lock-in; switching means migrating publishing and re-onboarding every client.
- **Faster adds.** Completeness kills the #1 objection ("it doesn't actually post"), shortens the sales cycle, drives referrals, and makes paid acquisition viable (higher LTV). Gross adds ramp ~5 → 26/mo vs 3 → 13 in Phase 1.

---

## 3. Post-Phase-2 Year-1 projection (base case)

Assumptions: ARPU ₹9,000 · churn 3%/mo · gross adds 5 → 26/mo · extra-client add-ons treated as upside.

| Month | New | Active | MRR | Cumulative |
|---|---|---|---|---|
| M1 | 5 | 5 | ₹45,000 | ₹45,000 |
| M2 | 6 | 11 | ₹99,000 | ₹1.44L |
| M3 | 8 | 19 | ₹1.71L | ₹3.15L |
| M4 | 10 | 28 | ₹2.52L | ₹5.67L |
| M5 | 12 | 39 | ₹3.51L | ₹9.18L |
| **M6** | 14 | **52** | **₹4.68L** | ₹13.86L |
| M7 | 16 | 66 | ₹5.94L | ₹19.80L |
| M8 | 18 | 82 | ₹7.38L | ₹27.18L |
| M9 | 20 | 100 | ₹9.00L | ₹36.18L |
| M10 | 22 | 119 | ₹10.71L | ₹46.89L |
| M11 | 24 | 139 | ₹12.51L | ₹59.40L |
| **M12** | 26 | **161** | **₹14.49L** | **₹73.89L** |

### MRR growth — 1 block ≈ ₹75k

```
M1  ₹45k   █
M2  ₹99k   █
M3  ₹1.7L  ██
M4  ₹2.5L  ███
M5  ₹3.5L  █████
M6  ₹4.7L  ██████
M7  ₹5.9L  ████████
M8  ₹7.4L  ██████████
M9  ₹9.0L  ████████████
M10 ₹10.7L ██████████████
M11 ₹12.5L █████████████████
M12 ₹14.5L ███████████████████
```

### Phase 1 vs Phase 2 (Year-1)

| Metric | Phase 1 | **Phase 2** | Multiple |
|---|---|---|---|
| Blended ARPU | ₹4,000 | **₹9,000** | 2.25× |
| Active agencies @ M12 | 75 | **161** | 2.1× |
| Exit MRR | ₹3.0L | **₹14.5L** | 4.8× |
| ARR run-rate @ M12 | ₹36L | **₹1.74 Cr** | 4.8× |
| Collected in year | ₹15.7L | **₹73.9L** | 4.7× |

### Milestones
- **Month 1:** ~5 agencies, ₹45k MRR — launch on a complete product.
- **Month 6:** ~52 agencies, **₹4.68L MRR**, ₹13.9L collected.
- **Month 12:** ~161 agencies, **₹14.5L MRR (₹1.74 Cr ARR run-rate)**, **~₹73.9L collected**.

### Scenario bracket

| Scenario | Exit MRR | ARR run-rate | Year collected |
|---|---|---|---|
| Conservative (slower adds, 4% churn, ARPU ₹7.5k) | ~₹8L | ~₹96L | ~₹42L |
| **Base (above)** | **~₹14.5L** | **~₹1.74 Cr** | **~₹74L** |
| Optimistic (paid + referrals, 2.5% churn, ARPU ₹9.5k) | ~₹22L | ~₹2.6 Cr | ~₹1.1 Cr |

---

## 4. Valuation impact

### A. Asset / IP basis (no clients)
Phase 2 roughly **doubles the engineering footprint** — 4-platform OAuth publishing, WhatsApp Business API, native iOS+Android, AI, analytics ingestion, client portal (~17–25 extra dev-months).

| Input | Estimate |
|---|---|
| Total rebuild effort | ~40–48 dev-months |
| Rebuild cost (India) | ₹90 lakh – 1.3 crore |
| Rebuild cost (global) | ₹2.5 – 3.2 crore |
| **Strategic asset sale** | **₹70 lakh – ₹2 crore** |

### B. Going-concern basis (with clients)
Now a publishing + analytics platform with lock-in → higher multiples (3–6× ARR) on a much larger ARR. At ₹1.74 Cr ARR run-rate:

| Multiple | Valuation |
|---|---|
| 3× ARR | ~₹5.2 crore |
| 4× ARR | ~₹7.0 crore |
| 5–6× ARR | ₹8.7 – 10.4 crore |

→ Realistic traction band: **₹5 – 10 crore** (vs ₹70L – 1.8 Cr in Phase 1). The category shift (Sprout/Hootsuite peer set) pulls both the multiple and acquirer interest up.

---

## 5. The catch (cost & margin)
Phase 2 introduces **real COGS** Phase 1 didn't have:
- WhatsApp per-conversation fees
- AI token costs
- Platform-API maintenance (Meta/X/YouTube/LinkedIn)
- Mobile app-store fees + ongoing upkeep
- Analytics ingestion infra
- Meta app-review + data-compliance overhead

Gross margin drops from ~90% to **~78–85%** — still strong SaaS economics, but no longer near-zero cost. Phase 2 also adds significant build time and support load before any of these numbers materialize.

---

## 6. Caveats
- Modeled estimates to plan against, not guarantees or formal valuation/financial advice.
- ARPU uplift (2.25×) is well-grounded in the price card + mix shift; the **customer-count ramp (2×)** is the more assumption-heavy lever — it depends on shipping Phase 2 fully and running a stronger go-to-market that a complete product enables.
- Biggest real-world variables remain **distribution** and **churn**.
