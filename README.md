# Pocket Phone 0.10.5 Stable Recovery

This is the stable recovery build of Pocket Phone for SillyTavern. It restores the proven normal-roleplay bridge used before the experimental optional feature suite was added. No Lorebook, World Info entry, Author's Note, or separate prompt is required.

## Automatic cleanup after updates

Starting with 0.10.5, Pocket Phone stores the last successfully loaded extension version. On the first page load after the version changes, it automatically:

- Removes obsolete Pocket Phone loader globals
- Removes old optional-suite script and style nodes
- Removes stale loader-only storage keys
- Deletes cached Pocket Phone code resources from Cache Storage when available
- Loads the current local `core.js` with a version and recovery cache-busting query

This cleanup runs once per version. It does not delete contacts, messages, media, wallet data, feed posts, stories, groups, or Pocket Phone settings.

The extension cannot receive SillyTavern's Update-button click as a direct browser event. The cleanup therefore runs automatically on the first SillyTavern page load after an updated version is installed, which produces the intended result without requiring a separate manual cleanup.

A manual recovery button remains available under **Extensions → Pocket Phone Recovery** and inside Pocket Phone settings.

## Included

- Automatic incoming text events during normal roleplay generation
- New NPC phone conversations
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
- Hidden command cleanup from the visible roleplay response

## Not included

The experimental optional feature suite from 0.10.0–0.10.2 is not loaded or referenced by this release.

## Install or update

Use this repository in SillyTavern:

```text
https://github.com/DesZiDesu/Pocket-Phone
```

After updating, reload SillyTavern. The Extensions panel should report **0.10.5**. The automatic cleanup then runs once before the stable core loads.

Do not select **Clean extension data** unless you intentionally want to remove stored Pocket Phone contacts, messages, wallet data, and settings.

## Required Pocket Phone settings

- Bot/NPC cross-chat
- Affects main roleplay
- Bot can call automatically

The build enables these once for installations that have not completed the stable bridge migration. Later manual changes are respected.

## Architecture

The local `index.js` is a lightweight recovery loader. The stable bridge is stored in local `core.js`, which then loads the proven upstream Pocket Phone 0.9.9 engine pinned to commit:

```text
f22ed2fcced366031b6f88271db921ebcf007d32
```

The pinned base engine is currently delivered through `cdn.jsdelivr.net`. If that domain is blocked by the browser, network, DNS filter, proxy, or content blocker, the base engine cannot download.