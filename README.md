# Pocket Phone 0.9.10 — SillyTavern integration fork

This fork packages Pocket Phone's normal-roleplay integration directly inside the extension. No Lorebook, World Info entry, Author's Note, or separate prompt is required.

It is based on upstream Pocket Phone 0.9.9 and also fixes the stale upstream manifest that reported version 0.9.6.

## Install or update

In SillyTavern, open **Extensions → Install Extension** and use:

```text
https://github.com/DesZiDesu/Pocket-Phone
```

For an existing installation, use the extension update button, then fully reload SillyTavern. The Extensions panel should report **0.9.10**.

## Built-in normal-chat integration

The extension registers its generation interceptor immediately and injects the full Pocket Phone command contract during ordinary SillyTavern roleplay generation.

On the first run of this version, it enables these Pocket Phone settings once:

- Bot/NPC cross-chat
- Affects main roleplay
- Bot can call automatically

After that one-time migration, manually turning a setting off is respected.

A character or NPC can create these Pocket Phone events from an ordinary SillyTavern response:

- Existing-contact text message
- New NPC conversation
- Incoming call
- Voice message
- Sticker
- Shared location
- Contact status/note
- Poll
- Gift
- Shared contact card
- Incoming wallet transfer
- Story-earned money
- Follow or follow request

The extension processes the hidden control command, creates the corresponding phone event, notification and unread state, then removes the command from the visible roleplay response.

## Usage

Chat normally in SillyTavern. When the current scene gives a character a believable reason to contact you privately, the model may initiate the appropriate Pocket Phone event automatically.

No command needs to be typed by the user and no Lorebook needs to be attached to the character.

For best results, make sure the relevant NPC exists as a Pocket Phone contact. A new NPC can still create a first conversation automatically and will be added as a contact.

## Implementation

The local manifest declares:

```json
"generate_interceptor": "ppGenInterceptor"
```

The interceptor function is registered synchronously by the local loader, so SillyTavern can resolve it even before the pinned upstream script finishes loading.

The extension loads the exact upstream 0.9.9 snapshot at commit:

```text
f22ed2fcced366031b6f88271db921ebcf007d32
```

Upstream repository:

```text
https://github.com/janzanaja188-cyber/pocket-phone
```

## Limits

- Phone events are evaluated after a normal SillyTavern assistant generation. This is not a background timer while the chat is idle.
- Model compliance varies. Stronger models generally follow the hidden event contract more reliably.
- Image messages require actual media stored by Pocket Phone and are not fabricated from text commands.
- The pinned upstream JavaScript and stylesheet are delivered through jsDelivr, so an internet connection is required when the extension loads.
