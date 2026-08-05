# Pocket Phone 0.11.1

Pocket Phone integration fork for SillyTavern. It keeps the stable upstream 0.9.9 phone engine, includes the normal-roleplay bridge directly in the extension, and does not require a Lorebook, World Info entry, or separate prompt.

## Install or update

Install this repository in SillyTavern:

```text
https://github.com/DesZiDesu/Pocket-Phone
```

After updating, Pocket Phone automatically clears obsolete code/loader caches and performs one reload. This cleanup does not erase contacts, messages, media, wallet data, feed data, or settings.

## Normal-roleplay integration

The extension can create Pocket Phone events from ordinary SillyTavern assistant responses:

- Incoming text messages and new NPC conversations
- Incoming calls and voice messages
- Stickers, locations, notes, polls, gifts, and contact cards
- Wallet transfers and earnings
- Follow requests

The hidden control command is processed by the extension and removed from the visible roleplay response.

## Optional per-chat phone worlds

Version 0.11.x adds **Per-chat phone worlds**. It is disabled by default.

Enable it from either:

- SillyTavern Extensions settings → Pocket Phone → Per-chat phone worlds
- Pocket Phone → Settings → Per-chat phone worlds

When enabled, each SillyTavern character/group and chat ID receives an independent Pocket Phone world. The following state is isolated:

- Contacts and NPCs
- Direct and group messages
- Chat styles, drafts, unread state, pinned, muted, and archived chats
- Feed posts, comments, likes, stories, highlights, and social lists
- Wallet balance, account details, transactions, requests, and NPC balances
- Call history and notifications
- User/contact notes
- Period logs and sharing state
- Phone activity/action logs

Enabling the feature copies the existing global phone into the currently active SillyTavern chat. Other chats begin with a fresh phone. The original global phone remains preserved, so disabling the feature restores the previous global data. Existing per-chat worlds remain stored and can be enabled again later.

Uploaded media remains in the shared Pocket Phone media store, but each chat world holds separate references to its own media.

## Delete contacts and characters from Pocket Phone

A contact can be deleted in two ways:

1. Open a contact conversation → Chat settings → **Delete contact and all data**.
2. Use the existing delete action in the message/contact list and choose **Delete contact and all associated data** rather than deleting only the conversation.

Deletion purges the contact from the active phone world together with related messages, message media, calls, feed/story activity, wallet records, notifications, notes, social references, and group membership. Groups with fewer than two remaining members are removed.

Deleting a SillyTavern character from Pocket Phone does **not** delete its SillyTavern character card. When per-chat worlds are enabled, deletion affects only the currently active chat world.

## Data behavior

- Per-chat worlds are optional and default to off.
- Existing data is not automatically deleted or moved away.
- The first chat where the option is enabled receives a copy of the existing global phone.
- New SillyTavern chats receive fresh independent phone data.
- Returning to an older chat restores that chat's Pocket Phone world.
- Normal extension updates automatically clear obsolete code and reload once.
- The manual maintenance button remains available as a fallback.

## Architecture

The manifest loads `entry.js`, which provides safe update cleanup, version display, and maintenance controls. It then loads:

- `chat-scope.js` — optional per-chat data routing and contact deletion
- `core.js` — stable normal-roleplay bridge and pinned upstream loader

The upstream Pocket Phone engine remains pinned to commit:

```text
f22ed2fcced366031b6f88271db921ebcf007d32
```

## Limitations

- Phone events are evaluated during normal assistant generation; this is not background activity while SillyTavern is idle.
- Model compliance with hidden phone-event commands varies by model.
- The pinned upstream engine is still delivered through `cdn.jsdelivr.net`; that domain must be reachable for the base phone UI to load.
- The new modules were syntax-validated, but this release has not been exercised in a live SillyTavern browser session from this development environment.
