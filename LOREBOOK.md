# Pocket Phone Lorebook Integration

This repository includes an importable SillyTavern World Info/Lorebook:

- `Pocket-Phone-Lorebook.json`

It reinforces Pocket Phone's normal-roleplay bridge and documents every event that the mirror can currently turn into Pocket Phone UI data.

## Install and enable

1. Update or reinstall the extension from `https://github.com/DesZiDesu/Pocket-Phone` and reload SillyTavern.
2. Open **World Info / Lorebooks** in SillyTavern.
3. Choose **Import World Info** and select `Pocket-Phone-Lorebook.json`.
4. Enable the imported book globally, or attach it to the relevant character/chat.
5. Open **Pocket Phone → Settings → Shared Universe**.
6. Enable **Bot/NPC cross-chat** and **Affects main roleplay**.
7. Enable **Bot can call automatically** under the phone settings.

The mirror now restores the manifest's `generate_interceptor`, so Pocket Phone injects its bridge instructions during ordinary SillyTavern generation. The Lorebook reinforces behavior and formatting for models that otherwise ignore extension instructions.

## Supported ordinary-roleplay events

| Event | Control tag |
|---|---|
| Existing contact text | `[PP_MSG:Name|message]` |
| New NPC first message | `[PP_NEWCHAT:Name|message]` |
| Incoming call | `[PP_CALL:Name]` |
| Voice message | `[PP_VOICE:Name|spoken words]` |
| Sticker | `[PP_STICKER:Name|configured label]` |
| Location | `[PP_LOCATION:Name|place|note]` |
| Status note | `[PP_NOTE:Name|status]` |
| Poll | `[PP_POLL:Name|question|option 1|option 2]` |
| Gift | `[PP_GIFT:Name|gift name|numeric value]` |
| Contact card | `[PP_CONTACT:Name|Shared Contact Name]` |
| Incoming payment | `[PP_PAY:Name|amount|reason]` |
| Story-earned money | `[PP_EARN:amount|reason]` |
| Follow/request | `[PP_FOLLOW:Name]` |

The extension removes these tags from the visible roleplay response after converting them into Pocket Phone events.

## Important limitations

- The model must use the contact's exact Pocket Phone display name.
- Lorebook instructions improve compliance but cannot guarantee that every model will emit a command.
- Incoming events are processed after a normal SillyTavern assistant response. This is not a background timer while the chat is idle.
- Image messages require actual media stored by Pocket Phone. A Lorebook cannot create uploaded image data, so no fake image command is provided.
- Feed posts, stories, group administration, voting, accepting transfers, and other user-operated controls remain inside the phone UI unless a dedicated bridge command exists.

## Test

Use an existing Pocket Phone contact, then send this ordinary roleplay message:

> We separate after the meeting. If you discover anything important later, contact me privately.

A contextually appropriate reply may end with an invisible command such as:

```text
[PP_MSG:Exact Contact Name|I found something. Call me when you're alone.]
```
