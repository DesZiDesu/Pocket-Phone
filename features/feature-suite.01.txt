// Pocket Phone optional feature suite 0.10.0.
// Every subsystem added here defaults to disabled and can be toggled independently.
(() => {
'use strict';

const SUITE_VERSION = '0.10.0';
const ROOT_KEY = 'featureSuite';
const DIALOG_ID = 'pp-feature-suite-dialog';
const STYLE_ID = 'pp-feature-suite-style';
const SETTINGS_CARD_ID = 'pp-feature-suite-settings-card';

const DEFAULTS = Object.freeze({
    autonomyEnabled: false,
    perContactControlsEnabled: false,
    backupToolsEnabled: false,
    schedulerEnabled: false,
    availabilityEnabled: false,
    receiptsEnabled: false,
    reactionsEnabled: false,
    ttsEnabled: false,
    browserNotificationsEnabled: false,
    imageBridgeEnabled: false,
    socialBridgeEnabled: false,
    calendarEnabled: false,
    worldMemoryEnabled: false,
    aliasResolverEnabled: false,
    diagnosticsEnabled: false,
    transactionQueueEnabled: false,
    offlineCacheEnabled: false,

    autonomyCheckMinutes: 5,
    autonomyChancePercent: 20,
    autonomyCooldownMinutes: 90,
    autonomyMaxPerHour: 2,
    quietHoursStart: 23,
    quietHoursEnd: 7,
    receiptReadDelaySeconds: 20,
    notificationPreview: true,
    ttsRate: 1,
    ttsPitch: 1,
    ttsVolume: 1,
    ttsAutoPlayVoice: false,
    imageEndpoint: '',
    imageEndpointKey: '',

    contactPolicies: {},
    scheduledEvents: [],
    calendarEvents: [],
    memories: [],
    diagnostics: [],
    processedEvents: {},
    transactionQueue: [],
    autonomyHistory: [],
    lastAutonomyCheck: 0,
    lastNativeNotificationTs: 0,
});

const getContext = () => {
    try { return window.SillyTavern?.getContext?.() || null; }
    catch { return null; }
};

const callGlobal = (name, ...args) => {
    try {
        const fn = window[name];
        return typeof fn === 'function' ? fn(...args) : undefined;
    } catch (error) {
        logDiagnostic('error', `Global call failed: ${name}`, error?.message || String(error));
        return undefined;
    }
};

function baseConfig() {
    try {
        if (typeof window.getCfg === 'function') return window.getCfg();
    } catch {}
    const context = getContext();
    if (context?.extensionSettings) {
        if (!context.extensionSettings['pocket-phone']) context.extensionSettings['pocket-phone'] = {};
        return context.extensionSettings['pocket-phone'];
    }
    try {
        const mirror = JSON.parse(localStorage.getItem('pp_cfg_mirror') || '{}');
        return mirror;
    } catch {
        return {};
    }
}

function suiteConfig() {
    const base = baseConfig();
    if (!base[ROOT_KEY] || typeof base[ROOT_KEY] !== 'object') base[ROOT_KEY] = {};
    const state = base[ROOT_KEY];
    for (const [key, value] of Object.entries(DEFAULTS)) {
        if (state[key] === undefined) state[key] = structuredClone(value);
    }
    return state;
}

function saveAll() {
    try {
        if (typeof window.saveCfg === 'function') {
            window.saveCfg();
            return;
        }
    } catch {}
    const context = getContext();
    try { context?.saveSettingsDebounced?.(); } catch {}
    try { localStorage.setItem('pp_cfg_mirror', JSON.stringify(baseConfig())); } catch {}
}

function enabled(key) {
    return suiteConfig()[key] === true;
}

function uid(prefix = 'fs') {
    return `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function toast(message, type = 'info') {
    try {
        const toastr = window.toastr;
        if (toastr?.[type]) toastr[type](message);
        else callGlobal('ppToast', message);
    } catch {}
}

function logDiagnostic(level, message, detail = '') {
    const state = suiteConfig();
    if (!state.diagnosticsEnabled && level !== 'error') return;
    const row = {
        id: uid('diag'),
        ts: Date.now(),
        level,
        message: String(message || '').slice(0, 240),
        detail: String(detail || '').slice(0, 2000),
    };
    state.diagnostics.push(row);
    if (state.diagnostics.length > 300) state.diagnostics = state.diagnostics.slice(-300);
    saveAll();
}

function contacts() {
    const list = callGlobal('getContacts');
    if (Array.isArray(list)) return list;
    return Array.isArray(baseConfig().contacts) ? baseConfig().contacts : [];
}

function displayName(contact) {
    if (!contact) return '?';
    return callGlobal('dname', contact) || contact.customName || contact.name || contact.id || '?';
}

function contactPolicy(contactId) {
    const state = suiteConfig();
    if (!state.contactPolicies[contactId]) {
        state.contactPolicies[contactId] = {
            enabled: true,
            allowMessages: true,
            allowCalls: true,
            allowVoice: true,
            allowSocial: true,
            allowGifts: true,
            allowPayments: true,
            ignoreQuietHours: false,
            aliases: [],
            cooldownMinutes: 0,
            availableDays: [0, 1, 2, 3, 4, 5, 6],
            availableFrom: '00:00',
            availableTo: '23:59',
            ttsVoice: '',
            lastAutonomousAt: 0,
        };
    }
    return state.contactPolicies[contactId];
}

function normalizeName(value) {
    return String(value || '').trim().toLocaleLowerCase();
}

function findContactByName(rawName, create = false) {
    const wanted = normalizeName(rawName);
    if (!wanted) return null;
    const list = contacts();

    let found = list.find(contact => normalizeName(displayName(contact)) === wanted);
    if (found) return found;

    if (enabled('aliasResolverEnabled')) {
        found = list.find(contact => {
            const aliases = contactPolicy(contact.id).aliases || [];
            return aliases.some(alias => normalizeName(alias) === wanted);
        });
        if (found) return found;
    }

    const partial = list.filter(contact => {
        const shown = normalizeName(displayName(contact));
        return shown && (shown.includes(wanted) || wanted.includes(shown));
    });
    if (partial.length === 1) return partial[0];

    if (!create) return null;
    const cfg = baseConfig();
    if (!Array.isArray(cfg.contacts)) cfg.contacts = [];
    const contact = { id: `npc:${uid('contact')}`, name: String(rawName).trim(), avatar: '', npc: true };
    cfg.contacts.push(contact);
    saveAll();
    logDiagnostic('info', 'Created NPC contact', contact.name);
    return contact;
}

function isBlocked(contactId) {
    try { return callGlobal('isBlocked', contactId) === true; } catch { return false; }
}

function parseTime(value) {
    const [h, m] = String(value || '00:00').split(':').map(Number);
    return Math.max(0, Math.min(1439, (h || 0) * 60 + (m || 0)));
}

function isContactAvailable(contact, at = new Date()) {
    if (!enabled('availabilityEnabled')) return true;
    if (!contact) return false;
    const policy = contactPolicy(contact.id);
    if (!policy.enabled) return false;
    const days = Array.isArray(policy.availableDays) ? policy.availableDays : [0,1,2,3,4,5,6];
    if (!days.includes(at.getDay())) return false;
    const current = at.getHours() * 60 + at.getMinutes();
    const from = parseTime(policy.availableFrom);
    const to = parseTime(policy.availableTo);
    if (from <= to) return current >= from && current <= to;
    return current >= from || current <= to;
}

function inQuietHours(at = new Date()) {
    const state = suiteConfig();
    const current = at.getHours();
    const start = Number(state.quietHoursStart) || 0;
    const end = Number(state.quietHoursEnd) || 0;
    if (start === end) return false;
    return start < end ? current >= start && current < end : current >= start || current < end;
}

function canContact(contact, channel = 'message') {
    if (!contact || isBlocked(contact.id)) return false;
    const policy = contactPolicy(contact.id);
    if (enabled('perContactControlsEnabled')) {
        if (!policy.enabled) return false;
        if (channel === 'call' && !policy.allowCalls) return false;
        if (channel === 'message' && !policy.allowMessages) return false;
        if (channel === 'voice' && !policy.allowVoice) return false;
        if (channel === 'social' && !policy.allowSocial) return false;
        if (channel === 'gift' && !policy.allowGifts) return false;
        if (channel === 'payment' && !policy.allowPayments) return false;
    }
    if (!isContactAvailable(contact)) return false;
    if (inQuietHours() && !policy.ignoreQuietHours) return false;
    return true;
}

function thread(contactId) {
    const value = callGlobal('getThread', contactId);
    if (Array.isArray(value)) return value;
    const cfg = baseConfig();
    if (!cfg.threads) cfg.threads = {};
    if (!Array.isArray(cfg.threads[contactId])) cfg.threads[contactId] = [];
    return cfg.threads[contactId];
}

function notifyIncoming(contact, kind, preview) {
    try { callGlobal('bumpUnread', contact.id, 1); } catch {}
    try { callGlobal('pushNotif', contact.id, kind || 'msg', preview); } catch {}
    try { callGlobal('islandNotify', contact, preview); } catch {}
    try {
        if (callGlobal('ppViewing', contact.id)) callGlobal('renderThread');
        else callGlobal('renderContactList');
        callGlobal('updateHomeWidgets');
    } catch {}
    nativeNotification(displayName(contact), preview, contact.id);
}

function pushIncoming(contact, message, preview = '') {
    if (!contact || !message) return false;
    if (typeof window.pushThreadMsg === 'function') {
        window.pushThreadMsg(contact.id, { from: 'them', ...message });
    } else {
        thread(contact.id).push({ ts: Date.now(), mid: uid('msg'), from: 'them', ...message });
        saveAll();
    }
    notifyIncoming(contact, 'msg', preview || displayName(contact));
    return true;
}

function incomingCall(contact) {
    if (!contact || !canContact(contact, 'call')) return false;
    if (typeof window.ppIncomingCall === 'function') {
        window.ppIncomingCall(contact);
        nativeNotification(displayName(contact), 'Incoming call', contact.id);
        return true;
    }
    pushIncoming(contact, { type: 'call', dir: 'in', missed: true, text: 'Missed call' }, 'Missed call');
    return true;
}

function nativeNotification(title, body, contactId = '') {
    if (!enabled('browserNotificationsEnabled')) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
        const state = suiteConfig();
        const text = state.notificationPreview ? String(body || '') : 'New Pocket Phone activity';
        const note = new Notification(title || 'Pocket Phone', {
            body: text,
            tag: contactId ? `pp:${contactId}` : `pp:${Date.now()}`,
            renotify: true,
        });
        note.onclick = () => {
            window.focus();
            try {
                if (contactId) {
                    const contact = contacts().find(item => item.id === contactId);
                    if (contact) {
                        window.ppActiveContact = contact;
                        window.ppActiveGroup = null;
                        callGlobal('ppNav', 'chat');
                    }
                }
            } catch {}
            note.close();
        };
    } catch (error) {
        logDiagnostic('error', 'Browser notification failed', error?.message);
    }
}

async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        toast('This browser does not support notifications.', 'warning');
        return;
    }
    try {
        const result = await Notification.requestPermission();
        toast(`Notification permission: ${result}`, result === 'granted' ? 'success' : 'warning');
    } catch (error) {
        logDiagnostic('error', 'Notification permission request failed', error?.message);
    }
}

function refreshPhone() {
    try {
        callGlobal('renderContactList');
        callGlobal('renderFeed');
        callGlobal('updateHomeWidgets');
        callGlobal('renderThread');
    } catch {}
}

function downloadJson(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error || new Error('File read failed'));
        reader.readAsText(file);
    });
}

function readBlobAsDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error || new Error('Blob read failed'));
        reader.readAsDataURL(blob);
    });
}
