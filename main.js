// Pocket Phone 0.11.0 entry loader.
// Keeps update cleanup, version display, recovery controls, and feature modules separate
// from the pinned stable Pocket Phone core.
(() => {
    'use strict';

    const VERSION = '0.11.0';
    const BUILD_KEY = 'pp-entry-last-build';
    const BUST_KEY = 'pp-entry-cache-bust';
    const MAINTENANCE_ID = 'pp-maintenance-0110';
    const CURRENT_SCRIPT = document.currentScript;

    if (typeof window.ppGenInterceptor !== 'function') {
        const placeholder = () => {};
        placeholder.__ppNormalRoleplayBridge = true;
        window.ppGenInterceptor = placeholder;
    }

    function extensionBaseUrl() {
        if (CURRENT_SCRIPT?.src) return new URL('./', CURRENT_SCRIPT.src);
        const match = Array.from(document.scripts || []).find(script => /\/Pocket-Phone\/main\.js(?:[?#]|$)/i.test(script.src || ''));
        if (match?.src) return new URL('./', match.src);
        return new URL('/scripts/extensions/third-party/Pocket-Phone/', window.location.origin);
    }

    const BASE_URL = extensionBaseUrl();

    function isPocketPhoneUrl(value) {
        const url = String(value || '').toLowerCase();
        return url.includes('/pocket-phone/')
            || url.includes('/pocket-phone@')
            || url.includes('/pocket-phone-main/')
            || url.includes('deszidesu/pocket-phone')
            || url.includes('janzanaja188-cyber/pocket-phone');
    }

    async function clearOldCodeCaches() {
        const report = { nodes: 0, globals: 0, cacheEntries: 0, storageKeys: 0 };

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
            const nodes = document.querySelectorAll('script[src], link[href], style[data-pocket-phone], [data-pocket-phone-suite]');
            for (const node of nodes) {
                if (node === CURRENT_SCRIPT) continue;
                const source = node.getAttribute('src') || node.getAttribute('href') || '';
                if (!isPocketPhoneUrl(source) && !node.hasAttribute('data-pocket-phone-suite')) continue;
                try {
                    node.remove();
                    report.nodes += 1;
                } catch {}
            }
        } catch {}

        const cleanStorage = storage => {
            try {
                const remove = [];
                for (let i = 0; i < storage.length; i += 1) {
                    const key = storage.key(i) || '';
                    const lower = key.toLowerCase();
                    const isOldCodeState = (lower.includes('pocket-phone') || lower.includes('pocketphone') || lower.includes('pocket_phone'))
                        && (lower.includes('loader') || lower.includes('suite') || lower.includes('asset-cache') || lower.includes('build-cache'));
                    if (isOldCodeState) remove.push(key);
                }
                for (const key of remove) {
                    storage.removeItem(key);
                    report.storageKeys += 1;
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
                        if (!isPocketPhoneUrl(request.url)) continue;
                        try {
                            if (await cache.delete(request)) report.cacheEntries += 1;
                        } catch {}
                    }
                }
            }
        } catch (error) {
            console.warn('[Pocket Phone] Cache Storage cleanup unavailable.', error);
        }

        try { performance.clearResourceTimings?.(); } catch {}
        return report;
    }

    async function automaticUpdateCleanup() {
        let previous = '';
        try { previous = window.localStorage.getItem(BUILD_KEY) || ''; } catch {}
        if (previous === VERSION) return null;

        const report = await clearOldCodeCaches();
        const stamp = `${VERSION}-${Date.now()}`;
        try {
            window.localStorage.setItem(BUILD_KEY, VERSION);
            window.sessionStorage.setItem(BUST_KEY, stamp);
        } catch {}
        console.info(`[Pocket Phone ${VERSION}] New build detected (${previous || 'first run'} → ${VERSION}); old code cache cleared.`, report);
        return report;
    }

    function replaceVersionLabels(root = document) {
        const selector = '#pp-ext-drawer, #pp-dialog, #pp-settings-body, #pp-helper-body, .pp-hint';
        try {
            const targets = [];
            if (root?.nodeType === Node.DOCUMENT_NODE) targets.push(root);
            if (root?.nodeType === Node.ELEMENT_NODE && root.matches?.(selector)) targets.push(root);
            if (root?.querySelectorAll) targets.push(...root.querySelectorAll(selector));

            for (const target of targets) {
                const inDrawer = target.id === 'pp-ext-drawer' || Boolean(target.closest?.('#pp-ext-drawer'));
                const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
                let node;
                while ((node = walker.nextNode())) {
                    const value = node.nodeValue || '';
                    let next = value
                        .replaceAll('Pocket Phone 0.9.9', `Pocket Phone ${VERSION}`)
                        .replaceAll('Pocket Phone 0.10.3 Stable', `Pocket Phone ${VERSION}`)
                        .replaceAll('Pocket Phone 0.10.4 Recovery', `Pocket Phone ${VERSION}`)
                        .replaceAll('Pocket Phone 0.10.5 Recovery', `Pocket Phone ${VERSION}`)
                        .replaceAll('Pocket Phone 0.10.6 Stable', `Pocket Phone ${VERSION}`);
                    if (inDrawer && /^\s*0\.9\.9\s*$/.test(value)) next = value.replace('0.9.9', VERSION);
                    if (next !== value) node.nodeValue = next;
                }
            }
        } catch (error) {
            console.warn('[Pocket Phone] Version display patch failed.', error);
        }
    }

    function installVersionObserver() {
        const start = () => {
            replaceVersionLabels(document);
            const observer = new MutationObserver(records => {
                for (const record of records) {
                    for (const node of record.addedNodes) replaceVersionLabels(node);
                }
                replaceVersionLabels(document);
            });
            observer.observe(document.documentElement, { childList: true, subtree: true });
        };
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
        else start();
    }

    async function manualRecovery(button, status) {
        const accepted = window.confirm(
            'Repair Pocket Phone now?\n\nThis clears old Pocket Phone code caches and reloads SillyTavern. Contacts, messages, media, wallet data, and settings are preserved.'
        );
        if (!accepted) return;
        if (button) button.disabled = true;
        if (status) status.textContent = 'Clearing old Pocket Phone code cache…';

        try {
            const report = await clearOldCodeCaches();
            const stamp = `${VERSION}-${Date.now()}`;
            try { window.sessionStorage.setItem(BUST_KEY, stamp); } catch {}
            if (status) status.textContent = `Cleared ${report.nodes} old resources and ${report.cacheEntries} cached files. Reloading…`;
            window.setTimeout(() => {
                const url = new URL(window.location.href);
                url.searchParams.set('pp_recovery', stamp);
                window.location.replace(url.href);
            }, 350);
        } catch (error) {
            console.error('[Pocket Phone] Manual recovery failed.', error);
            if (button) button.disabled = false;
            if (status) status.textContent = `Recovery failed: ${error?.message || error}`;
        }
    }

    function installMaintenancePanel() {
        const attach = () => {
            const host = document.querySelector('#extensions_settings2, #extensions_settings');
            if (!host || document.getElementById(MAINTENANCE_ID)) return;

            const panel = document.createElement('div');
            panel.id = MAINTENANCE_ID;
            panel.className = 'extension_container';
            panel.innerHTML = `
                <div class="inline-drawer">
                    <div class="inline-drawer-toggle inline-drawer-header">
                        <b>Pocket Phone Maintenance · ${VERSION}</b>
                        <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                    </div>
                    <div class="inline-drawer-content">
                        <div style="font-size:12px;opacity:.75;margin:6px 0;">Updates clear old code caches automatically. This button is a manual fallback and does not erase phone data.</div>
                        <div class="pp-maintenance-status" style="font-size:12px;opacity:.75;min-height:16px;"></div>
                    </div>
                </div>`;
            const status = panel.querySelector('.pp-maintenance-status');
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'menu_button';
            button.style.width = '100%';
            button.value = 'Clear old code cache and reload';
            button.textContent = 'Clear old code cache and reload';
            button.addEventListener('click', () => manualRecovery(button, status));
            panel.querySelector('.inline-drawer-content')?.appendChild(button);
            host.appendChild(panel);
        };

        const start = () => {
            attach();
            const observer = new MutationObserver(() => attach());
            observer.observe(document.documentElement, { childList: true, subtree: true });
        };
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
        else start();
    }

    function loadScript(name) {
        return new Promise((resolve, reject) => {
            const id = `pp-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
            const existing = document.getElementById(id);
            if (existing) {
                if (existing.dataset.loaded === 'true') resolve(existing);
                else {
                    existing.addEventListener('load', () => resolve(existing), { once: true });
                    existing.addEventListener('error', reject, { once: true });
                }
                return;
            }

            const url = new URL(name, BASE_URL);
            url.searchParams.set('v', VERSION);
            const stamp = window.sessionStorage.getItem(BUST_KEY);
            if (stamp) url.searchParams.set('build', stamp);

            const script = document.createElement('script');
            script.id = id;
            script.src = url.href;
            script.async = false;
            script.dataset.pocketPhoneModule = name;
            script.addEventListener('load', () => {
                script.dataset.loaded = 'true';
                resolve(script);
            }, { once: true });
            script.addEventListener('error', reject, { once: true });
            document.head.appendChild(script);
        });
    }

    window.PP_EXTENSION_VERSION = VERSION;
    window.PP_CLEAR_OLD_FILES = () => manualRecovery(null, null);

    installVersionObserver();
    installMaintenancePanel();

    (async () => {
        try {
            await automaticUpdateCleanup();
            await loadScript('chat-scope.js');
            await loadScript('core.js');
            console.info(`[Pocket Phone ${VERSION}] Entry modules loaded.`);
        } catch (error) {
            console.error(`[Pocket Phone ${VERSION}] Failed to load extension modules.`, error);
            try { window.toastr?.error('Pocket Phone could not load its local modules. Open Pocket Phone Maintenance and run recovery.'); } catch {}
        }
    })();
})();
