// Pocket Phone 0.9.9 compatibility mirror.
// Loads the exact upstream repository snapshot pinned below.

const POCKET_PHONE_VERSION = '0.9.9';
const POCKET_PHONE_UPSTREAM_COMMIT = 'f22ed2fcced366031b6f88271db921ebcf007d32';
const POCKET_PHONE_SCRIPT_URL = `https://cdn.jsdelivr.net/gh/janzanaja188-cyber/pocket-phone@${POCKET_PHONE_UPSTREAM_COMMIT}/index.js`;
const LOADER_KEY = '__deszidesuPocketPhone099Loader';

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

window[LOADER_KEY].catch(() => {
    // The detailed error is logged above; consume the rejection to avoid an unhandled-promise warning.
});
