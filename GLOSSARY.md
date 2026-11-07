# Tercero

Tercero is where a social media agency runs its client work end to end: winning clients, producing and approving deliverables, and billing for them.

## Workspace & people

**Workspace**:
One agency's tenant in Tercero: its owner, members, clients and all their data.
_Avoid_: Agency (as a data boundary), organization, account, tenant

**Owner**:
The person who created the workspace and holds ultimate control over it, including its Plan.
_Avoid_: Admin (Owner is a distinct role), agency user

**Member**:
Anyone who belongs to a workspace, including the Owner.
_Avoid_: User, teammate, staff

**Role**:
The permission level a Member holds in a workspace: Owner, Admin or Member.
_Avoid_: System role, access level

**Job title**:
A descriptive label for what a Member does (e.g. Designer, Copywriter). It grants no permissions.
_Avoid_: Job role, functional role

**Invite link**:
A link that lets someone join a workspace with a preset Role.
_Avoid_: Invitation, join token

**Plan**:
The Tercero tier a workspace pays for (Trial, Ignite, Velocity, Quantum), which decides the features and limits it gets.
_Avoid_: Subscription, tier, package

## Clients & sales

**Client**:
A business the agency does work for.
_Avoid_: Customer, account, brand

**Internal client**:
The agency itself, represented as a Client so it can manage its own deliverables, campaigns and costs like any other.
_Avoid_: Internal account, internal workspace, my organization

**Prospect**:
A potential Client the agency is pursuing but hasn't won yet.
_Avoid_: Lead, opportunity

**Outreach**:
A recorded contact attempt with a Prospect, on a channel such as WhatsApp, email or a call.
_Avoid_: Activity (when meaning a contact attempt), touchpoint

**Proposal**:
An offer of work sent to a Client or Prospect, which they can accept, decline or ask to change.
_Avoid_: Quote, pitch, estimate

**Engagement type**:
The commercial shape of the relationship with a Client: monthly retainer, project-based, campaign-based, one-off or advisory.
_Avoid_: Client type, contract type

**Retainer**:
An engagement where a Client pays a recurring fee for ongoing work.
_Avoid_: Subscription, client plan

## Deliverables

**Deliverable**:
A unit of work the agency produces for a Client, such as a social post, a design or a document.
_Avoid_: Post (as the general term), content, asset, piece

**Social deliverable**:
A Deliverable that is scheduled to go live on one or more social platforms.
_Avoid_: Post (prefer this term when the social nature matters)

**Version**:
One immutable snapshot of a Deliverable's content. A Deliverable always has a current Version.
_Avoid_: Revision (as a noun), draft (as a noun for a copy), iteration

**Revise**:
To create the next Version of a Deliverable after feedback.
_Avoid_: Edit (for locked versions), redo

**Internal review**:
The agency-side check where an Admin or Owner approves a Member's Deliverable, or asks for changes, before the client sees it.
_Avoid_: Internal approval, submission review

**Client approval**:
The Client's decision to approve a Deliverable or ask for revisions, made through a review link.
_Avoid_: Client review, sign-off

**Review link**:
A link that lets a Client view one Deliverable, or every Deliverable in a Campaign, and give their Client approval decision without logging in.
_Avoid_: Share link, share token, approval link

**Published**:
The end state of a Social deliverable: it is live on its platforms. It is _partially published_ while only some platforms are live.
_Avoid_: Posted, live, delivered

**Delivered**:
The end state of a non-social Deliverable: it has been handed over to the Client.
_Avoid_: Completed, published, done

**Campaign**:
A named initiative for one Client that groups related Deliverables, usually with a budget and a time frame.
_Avoid_: Project, initiative, batch

## Internal work

**Task**:
An internal piece of work assigned to a Member, optionally tied to a Client, a Campaign or Deliverables.
_Avoid_: Todo, to-do, reminder, note (for a work item)

**Note**:
A free-form document the agency writes for itself, such as an SOP, a brief or client context.
_Avoid_: Task, memo, doc

**Meeting**:
A scheduled call or session, usually with a Client.
_Avoid_: Event, appointment

**Comment**:
A message attached to a Deliverable, Campaign or Task.
_Avoid_: Note, reply, feedback (outside Client approval)

**Chat**:
Real-time messaging between Members: one shared workspace channel plus one-to-one direct messages.
_Avoid_: Messages, inbox, comments

## Money

**Invoice**:
A request for payment sent to a Client.
_Avoid_: Bill

**Recurring invoice**:
A template that produces Invoices for a Client on a regular cycle, typically to bill a Retainer.
_Avoid_: Subscription, recurring template

**Transaction**:
A recorded movement of money in or out of the agency.
_Avoid_: Payment (as the general term), entry

**Expense**:
Money the agency spends.
_Avoid_: Cost, outgoing

**Recurring expense**:
An Expense the agency pays on a regular cycle, such as a software tool.
_Avoid_: Subscription, recurring bill
