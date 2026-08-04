// Pocket Phone 0.10.0 integration fork.
// Loads the pinned upstream implementation, then installs the optional feature suite.
// All newly added feature-suite systems default to disabled.

const POCKET_PHONE_VERSION = '0.10.0';
const POCKET_PHONE_UPSTREAM_VERSION = '0.9.9';
const POCKET_PHONE_UPSTREAM_COMMIT = 'f22ed2fcced366031b6f88271db921ebcf007d32';
const POCKET_PHONE_UPSTREAM_URL = `https://cdn.jsdelivr.net/gh/janzanaja188-cyber/pocket-phone@${POCKET_PHONE_UPSTREAM_COMMIT}/index.js`;
const POCKET_PHONE_LOCAL_BASE = new URL('.', document.currentScript?.src || location.href).href;
const POCKET_PHONE_SUITE_PARTS = [
    'features/feature-suite.01.txt',
    'features/feature-suite.02.txt',
    'features/feature-suite.03.txt',
    'features/feature-suite.04.txt',
    'features/feature-suite.05.txt',
    'features/feature-suite.06.txt',
].map(path => new URL(path, POCKET_PHONE_LOCAL_BASE).href);
const LOADER_KEY = '__deszidesuPocketPhoneLoader0100';
const INTERCEPTOR_WRAPPER_KEY = '__deszidesuPocketPhoneInterceptorWrapper0100';
const UPSTREAM_CACHE_KEY = '__pp_upstream_099_cache';

function readFeatureSuiteFlags() {
    try {
        const mirror = JSON.parse(localStorage.getItem('pp_cfg_mirror') || '{}');
        return mirror?.featureSuite || {};
    } catch {
        return {};
    }
}

if (!window[INTERCEPTOR_WRAPPER_KEY]) {
    window[INTERCEPTOR_WRAPPER_KEY] = function pocketPhoneInterceptorWrapper(...args) {
        const suite = window.__ppFeatureSuiteInterceptor;
        if (typeof suite === 'function') return suite.apply(this, args);
        const upstream = window.__ppUpstreamInterceptor;
        if (typeof upstream === 'function') return upstream.apply(this, args);
    };
}
window.ppGenInterceptor = window[INTERCEPTOR_WRAPPER_KEY];

function executeUpstreamSource(source) {
    return new Promise((resolve, reject) => {
        try {
            const blob = new Blob([source], { type: 'text/javascript' });
            const url = URL.createObjectURL(blob);
            const script = document.createElement('script');
            script.src = url;
            script.async = false;
            script.addEventListener('load', () => {
                URL.revokeObjectURL(url);
                resolve();
            }, { once: true });
            script.addEventListener('error', event => {
                URL.revokeObjectURL(url);
                reject(event);
            }, { once: true });
            document.head.appendChild(script);
        } catch (error) {
            reject(error);
        }
    });
}

function loadUpstreamByScriptTag() {
    return new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[data-pocket-phone-upstream="${POCKET_PHONE_UPSTREAM_VERSION}"]`);
        if (existing) {
            if (existing.dataset.loaded === 'true') resolve();
            else {
                existing.addEventListener('load', resolve, { once: true });
                existing.addEventListener('error', reject, { once: true });
            }
            return;
        }

        const script = document.createElement('script');
        script.src = POCKET_PHONE_UPSTREAM_URL;
        script.async = false;
        script.dataset.pocketPhoneUpstream = POCKET_PHONE_UPSTREAM_VERSION;
        script.addEventListener('load', () => {
            script.dataset.loaded = 'true';
            resolve();
        }, { once: true });
        script.addEventListener('error', reject, { once: true });
        document.head.appendChild(script);
    });
}

async function loadUpstream() {
    const flags = readFeatureSuiteFlags();
    if (!flags.offlineCacheEnabled) {
        await loadUpstreamByScriptTag();
        return;
    }

    try {
        const response = await fetch(POCKET_PHONE_UPSTREAM_URL, { cache: 'no-cache' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const source = await response.text();
        try { localStorage.setItem(UPSTREAM_CACHE_KEY, source); } catch {}
        await executeUpstreamSource(source);
    } catch (networkError) {
        const cached = localStorage.getItem(UPSTREAM_CACHE_KEY);
        if (!cached) throw networkError;
        console.warn('[Pocket Phone] Network load failed; using the optional cached upstream source.', networkError);
        await executeUpstreamSource(cached);
    }
}

async function loadFeatureSuite() {
    const responses = await Promise.all(POCKET_PHONE_SUITE_PARTS.map(async url => {
        const response = await fetch(url, { cache: 'no-cache' });
        if (!response.ok) throw new Error(`Feature-suite part failed: ${url} (${response.status})`);
        return response.text();
    }));
    await executeUpstreamSource(responses.join('\n'));
}

if (!window[LOADER_KEY]) {
    window[LOADER_KEY] = loadUpstream()
        .then(() => {
            const loaded = window.ppGenInterceptor;
            if (typeof loaded === 'function' && loaded !== window[INTERCEPTOR_WRAPPER_KEY]) {
                window.__ppUpstreamInterceptor = loaded;
            }
            window.ppGenInterceptor = window[INTERCEPTOR_WRAPPER_KEY];
            console.info(`[Pocket Phone ${POCKET_PHONE_VERSION}] Loaded upstream ${POCKET_PHONE_UPSTREAM_VERSION} from pinned commit ${POCKET_PHONE_UPSTREAM_COMMIT}.`);
            return loadFeatureSuite();
        })
        .then(() => {
            window.ppGenInterceptor = window[INTERCEPTOR_WRAPPER_KEY];
            console.info(`[Pocket Phone ${POCKET_PHONE_VERSION}] Optional feature suite loaded.`);
        })
        .catch(error => {
            console.error('[Pocket Phone]', error);
            try {
                window.toastr?.error('Pocket Phone could not load. Check the browser console and reload SillyTavern.');
            } catch {}
        });
}
