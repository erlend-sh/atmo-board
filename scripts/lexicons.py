"""Generates lexicons/ from the definitions below: python3 scripts/lexicons.py

Edit here, not the JSON. Run appview/setup.sh afterwards to install them.
"""
import json, os, sys
ROOT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
NS = "dev.atmoboard"
def w(nsid, doc):
    path = os.path.join(ROOT, "lexicons", *nsid.split(".")[:-1], nsid.split(".")[-1] + ".json")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    doc = {"lexicon": 1, "id": nsid, **doc}
    with open(path, "w") as f:
        json.dump(doc, f, indent=2, ensure_ascii=False); f.write("\n")

S = lambda **k: {"type": "string", **k}
DT = {"type": "string", "format": "datetime"}
URI = {"type": "string", "format": "at-uri"}
DID = {"type": "string", "format": "did"}
KEY = {"type": "string", "minLength": 10, "maxLength": 10, "description": "Short stable key: the first 50 bits of sha256(at-uri), as 10 lowercase base32 characters."}
def rec(desc, key, req, props):
    return {"defs": {"main": {"type": "record", "description": desc, "key": key, "record": {"type": "object", "required": req, "properties": props}}}}
def obj(req, props, desc=None):
    o = {"type": "object", "required": req, "properties": props}
    if desc: o["description"] = desc
    return o
ref = lambda r: {"type": "ref", "ref": r}
arr = lambda items, **k: {"type": "array", "items": items, **k}
def query(desc, params, out, errors=None):
    d = {"type": "query", "description": desc,
         "parameters": {"type": "params", "required": [p for p, v in params.items() if v.pop("_req", False)], "properties": params},
         "output": {"encoding": "application/json", "schema": out}}
    if errors: d["errors"] = [{"name": e} for e in errors]
    return {"defs": {"main": d}}
def proc(desc, inp, out, errors=None):
    d = {"type": "procedure", "description": desc,
         "input": {"encoding": "application/json", "schema": inp},
         "output": {"encoding": "application/json", "schema": out}}
    if errors: d["errors"] = [{"name": e} for e in errors]
    return {"defs": {"main": d}}
def req(x): x = dict(x); x["_req"] = True; return x

MARKDOWN = f"{NS}.defs#markdown"
TITLE = S(minLength=1, maxLength=3000, maxGraphemes=300)
TEXT = S(maxLength=100000, maxGraphemes=10000)

