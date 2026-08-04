
async function processFeatureTag(type, payload) {
    const parts = String(payload || '').split('|').map(part => part.trim());
    const upper = String(type || '').toUpperCase();

    if (upper === 'REMINDER') {
        const title = parts.shift() || '';
        const dateText = parts.shift() || '';
        const note = parts.join('|');
        return addCalendarEvent(null, title, dateText, note, false);
    }
    if (upper === 'MEMORY') {
        const subject = parts.shift() || '';
        const fact = parts.join('|');
        return Boolean(subject && fact && addMemory(subject, fact));
    }

    const senderName = parts.shift() || '';
    const createContact = upper !== 'CONTACT';
    const contact = findContactByName(senderName, createContact);
    if (!contact) return false;

    if (upper === 'VOICE') {
        if (!canContact(contact, 'voice')) return false;
        const text = parts.join('|').trim();
        if (!text) return false;
        const ok = pushIncoming(contact, {
            type: 'voice',
            text,
            dur: Math.min(90, Math.max(2, Math.round(text.length / 8))),
        }, `Voice message from ${displayName(contact)}`);
        if (ok && enabled('ttsEnabled') && suiteConfig().ttsAutoPlayVoice) speakText(text, contact);
        return ok;
    }

    if (upper === 'STICKER') {
        if (!canContact(contact, 'message')) return false;
        const label = parts.join('|').trim();
        if (!label) return false;
        const sticker = callGlobal('findStickerByLabel', label);
        if (sticker?.url) {
            return pushIncoming(contact, { type: 'sticker', url: sticker.url, label: sticker.label || label }, `${displayName(contact)} sent a sticker`);
        }
        return pushIncoming(contact, { text: `[Sticker: ${label}]` }, `${displayName(contact)} sent a sticker`);
    }

    if (upper === 'LOCATION') {
        if (!canContact(contact, 'message')) return false;
        const place = parts.shift() || '';
        const note = parts.join('|');
        return Boolean(place && pushIncoming(contact, { type: 'location', place, note }, `${displayName(contact)} shared ${place}`));
    }

    if (upper === 'NOTE') {
        if (!canContact(contact, 'message')) return false;
        const note = parts.join('|').trim();
        if (!note) return false;
        callGlobal('setBotNote', contact.id, note);
        callGlobal('pushNotif', contact.id, 'note', `${displayName(contact)} updated their status`);
        refreshPhone();
        nativeNotification(displayName(contact), `Status: ${note}`, contact.id);
        return true;
    }

    if (upper === 'POLL') {
        if (!canContact(contact, 'message')) return false;
        const question = parts.shift() || '';
        const options = parts.filter(Boolean).slice(0, 8);
        if (!question || options.length < 2) return false;
        return pushIncoming(contact, {
            type: 'poll',
            question,
            options: options.map(text => ({ text, votes: [] })),
        }, `${displayName(contact)} sent a poll`);
    }

    if (upper === 'GIFT') {
        if (!canContact(contact, 'gift')) return false;
        const giftName = parts.shift() || '';
        const amount = Math.max(0, Number.parseInt(parts.shift() || '0', 10) || 0);
        return Boolean(giftName && pushIncoming(contact, { type: 'gift', giftName, amount }, `${displayName(contact)} sent ${giftName}`));
    }

    if (upper === 'CONTACT') {
        if (!canContact(contact, 'message')) return false;
        const shared = findContactByName(parts.join('|'), false);
        if (!shared) return false;
        return pushIncoming(contact, {
            type: 'contactcard',
            cardId: shared.id,
            cardName: displayName(shared),
        }, `${displayName(contact)} shared ${displayName(shared)}'s contact`);
    }

    if (upper === 'REACT') {
        return addReaction(contact, parts.join('|'));
    }

    if (upper === 'IMAGE') {
        const source = parts.shift() || '';
        const caption = parts.join('|');
        return addImageMessage(contact, source, caption);
    }

    if (upper === 'POST') {
        return addFeedPost(contact, parts.join('|'));
    }

    if (upper === 'STORY') {
        return addStory(contact, parts.join('|'));
    }

    if (upper === 'COMMENT') {
        const target = findContactByName(parts.shift() || '', false);
        return Boolean(target && addComment(contact, target, parts.join('|')));
    }

    if (upper === 'LIKE') {
        const target = findContactByName(parts.join('|'), false);
        return Boolean(target && addLike(contact, target));
    }

    if (upper === 'CALENDAR') {
        const title = parts.shift() || '';
        const dateText = parts.shift() || '';
        const note = parts.join('|');
        return addCalendarEvent(contact, title, dateText, note, true);
    }

    return false;
}

