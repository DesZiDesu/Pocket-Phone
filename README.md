# Pocket Phone 0.10.1 — SillyTavern integration fork

This fork packages Pocket Phone's normal-roleplay integration directly inside the extension. No Lorebook, World Info entry, Author's Note, or separate prompt is required.

Version 0.10.0 added an optional feature suite. **Every feature added by the suite defaults to off and can be enabled or disabled independently.** Version 0.10.1 corrects the stale in-phone 0.9.9 version label inherited from the pinned upstream engine.

## Install or update

In SillyTavern, open **Extensions → Install Extension** and use:

```text
https://github.com/DesZiDesu/Pocket-Phone
```

For an existing installation, use the extension update button and fully reload SillyTavern. The Extensions panel and Pocket Phone settings footer should report **0.10.1**.

## Open the optional features

1. Open Pocket Phone.
2. Open **Settings**.
3. Scroll to **Optional feature suite**.
4. Press **Open optional features**.
5. Enable only the systems you want.

Nothing in the optional suite is activated automatically.

## Built-in normal-chat integration

The extension registers `ppGenInterceptor` and supplies the Pocket Phone event contract during ordinary SillyTavern roleplay generation. The existing **Affects main roleplay** Pocket Phone setting remains the master control for normal-chat events.

Supported direct events include text messages, new NPC chats, calls, voice messages, stickers, locations, notes, polls, gifts, contact cards, transfers, earnings, and follow requests. Enabled optional systems add image, social, calendar, reminder, reaction, and world-memory commands.

## Optional feature suite

### Autonomy and world intelligence

- **Autonomous NPC activity** — contacts may independently message, call, send voice notes, post, create stories, or send gifts while SillyTavern remains open.
- **Per-contact controls** — individual permissions for messages, calls, voice, social activity, gifts, payments, quiet-hour exceptions, aliases, TTS voice, availability, and extra cooldowns.
- **Contact availability and routines** — configurable days and available hours.
- **Structured world memory** — persistent facts included in Pocket Phone generation context.
- **Contact alias resolver** — maps nicknames and alternate names to saved contacts.
- Adjustable autonomy interval, probability, cooldown, maximum events per hour, and quiet hours.

### Messages and notifications

- **Real scheduler** — persisted message, call, voice, note, gift, and reminder events with one-time, daily, or weekly recurrence.
- **Delivery and read receipts** — sent, delivered, and read states with configurable delay.
- **Message reactions** — user reactions by double-clicking a message and optional NPC reaction commands.
- **Browser TTS** — voice-message playback with rate, pitch, volume, autoplay, and per-contact browser voice selection.
- **Browser notifications** — native notifications with optional previews and explicit browser permission.

### Media, social, and planning

- **Image-message bridge** — accepts an image URL or calls a configurable HTTP image endpoint.
- **Feed and story bridge** — roleplay or autonomy can create posts, text stories, comments, and likes.
- **Calendar and reminders** — proposed events may be accepted or deleted; accepted events notify when due.

The optional image endpoint receives:

```json
{
  "prompt": "image description",
  "contact": "Contact Name"
}
```

It may return JSON containing `dataUrl` or `url`, or return an image response directly. A bearer key can be configured in the feature-suite settings.

### Reliability and data

- **Full backup and restore** — exports Pocket Phone configuration, contacts, threads, calls, wallet data, feed, stories, suite settings, and stored media.
- **Diagnostics** — command-processing logs, capability report, test message, test notification, and JSON export.
- **Event deduplication and transactions** — persistent event hashes and processing status.
- **Optional offline upstream cache** — caches the pinned upstream JavaScript after a successful load and can use it if the network later fails. This takes effect after reload.

## Important behavior

- All optional features start disabled.
- Contact policies only apply when **Per-contact controls** is enabled.
- Availability schedules only apply when **Contact availability and routines** is enabled.
- Autonomous activity and scheduled events run only while SillyTavern is open in the browser. Overdue scheduled events are evaluated after the extension is active again.
- Native browser notifications require permission and may be limited by browser or operating-system policy.
- Browser TTS uses voices installed or exposed by the current browser.
- Image URLs and custom image endpoints may be blocked by CORS or content-security rules.
- Model compliance varies. Stronger models generally follow hidden event commands more reliably.

## Implementation

The manifest declares:

```json
"generate_interceptor": "ppGenInterceptor"
```

The local loader registers the interceptor synchronously, loads the pinned upstream 0.9.9 implementation, then concatenates and executes the local optional feature-suite modules. Version 0.10.1 replaces the inherited visible `Pocket Phone 0.9.9` footer with the fork version so the displayed number is no longer misleading.

Pinned upstream commit:

```text
f22ed2fcced366031b6f88271db921ebcf007d32
```

Upstream repository:

```text
https://github.com/janzanaja188-cyber/pocket-phone
```

## Quick verification

After updating and reloading:

1. Confirm the Extensions panel shows **0.10.1**.
2. Open Pocket Phone Settings and confirm the footer also shows **0.10.1**.
3. Confirm the **Optional feature suite** card appears.
4. Open **Diagnostics**, enable it, and use **Test message** with at least one saved contact.
5. Enable other systems individually after the basic test succeeds.
