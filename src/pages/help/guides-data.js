export const GUIDES = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    description: 'Setting up your workspace and understanding the trial.',
    sections: [
      {
        heading: 'Your Trial Period',
        body: 'When you first sign up, you get a 14-day trial with full Quantum-level access. This means every feature in Tercero is unlocked from day one so you can explore everything before committing to a plan. Your trial status is always visible at the top of the sidebar.',
      },
      {
        heading: 'Setting Up Your Agency',
        body: 'Head to General Settings and fill in your agency name, logo, and any branding details. This information appears throughout the platform and on client-facing documents like proposals and invoices, so it is worth completing before you start adding clients.',
      },
      {
        heading: 'Inviting Your Team',
        body: 'Go to General Settings and open the Team tab. You can generate an invite link and share it with team members. Once they join via the link, they get full access to your workspace. The number of seats available depends on your plan.',
      },
      {
        heading: 'Choosing a Plan',
        body: 'When your trial ends, your account locks until you subscribe. Visit Billing and Usage to compare plans and pick the one that fits your current client count and feature needs. You can upgrade at any time as you grow.',
      },
    ],
  },
  {
    id: 'dashboard',
    title: 'Dashboard',
    description: 'A live snapshot of your agency health and activity.',
    sections: [
      {
        heading: 'What the Dashboard Shows',
        body: 'The dashboard gives you a quick read on the state of your agency at a glance. It shows your content pipeline status, how many posts are scheduled, upcoming deadlines, and a financial snapshot with lifetime revenue and current social media usage across your clients.',
      },
      {
        heading: 'Client Health Grid',
        body: 'The client health grid shows each of your active clients alongside key signals — whether they have posts due soon, pending approvals, or are idle. It is designed to help you spot at a glance which clients need attention without having to open each profile.',
      },
      {
        heading: 'Recent Invoices',
        body: 'A summary of your most recent invoices is shown on the dashboard so you can keep track of what has been sent, what is pending, and what has been paid, without navigating to the Finance section each time.',
      },
      {
        heading: 'Trial and Subscription Alerts',
        body: 'If your trial is close to expiring or your subscription has lapsed, a banner appears at the top of the dashboard with a direct link to the Billing page. These banners escalate in urgency as the deadline approaches.',
      },
    ],
  },
  {
    id: 'chat',
    title: 'Chat',
    description: 'A shared workspace channel plus 1:1 messages with your team, without leaving Tercero.',
    sections: [
      {
        heading: 'Workspace Room and Direct Messages',
        body: 'Every team member is automatically part of one shared workspace channel. You can also message any teammate directly from the Chat sidebar — starting a DM creates the conversation the first time you send them something.',
      },
      {
        heading: 'Mentions and Reactions',
        body: 'Type @ to mention a teammate. Inside the workspace room you can also use @Everyone or @Important to flag something to the whole team; those are not available in a 1:1 conversation since there is only one other person to reach. Messages support emoji reactions the same way comments do.',
      },
      {
        heading: 'Referencing Work',
        body: 'Use / in the composer to attach a specific deliverable or task to a message — it renders as a clickable card in the thread. Task references respect the same access rules as the Tasks page, so you will never see the title of a task you are not allowed to view.',
      },
      {
        heading: 'Sidebar Preview and Unread State',
        body: 'The Chat sidebar shows your conversations sorted by most recent activity, each with a preview of the last message and a timestamp. Unread conversations appear bolded with a count badge; an @ badge takes priority when you have been mentioned directly.',
      },
      {
        heading: 'Availability',
        body: 'Chat is available on Velocity and Quantum plans, and during your trial. On Ignite, the Chat nav item is visible but locked with an upgrade prompt.',
      },
    ],
  },
  {
    id: 'prospects',
    title: 'Prospects',
    description: 'Manage your pipeline of potential clients from first contact to conversion.',
    sections: [
      {
        heading: 'Adding Prospects',
        body: 'You can add prospects individually using the Add Prospect button, which opens a form to capture their name, contact details, source, and initial status. If you are importing from a tool like Apollo or Google Maps, use the CSV Import option to bulk-add prospects in one go.',
      },
      {
        heading: 'Tracking Status',
        body: 'Each prospect moves through a set of statuses: New, Contacted, Follow-Up, Discovery Call, Proposal Sent, Proposal Accepted, Contract Sent, Won, and Lost. You update the status from the prospect detail page using the dropdown at the top. The main prospects list has tabs that filter by status so you can focus on the right stage of your pipeline.',
      },
      {
        heading: 'Scheduling Follow-Ups',
        body: 'On the prospect detail page you can log a follow-up date. Overdue follow-ups are highlighted in the table view with an amber indicator so nothing slips through. The Outreach tab on each prospect keeps a log of your contact history.',
      },
      {
        heading: 'Converting to a Client',
        body: 'Once a prospect is marked as Won, a Convert to Client button appears on their profile. This creates a new client in your workspace linked to that prospect. The prospect record is kept for reference and a View Client button replaces the convert option.',
      },
    ],
  },
  {
    id: 'proposals',
    title: 'Proposals',
    description: 'Upload, send, and track proposals through to acceptance.',
    sections: [
      {
        heading: 'Creating a Proposal',
        body: 'Proposals are uploaded from the Proposals section or directly from a prospect profile — attach a PDF you have already prepared and Tercero tracks its status from there. An in-app proposal builder (drag-and-drop, with services/pricing/terms) is planned for a future update.',
      },
      {
        heading: 'Sending for Review',
        body: 'Once your proposal is ready, generate a public review link and share it with the client. They can view the proposal on a branded public page without needing to log in. The status updates automatically when they open the link, moving from Sent to Viewed.',
      },
      {
        heading: 'Client Accept and Decline',
        body: 'From the public review page, clients can accept or decline the proposal with a single click. Accepting moves the status to Accepted and you receive a notification. If they decline, the status updates accordingly and you can revise and resend.',
      },
      {
        heading: 'PDF Export',
        body: 'Any proposal can be exported as a PDF directly from the detail page. The PDF uses your agency branding if configured. You can also upload an existing PDF proposal if you have one prepared outside Tercero.',
      },
      {
        heading: 'Proposal Limits by Plan',
        body: 'Ignite plan users can have up to 10 active proposals at a time. Velocity and Quantum plans have no limit. Once you reach the limit on Ignite, the create button is replaced with an upgrade prompt.',
      },
    ],
  },
  {
    id: 'clients',
    title: 'Clients',
    description: 'Manage your client roster, profiles, and pipeline analytics.',
    sections: [
      {
        heading: 'Adding a Client',
        body: 'Click New Client from the Clients page to open the client creation form. You can set the client name, industry, tier, logo, and contact information. Clients are the core of Tercero — most other features like posts, campaigns, invoices, and documents are scoped to a specific client.',
      },
      {
        heading: 'Client Profile Tabs',
        body: 'Each client profile has several tabs: Overview (key details and health indicators), Management (contact and account info), Workflow (their posts and content), Campaigns (active campaigns), and Documents (files stored for that client). You can navigate between them using the tabs at the top of the profile.',
      },
      {
        heading: 'Internal Accounts',
        body: 'You can mark a client as an Internal Account using the is_internal flag. This is useful for tracking your own agency as a client, for example to log your own social media work. Internal accounts are excluded from your client count for subscription limit purposes.',
      },
      {
        heading: 'Client Limits',
        body: 'Your plan determines how many clients you can have. Ignite allows up to 8, Velocity up to 20, and Quantum is unlimited. Your current usage is always visible in the sidebar subscription card. You can add extra clients beyond your plan limit on Ignite or Velocity for a flat ₹500/client.',
      },
    ],
  },
  {
    id: 'deliverables',
    title: 'Deliverables',
    description: 'Create, manage, and deliver social media content for your clients.',
    sections: [
      {
        heading: 'Creating a Post',
        body: 'Click New Deliverable from the Deliverables page or from within a client profile. Fill in the title, content, target platforms, scheduled date, and upload any media. Posts are created as drafts by default and do not go live automatically until publishing is supported.',
      },
      {
        heading: 'Post Statuses',
        body: 'A deliverable moves through a full lifecycle: Draft, an optional internal Submitted / Changes Requested / Ready loop (see Approvals & Submissions), Pending Approval once it is sent to the client, Approved or Needs Revision based on their feedback, then Scheduled and Published. On the Deliverables page, tabs across the top filter posts by their current status so you can focus on what needs attention.',
      },
      {
        heading: 'Linking to Campaigns and Tasks',
        body: 'A deliverable can be assigned to a campaign from its card menu, and any task can link back to one or more deliverables — so a piece of content and the work items around it stay connected. Linked tasks show up on the deliverable’s own page under Linked Tasks.',
      },
      {
        heading: 'Platform Previews',
        body: 'The post editor includes live previews for Instagram, LinkedIn, X, and YouTube. As you write the content and upload media, you can toggle between platform previews to see exactly how the post will look on each platform before sharing it with the client.',
      },
      {
        heading: 'Post Versioning',
        body: 'Every time a revision is created, a new version of the post is saved. You can view the full version history from the sidebar in the post editor. Previous versions are never deleted, so you always have a record of every change and can reference earlier drafts.',
      },
      {
        heading: 'Client Review Link',
        body: 'Each post has a shareable public review link. Share it with your client and they can view the post and leave approval or revision feedback without needing a Tercero account. When they request revisions, the status updates and you can create a new version to address the feedback.',
      },
      {
        heading: 'Filtering and Search',
        body: 'The Deliverables page supports filtering by client, platform, campaign, date range, and content health (Urgent, Upcoming, Idle). Urgent posts are those due within 24 hours, Upcoming within 72 hours. These filters help you prioritise what needs to go out soonest.',
      },
    ],
  },
  {
    id: 'approvals',
    title: 'Approvals & Submissions',
    description: 'The internal review step deliverables go through before they reach a client.',
    sections: [
      {
        heading: 'Submitting for Internal Approval',
        body: 'Team members submit their own drafts for internal approval before they go anywhere near a client. Submitting moves the status to Submitted and notifies the workspace owner and admins. Owners and admins can skip this and send a draft straight to Ready themselves — the step mainly exists to give team leads a checkpoint on member-created work.',
      },
      {
        heading: 'Reviewing on the Approvals Page',
        body: 'Owners and admins review everything waiting on them from the Approvals page. Each submission can be approved, moving it to Ready, or sent back with a note requesting changes, which flips it to Changes Requested for the original creator to fix and resubmit.',
      },
      {
        heading: 'Tracking Your Own Submissions',
        body: 'Team members can see the status of everything they have submitted from the Submissions page, including how many are currently sent back for changes, so nothing sits waiting on a decision without you knowing.',
      },
      {
        heading: 'From Ready to Client',
        body: 'Once a deliverable is Ready, an owner or admin sends it on for client review the same way as any other post, or schedules it directly if no client sign-off is needed.',
      },
    ],
  },
  {
    id: 'campaigns',
    title: 'Campaigns',
    description: 'Group posts into campaigns and share progress with clients.',
    sections: [
      {
        heading: 'What is a Campaign',
        body: 'A campaign is a collection of posts grouped under a shared initiative for a specific client. For example, a product launch or a seasonal promotion. Campaigns help you organise related content, track overall progress, and present the full picture to a client in one place.',
      },
      {
        heading: 'Creating a Campaign',
        body: 'Create a campaign from the Campaigns page or from within a client profile. Give it a name, link it to a client, and optionally set a budget. Once created, you can add existing posts to it or create new ones directly inside the campaign.',
      },
      {
        heading: 'Campaign Analytics',
        body: 'The campaign detail page shows a KPI bar with post counts by status, a platform distribution chart showing where your content is going, a budget tracker if a budget has been set, and a list of all linked invoices. This gives both you and your client a clear overview of the campaign at a glance.',
      },
      {
        heading: 'Sharing a Campaign Review',
        body: 'When posts in a campaign are ready for client approval, you can generate a campaign review link. Share it with the client and they get a two-panel view: a list of pending posts on the left and a detail view on the right where they can approve or request revisions per post. You can also email the review link directly from inside Tercero.',
      },
      {
        heading: 'Campaign Limits',
        body: 'Ignite plan users can have up to 8 campaigns. Velocity and Quantum plans have no limit.',
      },
    ],
  },
  {
    id: 'tasks',
    title: 'Tasks & Todos',
    description: 'Internal work items for your team, optionally linked to a client, campaign, or deliverable.',
    sections: [
      {
        heading: 'Creating a Task',
        body: 'Click New Task to create one with a title, priority, and optional due date. A task can be scoped to a client, or left as a "General" task with no client at all for internal work that does not belong to any one account.',
      },
      {
        heading: 'Linking Work',
        body: 'A task can be tagged with a campaign and linked to any number of specific deliverables, even across different clients for a General task. Linked deliverables show up as a badge on the card, and the reverse link appears on the deliverable’s own page under Linked Tasks.',
      },
      {
        heading: 'Assigning Tasks',
        body: 'Only owners and admins can assign a task to someone else. Team members can still create and manage their own tasks, but assigning work to other people is restricted to keep workload distribution centralised.',
      },
      {
        heading: 'Views and Status',
        body: 'Tasks move through To Do, In Progress, Completed, and Archived. View them as a kanban board, a grouped list, or a table depending on how you like to work, and filter by a specific client, General, or Internal.',
      },
    ],
  },
  {
    id: 'calendar',
    title: 'Content Calendar',
    description: 'See all scheduled content across your clients in one view.',
    sections: [
      {
        heading: 'What the Calendar Shows',
        body: 'The content calendar displays all your scheduled posts across every client on a single calendar. You can switch between month and week view depending on how much detail you need. Each post appears on the date it is scheduled for, colour-coded by client.',
      },
      {
        heading: 'Navigating the Calendar',
        body: 'Use the arrow buttons to move forward and backward through months or weeks. Click on any post in the calendar to open its detail page. The calendar is read-only in terms of scheduling — to change a post date, open the post editor directly.',
      },
      {
        heading: 'PDF Export',
        body: 'On Velocity and Quantum plans, you can export the current calendar view as a PDF. This is useful for sending a content schedule to a client or keeping a printed record. The export button appears in the top right of the calendar page.',
      },
    ],
  },
  {
    id: 'documents',
    title: 'Documents',
    description: 'Store and organise files for each client.',
    sections: [
      {
        heading: 'Uploading Documents',
        body: 'Documents can be uploaded from the Documents page or from within a client profile under the Documents tab. Supported file types include PDFs, images, and common office formats. The maximum file size is 50MB per file. Uploaded files are stored privately and accessible only within your workspace.',
      },
      {
        heading: 'Categories and Archiving',
        body: 'Each document can be assigned a category to help with organisation. Documents can also be archived when they are no longer actively needed but should not be deleted. Archived documents remain accessible but are hidden from the default view.',
      },
      {
        heading: 'Document Collections',
        body: 'On Velocity and Quantum plans, you can organise documents into collections, which work like folders. This is useful when a client has a large number of files that benefit from grouping by project, year, or type.',
      },
      {
        heading: 'Storage Limits',
        body: 'Your plan comes with a storage allocation: 50GB on Ignite, 200GB on Velocity, and 500GB (base) on Quantum. Your current usage is shown in the Billing and Usage section. Files count toward your total regardless of which client they are stored under.',
      },
    ],
  },
  {
    id: 'reports',
    title: 'Reports',
    description: 'Generate a branded, downloadable performance summary for any client.',
    sections: [
      {
        heading: 'Generating a Report',
        body: 'Pick a client from the dropdown to see a stat summary — deliverables by status, revenue, and activity for that account. Click Download to export it as a branded PDF you can send straight to the client.',
      },
      {
        heading: 'Availability',
        body: 'Reports is available on Velocity and Quantum plans, and during your trial.',
      },
    ],
  },
  {
    id: 'notes',
    title: 'Notes & Reminders',
    description: 'Keep track of tasks, ideas, and reminders across your workspace.',
    sections: [
      {
        heading: 'Creating a Note',
        body: 'Click New Note to create a note. You can give it a title, body content, a due date, a category, and optionally link it to a specific client. Notes without a due date are treated as open reminders. Notes with a past due date are flagged as overdue.',
      },
      {
        heading: 'Grid and Kanban Views',
        body: 'Notes can be viewed in a grid layout grouped by status, or in a kanban board with columns for To Do, Done, and Archived. The kanban view supports drag and drop — move a card between columns to update its status instantly.',
      },
      {
        heading: 'Marking Notes Done',
        body: 'Click the circle icon on any note card to toggle it between To Do and Done. Done notes move to the Done column in kanban view or the Done group in grid view. You can restore a done note back to To Do at any time.',
      },
      {
        heading: 'Archiving',
        body: 'Archive a note when it is resolved but you want to keep it for reference. Archived notes appear in the Archived column or tab and can be restored if needed. They do not count against any limits.',
      },
    ],
  },
  {
    id: 'meetings',
    title: 'Meetings',
    description: 'Schedule and track client and team meetings.',
    sections: [
      {
        heading: 'Scheduling a Meeting',
        body: 'Click Schedule Meeting to create a new meeting. Set the title, date, time, a meeting link if it is virtual, optional notes, and link it to a client. Meetings require at least one external client to be created, as they are client-facing records.',
      },
      {
        heading: 'Meeting Statuses',
        body: 'Meetings are automatically categorised as Upcoming (future date), Missed (past date, not marked done), or Completed. You can mark a meeting as done from the card, which moves it to Completed. Completed meetings can also be restored if needed.',
      },
      {
        heading: 'Grid and Kanban Views',
        body: 'Like Notes, Meetings support both a grid view grouped by status and a kanban board view. You can drag meeting cards between columns to update their status. Clicking the meeting link button on a card opens the virtual meeting URL in a new tab.',
      },
    ],
  },
  {
    id: 'finance',
    title: 'Finance',
    description: 'Track invoices, expenses, and your overall agency financial health.',
    sections: [
      {
        heading: 'Financial Overview',
        body: 'The Finance overview shows your net profit, total revenue, total expenses, and pending invoice amount in KPI cards at the top. Below is a bar chart showing revenue vs. expenses over the last 3, 6, or 12 months. A pending invoices panel on the right lists all outstanding amounts.',
      },
      {
        heading: 'Invoices',
        body: 'Create invoices for clients from the Invoices tab. Each invoice has a line-item breakdown, due date, and status (Draft, Sent, Paid, Overdue). Invoices can be exported as PDFs and sent directly to clients. On Velocity and Quantum plans, you can also create recurring invoice templates.',
      },
      {
        heading: 'Expense and Transaction Ledger',
        body: 'The Ledger tab is where you record all income and expense transactions. Each entry has a date, amount, category, and optional client link. The ledger is the source of truth for your cash-basis financial calculations.',
      },
      {
        heading: 'Expense Subscriptions',
        body: 'On Velocity and Quantum plans, you can log recurring software subscriptions and vendor costs under the Subscriptions tab. These are tracked separately from one-off expenses and contribute to your monthly expense totals automatically.',
      },
      {
        heading: 'Cash vs. Accrual Accounting',
        body: 'The financial overview supports two accounting methods. Cash accounting counts revenue only when payment is received. Accrual accounting counts revenue when an invoice is issued, regardless of payment. You can toggle between the two from the overview page. Accrual mode is available on Velocity and Quantum plans.',
      },
    ],
  },
  {
    id: 'team',
    title: 'Team Management',
    description: 'Invite team members and manage workspace access.',
    sections: [
      {
        heading: 'Inviting Team Members',
        body: 'Go to General Settings and open the Team tab. Click Generate Invite Link to create a shareable link. Anyone who joins via that link becomes a member of your workspace with full access to all clients, posts, campaigns, and documents.',
      },
      {
        heading: 'Roles and Permissions',
        body: 'Every team member has a role: Owner, Admin, or Member. Owners and admins get full operational access — finance, proposals, prospects, reports, creating clients and campaigns, sending deliverables to clients, and assigning tasks. Members work inside clients and deliverables but do not get those higher-level actions, and their access to documents can be tuned individually (view or manage) from the Team tab.',
      },
      {
        heading: 'Seat Limits',
        body: 'The number of team members you can invite depends on your plan. Ignite includes 4 seats, Velocity includes 10, and Quantum is unlimited. You can add extra seats beyond your plan limit on Ignite or Velocity for a flat ₹399/seat. Active links are shown in the Team tab alongside active members.',
      },
    ],
  },
  {
    id: 'settings',
    title: 'Settings & Branding',
    description: 'Configure your profile, agency details, and workspace branding.',
    sections: [
      {
        heading: 'Profile Settings',
        body: 'The Profile tab in General Settings lets you update your personal details including your name, email, and password. These are your individual account details and are separate from your agency information.',
      },
      {
        heading: 'Agency Settings',
        body: 'The Agency tab is where you set your agency name, logo, and other workspace-level details. Your agency name and logo appear in the sidebar on Velocity and Quantum plans, and on client-facing documents like proposals and invoices across all plans.',
      },
      {
        heading: 'Sidebar Branding',
        body: 'On Velocity and Quantum plans, your agency logo and name replace the default Tercero branding in the sidebar. This gives your workspace a more personalised feel for you and your team. On Ignite and Trial plans, the Tercero logo is shown instead.',
      },
      {
        heading: 'Powered by Tercero',
        body: 'On Ignite and Velocity plans, a small "Powered by Tercero" attribution appears on public-facing pages. Quantum plan users have full whitelabel — no Tercero attribution anywhere, giving clients a fully branded experience.',
      },
    ],
  },
]