const FEATURE_TAG_PATTERN = /\[PP_(VOICE|STICKER|LOCATION|NOTE|POLL|GIFT|CONTACT|REACT|IMAGE|POST|STORY|COMMENT|LIKE|CALENDAR|REMINDER|MEMORY):\s*([^\]]+)\]/gi;

async function parseFeatureTags() {
    const cfg = baseConfig();
    if (!cfg.universeAffectsRP) return;

    const context = getContext();
    if (!context || !Array.isArray(context.chat) || !context.chat.length) return;
    const index = context.chat.length - 1;
    const message = context.chat[index];
    if (!message || message.is_user) return;

    const original = String(message.mes || '');
    FEATURE_TAG_PATTERN.lastIndex = 0;
    if (!FEATURE_TAG_PATTERN.test(original)) return;
    FEATURE_TAG_PATTERN.lastIndex = 0;

    const id = eventHash(original, index);
    if (transactionSeen(id)) return;
    markTransaction(id, 'processing');

    let match;
    let sawTag = false;
    let handled = 0;
    const failures = [];

    while ((match = FEATURE_TAG_PATTERN.exec(original))) {
        sawTag = true;
        const [raw, type, payload] = match;
        const eventId = eventHash(raw, index);
        if (transactionSeen(eventId)) continue;
        try {
            const ok = await processFeatureTag(type, payload);
            if (ok) {
                handled++;
                markTransaction(eventId, 'completed', type);
                logDiagnostic('info', `Processed PP_${type}`, payload);
            } else {
                failures.push(type);
                markTransaction(eventId, 'rejected', 'Feature disabled, invalid payload, unavailable contact, or missing dependency');
                logDiagnostic('warning', `Rejected PP_${type}`, payload);
            }
        } catch (error) {
            failures.push(type);
            markTransaction(eventId, 'failed', error?.message || String(error));
            logDiagnostic('error', `PP_${type} failed`, error?.stack || error?.message);
        }
    }

    if (!sawTag) return;

    const cleaned = original
        .replace(FEATURE_TAG_PATTERN, '')
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    if (cleaned !== original) {
        message.mes = cleaned;
        try {
            const node = document.querySelector(`#chat .mes[mesid="${index}"] .mes_text`);
            if (node && typeof context.messageFormatting === 'function') {
                node.innerHTML = context.messageFormatting(cleaned, message.name, false, false, index);
            }
        } catch {}
        try { await callGlobal('ppSaveChatNow'); } catch {}
    }

    markTransaction(id, failures.length ? 'partial' : 'completed', `${handled} handled; ${failures.length} rejected/failed`);
}

function generateQuiet(prompt) {
    const context = getContext();
    if (typeof context?.generateQuietPrompt === 'function') return context.generateQuietPrompt(prompt);
    if (typeof context?.generateRaw === 'function') return context.generateRaw(prompt);
    throw new Error('SillyTavern quiet generation API is unavailable');
}

function extractJsonObject(raw) {
    const text = String(raw || '').trim();
    try { return JSON.parse(text); } catch {}
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try { return JSON.parse(match[0]); } catch { return null; }
}

function characterDescriptor(contact) {
    const context = getContext();
    const list = Array.isArray(context?.characters) ? context.characters : [];
    const matched = list.find(character =>
        character?.avatar === contact.id ||
        normalizeName(character?.name) === normalizeName(contact.name) ||
        normalizeName(character?.name) === normalizeName(displayName(contact))
    );
    if (!matched) return '';
    return [
        matched.description,
        matched.personality,
        matched.scenario,
    ].filter(Boolean).join('\n').slice(0, 5000);
}

function recentThreadText(contact) {
    return thread(contact.id).slice(-16).map(message => {
        const who = message.from === 'me' ? 'User' : displayName(contact);
        if (message.type === 'voice') return `${who} (voice): ${message.text || ''}`;
        if (message.type === 'image') return `${who} (image): ${message.caption || ''}`;
        if (message.type === 'location') return `${who} (location): ${message.place || ''}`;
        return `${who}: ${message.text || message.giftName || message.question || ''}`;
    }).join('\n').slice(-6000);
}

