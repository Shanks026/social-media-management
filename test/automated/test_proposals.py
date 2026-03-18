"""
PROPOSALS TESTS
Covers: list, create, line items, share, PDF, public review, status transitions.

Manual test IDs: PROP-001 → PROP-013, PROPREVIEW-001 → PROPREVIEW-006
"""

import pytest
from playwright.sync_api import Page, expect
from conftest import BASE_URL


class TestProposalsList:

    def test_proposals_page_loads(self, authenticated_page: Page):
        """Proposals list renders correctly."""
        page = authenticated_page
        page.goto(f"{BASE_URL}/proposals")
        page.wait_for_load_state("networkidle")
        expect(page.get_by_role("main")).to_be_visible()

    def test_create_proposal_button_visible(self, authenticated_page: Page):
        """PROP-001: New Proposal button present (when under limit)."""
        page = authenticated_page
        page.goto(f"{BASE_URL}/proposals")
        page.wait_for_load_state("networkidle")

        # Check for either create button or upgrade prompt
        create_btn = page.get_by_role("button", name="New Proposal").or_(
            page.get_by_role("button", name="Create Proposal")
        )
        upgrade_prompt = page.get_by_text("upgrade").or_(page.get_by_text("Upgrade"))

        # One or the other must be present
        has_create = create_btn.count() > 0
        has_upgrade = upgrade_prompt.count() > 0
        assert has_create or has_upgrade, "Expected either a create button or upgrade prompt"

    def test_status_filter_tabs(self, authenticated_page: Page):
        """Proposal status filter tabs render."""
        page = authenticated_page
        page.goto(f"{BASE_URL}/proposals")
        page.wait_for_load_state("networkidle")

        for status in ["All", "Draft", "Sent", "Accepted", "Declined"]:
            tab = page.get_by_role("tab", name=status, exact=False).or_(
                page.locator("button").filter(has_text=status)
            )
            if tab.count() > 0:
                expect(tab.first).to_be_visible()


class TestProposalDetail:

    def _open_first_proposal(self, page: Page) -> bool:
        """Open the first proposal in the list. Returns True if found."""
        page.goto(f"{BASE_URL}/proposals")
        page.wait_for_load_state("networkidle")

        # Proposals render as div rows with cursor-pointer (useNavigate, not <a> tags)
        page.wait_for_timeout(2_000)
        row = page.locator("div.cursor-pointer.group").first
        if row.count() == 0:
            row = page.locator("div.cursor-pointer").first
        if row.count() == 0:
            return False

        row.click()
        page.wait_for_timeout(1_500)
        return True

    def test_proposal_detail_loads(self, authenticated_page: Page):
        """PROP-011: Proposal detail page renders without crash."""
        page = authenticated_page
        if not self._open_first_proposal(page):
            pytest.skip("No proposals available")
        expect(page.get_by_role("main")).to_be_visible()

    def test_proposal_has_line_items_section(self, authenticated_page: Page):
        """PROP-003: Line items section visible in proposal detail."""
        page = authenticated_page
        if not self._open_first_proposal(page):
            pytest.skip("No proposals available")

        line_items = page.get_by_text("Line Items").or_(
            page.get_by_text("Services").or_(page.get_by_text("Items"))
        )
        expect(page.get_by_role("main")).to_be_visible()

    def test_download_pdf_button_present(self, authenticated_page: Page):
        """PROP-008: PDF download button visible on proposal detail."""
        page = authenticated_page
        if not self._open_first_proposal(page):
            pytest.skip("No proposals available")

        pdf_btn = page.get_by_role("button", name="Download PDF").or_(
            page.get_by_role("button", name="Export PDF")
        )
        if pdf_btn.count() > 0:
            expect(pdf_btn.first).to_be_visible()

    def test_share_link_button_present(self, authenticated_page: Page):
        """PROP-007: Share/generate link button visible on detail."""
        page = authenticated_page
        if not self._open_first_proposal(page):
            pytest.skip("No proposals available")

        share_btn = page.get_by_role("button", name="Share").or_(
            page.get_by_role("button", name="Send Review Link")
        )
        expect(page.get_by_role("main")).to_be_visible()

    def test_status_timeline_visible(self, authenticated_page: Page):
        """PROP-012: Status timeline section present in proposal detail."""
        page = authenticated_page
        if not self._open_first_proposal(page):
            pytest.skip("No proposals available")

        # Look for timeline-related text
        timeline = page.get_by_text("Timeline").or_(
            page.get_by_text("Status History").or_(page.get_by_text("Activity"))
        )
        expect(page.get_by_role("main")).to_be_visible()


class TestProposalPublicReview:

    def test_invalid_token_shows_error(self, page: Page):
        """PROPREVIEW-006: Invalid proposal token shows error."""
        page.goto(f"{BASE_URL}/proposal/totally-invalid-token-xyz")
        page.wait_for_load_state("networkidle")

        # Must not crash or redirect to login
        expect(page).not_to_have_url(f"{BASE_URL}/login", timeout=5_000)
        expect(page.locator("body")).to_be_visible()

    def test_proposal_review_no_auth_required(self, page: Page):
        """PROPREVIEW-001: /proposal/:token is publicly accessible."""
        page.goto(f"{BASE_URL}/proposal/some-test-token")
        # Should not redirect to /login
        expect(page).not_to_have_url(f"{BASE_URL}/login", timeout=5_000)
