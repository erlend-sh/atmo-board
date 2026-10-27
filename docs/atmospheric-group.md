# atmo-board as an Atmospheric Group

These notes map atmo-board onto the opensocial.group proposal (`tangled.org/opensocial.group/proposal`, `proposal.md`, read 2026-10-23). The proposal is a draft. Its lexicons are drafts, and it has recent commits from Bluesky's dholms. It builds on atproto permissioned spaces (Bluesky proposal 0016), which aren't in the lexicon spec yet. The repo names no reference group-host implementation.

## The proposal in brief
- **A group is a DID with a set of permissioned spaces.** A *group host* acts like a PDS for group accounts. It holds the group's identity, signs the group's repo and space repos, hosts the spaces, enforces access, and is the OAuth authorization server for the group DID. Members' own records stay on their own PDSes.
- **Every group has the same standard spaces.**
  - `group.opensocial.meta` holds the profile, rules and labeler. It can be public.
  - `group.opensocial.members` holds roles, memberships, permissions and the space index.
  - Each user also has a `group.opensocial.invites` space of their own.
  - Apps add *modality spaces*. The proposal's own example is `com.atmoboards.forum`.
- **Roles are flat RBAC.** A role grants OAuth scopes on the group DID, and a member's effective scopes are the union of their roles' scopes. There are **no denies and no precedence**. Scopes are granted per space through `access` records (which can also mark a space public), and group-wide through `permissions`. Each role also has an `assignable` list, the roles its holders may hand out.
- **Membership is two-sided.** The group writes `membership` (keyed by the member's DID) and the member writes `acceptance`. Joining, leaving and reporting use the member's own service auth. Join requests are private state on the host.
- **Group-authored writes happen inside a group-DID OAuth session.** The host authenticates the user against their own PDS, checks their roles, and issues a session narrowed to those roles. Sessions come in two kinds: per user, or *shared application sessions*, where the app checks each member's permissions itself.
- **Moderation:** each group is the moderation service for its own content. `createReport` opens a subject in a queue on the host (open, escalated or resolved), with `listSubjects`, `getSubjectHistory` and `resolveSubject`. Labels are records that the group writes **in the same space as their subject**, so only readers of the subject see them. Moderation history is private host state.
- **Migration:** a group moves between hosts through ordinary account migration. Private host state doesn't move with it: join requests, the moderation queue and history, and sessions.

## How atmo-board maps onto it
| atmo-board concept | As an Atmospheric Group |
|---|---|
| The forum (one instance) | The group DID. The instance's `meta` profile is the forum's identity, and a `declaration` record in the group's public repo makes it discoverable. |
| Forum settings and rules | `group.opensocial.profile` and `rule` in `meta` |
| Staff (admin, moderator) | Roles `admin` and `moderator`, following the proposal's conventions |
| Members joining | `requestJoin` and invites, then `membership` plus `acceptance`. This replaces atmoBB's `forum.membership`, `accessRequest` and `acceptMember`. |
| Trust levels TL0 to TL4 | Roles `tl0` to `tl4` (see the tension below) |
| Channels | Records inside a modality space, `<our-nsid>.forum`. Public channels sit in a public space. |
| Private channels | One space each, with an `access` record granting the roles that may read and write. This replaces atmoBB's HappyView-space boards. |
| Whispers | A staff space with access for `moderator` and `admin` only. Reports and discussion of them can be threads there too. |
| See, Reply and Create | Scopes per role per space: read the space; write the post collection (Reply); write the thread collection (Create). Discourse's model needs no denies, so flat RBAC fits it exactly. |
| Moderation (hide, lock, ban) | Hide and lock become labels or forum-authored records in the subject's space. A ban removes the membership. Reports go to the group's `createReport` queue. |
| Moving posts and rename overrides | Records the group writes in the modality space, through a shared application session |

## What this changes
1. **Public content moves from public repos into public spaces.** atmoBB keeps public posts in authors' public repos and indexes them off Jetstream. Under the group model, all forum content belongs to the forum's modality spaces, with public channels in a space marked public. The appview reads spaces from the group host instead of the firehose. Requirement 7 ("posts live in the member's own repo") still holds, because space records are written to the member's own PDS, but the transport changes.
2. **The instance becomes, or sits beside, a group host.** Being self-contained (requirement 16) argues for an atmo-board instance that bundles its own group host. But no group-host software exists yet, and HappyView's permissioned spaces are an experimental polyfill, not a group host. **Recommendation:** shape the API and records around the group model now. Implement it on HappyView spaces as a stand-in, behind one small "group host" module, and swap in a real group host when one ships.
3. **Trust levels become roles. This revises my earlier decision.** Category access in Discourse is granted to trust-level groups. If the group host enforces access, trust levels have to be roles that the instance writes automatically, through a shared application session, whenever a level changes. These records live in the `members` space, which only members can read, so the privacy objection I raised before is much weaker. The *inputs* (reading time and visits) stay private in the appview, and only the resulting role is written. Manual grants and locks become role assignments made by staff.
4. **Some state stops being auditable.** Reports, the moderation queue and history, and join requests become private host state. atmoBB publishes approvals and moderation actions as public records. The group model keeps most of that private, which is better for privacy and worse for transparency.
5. **Lexicons:** we'd adopt `group.opensocial.*` for everything about the group, and define only our modality space and its records (channel, thread, post, override). That narrows requirement 8 ("derive lexicons from the API") to the modality layer.

## Risks
- **Two draft specs.** Both permissioned spaces and opensocial.group are still drafts, and atmo-board's core would depend on them. We should pin to a commit of the proposal and wrap it so churn stays contained.
- **No group host to run yet**, so the stand-in on HappyView has to cover OAuth for the group DID, role checks and access enforcement.
- **Migration loses moderation history.** Moving a group between hosts drops it, so we'd need our own export.
