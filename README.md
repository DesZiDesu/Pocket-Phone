# Pocket Phone 0.11.3

Pocket Phone integration fork for SillyTavern. It keeps the stable upstream 0.9.9 phone engine, includes the normal-roleplay bridge directly in the extension, and does not require a Lorebook, World Info entry, or separate prompt.

## Install or update

Install this repository in SillyTavern:

```text
https://github.com/DesZiDesu/Pocket-Phone
```

After updating, Pocket Phone automatically clears obsolete code/loader caches and performs one reload. This cleanup preserves contacts, messages, media, wallet data, feed data, per-chat worlds, and settings.

## AI Feed generator fixes

Version 0.11.3 replaces the original AI Feed generator with a direct robust implementation. It no longer excludes the active main character when `Affects main roleplay` is enabled.

The generator accepts results returned as:

- Plain strings
- Arrays
- Objects with `text`, `content`, `message`, `response`, `result`, or `output_text`
- OpenAI-style `choices`, message/content objects, and nested output structures
- JSON posts containing `post`, `caption`, `text`, `content`, `message`, or `body`
- Quoted text, markdown lines, or ordinary unquoted text

This fixes the previous case where a backend returned an object and Pocket Phone interpreted it as `[object Object]`, resulting in “bot did not post, try again.” The generator retries up to three times and displays the actual error message when generation still fails.

## Request feed posts from normal SillyTavern chat

A saved Pocket Phone contact or the current character can be told to post through the ordinary SillyTavern chat. The post is created after the next assistant response finishes.

Examples:

```text
ฮานะ โพสต์ลงฟีด
ฮานะ ช่วยโพสต์ลงฟีดเกี่ยวกับวันนี้
บอกฮานะให้โพสต์ลงฟีดว่า วันนี้อากาศดีจัง
Have Hana post to the feed
Hana post to the feed: Today was better than expected
```

Behavior:

1. Pocket Phone detects the contact name and the feed-post request.
2. The generation interceptor asks the assistant to append an invisible `PP_POST` command.
3. The command is converted into a real Pocket Phone feed post and removed from the visible roleplay response.
4. If the assistant does not return the command, Pocket Phone performs a quiet fallback generation and creates the post automatically.
5. Text written after `ว่า`, `:` or `caption:` is posted directly without another generation.

Internal command format:

```text
[PP_POST:Contact Name|post text]
```

Users do not need to type this command manually.

The post is saved in the currently active phone world. With Per-chat phone worlds enabled, it appears only in that SillyTavern chat.

## Other normal-roleplay phone events

The extension can also create:

- Incoming messages and new NPC conversations
- Incoming calls and voice messages
- Stickers, locations, notes, polls, gifts, and contact cards
- Wallet transfers and earnings
- Follow requests

Hidden control commands are processed by the extension and removed from the visible roleplay response.

## Optional per-chat phone worlds

**Per-chat phone worlds** is disabled by default. Enable it from either:

- SillyTavern Extensions settings → Pocket Phone → Per-chat phone worlds
- Pocket Phone → Settings → Per-chat phone worlds

When enabled, each SillyTavern character/group and chat ID receives independent contacts, messages, feed, wallet, calls, notifications, notes, groups, periods, and activity history.

The first active chat receives a copy of the existing global phone. Other chats begin with fresh data. The original global phone remains preserved and returns when the option is disabled.

## Delete contacts and characters from Pocket Phone

Delete a contact from:

1. Contact conversation → Chat settings → **Delete contact and all data**
2. The existing delete action → **Delete contact and all associated data**

Deletion removes related messages, media references, calls, feed/story activity, wallet records, notifications, notes, social references and group membership from the active phone world. It does not delete the SillyTavern character card.

## Architecture

The manifest loads `entry.js`, which provides safe update cleanup, version display and maintenance controls. It then loads:

- `chat-scope.js` — optional per-chat data routing and contact deletion
- `core.js` — stable normal-roleplay bridge and pinned upstream loader
- `feed-fix.js` — result normalization and normal-chat feed requests
- `feed-generator-override.js` — direct replacement for the phone AI Feed button

The upstream Pocket Phone engine remains pinned to commit:

```text
f22ed2fcced366031b6f88271db921ebcf007d32
```

## Console diagnostics

After a successful load, the console should include:

```text
[Pocket Phone 0.11.3] Stable core, per-chat worlds, and feed bridge loaded.
[Pocket Phone 0.11.2] Robust feed generation and normal-chat feed bridge installed.
[Pocket Phone 0.11.3] Direct AI Feed generator override installed.
```

A manual diagnostic helper is available:

```javascript
PP_FEED_BRIDGE.generatePostFor('Hana', 'Post something about today')
```

## Limitations

- Feed and phone events run after an assistant generation; they are not background activity while SillyTavern is idle.
- Contact-name detection is most reliable when the typed name matches the Pocket Phone display name.
- The pinned upstream engine is delivered through `cdn.jsdelivr.net`; that domain must be reachable for the base phone UI to load.
- The new modules were syntax-validated, but this release has not been exercised in a live SillyTavern browser session from this development environment.
