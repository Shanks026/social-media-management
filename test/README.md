# Tercero — Test Suite

This folder contains the full test suite for the Tercero application.

```
test/
├── MANUAL_TESTS.md          # Manual test cases with step-by-step instructions
├── README.md                # This file
└── automated/
    ├── conftest.py           # Pytest fixtures & shared auth helpers
    ├── .env.test.example     # Environment variable template (copy → .env.test)
    ├── requirements.txt      # Python dependencies
    ├── test_auth.py          # AUTH-001 → AUTH-009
    ├── test_clients.py       # CLT-001 → CLT-009
    ├── test_posts.py         # POST-001 → POST-012
    ├── test_campaigns.py     # CAMP-001 → CAMP-012 + CAMPREVIEW
    ├── test_proposals.py     # PROP-001 → PROP-013 + PROPREVIEW
    ├── test_finance.py       # FIN-INV, FIN-LED, FIN-SUB, FIN-OVR
    ├── test_documents.py     # DOC-001 → DOC-010
    ├── test_calendar.py      # CAL-001 → CAL-008
    ├── test_operations.py    # MTG-001 → MTG-004, NOTE-001 → NOTE-005
    ├── test_settings.py      # SETT, TEAM, BILL test IDs
    ├── test_navigation.py    # NAV-001 → NAV-004, THEME-001 → THEME-002
    └── test_feature_gating.py # GATE-001 → GATE-004
```

---

## Manual Tests

Open [MANUAL_TESTS.md](./MANUAL_TESTS.md) for the full manual test plan. Each test has:
- A unique ID (e.g. `AUTH-001`)
- Preconditions
- Step-by-step instructions
- Expected result

Use the **Regression Checklist** at the bottom of the manual tests file after any major change.

---

## Automated Tests (Playwright + Python)

### Prerequisites

- Python 3.11+
- Node.js (for the app itself)

### Setup

```bash
# 1. Navigate to the test/automated directory
cd test/automated

# 2. Create a virtual environment (recommended)
python -m venv venv
source venv/bin/activate       # macOS/Linux
venv\Scripts\activate          # Windows

# 3. Install dependencies
pip install -r requirements.txt

# 4. Install Playwright browser
playwright install chromium

# 5. Set up environment variables
cp .env.test.example .env.test
# Edit .env.test with your test credentials

# 6. Start the dev server (in a separate terminal)
cd ../..
npm run dev
```

### Running Tests

```bash
# Run all tests
pytest automated/

# Run with visible browser (useful for debugging)
pytest automated/ --headed

# Run a specific file
pytest automated/test_auth.py

# Run a specific test
pytest automated/test_auth.py::TestLogin::test_successful_login

# Run with verbose output
pytest automated/ -v

# Run with HTML report
pytest automated/ --html=report.html --self-contained-html

# Run in parallel (faster)
pytest automated/ -n auto
```

### Test Accounts

The tests expect two accounts in `.env.test`:

| Variable | Purpose |
|----------|---------|
| `TEST_EMAIL` | Agency owner account (primary test user) |
| `TEST_PASSWORD` | Owner account password |
| `TEST_TEAM_EMAIL` | Team member account (for multi-tenant tests) |
| `TEST_TEAM_PASSWORD` | Team member password |

> **Tip**: Create a dedicated test workspace in Supabase and seed it with sample data before running tests.

### What the tests cover

| File | Coverage |
|------|---------|
| `test_auth.py` | Login, logout, invalid credentials, protected routes, public pages |
| `test_clients.py` | Client CRUD, filters, search, detail tabs |
| `test_posts.py` | Posts list, status tabs, create form, post detail, version sidebar |
| `test_campaigns.py` | Feature gating, create, detail tabs, review link, public review |
| `test_proposals.py` | List, detail, line items, share link, PDF, public review |
| `test_finance.py` | Overview, invoices, ledger, subscriptions gating |
| `test_documents.py` | Upload, collections gating, filters |
| `test_calendar.py` | Month/week views, navigation, filters, PDF export gating |
| `test_operations.py` | Meetings, notes/reminders |
| `test_settings.py` | Profile, agency branding, team management, billing |
| `test_navigation.py` | Sidebar links, catch-all redirect, breadcrumbs, theme toggle |
| `test_feature_gating.py` | Plan-based gating, lock states, upgrade prompts |

### Notes on test design

- Tests are **non-destructive** where possible — they use existing data rather than always creating new records.
- Tests that require specific data (e.g. a campaign to exist) use `pytest.skip()` if no data is found, rather than failing.
- Gating tests verify that pages don't crash or 404 — they do NOT assert specific plan-level behavior (use manual tests for plan-specific validation).
- Auth tests verify redirection behavior without side effects.
