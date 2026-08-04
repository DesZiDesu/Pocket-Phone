// Pocket Phone 0.9.10 integration fork.
// Loads the pinned upstream Pocket Phone 0.9.9 implementation, then installs
// a built-in normal-roleplay bridge. No Lorebook is required.

const POCKET_PHONE_VERSION = '0.9.10';
const POCKET_PHONE_UPSTREAM_VERSION = '0.9.9';
const POCKET_PHONE_UPSTREAM_COMMIT = 'f22ed2fcced366031b6f88271db921ebcf007d32';
const POCKET_PHONE_SCRIPT_URL = `https://cdn.jsdelivr.net/gh/janzanaja188-cyber/pocket-phone@${POCKET_PHONE_UPSTREAM_COMMIT}/index.js`;
const LOADER_KEY = '__deszidesuPocketPhoneLoader';
const BRIDGE_KEY = '__deszidesuPocketPhoneNormalRoleplayBridge';
const BRIDGE_MIGRATION_KEY = 'normalRoleplayBridgeV1';

const NORMAL_ROLEPLAY_INSTRUCTION = `[Pocket Phone normal-roleplay integration — invisible machine commands for the installed Pocket Phone extension.
Write the ordinary roleplay response normally. Only when a phone-side event truly happens, append the appropriate command on its own final line, outside narration and dialogue. Never explain, quote, roleplay, or put these commands in a code fence. Use exact saved Pocket Phone contact names whenever possible. Do not force phone activity every turn. Never decide that the user answered, accepted, read, paid, followed, voted, or picked up unless that already happened.

Existing contact sends text: [PP_MSG:Contact Name|message]
New NPC starts first phone thread: [PP_NEWCHAT:New NPC Name|first message]
Existing contact starts incoming call: [PP_CALL:Contact Name]
Existing contact sends voice message: [PP_VOICE:Contact Name|spoken transcription]
Existing contact sends configured sticker: [PP_STICKER:Contact Name|exact sticker label]
Existing contact shares location: [PP_LOCATION:Contact Name|place|optional note]
Existing contact changes status/note: [PP_NOTE:Contact Name|short status]
Existing contact sends poll: [PP_POLL:Contact Name|question|option 1|option 2|more options]
Existing contact sends gift: [PP_GIFT:Contact Name|gift name|optional whole-number value]
Existing contact shares another saved contact: [PP_CONTACT:Contact Name|Shared Contact Name]
Existing contact transfers money to the user: [PP_PAY:Contact Name|whole-number amount|reason]
User earns money from a story event without a specific sender: [PP_EARN:whole-number amount|reason]
Existing contact follows or requests to follow the user: [PP_FOLLOW:Contact Name]

Rules: one command per line; multiple commands are allowed only when multiple events really occur. Amounts use positive whole digits without commas or currency symbols. Do not put ] inside fields. Use PP_NEWCHAT only for someone not already saved. Do not invent other PP_ commands.]`;

