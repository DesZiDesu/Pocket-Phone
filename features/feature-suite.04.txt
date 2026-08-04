
function scheduleEvent(event) {
    const state = suiteConfig();
    state.scheduledEvents.push({
        id: uid('schedule'),
        enabled: true,
        completed: false,
        repeat: 'none',
        createdAt: Date.now(),
        ...event,
    });
    saveAll();
}

function reschedule(event) {
    if (event.repeat === 'daily') event.at += 86400000;
    else if (event.repeat === 'weekly') event.at += 604800000;
    else {
        event.completed = true;
        event.enabled = false;
    }
}

function executeScheduledEvent(event) {
    const contact = event.contactId ? contacts().find(item => item.id === event.contactId) : null;
    if (event.type !== 'reminder' && !contact) return false;
    if (contact && !canContact(contact, event.type === 'call' ? 'call' : 'message')) return false;

    if (event.type === 'message') return pushIncoming(contact, { text: event.text || '' }, event.text || 'New message');
    if (event.type === 'voice') return pushIncoming(contact, {
        type: 'voice',
        text: event.text || '',
        dur: Math.min(90, Math.max(2, Math.round(String(event.text || '').length / 8))),
    }, `Voice message from ${displayName(contact)}`);
    if (event.type === 'call') return incomingCall(contact);
    if (event.type === 'note') {
        callGlobal('setBotNote', contact.id, event.text || '');
        refreshPhone();
        nativeNotification(displayName(contact), `Status: ${event.text || ''}`, contact.id);
        return true;
    }
    if (event.type === 'gift') return pushIncoming(contact, { type: 'gift', giftName: event.text || 'Gift', amount: 0 }, `${displayName(contact)} sent a gift`);
    if (event.type === 'reminder') {
        nativeNotification('Pocket Phone Reminder', event.text || 'Reminder');
        toast(event.text || 'Pocket Phone reminder');
        return true;
    }
    return false;
}

function processScheduler() {
    const state = suiteConfig();
    const now = Date.now();

    if (state.schedulerEnabled) {
        for (const event of state.scheduledEvents) {
            if (!event.enabled || event.completed || Number(event.at) > now) continue;
            try {
                const ok = executeScheduledEvent(event);
                if (ok) {
                    event.lastRun = now;
                    reschedule(event);
                    logDiagnostic('info', 'Scheduled event executed', `${event.type}: ${event.text || ''}`);
                } else {
                    event.lastError = 'Contact unavailable or event invalid';
                    event.at = now + 60000;
                }
            } catch (error) {
                event.lastError = error?.message || String(error);
                event.at = now + 60000;
                logDiagnostic('error', 'Scheduled event failed', error?.stack || error?.message);
            }
        }
    }

    if (state.calendarEnabled) {
        for (const event of state.calendarEvents) {
            if (!event.enabled || event.notified || !event.accepted || Number(event.at) > now) continue;
            event.notified = true;
            const contact = event.contactId ? contacts().find(item => item.id === event.contactId) : null;
            nativeNotification(contact ? displayName(contact) : 'Pocket Phone Calendar', event.title, event.contactId || '');
            toast(`Calendar: ${event.title}`);
            logDiagnostic('info', 'Calendar notification', event.title);
        }
    }
    saveAll();
}

function processReceipts() {
    if (!enabled('receiptsEnabled')) return;
    const state = suiteConfig();
    const now = Date.now();
    const delay = Math.max(1, Number(state.receiptReadDelaySeconds) || 20) * 1000;
    let changed = false;

    for (const contact of contacts()) {
        const available = isContactAvailable(contact);
        for (const message of thread(contact.id)) {
            if (message.from !== 'me' || message.unsent || message.type === 'call') continue;
            if (!message.deliveryState) {
                message.deliveryState = 'sent';
                message.sentAt = Number(message.ts) || now;
                changed = true;
            }
            if (message.deliveryState === 'sent' && now - Number(message.sentAt || now) >= 1000) {
                message.deliveryState = 'delivered';
                message.deliveredAt = now;
                changed = true;
            }
            if (message.deliveryState === 'delivered' && available && now - Number(message.deliveredAt || now) >= delay) {
                message.deliveryState = 'read';
                message.readAt = now;
                changed = true;
            }
        }
    }
    if (changed) {
        saveAll();
        decorateThreadMessages();
    }
}

function findVisibleMessage(mid) {
    if (!mid) return null;
    for (const contact of contacts()) {
        const message = thread(contact.id).find(item => item.mid === mid);
        if (message) return { contact, message };
    }
    return null;
}

