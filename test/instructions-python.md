# How to Run the Python Automated Tests

---

## 1. Install Python (if not already)

Check if you have it:
```bash
python --version
```
If not, download from https://python.org (3.11+). During install, check **"Add to PATH"**.

---

## 2. Install dependencies

```bash
cd "C:\Users\chris_austin\Desktop\social-media-management\test\automated"

pip install -r requirements.txt

playwright install chromium
```

---

## 3. Set up your credentials

```bash
copy .env.test.example .env.test
```

Open `.env.test` and fill in your real login details:

```env
TEST_BASE_URL=http://localhost:5173
TEST_EMAIL=your-real-login@email.com
TEST_PASSWORD=YourRealPassword
```

---

## 4. Start the dev server (in a separate terminal)

```bash
cd "C:\Users\chris_austin\Desktop\social-media-management"
npm run dev
```

Keep this running. The tests hit `localhost:5173`.

---

## 5. Run the tests

Open a second terminal in `test/automated/` and use any of these commands:

```bash
# Run everything (headless — fast, no browser window)
pytest .

# Run WITH a visible browser so you can watch it click through
pytest . --headed

# Run just one file
pytest test_auth.py --headed

# Run one specific test
pytest test_auth.py::TestLogin::test_successful_login --headed

# Verbose output (see each test name pass/fail)
pytest . -v

# Stop on first failure
pytest . -x --headed
```

---

## What you'll see

With `--headed`, a real Chromium window opens and the script clicks through your app automatically. Each test result will be one of:

| Result | Meaning |
|--------|---------|
| **PASSED** | Scenario worked as expected |
| **FAILED** | Something didn't match — check the error output |
| **SKIPPED** | Test needs data that doesn't exist yet (e.g. "No campaigns available") |

Playwright automatically saves a screenshot on failure.

---

## Recommended order to run

Start with auth and navigation since everything else depends on login working:

```bash
pytest test_auth.py test_navigation.py -v --headed
```

Then run the rest:

```bash
pytest test_clients.py test_posts.py test_proposals.py test_finance.py -v --headed
```

---

## Test files at a glance

| File | What it tests |
|------|--------------|
| `test_auth.py` | Login, logout, invalid credentials, protected routes |
| `test_clients.py` | Client CRUD, filters, search, detail tabs |
| `test_posts.py` | Posts list, status tabs, create form, post detail |
| `test_campaigns.py` | Feature gating, create, detail tabs, review link, public review |
| `test_proposals.py` | List, detail, line items, share link, PDF, public review |
| `test_finance.py` | Overview, invoices, ledger, subscriptions gating |
| `test_documents.py` | Upload, collections gating, filters |
| `test_calendar.py` | Month/week views, navigation, filters, PDF export gating |
| `test_operations.py` | Meetings, notes/reminders |
| `test_settings.py` | Profile, agency branding, team management, billing |
| `test_navigation.py` | All nav routes, catch-all redirect, theme toggle |
| `test_feature_gating.py` | Plan locks, upgrade prompts, visibility rules |