function installPocketPhoneNormalRoleplayBridge() {
    if (window[BRIDGE_KEY]) return;

    const context = (() => {
        try { return window.SillyTavern?.getContext?.(); } catch { return null; }
    })();

    if (!context) {
        console.warn('[Pocket Phone bridge] SillyTavern context was not available.');
        return;
    }

    const callGlobal = (name, ...args) => {
        const fn = window[name];
        return typeof fn === 'function' ? fn(...args) : undefined;
    };

    const getConfig = () => {
        try {
            return callGlobal('getCfg')
                || context.extensionSettings?.['pocket-phone']
                || null;
        } catch {
            return context.extensionSettings?.['pocket-phone'] || null;
        }
    };

    const saveSettings = () => {
        try {
            if (typeof context.saveSettingsDebounced === 'function') context.saveSettingsDebounced();
            else callGlobal('saveCfg');
        } catch {}
    };

    // One-time migration: enable the bridge for existing installations. After this,
    // users can turn the settings off and the extension will respect that choice.
    const initialConfig = getConfig();
    if (initialConfig && !initialConfig[BRIDGE_MIGRATION_KEY]) {
        initialConfig.sharedUniverse = true;
        initialConfig.universeAffectsRP = true;
        initialConfig.botCallKeyword = true;
        initialConfig[BRIDGE_MIGRATION_KEY] = true;
        saveSettings();
        try { window.toastr?.info('Pocket Phone normal-chat integration is enabled.'); } catch {}
    }

    const upstreamInterceptor = window.ppGenInterceptor;
    if (typeof upstreamInterceptor === 'function' && !upstreamInterceptor.__ppNormalRoleplayBridge) {
        const wrappedInterceptor = function (...args) {
            upstreamInterceptor.apply(this, args);
            try {
                const chat = args[0];
                const cfg = getConfig();
                if (!cfg?.universeAffectsRP || !Array.isArray(chat)) return;
                if (chat.some(message => String(message?.mes || '').includes('[Pocket Phone normal-roleplay integration'))) return;
                chat.push({
                    is_user: false,
                    is_system: true,
                    name: 'PocketPhoneBridge',
                    mes: NORMAL_ROLEPLAY_INSTRUCTION,
                });
            } catch (error) {
                console.warn('[Pocket Phone bridge] generation instruction failed', error);
            }
        };
        wrappedInterceptor.__ppNormalRoleplayBridge = true;
        wrappedInterceptor.__ppUpstream = upstreamInterceptor;
        window.ppGenInterceptor = wrappedInterceptor;
    }

    if (!context.eventSource || !context.event_types) {
        console.warn('[Pocket Phone bridge] SillyTavern event API was not available.');
        return;
    }

    let lastFingerprint = '';

    const displayName = contact => {
        try { return callGlobal('dname', contact) || contact?.customName || contact?.name || '?'; }
        catch { return contact?.customName || contact?.name || '?'; }
    };

    const findContactByName = rawName => {
        const name = String(rawName || '').trim();
        const contacts = callGlobal('getContacts') || [];
        const wanted = name.toLowerCase();
        return contacts.find(contact => displayName(contact).toLowerCase() === wanted)
            || contacts.find(contact => {
                const shown = displayName(contact).toLowerCase();
                return wanted && (wanted.includes(shown) || shown.includes(wanted));
            })
            || null;
    };

    const makeId = () => {
        try { return callGlobal('newId') || `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`; }
        catch { return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`; }
    };

    const resolveOrCreateContact = rawName => {
        const name = String(rawName || '').trim();
        if (!name) return null;
        const existing = findContactByName(name);
        if (existing) return existing;

        const cfg = getConfig();
        if (!cfg || !Array.isArray(cfg.contacts)) return null;

        let matchedCharacter = null;
        try {
            const characters = callGlobal('listStCharacters') || [];
            matchedCharacter = characters.find(character => String(character?.name || '').toLowerCase() === name.toLowerCase()) || null;
        } catch {}

        const contact = matchedCharacter
            ? { id: matchedCharacter.id, name: matchedCharacter.name, avatar: matchedCharacter.avatar }
            : { id: `npc:${makeId()}`, name, avatar: '', npc: true };
        cfg.contacts.push(contact);
        saveSettings();
        return contact;
    };

    const refreshPhoneViews = contact => {
        try {
            if (callGlobal('ppViewing', contact.id)) callGlobal('renderThread');
            else callGlobal('renderContactList');
            callGlobal('updateHomeWidgets');
        } catch {}
    };

    const notifyIncoming = (contact, kind, preview) => {
        try { callGlobal('bumpUnread', contact.id, 1); } catch {}
        try { callGlobal('pushNotif', contact.id, kind, preview); } catch {}
        try { callGlobal('islandNotify', contact, preview); } catch {}
        refreshPhoneViews(contact);
    };

    const pushIncoming = (contact, message, kind, preview) => {
        if (!contact || !message) return false;
        callGlobal('pushThreadMsg', contact.id, { from: 'them', ...message });
        notifyIncoming(contact, kind || 'msg', preview || displayName(contact));
        return true;
    };

    const parseExtendedTags = async () => {
        try {
            const cfg = getConfig();
            if (!cfg?.universeAffectsRP) return;

            const current = window.SillyTavern?.getContext?.();
            if (!current || !Array.isArray(current.chat) || !current.chat.length) return;
            const last = current.chat[current.chat.length - 1];
            if (!last || last.is_user) return;

            const original = String(last.mes || '');
            const fingerprint = `${original.length}|${original.slice(0, 48)}|${original.slice(-48)}`;
            if (fingerprint === lastFingerprint) return;
            lastFingerprint = fingerprint;

            let found = false;
            const tagPattern = /\[PP_(VOICE|STICKER|LOCATION|NOTE|POLL|GIFT|CONTACT):\s*([^\]]+)\]/gi;
            let match;
            while ((match = tagPattern.exec(original))) {
                const type = match[1].toUpperCase();
                const parts = String(match[2]).split('|').map(part => part.trim());
                const senderName = parts.shift() || '';
                const contact = resolveOrCreateContact(senderName);
                if (!contact) continue;

                if (type === 'VOICE') {
                    const text = parts.join('|').trim();
                    if (text) {
                        const duration = Math.min(60, Math.max(2, Math.round(text.length / 8)));
                        found = pushIncoming(contact, { type: 'voice', text, dur: duration }, 'msg', `Voice message from ${displayName(contact)}`) || found;
                    }
                } else if (type === 'STICKER') {
                    const label = parts.join('|').trim();
                    const sticker = callGlobal('findStickerByLabel', label);
                    if (sticker?.url) {
                        found = pushIncoming(contact, { type: 'sticker', url: sticker.url, label: sticker.label || label }, 'msg', `${displayName(contact)} sent a sticker`) || found;
                    } else if (label) {
                        found = pushIncoming(contact, { text: `[Sticker: ${label}]` }, 'msg', `${displayName(contact)} sent a sticker`) || found;
                    }
                } else if (type === 'LOCATION') {
                    const place = parts.shift() || '';
                    const note = parts.join('|').trim();
                    if (place) found = pushIncoming(contact, { type: 'location', place, note }, 'msg', `${displayName(contact)} shared ${place}`) || found;
                } else if (type === 'NOTE') {
                    const status = parts.join('|').trim();
                    if (status) {
                        callGlobal('setBotNote', contact.id, status);
                        callGlobal('pushNotif', contact.id, 'note', `${displayName(contact)} updated their status: ${status}`);
                        callGlobal('updateHomeWidgets');
                        found = true;
                    }
                } else if (type === 'POLL') {
                    const question = parts.shift() || '';
                    const options = parts.filter(Boolean).slice(0, 8);
                    if (question && options.length >= 2) {
                        found = pushIncoming(contact, {
                            type: 'poll',
                            question,
                            options: options.map(text => ({ text, votes: [] })),
                        }, 'msg', `${displayName(contact)} sent a poll`) || found;
                    }
                } else if (type === 'GIFT') {
                    const giftName = parts.shift() || '';
                    const amount = Math.max(0, Number.parseInt(parts.shift() || '0', 10) || 0);
                    if (giftName) found = pushIncoming(contact, { type: 'gift', giftName, amount }, 'msg', `${displayName(contact)} sent ${giftName}`) || found;
                } else if (type === 'CONTACT') {
                    const sharedName = parts.join('|').trim();
                    const shared = findContactByName(sharedName);
                    if (shared) {
                        found = pushIncoming(contact, {
                            type: 'contactcard',
                            cardId: shared.id,
                            cardName: displayName(shared),
                        }, 'msg', `${displayName(contact)} shared ${displayName(shared)}'s contact`) || found;
                    }
                }
            }

            const hasExtendedTag = /\[PP_(?:VOICE|STICKER|LOCATION|NOTE|POLL|GIFT|CONTACT):/i.test(original);
            if (!found && !hasExtendedTag) return;

            const cleaned = original
                .replace(/\[PP_(?:VOICE|STICKER|LOCATION|NOTE|POLL|GIFT|CONTACT):[^\]]*\]/gi, '')
                .replace(/[ \t]{2,}/g, ' ')
                .replace(/\n{3,}/g, '\n\n')
                .trim();

            if (cleaned !== original) {
                last.mes = cleaned;
                const index = current.chat.length - 1;
                try {
                    const node = document.querySelector(`#chat .mes[mesid="${index}"] .mes_text`);
                    if (node && typeof current.messageFormatting === 'function') {
                        node.innerHTML = current.messageFormatting(cleaned, last.name, false, false, index);
                    }
                } catch {}
                try {
                    if (typeof current.saveChatDebounced === 'function') current.saveChatDebounced();
                    else if (typeof current.saveChat === 'function') await current.saveChat();
                    else await callGlobal('ppSaveChatNow');
                } catch {}
            }
        } catch (error) {
            console.warn('[Pocket Phone bridge] tag processing failed', error);
        }
    };

    const events = context.event_types;
    if (events.MESSAGE_RECEIVED) context.eventSource.on(events.MESSAGE_RECEIVED, () => setTimeout(parseExtendedTags, 260));
    if (events.CHARACTER_MESSAGE_RENDERED) context.eventSource.on(events.CHARACTER_MESSAGE_RENDERED, () => setTimeout(parseExtendedTags, 260));

    window[BRIDGE_KEY] = {
        version: '1.1.0',
        parseExtendedTags,
        instruction: NORMAL_ROLEPLAY_INSTRUCTION,
    };
    console.info('[Pocket Phone bridge] Built-in normal-roleplay integration installed. No Lorebook required.');
}

