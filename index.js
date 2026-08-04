// Pocket Phone 0.10.2 integration fork.
// Loads the pinned upstream implementation, then loads the optional feature suite
// as one normal external script. No blob: URLs or inline eval are used.

const POCKET_PHONE_VERSION = '0.10.2';
const POCKET_PHONE_UPSTREAM_VERSION = '0.9.9';
const POCKET_PHONE_UPSTREAM_COMMIT = 'f22ed2fcced366031b6f88271db921ebcf007d32';
const POCKET_PHONE_FEATURE_COMMIT = 'e8a0f0aff4c10f180154ea987acbce10131bf2bd';
const POCKET_PHONE_UPSTREAM_URL = `https://cdn.jsdelivr.net/gh/janzanaja188-cyber/pocket-phone@${POCKET_PHONE_UPSTREAM_COMMIT}/index.js`;
const POCKET_PHONE_FEATURE_URL = `https://cdn.jsdelivr.net/combine/gh/DesZiDesu/Pocket-Phone@${POCKET_PHONE_FEATURE_COMMIT}/features/feature-suite.01.js,gh/DesZiDesu/Pocket-Phone@${POCKET_PHONE_FEATURE_COMMIT}/features/feature-suite.02.js,gh/DesZiDesu/Pocket-Phone@${POCKET_PHONE_FEATURE_COMMIT}/features/feature-suite.03.js,gh/DesZiDesu/Pocket-Phone@${POCKET_PHONE_FEATURE_COMMIT}/features/feature-suite.04.js,gh/DesZiDesu/Pocket-Phone@${POCKET_PHONE_FEATURE_COMMIT}/features/feature-suite.05.js,gh/DesZiDesu/Pocket-Phone@${POCKET_PHONE_FEATURE_COMMIT}/features/feature-suite.06.js`;
const LOADER_KEY = '__deszidesuPocketPhoneLoader0102';
const INTERCEPTOR_WRAPPER_KEY = '__deszidesuPocketPhoneInterceptorWrapper0100';

window.PP_FORK_VERSION = POCKET_PHONE_VERSION;

if (!window[INTERCEPTOR_WRAPPER_KEY]) {
    window[INTERCEPTOR_WRAPPER_KEY] = function pocketPhoneInterceptorWrapper(...args) {
        const suite = window.__ppFeatureSuiteInterceptor;
        if (typeof suite === 'function') return suite.apply(this, args);
        const upstream = window.__ppUpstreamInterceptor;
        if (typeof upstream === 'function') return upstream.apply(this, args);
    };
}
window.ppGenInterceptor = window[INTERCEPTOR_WRAPPER_KEY];

function loadClassicScript(url, marker) {
    return new Promise((resolve, reject) => {
        const selector = `script[data-pocket-phone-module="${marker}"]`;
        const existing = document.querySelector(selector);
        if (existing) {
            if (existing.dataset.loaded === 'true') {
                resolve();
                return;
            }
            existing.addEventListener('load', resolve, { once: true });
            existing.addEventListener('error', reject, { once: true });
            return;
        }

        const script = document.createElement('script');
        script.src = url;
        script.async = false;
        script.dataset.pocketPhoneModule = marker;
        script.addEventListener('load', () => {
            script.dataset.loaded = 'true';
            resolve();
        }, { once: true });
        script.addEventListener('error', () => {
            reject(new Error(`Failed to load ${marker} from ${url}`));
        }, { once: true });
        document.head.appendChild(script);
    });
}

function patchVisibleVersion(root = document) {
    try {
        const targets = [];
        if (root.nodeType === Node.ELEMENT_NODE || root.nodeType === Node.DOCUMENT_NODE) targets.push(root);
        if (root.querySelectorAll) targets.push(...root.querySelectorAll('#pp-dialog, #pp-settings-body, .pp-hint'));

        const seen = new Set();
        for (const target of targets) {
            if (!target || seen.has(target)) continue;
            seen.add(target);
            const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
            let node;
            while ((node = walker.nextNode())) {
                if (node.nodeValue?.includes('Pocket Phone 0.9.9')) {
                    node.nodeValue = node.nodeValue.replaceAll('Pocket Phone 0.9.9', `Pocket Phone ${POCKET_PHONE_VERSION}`);
                }
            }
        }
    } catch (error) {
        console.debug('[Pocket Phone] Version label patch skipped.', error);
    }
}

function installVersionPatch() {
    const start = () => {
        patchVisibleVersion(document);
        const observer = new MutationObserver(records => {
            for (const record of records) {
                for (const node of record.addedNodes) patchVisibleVersion(node);
            }
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
}

async function loadUpstream() {
    await loadClassicScript(POCKET_PHONE_UPSTREAM_URL, `upstream-${POCKET_PHONE_UPSTREAM_VERSION}`);
    const loaded = window.ppGenInterceptor;
    if (typeof loaded === 'function' && loaded !== window[INTERCEPTOR_WRAPPER_KEY]) {
        window.__ppUpstreamInterceptor = loaded;
    }
    window.ppGenInterceptor = window[INTERCEPTOR_WRAPPER_KEY];
    console.info(`[Pocket Phone ${POCKET_PHONE_VERSION}] Loaded upstream ${POCKET_PHONE_UPSTREAM_VERSION} from pinned commit ${POCKET_PHONE_UPSTREAM_COMMIT}.`);
}

async function loadOptionalFeatureSuite() {
    try {
        await loadClassicScript(POCKET_PHONE_FEATURE_URL, `feature-suite-${POCKET_PHONE_VERSION}`);
        window.ppGenInterceptor = window[INTERCEPTOR_WRAPPER_KEY];
        console.info(`[Pocket Phone ${POCKET_PHONE_VERSION}] Optional feature suite loaded.`);
    } catch (error) {
        console.error('[Pocket Phone] Optional feature suite failed to load; the base phone remains available.', error);
        try {
            window.toastr?.warning('Pocket Phone loaded, but optional features could not start. The base phone is still available.');
        } catch {}
    }
}

installVersionPatch();

if (!window[LOADER_KEY]) {
    window[LOADER_KEY] = loadUpstream()
        .then(loadOptionalFeatureSuite)
        .catch(error => {
            console.error('[Pocket Phone] Base phone failed to load.', error);
            try {
                window.toastr?.error('Pocket Phone base could not load. Check the network connection and reload SillyTavern.');
            } catch {}
        });
}
