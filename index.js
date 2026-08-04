// Pocket Phone 0.9.9 compatibility mirror.
// Loads the exact upstream repository snapshot pinned below, then installs
// the Lorebook/normal-roleplay bridge extensions maintained by DesZiDesu.

const POCKET_PHONE_VERSION = '0.9.9';
const POCKET_PHONE_UPSTREAM_COMMIT = 'f22ed2fcced366031b6f88271db921ebcf007d32';
const POCKET_PHONE_SCRIPT_URL = `https://cdn.jsdelivr.net/gh/janzanaja188-cyber/pocket-phone@${POCKET_PHONE_UPSTREAM_COMMIT}/index.js`;
const LOADER_KEY = '__deszidesuPocketPhone099Loader';
const BRIDGE_KEY = '__deszidesuPocketPhoneLorebookBridge';

const EXTENDED_BRIDGE_INSTRUCTION = `[Pocket Phone extended bridge — invisible control tags for the installed Pocket Phone extension.
Use an exact Pocket Phone contact name. Put each tag on its own final line, outside narration and dialogue. Emit a tag only when the event truly happens in the story. Never explain, quote, or roleplay the tags.
Existing contact voice message: [PP_VOICE:Contact Name|spoken words]
Configured sticker: [PP_STICKER:Contact Name|sticker label]
Shared location: [PP_LOCATION:Contact Name|place|optional note]
Contact status/note: [PP_NOTE:Contact Name|short status]
Incoming poll: [PP_POLL:Contact Name|question|option 1|option 2|more options]
Incoming gift: [PP_GIFT:Contact Name|gift name|optional numeric value]
Shared contact card: [PP_CONTACT:Contact Name|Shared Contact Name]
The base Pocket Phone bridge separately supports PP_CALL, PP_MSG, PP_NEWCHAT, PP_PAY, PP_EARN, and PP_FOLLOW. Do not invent other PP_ tags.]`;

function installPocketPhoneLorebookBridge() {
    if (window[BRIDGE_KEY]) return;

    const upstreamInterceptor = window.ppGenInterceptor;
    if (typeof upstreamInterceptor === 'function' && !upstreamInterceptor.__ppLorebookExtended) {
        const wrappedInterceptor = function (...args) {
            upstreamInterceptor.apply(this, args);
            try {
                const chat = args[0];
                const cfg = typeof window.getCfg === 'function' ? window.getCfg() : null;
                if (!cfg?.universeAffectsRP || !Array.isArray(chat)) return;
                if (chat.some(message => String(message?.mes || '').includes('[Pocket Phone extended bridge'))) return;
                chat.push({
                    is_user: false,
                    is_system: true,
                    name: 'PocketPhoneLorebook',
                    mes: EXTENDED_BRIDGE_INSTRUCTION,
                });
            } catch (error) {
                console.warn('[Pocket Phone lorebook bridge] interceptor extension failed', error);
            }
        };
        wrappedInterceptor.__ppLorebookExtended = true;
        wrappedInterceptor.__ppUpstream = upstreamInterceptor;
        window.ppGenInterceptor = wrappedInterceptor;
    }

    const context = (() => {
        try { return window.SillyTavern?.getContext?.(); } catch { return null; }
    })();

    if (!context?.eventSource || !context?.event_types) {
        console.warn('[Pocket Phone lorebook bridge] SillyTavern event API was not available.');
        return;
    }

    let lastFingerprint = '';

    const callGlobal = (name, ...args) => {
        const fn = window[name];
        return typeof fn === 'function' ? fn(...args) : undefined;
    };

    const displayName = contact => {
        try { return callGlobal('dname', contact) || contact?.customName || contact?.name || '?'; }
        catch { return contact?.customName || contact?.name || '?'; }
    };

    const findContactByName = rawName => {
        const name = String(rawName || '').trim();
        const contacts = callGlobal('getContacts') || [];
        return contacts.find(contact => displayName(contact).toLowerCase() === name.toLowerCase())
            || contacts.find(contact => {
                const shown = displayName(contact).toLowerCase();
                const wanted = name.toLowerCase();
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

        const cfg = callGlobal('getCfg');
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
        callGlobal('saveCfg');
        return contact;
    };

    const refreshPhoneViews = contact => {
        try {
            if (callGlobal('ppViewing', contact.id)) callGlobal('renderThread');
            else if (window.ppCurrentScreen === 'messages') callGlobal('renderContactList');
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
            const cfg = callGlobal('getCfg');
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

            if (!found && !/\[PP_(?:VOICE|STICKER|LOCATION|NOTE|POLL|GIFT|CONTACT):/i.test(original)) return;

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
                try { await callGlobal('ppSaveChatNow'); } catch {}
            }
        } catch (error) {
            console.warn('[Pocket Phone lorebook bridge] tag processing failed', error);
        }
    };

    const events = context.event_types;
    if (events.MESSAGE_RECEIVED) context.eventSource.on(events.MESSAGE_RECEIVED, () => setTimeout(parseExtendedTags, 260));
    if (events.CHARACTER_MESSAGE_RENDERED) context.eventSource.on(events.CHARACTER_MESSAGE_RENDERED, () => setTimeout(parseExtendedTags, 260));

    window[BRIDGE_KEY] = {
        version: '1.0.0',
        parseExtendedTags,
        instruction: EXTENDED_BRIDGE_INSTRUCTION,
    };
    console.info('[Pocket Phone lorebook bridge] Installed extended normal-roleplay integration.');
}

if (!window[LOADER_KEY]) {
    window[LOADER_KEY] = new Promise((resolve, reject) => {
        const existing = document.querySelector('script[data-pocket-phone-mirror="0.9.9"]');
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
        script.dataset.pocketPhoneMirror = POCKET_PHONE_VERSION;
        script.addEventListener('load', () => {
            script.dataset.loaded = 'true';
            console.info(`[Pocket Phone mirror] Loaded v${POCKET_PHONE_VERSION} from pinned upstream commit ${POCKET_PHONE_UPSTREAM_COMMIT}.`);
            resolve();
        }, { once: true });
        script.addEventListener('error', () => {
            const error = new Error(`Unable to load Pocket Phone v${POCKET_PHONE_VERSION} from ${POCKET_PHONE_SCRIPT_URL}`);
            console.error('[Pocket Phone mirror]', error);
            try {
                window.toastr?.error('Pocket Phone 0.9.9 could not be downloaded. Check your internet connection and reload SillyTavern.');
            } catch (_) {
                // Notification support is optional.
            }
            reject(error);
        }, { once: true });
        document.head.appendChild(script);
    });
}

window[LOADER_KEY]
    .then(() => installPocketPhoneLorebookBridge())
    .catch(() => {
        // The detailed error is logged above; consume the rejection to avoid an unhandled-promise warning.
    });
