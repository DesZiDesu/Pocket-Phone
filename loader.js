// Pocket Phone 0.10.6 stable loader.
// Keeps recovery and version correction local while loading the proven stable core.

const PP_BUILD_VERSION = '0.10.6';
const PP_BUILD_KEY = 'pp-recovery-last-installed-build';
const PP_BUST_KEY = 'pp-recovery-cache-bust';
const PP_CORE_ID = 'pp-stable-core-0106';
const PP_RECOVERY_PANEL_ID = 'pp-recovery-settings-panel-0106';
const PP_RECOVERY_INLINE_ID = 'pp-recovery-inline-panel-0106';

if (typeof window.ppGenInterceptor !== 'function') {
    const placeholder = () => {};
    placeholder.__ppNormalRoleplayBridge = true;
    window.ppGenInterceptor = placeholder;
}

function extensionBaseUrl() {
    const scripts = Array.from(document.scripts || []);
    const current = document.currentScript
        || scripts.slice().reverse().find(script => /\/Pocket-Phone\/loader\.js(?:[?#]|$)/i.test(script.src || ''))
        || scripts.slice().reverse().find(script => /\/pocket-phone\/loader\.js(?:[?#]|$)/i.test(script.src || ''));
    if (current?.src) return new URL('./', current.src);
    return new URL('/scripts/extensions/third-party/Pocket-Phone/', window.location.origin);
}

const PP_BASE_URL = extensionBaseUrl();

function isPocketPhoneCodeUrl(value) {
    const url = String(value || '').toLowerCase();
    return url.includes('/pocket-phone/')
        || url.includes('/pocket-phone@')
        || url.includes('/pocket-phone-main/')
        || url.includes('janzanaja188-cyber/pocket-phone')
        || url.includes('deszidesu/pocket-phone');
}

function isCurrentLoaderUrl(value) {
    try {
        const current = document.currentScript?.src || '';
        return current && new URL(value, window.location.href).href === new URL(current, window.location.href).href;
    } catch {
        return false;
    }
}

async function clearOldPocketPhoneCode() {
    const report = { globals: 0, nodes: 0, storage: 0, cacheEntries: 0 };

    try {
        for (const name of Object.getOwnPropertyNames(window)) {
            if (!/^__deszidesuPocketPhone/i.test(name)
                && !/^__pocketPhone(?:Feature|Loader|Suite)/i.test(name)
                && !/^pp(?:Feature|Optional)Suite/i.test(name)) continue;
            try {
                if (delete window[name]) report.globals += 1;
            } catch {}
        }
    } catch {}

    try {
        for (const node of document.querySelectorAll('script[src], link[href], style[data-pocket-phone], [data-pocket-phone-suite]')) {
            const source = node.getAttribute('src') || node.getAttribute('href') || '';
            if (isCurrentLoaderUrl(source)) continue;
            if (!isPocketPhoneCodeUrl(source) && !node.hasAttribute('data-pocket-phone-suite')) continue;
            try {
                node.remove();
                report.nodes += 1;
            } catch {}
        }
    } catch {}

    const cleanStorage = storage => {
        try {
            const remove = [];
            for (let index = 0; index < storage.length; index += 1) {
                const key = storage.key(index) || '';
                if (key === PP_BUILD_KEY || key === PP_BUST_KEY) continue;
                const lower = key.toLowerCase();
                const pocketPhoneKey = lower.includes('pocket-phone')
                    || lower.includes('pocket_phone')
                    || lower.includes('pocketphone');
                const codeState = lower.includes('loader')
                    || lower.includes('suite')
                    || lower.includes('build-cache')
                    || lower.includes('asset-cache');
                if (pocketPhoneKey && codeState) remove.push(key);
            }
            for (const key of remove) {
                storage.removeItem(key);
                report.storage += 1;
            }
        } catch {}
    };

    cleanStorage(window.localStorage);
    cleanStorage(window.sessionStorage);

    try {
        if ('caches' in window) {
            for (const cacheName of await window.caches.keys()) {
                const cache = await window.caches.open(cacheName);
                for (const request of await cache.keys()) {
                    if (!isPocketPhoneCodeUrl(request.url)) continue;
                    try {
                        if (await cache.delete(request)) report.cacheEntries += 1;
                    } catch {}
                }
            }
        }
    } catch (error) {
        console.warn('[Pocket Phone Recovery] Cache Storage cleanup unavailable.', error);
    }

    try { performance.clearResourceTimings?.(); } catch {}
    return report;
}

async function automaticUpdateCleanup() {
    let previous = '';
    try { previous = window.localStorage.getItem(PP_BUILD_KEY) || ''; } catch {}
    if (previous === PP_BUILD_VERSION) return null;

    const report = await clearOldPocketPhoneCode();
    const stamp = `${PP_BUILD_VERSION}-${Date.now()}`;
    try {
        window.localStorage.setItem(PP_BUILD_KEY, PP_BUILD_VERSION);
        window.sessionStorage.setItem(PP_BUST_KEY, stamp);
    } catch {}

    console.info(`[Pocket Phone ${PP_BUILD_VERSION}] New build detected (${previous || 'first run'} → ${PP_BUILD_VERSION}); old code cache cleared.`, report);
    return report;
}

function replaceVersionText(root = document) {
    const selector = '#pp-ext-drawer, #pp-dialog, #pp-settings-body, #pp-helper-body, .pp-hint';
    const targets = [];

    try {
        if (root?.nodeType === Node.ELEMENT_NODE && root.matches?.(selector)) targets.push(root);
        if (root?.nodeType === Node.DOCUMENT_NODE) targets.push(root);
        if (root?.querySelectorAll) targets.push(...root.querySelectorAll(selector));

        for (const target of targets) {
            const inExtensionDrawer = target.id === 'pp-ext-drawer' || Boolean(target.closest?.('#pp-ext-drawer'));
            const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
            let node;
            while ((node = walker.nextNode())) {
                const value = node.nodeValue || '';
                let next = value
                    .replaceAll('Pocket Phone 0.9.9', `Pocket Phone ${PP_BUILD_VERSION} Stable`)
                    .replaceAll('Pocket Phone 0.10.3 Stable', `Pocket Phone ${PP_BUILD_VERSION} Stable`)
                    .replaceAll('Pocket Phone 0.10.4 Recovery', `Pocket Phone ${PP_BUILD_VERSION} Stable`)
                    .replaceAll('Pocket Phone 0.10.5 Recovery', `Pocket Phone ${PP_BUILD_VERSION} Stable`);

                if (inExtensionDrawer && value.trim() === '0.9.9') {
                    next = value.replace('0.9.9', PP_BUILD_VERSION);
                }
                if (next !== value) node.nodeValue = next;
            }
        }
    } catch (error) {
        console.warn('[Pocket Phone] Version label patch failed.', error);
    }
}

function installVersionObserver() {
    const start = () => {
        replaceVersionText(document);
        const observer = new MutationObserver(records => {
            for (const record of records) {
                for (const node of record.addedNodes) replaceVersionText(node);
            }
            replaceVersionText(document);
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
}

async function runManualRecovery(button, status) {
    const accepted = window.confirm(
        'Repair Pocket Phone now?\n\nThis clears only old Pocket Phone code/loader caches and reloads SillyTavern. Contacts, messages, media, wallet data, and settings are preserved.'
    );
    if (!accepted) return;

    if (button) button.disabled = true;
    if (status) status.textContent = 'Clearing old Pocket Phone code cache…';

    try {
        const report = await clearOldPocketPhoneCode();
        const stamp = `${PP_BUILD_VERSION}-${Date.now()}`;
        try {
            window.localStorage.setItem(PP_BUILD_KEY, PP_BUILD_VERSION);
            window.sessionStorage.setItem(PP_BUST_KEY, stamp);
        } catch {}
        console.info('[Pocket Phone Recovery] Manual cleanup complete.', report);
        if (status) status.textContent = 'Old code cache cleared. Reloading…';
        setTimeout(() => {
            const url = new URL(window.location.href);
            url.searchParams.set('pp_recovery', stamp);
            window.location.replace(url.href);
        }, 350);
    } catch (error) {
        console.error('[Pocket Phone Recovery] Manual cleanup failed.', error);
        if (button) button.disabled = false;
        if (status) status.textContent = `Recovery failed: ${error?.message || error}`;
    }
}

function recoveryButton(status) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'menu_button';
    button.textContent = 'Clear old code cache and reload';
    button.style.width = '100%';
    button.style.marginTop = '8px';
    button.addEventListener('click', () => runManualRecovery(button, status));
    return button;
}

function installRecoveryPanels() {
    const attach = () => {
        const host = document.querySelector('#extensions_settings2, #extensions_settings');
        if (host && !document.getElementById(PP_RECOVERY_PANEL_ID)) {
            const panel = document.createElement('div');
            panel.id = PP_RECOVERY_PANEL_ID;
            panel.className = 'extension_container';
            panel.innerHTML = `
                <div class="inline-drawer">
                    <div class="inline-drawer-toggle inline-drawer-header">
                        <b>Pocket Phone Recovery · ${PP_BUILD_VERSION}</b>
                        <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                    </div>
                    <div class="inline-drawer-content">
                        <p style="margin:8px 0 4px;opacity:.82;">Old code cache is cleared automatically after each extension update. This manual control is only a fallback.</p>
                        <div class="pp-recovery-status" style="font-size:.9em;opacity:.72;min-height:1.3em;"></div>
                    </div>
                </div>`;
            const status = panel.querySelector('.pp-recovery-status');
            panel.querySelector('.inline-drawer-content')?.appendChild(recoveryButton(status));
            host.appendChild(panel);
        }

        const phoneSettings = document.getElementById('pp-settings-body');
        if (phoneSettings && !document.getElementById(PP_RECOVERY_INLINE_ID)) {
            const panel = document.createElement('div');
            panel.id = PP_RECOVERY_INLINE_ID;
            panel.style.cssText = 'margin:14px 0;padding:12px;border:1px solid rgba(255,255,255,.15);border-radius:12px;background:rgba(255,255,255,.04);';
            panel.innerHTML = `<div style="font-weight:700;margin-bottom:5px;">Recovery · ${PP_BUILD_VERSION}</div><div style="font-size:.9em;opacity:.72;">Updates clean old code automatically. Use this only if the UI is still stale.</div><div class="pp-recovery-status" style="font-size:.85em;opacity:.7;min-height:1.2em;margin-top:5px;"></div>`;
            const status = panel.querySelector('.pp-recovery-status');
            panel.appendChild(recoveryButton(status));
            phoneSettings.appendChild(panel);
        }
    };

    const start = () => {
        attach();
        const observer = new MutationObserver(() => attach());
        observer.observe(document.documentElement, { childList: true, subtree: true });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
}

function loadStableCore() {
    if (document.getElementById(PP_CORE_ID)) return;
    const url = new URL('core.js', PP_BASE_URL);
    url.searchParams.set('v', PP_BUILD_VERSION);
    try {
        const stamp = window.sessionStorage.getItem(PP_BUST_KEY);
        if (stamp) url.searchParams.set('recovery', stamp);
    } catch {}

    const script = document.createElement('script');
    script.id = PP_CORE_ID;
    script.src = url.href;
    script.async = false;
    script.addEventListener('load', () => {
        console.info(`[Pocket Phone ${PP_BUILD_VERSION}] Stable core loaded.`);
        replaceVersionText(document);
    }, { once: true });
    script.addEventListener('error', error => {
        console.error('[Pocket Phone] Stable core.js could not load.', error);
        try { window.toastr?.error('Pocket Phone core could not load. Open Pocket Phone Recovery and run the repair button.'); } catch {}
    }, { once: true });
    document.head.appendChild(script);
}

window.PP_CLEAR_OLD_FILES = () => runManualRecovery(null, null);
window.PP_RECOVERY_VERSION = PP_BUILD_VERSION;

installVersionObserver();
installRecoveryPanels();
automaticUpdateCleanup()
    .catch(error => console.warn('[Pocket Phone] Automatic cleanup failed.', error))
    .finally(loadStableCore);