if (!window[LOADER_KEY]) {
    window[LOADER_KEY] = new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[data-pocket-phone-mirror="${POCKET_PHONE_UPSTREAM_VERSION}"]`);
        if (existing) {
            if (existing.dataset.loaded === 'true') resolve();
            else {
                existing.addEventListener('load', resolve, { once: true });
                existing.addEventListener('error', reject, { once: true });
            }
            return;
        }

        const script = document.createElement('script');
        script.src = POCKET_PHONE_SCRIPT_URL;
        script.async = false;
        script.dataset.pocketPhoneMirror = POCKET_PHONE_UPSTREAM_VERSION;
        script.addEventListener('load', () => {
            script.dataset.loaded = 'true';
            console.info(`[Pocket Phone ${POCKET_PHONE_VERSION}] Loaded upstream ${POCKET_PHONE_UPSTREAM_VERSION} from pinned commit ${POCKET_PHONE_UPSTREAM_COMMIT}.`);
            resolve();
        }, { once: true });
        script.addEventListener('error', () => {
            const error = new Error(`Unable to load Pocket Phone ${POCKET_PHONE_UPSTREAM_VERSION} from ${POCKET_PHONE_SCRIPT_URL}`);
            console.error('[Pocket Phone mirror]', error);
            try {
                window.toastr?.error('Pocket Phone could not be downloaded. Check your internet connection and reload SillyTavern.');
            } catch {}
            reject(error);
        }, { once: true });
        document.head.appendChild(script);
    });
}

window[LOADER_KEY]
    .then(() => installPocketPhoneNormalRoleplayBridge())
    .catch(() => {
        // The detailed load error is logged above.
    });
