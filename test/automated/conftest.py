"""
Pytest configuration and shared fixtures for Tercero E2E tests.

Setup:
  1. pip install -r requirements.txt
  2. playwright install chromium
  3. Copy .env.test.example to .env.test and fill in credentials
  4. pytest automated/ --headed (optional: --headed to see browser)
"""

import os
import pytest
from dotenv import load_dotenv
from playwright.sync_api import Page, BrowserContext

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env.test"))

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

BASE_URL = os.getenv("TEST_BASE_URL", "http://localhost:5173")
TEST_EMAIL = os.getenv("TEST_EMAIL", "test@tercero.test")
TEST_PASSWORD = os.getenv("TEST_PASSWORD", "TestPass123!")
TEST_TEAM_EMAIL = os.getenv("TEST_TEAM_EMAIL", "team@tercero.test")
TEST_TEAM_PASSWORD = os.getenv("TEST_TEAM_PASSWORD", "TeamPass123!")

# Supabase direct access (for seeding / teardown)
SUPABASE_URL = os.getenv("VITE_SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")


# ---------------------------------------------------------------------------
# Pytest-Playwright settings
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def browser_context_args(browser_context_args):
    """Apply default viewport and locale to all browser contexts."""
    return {
        **browser_context_args,
        "viewport": {"width": 1440, "height": 900},
        "locale": "en-GB",
    }


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------

def login(page: Page, email: str = TEST_EMAIL, password: str = TEST_PASSWORD):
    """Log in, wait for dashboard, and suppress the WelcomeCarousel."""
    page.goto(f"{BASE_URL}/login")
    page.get_by_label("Email").fill(email)
    page.get_by_label("Password").fill(password)
    page.get_by_role("button", name="Login").click()
    page.wait_for_url(f"{BASE_URL}/dashboard", timeout=10_000)
    # Suppress the WelcomeCarousel by marking it as seen in localStorage
    page.evaluate("""
        const keys = Object.keys(localStorage).filter(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
        if (keys.length) {
            try {
                const session = JSON.parse(localStorage.getItem(keys[0]));
                const userId = session?.user?.id;
                if (userId) localStorage.setItem('has_seen_welcome_' + userId, 'true');
            } catch(e) {}
        }
    """)
    # Close the carousel if it already opened before we set the flag
    overlay = page.locator('[data-slot="dialog-overlay"][data-state="open"]')
    if overlay.count() > 0:
        page.keyboard.press("Escape")
        page.wait_for_timeout(500)


def logout(page: Page):
    """Click the nav-user dropdown and log out."""
    page.locator('[data-sidebar="menu-button"]').last.click()
    page.get_by_role("menuitem", name="Log out").click()
    page.wait_for_url(f"{BASE_URL}/login", timeout=8_000)


# ---------------------------------------------------------------------------
# Shared fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def authenticated_page(page: Page):
    """Page with an active auth session."""
    login(page)
    yield page


@pytest.fixture(scope="session")
def base_url() -> str:
    return BASE_URL
