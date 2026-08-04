# Pocket Phone 0.10.3 Stable Recovery

This is the stable recovery build of Pocket Phone for SillyTavern.

It restores the proven normal-roleplay bridge used before the experimental optional feature suite was added. No Lorebook, World Info entry, Author's Note, or separate prompt is required.

## Why the version is 0.10.3

The stable bridge was previously published as 0.9.10. Some SillyTavern installations retained the broken 0.10.2 loader because changing the repository back to a lower version behaved like a downgrade. Version 0.10.3 keeps the stable code while using a higher version number so the extension updater replaces the old files.

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

## Update or reinstall

Use this repository in SillyTavern:

```text
https://github.com/DesZiDesu/Pocket-Phone
```

After updating, fully close all SillyTavern tabs, restart the SillyTavern server, and reopen the browser. The Extensions panel should report **0.10.3**.

Do not select **Clean extension data** when reinstalling unless you intentionally want to remove stored Pocket Phone contacts, messages, wallet data, and settings.

## Required Pocket Phone settings

- Bot/NPC cross-chat
- Affects main roleplay
- Bot can call automatically

The build enables these once for installations that have not completed the stable bridge migration. Later manual changes are respected.

## Architecture

The extension loads the proven upstream Pocket Phone 0.9.9 engine pinned to commit:

```text
f22ed2fcced366031b6f88271db921ebcf007d32
```

The visible in-phone version label is changed to **Pocket Phone 0.10.3 Stable** so it is no longer confused with the upstream engine version.

## Limitation

The pinned base engine is currently delivered through `cdn.jsdelivr.net`. If that domain is blocked by the browser, network, DNS filter, proxy, or content blocker, the stable base cannot download. The console will then show a specific stable-loader error rather than the obsolete 0.10.x optional-suite error.