# ---- defs
w(f"{NS}.defs", {"description": "Shared definitions and API views for atmo-board.", "defs": {
  "markdown": obj(["text"], {"text": S(maxLength=100000, maxGraphemes=10000, description="CommonMark source.")}, "Post body as Markdown."),
  "permissions": obj(["see", "reply", "create"], {
      "see": {"type": "boolean"}, "reply": {"type": "boolean"}, "create": {"type": "boolean"},
      "flag": {"type": "boolean", "description": "Report a post (TL1 and up)."},
      "curate": {"type": "boolean", "description": "Rename and move threads (TL3 and up)."},
      "manage": {"type": "boolean", "description": "Pin, lock and hide threads, and see hidden posts (TL4 and staff)."},
      "moderate": {"type": "boolean"}, "admin": {"type": "boolean"}},
      "What the viewer may do in one channel: Discourse's See / Reply / Create, plus the trust-level and staff powers."),
  "forumView": obj(["did", "name", "joinPolicy"], {
      "did": DID, "name": S(), "description": S(), "joinPolicy": S(knownValues=["open", "approval", "invite"]),
      "rules": arr(obj(["uri", "text"], {"uri": URI, "text": S()}))}),
  "viewerState": obj(["member", "roles"], {
      "did": DID, "handle": S(), "member": {"type": "boolean"},
      "roles": arr(S()), "trustLevel": {"type": "integer", "minimum": 0, "maximum": 4},
      "permissions": ref("#permissions")}),
  "authorView": obj(["did"], {"did": DID, "handle": S(), "displayName": S(), "avatar": S(format="uri"),
      "roles": arr(S()), "trustLevel": {"type": "integer"}}),
  "threadState": obj([], {"locked": {"type": "boolean"},       "pinned": {"type": "boolean"}, "hidden": {"type": "boolean"}}),
  "channelView": obj(["key", "uri", "slug", "title", "position"], {
      "key": KEY, "uri": URI, "slug": S(), "title": S(), "description": S(), "icon": S(maxGraphemes=1),
      "section": S(), "position": {"type": "integer"}, "private": {"type": "boolean"},
      "threadCount": {"type": "integer"}, "postCount": {"type": "integer"},
      "lastActivityAt": DT,
      "unreadCount": {"type": "integer", "description": "Threads in the channel with unread posts. Chat is not counted."},
      "unreadChat": {"type": "boolean", "description": "The channel's own chat has unread posts."}}),
  "sectionView": obj(["name", "channels"], {"name": S(), "channels": arr(ref("#channelView"))}),
  "threadView": obj(["key", "uri", "slug", "author", "postCount", "createdAt", "lastActivityAt", "state"], {
      "key": KEY, "uri": URI, "slug": S(), "title": S(), "parent": KEY, "isChannel": {"type": "boolean"},
      "author": ref("#authorView"), "textContent": S(), "content": {"type": "union", "refs": ["#markdown"]},
      "tags": arr(S()), "postCount": {"type": "integer"}, "participants": arr(ref("#authorView")),
      "createdAt": DT, "updatedAt": DT, "lastActivityAt": DT, "state": ref("#threadState"),
      "lastReadNumber": {"type": "integer"},
      "notificationLevel": S(knownValues=["watching", "normal", "muted"])}),
  "reactionSummary": obj(["emoji", "count"], {"emoji": S(maxGraphemes=1), "count": {"type": "integer"}, "viewer": {"type": "boolean"}}),
  "postView": obj(["key", "uri", "number", "thread", "author", "textContent", "createdAt"], {
      "key": KEY, "uri": URI, "number": {"type": "integer", "minimum": 1}, "thread": KEY,
      "author": ref("#authorView"), "textContent": S(), "content": {"type": "union", "refs": ["#markdown"]},
      "replyTo": {"type": "integer", "description": "Post number this post answers."},
      "reactions": arr(ref("#reactionSummary")), "createdAt": DT, "updatedAt": DT, "hidden": {"type": "boolean"},
      "hiddenBy": S(knownValues=["staff", "flags"], description="Why it is hidden: a staff override, or community flags."),
      "whisper": {"type": "boolean", "description": "A staff-only post. Only staff are served it."},
      "editCount": {"type": "integer", "description": "Earlier versions kept by getPostHistory."},
      "deleted": {"type": "boolean", "description": "The author deleted this post; its text is gone."}}),
  "revisionView": obj(["version", "textContent", "createdAt"], {
      "version": {"type": "integer", "minimum": 1}, "title": S(), "textContent": S(),
      "content": {"type": "union", "refs": ["#markdown"]}, "createdAt": DT, "current": {"type": "boolean"}}),
  "reportView": obj(["reporter", "reason", "status", "createdAt"], {
      "reporter": ref("#authorView"), "reason": S(knownValues=["spam", "offtopic", "inappropriate", "other"]),
      "note": S(), "status": S(knownValues=["open", "agreed", "disagreed", "ignored"]),
      "createdAt": DT, "resolvedBy": DID, "resolvedAt": DT}),
  "reviewItem": obj(["subject", "post", "reports"], {
      "subject": KEY, "post": ref("#postView"), "thread": ref("#threadView"), "reports": arr(ref("#reportView"))}),
  "channelAccess": obj(["group", "level"], {
      "group": S(description="everyone, members, staff, a role (admin, moderator) or trust_level_0..4."),
      "level": S(knownValues=["see", "reply", "create"])}),
  "postHit": obj(["post", "thread"], {"post": ref("#postView"), "thread": ref("#threadView")}),
  "change": obj(["seq", "kind", "key"], {"seq": {"type": "integer"},
      "kind": S(knownValues=["thread", "post", "channel", "member", "reaction", "override", "report"]),
      "key": KEY, "thread": KEY, "parent": KEY}),
}})