function decorateThreadMessages() {
    const rows = document.querySelectorAll('#pp-msgs .pp-brow[data-mid]');
    for (const row of rows) {
        const mid = row.dataset.mid;
        const resolved = findVisibleMessage(mid);
        if (!resolved) continue;
        const { contact, message } = resolved;
        let extras = row.querySelector('.pp-suite-message-extras');
        if (!extras) {
            extras = document.createElement('div');
            extras.className = 'pp-suite-message-extras';
            row.querySelector('.pp-brow-col')?.appendChild(extras);
        }
        const chunks = [];
        if (enabled('receiptsEnabled') && message.from === 'me' && message.deliveryState) {
            const label = message.deliveryState === 'read' ? 'Read' : message.deliveryState === 'delivered' ? 'Delivered' : 'Sent';
            chunks.push(`<span class="pp-suite-receipt">${label}</span>`);
        }
        if (enabled('reactionsEnabled') && Array.isArray(message.reactions) && message.reactions.length) {
            const reactions = message.reactions.map(item => `<span class="pp-suite-reaction" title="${escapeHtml(item.by || '')}">${escapeHtml(item.reaction || '')}</span>`).join('');
            chunks.push(`<span class="pp-suite-reactions">${reactions}</span>`);
        }
        if (enabled('ttsEnabled') && message.type === 'voice' && message.text) {
            chunks.push(`<button type="button" class="pp-suite-tts" data-tts-mid="${escapeHtml(mid)}">Play voice</button>`);
        }
        extras.innerHTML = chunks.join('');
        extras.style.display = chunks.length ? '' : 'none';
        row.dataset.ppSuiteContact = contact.id;
    }
}

function speakText(text, contact = null) {
    if (!enabled('ttsEnabled') || !('speechSynthesis' in window)) return false;
    try {
        speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(String(text || ''));
        const state = suiteConfig();
        utterance.rate = Math.max(0.5, Math.min(2, Number(state.ttsRate) || 1));
        utterance.pitch = Math.max(0, Math.min(2, Number(state.ttsPitch) || 1));
        utterance.volume = Math.max(0, Math.min(1, Number(state.ttsVolume) || 1));
        const desired = contact ? contactPolicy(contact.id).ttsVoice : '';
        if (desired) {
            const voice = speechSynthesis.getVoices().find(item => item.name === desired);
            if (voice) utterance.voice = voice;
        }
        speechSynthesis.speak(utterance);
        return true;
    } catch (error) {
        logDiagnostic('error', 'TTS failed', error?.message);
        return false;
    }
}

async function exportBackup() {
    if (!enabled('backupToolsEnabled')) {
        toast('Enable Backup & Restore first.', 'warning');
        return;
    }
    const cfg = structuredClone(baseConfig());
    const media = {};
    try {
        const store = window.SillyTavern?.libs?.localforage?.createInstance({ name: 'pocket-phone', storeName: 'media' });
        if (store) {
            const keys = await store.keys();
            for (const key of keys) media[key] = await store.getItem(key);
        } else {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key?.startsWith('ppmedia_')) media[key.slice(8)] = localStorage.getItem(key);
            }
        }
    } catch (error) {
        logDiagnostic('error', 'Media backup failed', error?.message);
    }
    downloadJson(`pocket-phone-backup-${new Date().toISOString().slice(0,10)}.json`, {
        schema: 'pocket-phone-backup',
        schemaVersion: 1,
        extensionVersion: SUITE_VERSION,
        exportedAt: new Date().toISOString(),
        config: cfg,
        media,
    });
}

async function importBackup(file) {
    if (!enabled('backupToolsEnabled')) {
        toast('Enable Backup & Restore first.', 'warning');
        return;
    }
    const parsed = JSON.parse(await readFileAsText(file));
    if (parsed?.schema !== 'pocket-phone-backup' || !parsed.config) throw new Error('Not a Pocket Phone backup');

    const target = baseConfig();
    for (const key of Object.keys(target)) delete target[key];
    Object.assign(target, parsed.config);

    if (parsed.media && typeof parsed.media === 'object') {
        const store = window.SillyTavern?.libs?.localforage?.createInstance({ name: 'pocket-phone', storeName: 'media' });
        for (const [key, value] of Object.entries(parsed.media)) {
            if (store) await store.setItem(key, value);
            else localStorage.setItem(`ppmedia_${key}`, value);
        }
    }

    saveAll();
    refreshPhone();
    toast('Pocket Phone backup restored. Reload SillyTavern.', 'success');
}

function exportDiagnostics() {
    downloadJson(`pocket-phone-diagnostics-${Date.now()}.json`, {
        version: SUITE_VERSION,
        exportedAt: new Date().toISOString(),
        flags: suiteConfig(),
        capabilities: {
            context: Boolean(getContext()),
            quietGeneration: typeof getContext()?.generateQuietPrompt === 'function',
            rawGeneration: typeof getContext()?.generateRaw === 'function',
            notification: 'Notification' in window ? Notification.permission : 'unsupported',
            speechSynthesis: 'speechSynthesis' in window,
            upstreamInterceptor: typeof window.__ppUpstreamInterceptor === 'function',
            suiteInterceptor: typeof window.__ppFeatureSuiteInterceptor === 'function',
        },
        logs: suiteConfig().diagnostics,
    });
}
