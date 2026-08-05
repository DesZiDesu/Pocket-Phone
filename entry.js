// Pocket Phone 0.11.1 safe update entry.
(() => {
    'use strict';

    const VERSION = '0.11.1';
    const BUILD_KEY = 'pp-safe-entry-build';
    const BUST_KEY = 'pp-safe-entry-bust';
    const PANEL_ID = 'pp-maintenance-0111';
    const CURRENT_SCRIPT = document.currentScript;

    if (typeof window.ppGenInterceptor !== 'function') {
        const placeholder = () => {};
        placeholder.__ppNormalRoleplayBridge = true;
        window.ppGenInterceptor = placeholder;
    }

    function baseUrl() {
        if (CURRENT_SCRIPT?.src) return new URL('./', CURRENT_SCRIPT.src);
        return new URL('/scripts/extensions/third-party/Pocket-Phone/', window.location.origin);
    }

    const BASE_URL = baseUrl();

    function isPocketPhoneUrl(value) {
        const url = String(value || '').toLowerCase();
        return url.includes('/pocket-phone/')
            || url.includes('/pocket-phone@')
            || url.includes('/pocket-phone-main/')
            || url.includes('deszidesu/pocket-phone')
            || url.includes('janzanaja188-cyber/pocket-phone');
    }

    async function clearOldCodeCaches() {
        const report = { scripts: 0, cacheEntries: 0, staleKeys: 0 };

        try {
            for (const script of document.querySelectorAll('script[src]')) {
                if (script === CURRENT_SCRIPT || !isPocketPhoneUrl(script.src)) continue;
                script.remove();
                report.scripts += 1;
            }
        } catch {}

        const cleanStorage = storage => {
            try {
                const remove = [];
                for (let i = 0; i < storage.length; i += 1) {
                    const key = storage.key(i) || '';
                    const lower = key.toLowerCase();
                    if ((lower.includes('pocket-phone') || lower.includes('pocketphone') || lower.includes('pocket_phone'))
                        && (lower.includes('loader') || lower.includes('suite') || lower.includes('asset-cache') || lower.includes('build-cache'))) {
                        remove.push(key);
                    }
                }
                for (const key of remove) {
                    storage.removeItem(key);
                    report.staleKeys += 1;
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
                        if (await cache.delete(request)) report.cacheEntries += 1;
                    }
                }
            }
        } catch (error) {
            console.warn('[Pocket Phone] Cache Storage cleanup unavailable.', error);
        }

        try { performance.clearResourceTimings?.(); } catch {}
        return report;
    }

    function reloadWithMarker(parameter, value) {
        const url = new URL(window.location.href);
        url.searchParams.set(parameter, value);
        window.location.replace(url.href);
    }

    async function cleanAfterUpdateAndReload() {
        let previous = '';
        try { previous = window.localStorage.getItem(BUILD_KEY) || ''; } catch {}
        if (previous === VERSION) return false;

        const report = await clearOldCodeCaches();
        const stamp = `${VERSION}-${Date.now()}`;
        try {
            window.localStorage.setItem(BUILD_KEY, VERSION);
            window.sessionStorage.setItem(BUST_KEY, stamp);
        } catch {}
        console.info(`[Pocket Phone ${VERSION}] Update detected (${previous || 'first install'} → ${VERSION}). Old code cache cleared; reloading once.`, report);
        reloadWithMarker('pp_updated', stamp);
        return true;
    }

    function patchVersion(root = document) {
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
                    const old = node.nodeValue || '';
                    let next = old.replace(/Pocket Phone (?:0\.9\.9|0\.10\.[3-6](?: Stable| Recovery)?|0\.11\.0)/g, `Pocket Phone ${VERSION}`);
                    if (inDrawer && /^\s*0\.9\.9\s*$/.test(old)) next = old.replace('0.9.9', VERSION);
                    if (next !== old) node.nodeValue = next;
                }
            }
        } catch {}
    }

    function installVersionObserver() {
        const start = () => {
            patchVersion(document);
            const observer = new MutationObserver(records => {
                for (const record of records) for (const node of record.addedNodes) patchVersion(node);
                patchVersion(document);
            });
            observer.observe(document.documentElement, { childList: true, subtree: true });
        };
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
        else start();
    }

    async function manualRecovery(button, status) {
        if (!window.confirm('Clear old Pocket Phone code caches and reload?\n\nContacts, messages, media, wallet data, feed data, and settings are preserved.')) return;
        if (button) button.disabled = true;
        if (status) status.textContent = 'Clearing old code cache…';
        try {
            const report = await clearOldCodeCaches();
            const stamp = `${VERSION}-${Date.now()}`;
            try { window.sessionStorage.setItem(BUST_KEY, stamp); } catch {}
            if (status) status.textContent = `Cleared ${report.scripts} old scripts and ${report.cacheEntries} cached files. Reloading…`;
            setTimeout(() => reloadWithMarker('pp_recovery', stamp), 300);
        } catch (error) {
            console.error('[Pocket Phone] Recovery failed.', error);
            if (button) button.disabled = false;
            if (status) status.textContent = `Recovery failed: ${error?.message || error}`;
        }
    }

    function installMaintenancePanel() {
        const attach = () => {
            const host = document.querySelector('#extensions_settings2, #extensions_settings');
            if (!host || document.getElementById(PANEL_ID)) return;
            const panel = document.createElement('div');
            panel.id = PANEL_ID;
            panel.className = 'extension_container';
            panel.innerHTML = `
                <div class="inline-drawer">
                    <div class="inline-drawer-toggle inline-drawer-header">
                        <b>Pocket Phone Maintenance · ${VERSION}</b>
                        <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                    </div>
                    <div class="inline-drawer-content">
                        <div style="font-size:12px;opacity:.75;margin:6px 0;">Updates clean old code automatically and reload once. This manual fallback preserves all Pocket Phone data.</div>
                        <div class="pp-maintenance-status" style="font-size:12px;opacity:.75;min-height:16px;"></div>
                    </div>
                </div>`;
            const status = panel.querySelector('.pp-maintenance-status');
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'menu_button';
            button.style.width = '100%';
            button.textContent = 'Clear old code cache and reload';
            button.addEventListener('click', () => manualRecovery(button, status));
            panel.querySelector('.inline-drawer-content')?.appendChild(button);
            host.appendChild(panel);
        };
        const start = () => {
            attach();
            new MutationObserver(attach).observe(document.documentElement, { childList: true, subtree: true });
        };
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
        else start();
    }

    function loadScript(filename) {
        return new Promise((resolve, reject) => {
            const url = new URL(filename, BASE_URL);
            url.searchParams.set('v', VERSION);
            const stamp = window.sessionStorage.getItem(BUST_KEY);
            if (stamp) url.searchParams.set('build', stamp);
            const script = document.createElement('script');
            script.src = url.href;
            script.async = false;
            script.dataset.pocketPhoneModule = filename;
            script.addEventListener('load', resolve, { once: true });
            script.addEventListener('error', reject, { once: true });
            document.head.appendChild(script);
        });
    }

    function removeReloadMarkers() {
        try {
            const url = new URL(window.location.href);
            let changed = false;
            for (const key of ['pp_updated', 'pp_recovery', 'pp_world']) {
                if (!url.searchParams.has(key)) continue;
                url.searchParams.delete(key);
                changed = true;
            }
            if (changed) window.history.replaceState(window.history.state, '', url.href);
        } catch {}
    }

    window.PP_EXTENSION_VERSION = VERSION;
    window.PP_CLEAR_OLD_FILES = () => manualRecovery(null, null);
    installVersionObserver();
    installMaintenancePanel();

    (async () => {
        try {
            if (await cleanAfterUpdateAndReload()) return;
            removeReloadMarkers();
            await loadScript('chat-scope.js');
            await loadScript('core.js');
            console.info(`[Pocket Phone ${VERSION}] Stable core and per-chat module loaded.`);
        } catch (error) {
            console.error(`[Pocket Phone ${VERSION}] Module load failed.`, error);
            try { window.toastr?.error('Pocket Phone could not load. Open Pocket Phone Maintenance and run recovery.'); } catch {}
        }
    })();
})();