# ---- records
w(f"{NS}.thread", rec("A thread. Threads all the way down: a channel is a thread the group lists in its sidebar (see channel), and a named thread is a thread whose parent is another thread. Lives in a forum space, written by its author. Field names follow garden.msg.thread where they overlap.",
  "tid", ["createdAt"], {
    "title": dict(TITLE, description="Absent for an untitled thread."),
    "parent": dict(URI, description="The thread this one lives in. Absent for top-level threads (channels)."),
    "textContent": dict(TEXT, description="Plain-text rendering of the opening post."),
    "content": {"type": "union", "refs": [MARKDOWN], "description": "The opening post in a rich format. Open union."},
    "tags": arr(S(maxLength=640, maxGraphemes=64), maxLength=8),
    "createdAt": DT, "updatedAt": DT}))
w(f"{NS}.post", rec("A post in a thread: a chat message or a forum reply alike. Lives in the thread's space, written by its author. Field names follow garden.msg.post.",
  "tid", ["thread", "textContent", "createdAt"], {
    "thread": URI, "replyTo": dict(URI, description="The post this one answers, if any."),
    "textContent": TEXT, "content": {"type": "union", "refs": [MARKDOWN]},
    "createdAt": DT, "updatedAt": DT}))
w(f"{NS}.reaction", rec("An emoji reaction to a post. A ❤️ is a Discourse-style like.",
  "tid", ["subject", "emoji", "createdAt"], {"subject": URI, "emoji": S(maxLength=64, maxGraphemes=1), "createdAt": DT}))
w(f"{NS}.channel", rec("A sidebar entry that promotes a thread to a channel. Written only by the group. Deleting it demotes the thread.",
  "tid", ["thread", "position", "createdAt"], {
    "thread": URI, "section": S(maxLength=640, maxGraphemes=64), "position": {"type": "integer", "minimum": 0},
    "icon": S(maxLength=64, maxGraphemes=1), "description": S(maxLength=3000, maxGraphemes=300), "createdAt": DT}))
w(f"{NS}.override", rec("A curation or moderation decision the group applies on top of authors' records. Written only by the group; actor names the staff member.",
  "tid", ["subject", "action", "createdAt"], {
    "subject": {"type": "string", "description": "The at-uri of the thread or post, or the DID of an account."},
    "action": S(knownValues=["move", "rename", "hide", "unhide", "lock", "unlock", "pin", "unpin", "setTrustLevel", "ban"]),
    "toThread": dict(URI, description="For move: the new parent thread."),
    "title": dict(TITLE, description="For rename."),
    "level": {"type": "integer", "minimum": 0, "maximum": 4, "description": "For setTrustLevel."},
    "locked": {"type": "boolean", "description": "For setTrustLevel: pin the level so automatic promotion and demotion skip it."},
    "until": dict(DT, description="For pin: when the pin lapses."),
    "actor": DID, "reason": S(maxLength=10000, maxGraphemes=1000), "createdAt": DT}))

# ---- queries
w(f"{NS}.getForum", query("The forum's profile, rules, and what the viewer may do.", {},
  obj(["forum", "viewer"], {"forum": ref(f"{NS}.defs#forumView"), "viewer": ref(f"{NS}.defs#viewerState")})))
w(f"{NS}.getSidebar", query("Channels the viewer can see, grouped into sections, with unread counts.", {},
  obj(["sections", "cursor"], {"sections": arr(ref(f"{NS}.defs#sectionView")), "cursor": S(description="Change cursor for getChanges.")})))
w(f"{NS}.listThreads", query("Threads, newest activity first by default. With parent: the named threads of one channel.", {
    "parent": dict(KEY, description="Channel (or thread) key."), "tag": S(),
    "sort": S(knownValues=["latest", "new", "unread", "top"], default="latest"),
    "limit": {"type": "integer", "minimum": 1, "maximum": 100, "default": 30}, "cursor": S()},
  obj(["threads"], {"threads": arr(ref(f"{NS}.defs#threadView")), "cursor": S(), "changeCursor": S()})))
w(f"{NS}.getThread", query("One thread and a window of its posts around an anchor.", {
    "key": req(KEY),
    "anchor": S(description="A post number, 'first' (default), 'last', or 'first_unread'."),
    "before": {"type": "integer", "minimum": 0, "maximum": 100, "default": 0},
    "after": {"type": "integer", "minimum": 0, "maximum": 100, "default": 50}},
  obj(["thread", "posts", "channel", "permissions", "changeCursor"], {
    "thread": ref(f"{NS}.defs#threadView"), "channel": ref(f"{NS}.defs#channelView"),
    "ancestors": arr(ref(f"{NS}.defs#threadView")),
    "posts": arr(ref(f"{NS}.defs#postView")), "hasBefore": {"type": "boolean"}, "hasAfter": {"type": "boolean"},
    "permissions": ref(f"{NS}.defs#permissions"), "changeCursor": S()}), ["NotFound"]))
