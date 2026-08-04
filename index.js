// Pocket Phone 0.10.4 Recovery Loader.
// This entry point stays local and lightweight so recovery controls remain available
// even when the Pocket Phone core or its pinned upstream dependency cannot load.

const PP_RECOVERY_VERSION = '0.10.4';
const PP_RECOVERY_PANEL_ID = 'pp-recovery-settings-panel';
const PP_RECOVERY_INLINE_ID = 'pp-recovery-inline-panel';
const PP_RECOVERY_BUST_KEY = 'pp-recovery-cache-bust';
const PP_CORE_SCRIPT_ID = 'pp-stable-local-core';

function getPocketPhoneExtensionBaseUrl() {
    const scripts = Array.from(document.scripts || []);
    const entry = document.currentScript
        || scripts.slice().reverse().find(script => /\/Pocket-Phone\/index\.js(?:[?#]|$)/i.test(script.src || ''))
        || scripts.find(script => /\/pocket-phone\/index\.js(?:[?#]|$)/i.test(script.src || ''));

    if (entry?.src) return new URL('./', entry.src);
    return new URL('/scripts/extensions/third-party/Pocket-Phone/', window.location.origin);
}

const PP_EXTENSION_BASE_URL = getPocketPhoneExtensionBaseUrl();

function isPocketPhoneCodeUrl(value) {
    const url = String(value || '').toLowerCase();
    return url.includes('/pocket-phone/')
        || url.includes('/pocket-phone@')
        || url.includes('/pocket-phone-main/')
        || url.includes('janzanaja188-cyber/pocket-phone')
        || url.includes('deszidesu/pocket-phone');
}

function isObsoletePocketPhoneResource(value) {
    const url = String(value || '').toLowerCase();
    if (!isPocketPhoneCodeUrl(url)) return false;
    return url.includes('feature-suite')
        || url.includes('optional-suite')
        || url.includes('pp-features')
        || url.includes('0.10.0')
        || url.includes('0.10.1')
        || url.includes('0.10.2');
}

async function clearPocketPhoneCodeCaches() {
    const report = { globals: 0, nodes: 0, storage: 0, cacheEntries: 0 };

    try {
        for (const name of Object.getOwnPropertyNames(window)) {
            const obsoleteLoader = /^__deszidesuPocketPhone/i.test(name)
                || /^__pocketPhone(?:Feature|Loader|Suite)/i.test(name)
                || /^pp(?:Feature|Optional)Suite/i.test(name);
            if (!obsoleteLoader) continue;
            try {
                if (delete window[name]) report.globals += 1;
            } catch {}
        }
    } catch {}

    try {
        const removableNodes = document.querySelectorAll('script[src], link[href], style[data-pocket-phone], [data-pocket-phone-suite]');
        for (const node of removableNodes) {
            const source = node.getAttribute('src') || node.getAttribute('href') || '';
            if (!isObsoletePocketPhoneResource(source) && !node.hasAttribute('data-pocket-phone-suite')) continue;
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
                const lower = key.toLowerCase();
                const isLoaderState = (lower.includes('pocket-phone') || lower.includes('pocket_phone') || lower.includes('pocketphone'))
                    && (lower.includes('loader') || lower.includes('suite') || lower.includes('build-cache') || lower.includes('asset-cache'));
                if (isLoaderState) remove.push(key);
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
        console.warn('[Pocket Phone Recovery] Cache Storage cleanup was unavailable.', error);
    }

    try { performance.clearResourceTimings?.(); } catch {}
    return report;
}

async function runPocketPhoneRecovery(button, statusNode) {
    const accepted = window.confirm(
        'Repair Pocket Phone now?\n\nThis clears old loader/code caches and reloads SillyTavern. Contacts, messages, media, wallet data, and Pocket Phone settings are preserved.'
    );
    if (!accepted) return;

    if (button) button.disabled = true;
    if (statusNode) statusNode.textContent = 'Clearing old Pocket Phone loader cache…';

    try {
        const stamp = String(Date.now());
        const report = await clearPocketPhoneCodeCaches();
        window.sessionStorage.setItem(PP_RECOVERY_BUST_KEY, stamp);
        console.info('[Pocket Phone Recovery] Cleanup complete.', report);

        if (statusNode) {
            statusNode.textContent = `Cleared ${report.globals} loader globals, ${report.nodes} obsolete nodes, ${report.storage} stale storage keys, and ${report.cacheEntries} cached resources. Reloading…`;
        }

        try { window.toastr?.success('Pocket Phone old loader cache cleared. Reloading SillyTavern…'); } catch {}

        window.setTimeout(() => {
            const reloadUrl = new URL(window.location.href);
            reloadUrl.searchParams.set('pp_recovery', stamp);
            window.location.replace(reloadUrl.href);
        }, 450);
    } catch (error) {
        console.error('[Pocket Phone Recovery] Cleanup failed.', error);
        if (button) button.disabled = false;
        if (statusNode) statusNode.textContent = `Recovery failed: ${error?.message || error}`;
        try { window.toastr?.error('Pocket Phone recovery failed. Check the browser console.'); } catch {}
    }
}

function makeRecoveryButton(statusNode) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'menu_button';
    button.textContent = 'Clear old loader cache and reload';
    button.style.width = '100%';
    button.style.marginTop = '8px';
    button.addEventListener('click', () => runPocketPhoneRecovery(button, statusNode));
    return button;
}

function createMainRecoveryPanel() {
    const panel = document.createElement('div');
    panel.id = PP_RECOVERY_PANEL_ID;
    panel.className = 'extension_container';
    panel.innerHTML = `
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b>Pocket Phone Recovery · ${PP_RECOVERY_VERSION}</b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content">
                <p style="margin: 8px 0 4px; opacity: .82;">
                    Removes obsolete Pocket Phone loader and code caches without deleting contacts, messages, media, wallet data, or settings.
                </p>
                <div class="pp-recovery-status" style="font-size: .9em; opacity: .72; min-height: 1.3em;"></div>
            </div>
        </div>`;

    const content = panel.querySelector('.inline-drawer-content');
    const status = panel.querySelector('.pp-recovery-status');
    content?.appendChild(makeRecoveryButton(status));
    return panel;
}

function createInlineRecoveryPanel() {
    const panel = document.createElement('div');
    panel.id = PP_RECOVERY_INLINE_ID;
    panel.style.cssText = 'margin:14px 0;padding:12px;border:1px solid rgba(255,255,255,.15);border-radius:12px;background:rgba(255,255,255,.04);';

    const title = document.createElement('div');
    title.textContent = `Recovery · ${PP_RECOVERY_VERSION}`;
    title.style.cssText = 'font-weight:700;margin-bottom:5px;';

    const text = document.createElement('div');
    text.textContent = 'Clear only obsolete loader/code caches. Phone data is preserved.';
    text.style.cssText = 'font-size:.9em;opacity:.72;';

    const status = document.createElement('div');
    status.style.cssText = 'font-size:.85em;opacity:.7;min-height:1.2em;margin-top:5px;';

    panel.append(title, text, status, makeRecoveryButton(status));
    return panel;
}

function patchDisplayedRecoveryVersion(root = document) {
    try {
        const selector = '#pp-dialog, #pp-settings-body, .pp-hint';
        const targets = [];
        if (root?.matches?.(selector)) targets.push(root);
        if (root?.querySelectorAll) targets.push(...root.querySelectorAll(selector));

        for (const target of targets) {
            const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
            let node;
            while ((node = walker.nextNode())) {
                if (node.nodeValue?.includes('Pocket Phone 0.10.3 Stable')) {
                    node.nodeValue = node.nodeValue.replaceAll('Pocket Phone 0.10.3 Stable', `Pocket Phone ${PP_RECOVERY_VERSION} Recovery`);
                }
            }
        }
    } catch {}
}

function installRecoveryUi() {
    const attachPanels = () => {
        const settingsRoot = document.querySelector('#extensions_settings2, #extensions_settings');
        if (settingsRoot && !document.getElementById(PP_RECOVERY_PANEL_ID)) {
            settingsRoot.appendChild(createMainRecoveryPanel());
        }

        const pocketPhoneSettings = document.querySelector('#pp-settings-body');
        if (pocketPhoneSettings && !document.getElementById(PP_RECOVERY_INLINE_ID)) {
            pocketPhoneSettings.appendChild(createInlineRecoveryPanel());
        }
    };

    const start = () => {
        attachPanels();
        patchDisplayedRecoveryVersion(document);

        const observer = new MutationObserver(records => {
            let shouldCheckPanels = false;
            for (const record of records) {
                for (const node of record.addedNodes) {
                    patchDisplayedRecoveryVersion(node);
                    if (node.nodeType === Node.ELEMENT_NODE) shouldCheckPanels = true;
                }
            }
            if (shouldCheckPanels) attachPanels();
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
}

function loadPocketPhoneCore() {
    if (document.getElementById(PP_CORE_SCRIPT_ID)) return;

    const coreUrl = new URL('core.js', PP_EXTENSION_BASE_URL);
    coreUrl.searchParams.set('v', PP_RECOVERY_VERSION);
    const recoveryStamp = window.sessionStorage.getItem(PP_RECOVERY_BUST_KEY);
    if (recoveryStamp) coreUrl.searchParams.set('recovery', recoveryStamp);

    const script = document.createElement('script');
    script.id = PP_CORE_SCRIPT_ID;
    script.src = coreUrl.href;
    script.async = false;
    script.dataset.pocketPhoneLocalCore = PP_RECOVERY_VERSION;
    script.addEventListener('load', () => {
        console.info(`[Pocket Phone Recovery ${PP_RECOVERY_VERSION}] Local core loaded.`);
        patchDisplayedRecoveryVersion(document);
        try {
            const currentUrl = new URL(window.location.href);
            if (currentUrl.searchParams.has('pp_recovery')) {
                currentUrl.searchParams.delete('pp_recovery');
                window.history.replaceState(window.history.state, '', currentUrl.href);
            }
        } catch {}
    }, { once: true });
    script.addEventListener('error', error => {
        console.error('[Pocket Phone Recovery] Local core.js could not load.', error);
        try { window.toastr?.error('Pocket Phone core could not load. Open Extensions → Pocket Phone Recovery and run the repair button.'); } catch {}
    }, { once: true });
    document.head.appendChild(script);
}

window.PP_CLEAR_OLD_FILES = () => runPocketPhoneRecovery(null, null);
window.PP_RECOVERY_VERSION = PP_RECOVERY_VERSION;

installRecoveryUi();
loadPocketPhoneCore();
