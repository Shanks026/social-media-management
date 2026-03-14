"""
AUTH TESTS
Covers: login, logout, signup, protected routes, session persistence.

Manual test IDs: AUTH-001 → AUTH-009
"""

import pytest
from playwright.sync_api import Page, expect
from conftest import BASE_URL, TEST_EMAIL, TEST_PASSWORD, login, logout


class TestLogin:
    """AUTH-001, AUTH-002, AUTH-003"""

    def test_successful_login(self, page: Page):
        """AUTH-001: Valid credentials navigate to /dashboard."""
        login(page)
        expect(page).to_have_url(f"{BASE_URL}/dashboard")
        # Sidebar should be visible
        expect(page.locator('[data-sidebar="sidebar"]').first).to_be_visible()

    def test_invalid_credentials(self, page: Page):
        """AUTH-002: Wrong password shows error, stays on /login."""
        page.goto(f"{BASE_URL}/login")
        page.get_by_label("Email").fill(TEST_EMAIL)
        page.get_by_label("Password").fill("wrong-password-xyz")
        page.get_by_role("button", name="Login").click()

        # Should NOT navigate away
        expect(page).to_have_url(f"{BASE_URL}/login")
        # Error message visible
        expect(page.get_by_text("Invalid login credentials")).to_be_visible(timeout=5_000)

    def test_empty_fields_validation(self, page: Page):
        """AUTH-003: Submitting empty form shows validation errors."""
        page.goto(f"{BASE_URL}/login")
        page.get_by_role("button", name="Login").click()

        # Native HTML5 required validation prevents submission — URL stays at /login
        expect(page).to_have_url(f"{BASE_URL}/login")

    def test_non_existent_email(self, page: Page):
        """Variation of AUTH-002: Completely unknown email."""
        page.goto(f"{BASE_URL}/login")
        page.get_by_label("Email").fill("nobody@doesnotexist.invalid")
        page.get_by_label("Password").fill("somepassword")
        page.get_by_role("button", name="Login").click()

        expect(page).to_have_url(f"{BASE_URL}/login")
        # Inline error div shown on bad credentials
        expect(page.locator(".text-destructive").first).to_be_visible(timeout=5_000)


class TestLogout:
    """AUTH-008"""

    def test_logout_clears_session(self, authenticated_page: Page):
        """AUTH-008: After logout, navigating to /dashboard redirects to /login."""
        page = authenticated_page
        logout(page)
        expect(page).to_have_url(f"{BASE_URL}/login")

        # Try to access protected route
        page.goto(f"{BASE_URL}/dashboard")
        expect(page).to_have_url(f"{BASE_URL}/login")


class TestProtectedRoutes:
    """AUTH-009"""

    def test_unauthenticated_redirect(self, page: Page):
        """AUTH-009: Direct navigation to /dashboard while logged out redirects to /login."""
        page.goto(f"{BASE_URL}/dashboard")
        expect(page).to_have_url(f"{BASE_URL}/login")

    def test_unauthenticated_clients_redirect(self, page: Page):
        page.goto(f"{BASE_URL}/clients")
        expect(page).to_have_url(f"{BASE_URL}/login")

    def test_unauthenticated_finance_redirect(self, page: Page):
        page.goto(f"{BASE_URL}/finance/overview")
        expect(page).to_have_url(f"{BASE_URL}/login")


class TestPublicPagesNoAuth:
    """Public routes must load without authentication."""

    def test_login_page_accessible(self, page: Page):
        page.goto(f"{BASE_URL}/login")
        expect(page).to_have_url(f"{BASE_URL}/login")
        expect(page.get_by_role("button", name="Login")).to_be_visible()

    def test_signup_page_accessible(self, page: Page):
        page.goto(f"{BASE_URL}/signup")
        expect(page.get_by_role("button", name="Create account")).to_be_visible()