w(f"{NS}.resolveKey", query("Where a key lives now: its canonical slug, and for a post its thread and number. Backs /p/{key} and slug redirects.", {
    "key": req(KEY)},
  obj(["kind", "key", "slug"], {"kind": S(knownValues=["thread", "channel", "post"]), "key": KEY, "slug": S(),
    "thread": KEY, "threadSlug": S(), "number": {"type": "integer"}}), ["NotFound"]))
w(f"{NS}.getChanges", query("Change hints since a cursor, for slow realtime: poll while the tab is visible and refetch what changed.", {
    "since": req(S()), "thread": KEY, "parent": KEY,
    "limit": {"type": "integer", "minimum": 1, "maximum": 200, "default": 100}},
  obj(["changes", "cursor"], {"changes": arr(ref(f"{NS}.defs#change")), "cursor": S()})))

w(f"{NS}.listMembers", query("The forum's members, most recently joined first. Discourse's /u directory.", {
    "limit": {"type": "integer", "minimum": 1, "maximum": 100, "default": 50}, "cursor": S()},
  obj(["members"], {"members": arr(ref(f"{NS}.defs#authorView")), "cursor": S()})))

# ---- procedures
OK = obj(["key", "uri"], {"key": KEY, "uri": URI})
w(f"{NS}.createThread", proc("Open a thread. Without parent the thread is top-level (only staff, since that is how channels start).", obj(["textContent"], {
    "parent": KEY, "title": TITLE, "textContent": TEXT, "content": {"type": "union", "refs": [MARKDOWN]},
    "tags": arr(S(maxLength=640, maxGraphemes=64), maxLength=8)}),
  obj(["key", "uri", "slug"], {"key": KEY, "uri": URI, "slug": S()}), ["Forbidden", "NotFound", "Locked"]))
w(f"{NS}.createPost", proc("Post into a thread. Posting into a channel is untitled chat.", obj(["thread", "textContent"], {
    "thread": KEY, "replyTo": dict(KEY, description="Key of the post being answered."),
    "textContent": TEXT, "content": {"type": "union", "refs": [MARKDOWN]},
    "whisper": {"type": "boolean", "description": "Staff only: post into the staff space, visible only to staff."}}),
  obj(["key", "uri", "number"], {"key": KEY, "uri": URI, "number": {"type": "integer"}}), ["Forbidden", "NotFound", "Locked"]))
w(f"{NS}.admin.initForum", proc("Create the group's spaces and profile and make the caller's actor its first admin. Callable only by the group account; idempotent.", obj(["name", "admin"], {
    "name": S(maxLength=640, maxGraphemes=64), "description": S(maxLength=20000, maxGraphemes=2000),
    "joinPolicy": S(knownValues=["open", "approval", "invite"], default="open"), "admin": DID, "adminHandle": S()}),
  obj(["did", "spaces"], {"did": DID, "spaces": {"type": "unknown"}}), ["Forbidden"]))
w(f"{NS}.admin.putChannel", proc("Promote a thread to a channel, or create a new channel thread when no thread is given. Group account only, on behalf of an admin actor.", obj(["actor", "title"], {
    "actor": DID, "thread": KEY, "title": TITLE, "description": S(maxLength=3000, maxGraphemes=300),
    "icon": S(maxLength=64, maxGraphemes=1), "section": S(maxLength=640, maxGraphemes=64), "position": {"type": "integer", "minimum": 0},
    "private": {"type": "boolean", "description": "Create the channel in its own space, readable only by its access list. Can't be changed later."},
    "access": arr(ref(f"{NS}.defs#channelAccess"), description="Replaces the channel's access rows.")}),
  obj(["key", "uri", "slug"], {"key": KEY, "uri": URI, "slug": S()}), ["Forbidden", "NotFound"]))
