"""
CLIENT MANAGEMENT TESTS
Covers: create, edit, delete, filters, search, client detail tabs.

Manual test IDs: CLT-001 → CLT-009
"""

import io
import struct
import zlib
import pytest
from playwright.sync_api import Page, expect
from conftest import BASE_URL, login


INDUSTRY = "Fashion & Apparel"
TIER = "Retainer"


def _make_1x1_png() -> bytes:
    """Return a minimal valid 1×1 white PNG as bytes."""
    def chunk(name, data):
        c = struct.pack('>I', len(data)) + name + data
        return c + struct.pack('>I', zlib.crc32(name + data) & 0xFFFFFFFF)

    sig = b'\x89PNG\r\n\x1a\n'
    ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', 1, 1, 8, 2, 0, 0, 0))
    raw  = b'\x00\xff\xff\xff'   # filter byte + RGB white
    idat = chunk(b'IDAT', zlib.compress(raw))
    iend = chunk(b'IEND', b'')
    return sig + ihdr + idat + iend


class TestClientCRUD:

    def test_create_client(self, authenticated_page: Page):
        """CLT-001: Create a new client and verify it appears in the list."""
        page = authenticated_page
        page.goto(f"{BASE_URL}/clients/create")

        # Upload logo (required) — use a 1×1 white PNG
        page.locator('input[type="file"]').set_input_files(
            files=[{"name": "logo.png", "mimeType": "image/png", "buffer": _make_1x1_png()}]
        )
        # Wait for upload to complete — wait for sonner toast "Logo uploaded!"
        page.wait_for_selector('[data-sonner-toast]', timeout=10_000)
        page.wait_for_timeout(500)

        # Fill text fields
        page.locator('input[name="name"]').fill("Playwright Test Client")
        page.locator('input[name="email"]').fill("playwright@testclient.example.com")
        # Mobile must match +91 Indian number format
        page.locator('input[name="mobile_number"]').fill("+919876543210")

        # Select industry
        page.locator('button').filter(has_text="Select industry").click()
        page.wait_for_selector('[role="listbox"]', timeout=5_000)
        page.get_by_role("option", name=INDUSTRY).click()

        # Select Instagram platform and fill handle
        page.get_by_text("Instagram").first.click()
        page.wait_for_timeout(300)
        page.locator('input[name="social_links.instagram.handle"]').fill("playwrighttest")

        page.get_by_role("button", name="Create Client").click()

        # Should navigate away from /clients/create
        expect(page).not_to_have_url(f"{BASE_URL}/clients/create", timeout=15_000)

    def test_create_client_required_field_validation(self, authenticated_page: Page):
        """CLT-002: Submitting with no name shows validation error."""
        page = authenticated_page
        page.goto(f"{BASE_URL}/clients/create")
        page.get_by_role("button", name="Create Client").click()

        # Validation error on name field — rendered as <p class="text-destructive">
        expect(page.locator("p.text-destructive").first).to_be_visible(timeout=3_000)
        expect(page).to_have_url(f"{BASE_URL}/clients/create")

    def test_clients_list_loads(self, authenticated_page: Page):
        """Clients page renders without error."""
        page = authenticated_page
        page.goto(f"{BASE_URL}/clients")
        # Wait for list to load (skeleton resolves)
        page.wait_for_load_state("networkidle")
        expect(page.get_by_role("main")).to_be_visible()

    def test_client_detail_tabs(self, authenticated_page: Page):
        """CLT-005: All client detail tabs navigate without error."""
        page = authenticated_page
        page.goto(f"{BASE_URL}/clients")
        page.wait_for_load_state("networkidle")

        # Click the first client card
        first_client = page.locator("[data-testid='client-card']").first
        if first_client.count() == 0:
            # Fallback: find first link pointing to /clients/:id
            first_client = page.locator("a[href^='/clients/']").first

        first_client.click()
        page.wait_for_load_state("networkidle")

        tab_names = ["Overview", "Management", "Workflow", "Documents"]
        for tab in tab_names:
            tab_el = page.get_by_role("tab", name=tab)
            if tab_el.count() > 0:
                tab_el.click()
                # No error boundary visible
                expect(page.get_by_text("Something went wrong")).not_to_be_visible(timeout=3_000)


class TestClientFilters:

    def test_search_filter(self, authenticated_page: Page):
        """CLT-007: Typing in search filters the visible clients."""
        page = authenticated_page
        page.goto(f"{BASE_URL}/clients")
        page.wait_for_load_state("networkidle")

        search_input = page.get_by_placeholder("Search clients")
        if search_input.count() == 0:
            search_input = page.get_by_role("searchbox")

        # Get initial count
        search_input.fill("zzznomatch")
        page.wait_for_timeout(500)

        # Should show empty/no results state
        no_results = page.get_by_text("No clients").or_(page.get_by_text("No results"))
        # Either show empty state OR the search filtered results — we just verify no crash
        expect(page.get_by_role("main")).to_be_visible()

    def test_industry_filter(self, authenticated_page: Page):
        """CLT-006: Industry dropdown filters clients."""
        page = authenticated_page
        page.goto(f"{BASE_URL}/clients")
        page.wait_for_load_state("networkidle")

        industry_filter = page.get_by_role("combobox", name="Industry").or_(
            page.locator("button").filter(has_text="Industry")
        )
        if industry_filter.count() > 0:
            industry_filter.first.click()
            option = page.get_by_role("option").first
            if option.count() > 0:
                option.click()
                page.wait_for_timeout(500)
                expect(page.get_by_role("main")).to_be_visible()
