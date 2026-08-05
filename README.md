# Pocket Phone 0.11.0

Pocket Phone integration fork for SillyTavern. It keeps the stable upstream 0.9.9 phone engine, includes the normal-roleplay bridge directly in the extension, and does not require a Lorebook, World Info entry, or separate prompt.

## Install or update

Install this repository in SillyTavern:

```text
https://github.com/DesZiDesu/Pocket-Phone
```

After updating, reload SillyTavern. Version 0.11.0 automatically clears obsolete Pocket Phone code/loader caches on its first load after the update. It does not erase contacts, messages, media, wallet data, feed data, or settings.

## Normal-roleplay integration

The extension can create Pocket Phone events from ordinary SillyTavern assistant responses:

- Incoming text messages
- New NPC conversations
- Incoming calls
- Voice messages
- Stickers
- Locations
- Contact notes
- Polls
- Gifts
- Shared contact cards
- Wallet transfers and earnings
- Follow requests

The hidden control command is processed by the extension and removed from the visible roleplay response.

## Optional per-chat phone worlds

Version 0.11.0 adds **Per-chat phone worlds**. This feature is disabled by default.

Enable it from either:

- SillyTavern Extensions settings → Pocket Phone → Per-chat phone worlds
- Pocket Phone → Settings → Per-chat phone worlds

When enabled, every SillyTavern chat receives its own independent Pocket Phone world. The following data is isolated by character/group and SillyTavern chat ID:

- Contacts and NPCs
- Direct and group message history
- Chat styles, drafts, unread state, pinned/muted/archived chats
- Feed posts, comments, likes, stories, highlights, and social lists
- Wallet balance, account details, transactions, requests, and NPC balances
- Call history
- Notifications
- User/contact notes
- Period logs and sharing state
- Phone activity/action logs

Enabling the feature copies the existing global phone into the currently active SillyTavern chat. Other chats begin with a fresh phone. The original global phone is preserved, so disabling the feature restores the previous global data. Existing per-chat worlds remain stored and can be enabled again later.

Uploaded media remains in the shared Pocket Phone media store, but each chat world keeps separate references to its own media.

## Delete contacts and characters from Pocket Phone

A contact can now be deleted in two ways:

1. Open a contact conversation → Chat settings → **Delete contact and all data**.
2. Use the existing delete action from the message/contact list and choose **Delete contact and all associated data** instead of deleting only the conversation.

Deleting a Pocket Phone contact removes that contact from the active phone world and purges related:

- Messages and uploaded message media
- Call records
- Feed posts, stories, comments, likes, and social references
- Wallet records and NPC wallet balance
- Notifications and notes
- Group memberships; groups with fewer than two remaining members are removed
- Contact-specific activity entries

Deleting a SillyTavern character from Pocket Phone does **not** delete the character card from SillyTavern. When per-chat worlds are enabled, deletion affects only the currently active chat world.

## Data and migration behavior

- Per-chat worlds are optional and default to off.
- Existing Pocket Phone data is not automatically moved away or deleted.
- The first chat where per-chat worlds is enabled receives a copy of the existing global phone.
- New SillyTavern chats receive fresh independent phone data.
- Switching back to an older SillyTavern chat restores that chat's Pocket Phone world.
- The manual maintenance button remains available as a fallback, but normal updates clean old code caches automatically.

## Architecture

The manifest loads `main.js`, which provides update cleanup, version display, and maintenance controls. It then loads:

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
- This release was syntax-validated, but it has not been exercised in a live SillyTavern browser session from this development environment.