w(f"{NS}.admin.addMember", proc("Admit a member: write their group.opensocial.membership and grant them write access to the forum's spaces. Group account only.", obj(["member"], {
    "member": DID, "roles": arr(S()), "actor": DID, "trustLevel": {"type": "integer", "minimum": 0, "maximum": 4},
    "handle": S(), "displayName": S(maxLength=640, maxGraphemes=64), "avatar": S(format="uri")}),
  obj(["member", "roles"], {"member": DID, "roles": arr(S())}), ["Forbidden"]))

w(f"{NS}.markRead", proc("Record how far the viewer has read a thread. Private appview state; never written to a repo. Reading also feeds the trust-level inputs, so a new level may come back.", obj(["thread", "number"], {
    "thread": KEY, "number": {"type": "integer", "minimum": 0}}),
  obj(["thread", "lastRead"], {"thread": KEY, "lastRead": {"type": "integer"},
    "trustLevel": {"type": "integer", "description": "Present when this read changed the viewer's level; call admin.syncMember to publish it."}}), ["NotFound"]))

w(f"{NS}.admin.syncMember", proc("Recompute a member's trust level and republish their membership roles and space access. Group account only.", obj(["member"], {"member": DID}),
  obj(["member", "trustLevel"], {"member": DID, "trustLevel": {"type": "integer"}}), ["Forbidden", "NotFound"]))
w(f"{NS}.admin.removeMember", proc("Remove a member: the membership record and every space grant go, and a ban is recorded as a forum-signed override. Their posts stay. Group account only, on behalf of a staff actor (or the member themselves, leaving).", obj(["member"], {
    "member": DID, "actor": DID, "reason": S(maxLength=10000, maxGraphemes=1000)}),
  obj(["member"], {"member": DID}), ["Forbidden", "NotFound"]))

w(f"{NS}.moderate", proc("Apply a curation or moderation decision as a forum-signed override. Group account only, on behalf of actor: TL3 renames and moves, TL4 also pins, locks and hides, staff also set trust levels.", obj(["actor", "action", "subject"], {
    "actor": DID, "subject": {"type": "string", "description": "A thread or post key, or a member DID for setTrustLevel."},
    "action": S(knownValues=["move", "rename", "hide", "unhide", "lock", "unlock", "pin", "unpin", "setTrustLevel"]),
    "toThread": dict(KEY, description="For move: the new parent."), "title": dict(TITLE, description="For rename."),
    "level": {"type": "integer", "minimum": 0, "maximum": 4, "description": "For setTrustLevel."},
    "locked": {"type": "boolean", "description": "For setTrustLevel: false lets automatic promotion resume."},
    "reason": S(maxLength=10000, maxGraphemes=1000)}),
  obj(["subject", "action"], {"subject": S(), "action": S(), "uri": URI}), ["Forbidden", "NotFound", "InvalidRequest"]))
w(f"{NS}.report", proc("Flag a post for staff review. Private host state, never a public record. Enough open flags hide a post until staff decide.", obj(["subject", "reason"], {
    "subject": KEY, "reason": S(knownValues=["spam", "offtopic", "inappropriate", "other"]),
    "note": S(maxLength=10000, maxGraphemes=1000)}),
  obj(["subject", "reports"], {"subject": KEY, "reports": {"type": "integer"}, "hidden": {"type": "boolean"}}),
  ["Forbidden", "NotFound", "InvalidRequest"]))
w(f"{NS}.getReviewQueue", query("Staff only: reported posts with their flags, newest first.", {
    "status": S(knownValues=["open", "all"], default="open"),
    "limit": {"type": "integer", "minimum": 1, "maximum": 100, "default": 25}, "cursor": S()},
  obj(["items"], {"items": arr(ref(f"{NS}.defs#reviewItem")), "cursor": S()}), ["Forbidden"]))
w(f"{NS}.resolveReport", proc("Staff close a review item: agreed, disagreed (which lifts a flag-caused hide) or ignored.", obj(["subject", "status"], {
    "subject": KEY, "status": S(knownValues=["agreed", "disagreed", "ignored"])}),
  obj(["subject", "status"], {"subject": KEY, "status": S(), "resolved": {"type": "integer"}}), ["Forbidden", "NotFound"]))

