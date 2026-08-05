/**
 * Content for the /welcome overview, grouped by the agency lifecycle rather than
 * by feature area — so a new feature has an obvious home and the page drifts out
 * of date more slowly than the old per-feature slide deck did.
 *
 * Each stage carries `details`: a title plus a sentence on what it actually does,
 * rather than a bare feature name. This is the overview; the step-by-step
 * walkthroughs live in Help → Guides & How it Works.
 *
 * `visualCaption` names the screenshot that belongs in the frame. Until real
 * imagery exists the frame renders a deliberate composition instead — set
 * `image` to a path (e.g. '/welcome/deliver.png') and VisualFrame renders it in
 * the same frame, so adding artwork can't shift the layout.
 */
export const WELCOME_SECTIONS = [
  {
    key: 'win',
    label: 'Win the work',
    summary: 'First contact to signed deal.',
    details: [
      {
        title: 'Prospect pipeline',
        body: 'Track every lead from new through contacted, demo scheduled, and won or lost — with contact details and notes on each one.',
      },
      {
        title: 'Outreach log',
        body: 'Record every touch by channel — WhatsApp, Instagram, email, call or in person — so you always know when you last reached out.',
      },
      {
        title: 'Proposals with public links',
        body: 'Build a proposal, send a link, and the client accepts or declines in the browser. You see when it was viewed. Export to PDF any time.',
      },
      {
        title: 'Convert to client',
        body: "One click turns a won prospect into a full client workspace with their details already filled in — nothing gets retyped.",
      },
    ],
    image: '/onboarding/prospects.png',
    emoji: '🎯',
    visualCaption: 'Prospects board and a proposal ready to send',
  },
  {
    key: 'deliver',
    label: 'Deliver it',
    summary: 'Draft, version and schedule the work.',
    details: [
      {
        title: 'Versioned deliverables',
        body: 'Every post keeps its full history. Request a revision and a new version is created, so nothing is overwritten and you can always see what changed.',
      },
      {
        title: 'Per-platform scheduling',
        body: 'Schedule and mark published per platform, not per post — Instagram can go out Tuesday and LinkedIn Thursday from the same deliverable.',
      },
      {
        title: 'Campaigns',
        body: 'Group deliverables into a named initiative and track budget spend, platform mix, and progress against KPIs in one place.',
      },
      {
        title: 'Content calendar',
        body: 'See every scheduled deliverable across all clients on one calendar, and export a date range to PDF for client planning.',
      },
    ],
    image: '/onboarding/calendar.png',
    emoji: '✍️',
    visualCaption: 'Content calendar with a campaign detail view',
  },
  {
    key: 'approve',
    label: 'Get it approved',
    summary: 'Client sign-off without the email thread.',
    details: [
      {
        title: 'Public review links',
        body: 'Share one link per deliverable or per campaign. Clients approve or request revisions with no login, no account, and no attachments.',
      },
      {
        title: 'Batch campaign review',
        body: 'A campaign review link puts every pending post in one screen so the client can action a whole month in a single sitting.',
      },
      {
        title: 'Internal approvals first',
        body: 'Team members submit work for internal sign-off. Owners and admins approve or request changes before anything reaches the client.',
      },
      {
        title: 'Comments and @mentions',
        body: 'Discuss a deliverable or campaign in place. Mentioning a teammate notifies them, so feedback stays attached to the work.',
      },
    ],
    image: '/onboarding/review.png',
    emoji: '✅',
    visualCaption: 'Client review screen with approve and revise actions',
  },
  {
    key: 'paid',
    label: 'Get paid',
    summary: 'Invoicing and finance in the same place.',
    details: [
      {
        title: 'Branded PDF invoices',
        body: 'Generate invoices carrying your logo, address and signatory. Download or email them to the client without leaving Tercero.',
      },
      {
        title: 'Expenses and ledger',
        body: 'Log costs against a client or the agency, and read the whole money picture — income and spend — from a single transaction ledger.',
      },
      {
        title: 'Recurring templates',
        body: 'Set retainers up once and let the template raise each period’s invoice, so the monthly billing run stops being a task.',
      },
      {
        title: 'Profitability and reports',
        body: 'See revenue, cost and margin per client, and generate a shareable client report when it is time to prove the value.',
      },
    ],
    image: '/onboarding/finance.png',
    emoji: '💰',
    visualCaption: 'Finance overview beside a generated invoice PDF',
  },
  {
    key: 'team',
    label: 'Run the team',
    summary: 'Everyone in one workspace.',
    details: [
      {
        title: 'Invite by link',
        body: 'Send one link and a teammate joins instantly. Roles decide what they reach — members work on deliverables, admins also get finance.',
      },
      {
        title: 'Tasks',
        body: 'Assign work with a priority and due date, and link it to a client, a campaign or specific deliverables. View as a board, grouped, or a table.',
      },
      {
        title: 'Workspace chat',
        body: 'One shared channel plus 1:1 DMs. Reference a deliverable or task inline so the conversation carries its context.',
      },
      {
        title: 'Documents, notes and meetings',
        body: 'Keep client files in private storage, write notes with tags, and track meetings — all attached to the client they belong to.',
      },
    ],
    image: '/onboarding/tasks.png',
    emoji: '🤝',
    visualCaption: 'Task board alongside a workspace chat thread',
  },
]
