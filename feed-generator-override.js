// Pocket Phone 0.11.3 — direct replacement for the phone's AI Feed generator.
(() => {
    'use strict';

    const VERSION = '0.11.3';
    const INSTALL_KEY = '__ppDirectFeedGenerator0113';

    function displayName(contact) {
        try { return window.dname?.(contact) || contact?.customName || contact?.name || '?'; }
        catch { return contact?.customName || contact?.name || '?'; }
    }

    function contacts() {
        try { return window.getContacts?.() || window.getCfg?.().contacts || []; }
        catch { return []; }
    }

    function isBusy() {
        try {
            return Boolean(
                (typeof ppFeedGenBusy !== 'undefined' && ppFeedGenBusy)
                || (typeof ppGeneratingId !== 'undefined' && ppGeneratingId)
            );
        } catch {
            return false;
        }
    }

    function setBusy(value) {
        try {
            ppFeedGenBusy = value;
            if (value) {
                ppFeedGenAbort = false;
                ppGenAbort = false;
            }
        } catch {}
        try { window.showFeedGenControls?.(value); } catch {}
    }

    async function generateFeedPost(forcedAuthorId) {
        if (isBusy()) return;

        const available = contacts().filter(contact => {
            try { return typeof window.isBlocked !== 'function' || !window.isBlocked(contact.id); }
            catch { return true; }
        });
        const author = forcedAuthorId
            ? available.find(contact => String(contact.id) === String(forcedAuthorId))
                || contacts().find(contact => String(contact.id) === String(forcedAuthorId))
            : available[Math.floor(Math.random() * available.length)];

        if (!author) {
            try { window.ppToast?.('ยังไม่มีคอนแทกต์ให้โพสต์'); } catch {}
            return;
        }

        setBusy(true);
        try {
            try { window.islandStatus?.(`กำลังให้ ${displayName(author)} สร้างโพสต์…`); } catch {}
            const post = await window.PP_FEED_BRIDGE.generatePostFor(
                displayName(author),
                'Create a spontaneous in-character feed post appropriate to the current story and phone context.'
            );
            if (!post) throw new Error('The model returned no usable feed post.');
        } catch (error) {
            console.error('[Pocket Phone direct feed generator] Generation failed.', error);
            try { window.ppToast?.(`สร้างโพสต์ไม่สำเร็จ: ${error?.message || error}`); } catch {}
        } finally {
            try {
                ppFeedGenBusy = false;
                ppFeedGenAbort = false;
                ppGenAbort = false;
            } catch {}
            try { window.showFeedGenControls?.(false); } catch {}
            try { window.islandCollapse?.(); } catch {}
        }
    }

    function install() {
        if (window[INSTALL_KEY]) return;
        const original = typeof window.ppFeedGenerate === 'function' ? window.ppFeedGenerate : null;
        generateFeedPost.original = original;
        window.ppFeedGenerate = generateFeedPost;
        window[INSTALL_KEY] = { version: VERSION, generateFeedPost, original };
        console.info(`[Pocket Phone ${VERSION}] Direct AI Feed generator override installed.`);
    }

    let attempts = 0;
    const timer = setInterval(() => {
        attempts += 1;
        if (window.PP_FEED_BRIDGE && typeof window.ppFeedGenerate === 'function') {
            clearInterval(timer);
            install();
        } else if (attempts > 1200) {
            clearInterval(timer);
            console.error('[Pocket Phone direct feed generator] Timed out waiting for feed bridge.');
        }
    }, 25);
})();