w(f"{NS}.react", proc("React to a post (or a thread's opening post) with one emoji. ❤️ is the Discourse-style like.", obj(["post", "emoji"], {
    "post": dict(KEY, description="Post key, or a thread key for its opening post."), "emoji": S(maxLength=64, maxGraphemes=1)}),
  obj(["post", "emoji"], {"post": KEY, "emoji": S(), "uri": URI}), ["Forbidden", "NotFound"]))
w(f"{NS}.unreact", proc("Remove one of the viewer's reactions.", obj(["post", "emoji"], {"post": KEY, "emoji": S(maxLength=64, maxGraphemes=1)}),
  obj(["post", "emoji"], {"post": KEY, "emoji": S()}), ["NotFound"]))
w(f"{NS}.editPost", proc("Edit one of the viewer's own posts, or the opening post (and title) of their thread. The previous version is kept for getPostHistory.", obj(["key", "textContent"], {
    "key": KEY, "title": TITLE, "textContent": TEXT, "content": {"type": "union", "refs": [MARKDOWN]}}),
  obj(["key", "version"], {"key": KEY, "version": {"type": "integer"}}), ["Forbidden", "NotFound"]))
w(f"{NS}.deletePost", proc("Delete one of the viewer's own posts. The record is deleted from the space and its history dropped; the post number stays, marked deleted. Deleting a thread's opening post deletes the thread.", obj(["key"], {"key": KEY}),
  obj(["key"], {"key": KEY}), ["Forbidden", "NotFound"]))
w(f"{NS}.getPostHistory", query("Every version of a post the appview has seen, oldest first.", {"key": req(KEY)},
  obj(["revisions"], {"revisions": arr(ref(f"{NS}.defs#revisionView"))}), ["NotFound"]))
w(f"{NS}.listPosts", query("Find posts across chat and threads, Zulip-narrow style. All filters combine.", {
    "q": S(description="Words to search for."), "thread": KEY, "author": DID,
    "limit": {"type": "integer", "minimum": 1, "maximum": 100, "default": 25}, "cursor": S()},
  obj(["hits"], {"hits": arr(ref(f"{NS}.defs#postHit")), "cursor": S()})))
w(f"{NS}.setThreadNotification", proc("Follow (watching), reset (normal) or mute a thread or channel. Private appview state. Muted threads drop out of unread counts and lists.", obj(["thread", "level"], {
    "thread": KEY, "level": S(knownValues=["watching", "normal", "muted"])}),
  obj(["thread", "level"], {"thread": KEY, "level": S()}), ["NotFound"]))

# ---- vendored opensocial drafts (subset), so HappyView can validate space records
OS = "group.opensocial"
w(f"{OS}.profile", rec("Vendored draft (opensocial.group proposal, main @ 2026-10-23). The group's profile, in meta.", "literal:self", ["displayName", "joinPolicy"], {
    "displayName": S(maxGraphemes=64, maxLength=640), "description": S(maxGraphemes=2000, maxLength=20000),
    "joinPolicy": S(knownValues=["open", "approval", "invite"]), "url": S(format="uri")}))
w(f"{OS}.rule", rec("Vendored draft. One group rule, in meta.", "tid", ["text", "createdAt"], {
    "text": S(maxGraphemes=2000, maxLength=20000), "createdAt": DT}))
w(f"{OS}.role", rec("Vendored draft. A group role, in members. The rkey is the role ID.", "any", ["displayName"], {
    "displayName": S(maxGraphemes=64, maxLength=640), "description": S(maxGraphemes=2000, maxLength=20000),
    "default": {"type": "boolean", "default": False}}))
w(f"{OS}.membership", rec("Vendored draft. Grants a member their roles, in members. The rkey is the member DID.", "any", ["member", "roles", "createdAt"], {
    "member": DID, "roles": arr(S(format="record-key"), maxLength=100), "createdAt": DT}))
w(f"{OS}.acceptance", rec("Vendored draft. The member's side of a membership, in members.", "literal:self", ["createdAt"], {"createdAt": DT}))
w(f"{OS}.access", rec("Vendored draft. Who can access this space; grants apply only here.", "literal:self", ["grants"], {
    "public": {"type": "boolean", "default": False},
    "grants": arr(obj(["role", "scopes"], {"role": S(format="record-key"), "scopes": arr(S())}), maxLength=100)}))