function autonomyBusy() {
    const context = getContext();
    try {
        if (context?.is_send_press === true) return true;
        if (document.querySelector('.mes_stop, #mes_stop, .stop_generation')) return true;
        if (window.ppGeneratingId || window.ppCall) return true;
    } catch {}
    return false;
}

async function runAutonomyCheck(force = false) {
    const state = suiteConfig();
    if (!state.autonomyEnabled) return;
    if (autonomyBusy()) return;
    const now = Date.now();
    const interval = Math.max(1, Number(state.autonomyCheckMinutes) || 5) * 60000;
    if (!force && now - Number(state.lastAutonomyCheck || 0) < interval) return;
    state.lastAutonomyCheck = now;
    saveAll();

    state.autonomyHistory = state.autonomyHistory.filter(ts => now - ts < 3600000);
    if (state.autonomyHistory.length >= Math.max(1, Number(state.autonomyMaxPerHour) || 2)) return;

    const candidates = contacts().filter(contact => {
        if (!canContact(contact, 'message')) return false;
        const policy = contactPolicy(contact.id);
        const cooldown = Math.max(
            Number(state.autonomyCooldownMinutes) || 90,
            Number(policy.cooldownMinutes) || 0
        ) * 60000;
        return now - Number(policy.lastAutonomousAt || 0) >= cooldown;
    });
    if (!candidates.length) return;

    if (!force && Math.random() * 100 >= Math.max(0, Math.min(100, Number(state.autonomyChancePercent) || 0))) return;
    const contact = candidates[Math.floor(Math.random() * candidates.length)];
    const policy = contactPolicy(contact.id);

    const allowed = ['none'];
    if (policy.allowMessages !== false) allowed.push('message');
    if (policy.allowCalls !== false) allowed.push('call');
    if (policy.allowVoice !== false) allowed.push('voice');
    if (state.socialBridgeEnabled && policy.allowSocial !== false) allowed.push('story', 'post');
    if (policy.allowGifts !== false) allowed.push('gift');

    const prompt = [
        'You are deciding whether one fictional Pocket Phone contact should initiate an event now.',
        `Contact: ${displayName(contact)}`,
        `Allowed actions: ${allowed.join(', ')}`,
        `Current local time: ${new Date().toLocaleString()}`,
        `Character information:\n${characterDescriptor(contact) || '(none supplied)'}`,
        `Recent phone thread:\n${recentThreadText(contact) || '(empty)'}`,
        'Return JSON only with this schema:',
        '{"action":"none|message|call|voice|story|post|gift","text":"content","extra":"optional gift name or note"}',
        'Choose none unless contact is believable, useful, and non-spammy. Calls require urgency or emotional immediacy.',
    ].join('\n\n');

    try {
        const raw = await generateQuiet(prompt);
        const decision = extractJsonObject(raw);
        if (!decision || !allowed.includes(decision.action) || decision.action === 'none') {
            logDiagnostic('info', 'Autonomy chose no event', displayName(contact));
            return;
        }

        let ok = false;
        const text = String(decision.text || '').trim();
        if (decision.action === 'message' && text) ok = pushIncoming(contact, { text }, text);
        if (decision.action === 'voice' && text && canContact(contact, 'voice')) {
            ok = pushIncoming(contact, { type: 'voice', text, dur: Math.min(90, Math.max(2, Math.round(text.length / 8))) }, `Voice message from ${displayName(contact)}`);
        }
        if (decision.action === 'call') ok = incomingCall(contact);
        if (decision.action === 'story' && text) ok = addStory(contact, text);
        if (decision.action === 'post' && text) ok = addFeedPost(contact, text);
        if (decision.action === 'gift') {
            const giftName = String(decision.extra || text || 'Gift').slice(0, 120);
            ok = pushIncoming(contact, { type: 'gift', giftName, amount: 0 }, `${displayName(contact)} sent ${giftName}`);
        }

        if (ok) {
            policy.lastAutonomousAt = now;
            state.autonomyHistory.push(now);
            saveAll();
            logDiagnostic('info', `Autonomous ${decision.action}`, `${displayName(contact)}: ${text}`);
        }
    } catch (error) {
        logDiagnostic('error', 'Autonomy generation failed', error?.stack || error?.message);
    }
}
