// Pocket Phone 0.11.0 — optional per-SillyTavern-chat worlds and contact deletion.
(() => {
    'use strict';

    const VERSION = '0.11.0';
    const INSTALL_KEY = '__ppChatWorlds0110';
    const ENABLE_KEY = 'ppPerChatWorldsEnabled';
    const WORLDS_KEY = 'ppChatWorlds';
    const WORLD_SCHEMA_KEY = 'ppChatWorldSchema';
    const WORLD_SCHEMA = 1;
    const CONTROL_CLASS = 'pp-chat-world-controls';
    const DELETE_CONTROL_ID = 'pp-delete-contact-control';

    const WORLD_DEFAULTS = {
        contacts: [], threads: {}, chatStyle: {}, callLog: [], pinned: [], userNote: null,
        botNotes: {}, userAppName: '', stories: [], storySeen: {}, feedPosts: [], periods: [],
        groups: [], notifCenter: [], walletBalance: 50000, walletAccount: '', walletName: '',
        walletHistory: [], botWallets: {}, actionLog: [], logStamps: [], periodLogs: {},
        periodSharedWith: null, userHandle: '', userBio: '', userLink: '', accountLocked: false,
        followRequests: [], followers: [], following: [], closeFriends: [], blocked: [], restricted: [],
        mutedChats: [], archivedChats: [], starred: {}, drafts: {}, scheduled: {}, unread: {},
        savedPosts: [], archivedPosts: [], storyHighlights: [], hashtagSeen: {}, walletRequests: [],
    };

    const WORLD_KEYS = new Set(Object.keys(WORLD_DEFAULTS));
    const IDENTITY_FIELDS = new Set([
        'id', 'cid', 'contactId', 'contactID', 'author', 'authorId', 'ownerId', 'userId',
        'senderId', 'fromId', 'targetId', 'botId', 'memberId', 'characterId', 'baseCharId',
    ]);

    const cloneValue = value => {
        try { return structuredClone(value); }
        catch {
            try { return JSON.parse(JSON.stringify(value)); }
            catch { return value; }
        }
    };

    function context() {
        try { return window.SillyTavern?.getContext?.() || null; }
        catch { return null; }
    }

    function safePart(value) {
        return encodeURIComponent(String(value == null ? '' : value).trim() || 'unknown');
    }

    function currentRouteInfo() {
        const c = context();
        let entityType = 'character';
        let entityId = '';
        let entityName = '';

        const groupId = c?.groupId ?? c?.group_id ?? c?.selectedGroup ?? c?.selected_group ?? window.selected_group;
        if (groupId !== undefined && groupId !== null && groupId !== '') {
            entityType = 'group';
            entityId = String(groupId);
            entityName = c?.groups?.find?.(group => String(group?.id) === entityId)?.name || `Group ${entityId}`;
        } else {
            const characterId = c?.characterId;
            const character = Array.isArray(c?.characters) && characterId != null ? c.characters[characterId] : null;
            entityId = character?.avatar || character?.name || characterId || c?.name2 || 'unknown-character';
            entityName = character?.name || c?.name2 || String(entityId);
        }

        let chatId = c?.chatId;
        try {
            if ((chatId === undefined || chatId === null || chatId === '') && typeof c?.getCurrentChatId === 'function') {
                chatId = c.getCurrentChatId();
            }
        } catch {}
        chatId = chatId ?? c?.chatMetadata?.chat_id ?? c?.chatMetadata?.file_name ?? c?.chatName ?? c?.chat_file ?? '';

        let provisional = false;
        if (chatId === '') {
            provisional = true;
            const provisionalKey = `pp-provisional-route:${entityType}:${safePart(entityId)}`;
            try {
                chatId = window.sessionStorage.getItem(provisionalKey);
                if (!chatId) {
                    chatId = `provisional-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
                    window.sessionStorage.setItem(provisionalKey, chatId);
                }
            } catch {
                chatId = 'provisional';
            }
        }

        return {
            entityType,
            entityId: String(entityId),
            entityName,
            chatId: String(chatId),
            provisional,
            key: `${entityType}:${safePart(entityId)}::chat:${safePart(chatId)}`,
            label: `${entityName || entityId} · ${chatId}`,
        };
    }

    function normalizeWorld(world) {
        const target = world && typeof world === 'object' ? world : {};
        for (const [key, fallback] of Object.entries(WORLD_DEFAULTS)) {
            if (target[key] === undefined) target[key] = cloneValue(fallback);
        }
        return target;
    }

    function recordReferencesContact(record, contactId) {
        if (!record || typeof record !== 'object') return record === contactId;
        for (const [key, value] of Object.entries(record)) {
            if (IDENTITY_FIELDS.has(key) && String(value) === String(contactId)) return true;
        }
        return false;
    }

    function scrubContactReferences(value, contactId) {
        if (Array.isArray(value)) {
            return value
                .filter(item => String(item) !== String(contactId))
                .filter(item => !recordReferencesContact(item, contactId))
                .map(item => scrubContactReferences(item, contactId));
        }
        if (!value || typeof value !== 'object') return value;

        const result = value;
        for (const key of Object.keys(result)) {
            if (String(key) === String(contactId)) {
                delete result[key];
                continue;
            }
            const current = result[key];
            if (Array.isArray(current) || (current && typeof current === 'object')) {
                result[key] = scrubContactReferences(current, contactId);
            } else if (IDENTITY_FIELDS.has(key) && String(current) === String(contactId)) {
                delete result[key];
            }
        }
        return result;
    }

    function collectMediaKeys(value, output = new Set()) {
        if (!value) return output;
        if (Array.isArray(value)) {
            value.forEach(item => collectMediaKeys(item, output));
            return output;
        }
        if (typeof value !== 'object') return output;
        for (const [key, item] of Object.entries(value)) {
            if ((key === 'mediaKey' || key === 'imageKey') && typeof item === 'string' && item) output.add(item);
            else if (key === 'mediaKeys' && Array.isArray(item)) item.filter(Boolean).forEach(mediaKey => output.add(mediaKey));
            else collectMediaKeys(item, output);
        }
        return output;
    }

    function matchingMapKey(key, contactId) {
        const text = String(key);
        const id = String(contactId);
        return text === id || text.startsWith(`${id}::`);
    }

    function removeMapEntries(map, contactId, removedValues) {
        if (!map || typeof map !== 'object') return;
        for (const key of Object.keys(map)) {
            if (!matchingMapKey(key, contactId)) continue;
            if (removedValues) removedValues.push(map[key]);
            delete map[key];
        }
    }

    function saveRoot(root) {
        try { window.localStorage.setItem('pp_cfg_mirror', JSON.stringify(root)); } catch {}
        try {
            const c = context();
            if (typeof c?.saveSettingsDebounced === 'function') c.saveSettingsDebounced();
            else if (typeof c?.saveSettings === 'function') c.saveSettings();
        } catch (error) {
            console.warn('[Pocket Phone chat worlds] Saving extension settings failed.', error);
        }
    }

    function install() {
        if (window[INSTALL_KEY]) return;
        if (typeof window.getCfg !== 'function' || typeof window.saveCfg !== 'function') return;

        const originalGetCfg = window.getCfg;
        const originalDeleteChat = typeof window.ppDeleteChat === 'function' ? window.ppDeleteChat : null;
        const proxyCache = new Map();
        let lastRoute = currentRouteInfo();

        const rootCfg = () => {
            const root = originalGetCfg();
            if (root[ENABLE_KEY] === undefined) root[ENABLE_KEY] = false;
            if (!root[WORLDS_KEY] || typeof root[WORLDS_KEY] !== 'object') root[WORLDS_KEY] = {};
            if (root[WORLD_SCHEMA_KEY] === undefined) root[WORLD_SCHEMA_KEY] = WORLD_SCHEMA;
            return root;
        };

        function migrateProvisionalRoute(root, route) {
            if (!lastRoute?.provisional || route.provisional) return;
            if (lastRoute.entityType !== route.entityType || lastRoute.entityId !== route.entityId) return;
            const worlds = root[WORLDS_KEY];
            if (worlds[lastRoute.key] && !worlds[route.key]) {
                worlds[route.key] = worlds[lastRoute.key];
                delete worlds[lastRoute.key];
                saveRoot(root);
            }
        }

        function worldFor(route, create = true) {
            const root = rootCfg();
            migrateProvisionalRoute(root, route);
            const worlds = root[WORLDS_KEY];
            if (!worlds[route.key] && create) worlds[route.key] = normalizeWorld({});
            if (worlds[route.key]) normalizeWorld(worlds[route.key]);
            return worlds[route.key] || null;
        }

        function mergedSnapshot(root, world) {
            const merged = {};
            for (const key of Reflect.ownKeys(root)) {
                if (typeof key === 'string' && WORLD_KEYS.has(key)) continue;
                merged[key] = root[key];
            }
            for (const key of WORLD_KEYS) merged[key] = world[key];
            return merged;
        }

        function proxyFor(route) {
            const root = rootCfg();
            const world = worldFor(route, true);
            if (proxyCache.has(route.key)) return proxyCache.get(route.key);
            const proxy = new Proxy(root, {
                get(target, property, receiver) {
                    if (property === '__ppRootConfig') return root;
                    if (property === '__ppChatWorld') return world;
                    if (property === '__ppRouteKey') return route.key;
                    if (property === 'toJSON') return () => mergedSnapshot(root, world);
                    if (typeof property === 'string' && WORLD_KEYS.has(property)) return world[property];
                    return Reflect.get(target, property, receiver);
                },
                set(target, property, value, receiver) {
                    if (typeof property === 'string' && WORLD_KEYS.has(property)) {
                        world[property] = value;
                        return true;
                    }
                    return Reflect.set(target, property, value, receiver);
                },
                deleteProperty(target, property) {
                    if (typeof property === 'string' && WORLD_KEYS.has(property)) {
                        delete world[property];
                        return true;
                    }
                    return Reflect.deleteProperty(target, property);
                },
                has(target, property) {
                    return (typeof property === 'string' && WORLD_KEYS.has(property)) || Reflect.has(target, property);
                },
                ownKeys(target) {
                    return Array.from(new Set([...Reflect.ownKeys(target), ...WORLD_KEYS]));
                },
                getOwnPropertyDescriptor(target, property) {
                    if (typeof property === 'string' && WORLD_KEYS.has(property)) {
                        return { configurable: true, enumerable: true, writable: true, value: world[property] };
                    }
                    return Reflect.getOwnPropertyDescriptor(target, property)
                        || { configurable: true, enumerable: true, writable: true, value: target[property] };
                },
                defineProperty(target, property, descriptor) {
                    if (typeof property === 'string' && WORLD_KEYS.has(property)) {
                        if ('value' in descriptor) world[property] = descriptor.value;
                        return true;
                    }
                    return Reflect.defineProperty(target, property, descriptor);
                },
            });
            proxyCache.set(route.key, proxy);
            return proxy;
        }

        function scopedGetCfg() {
            const root = rootCfg();
            if (!root[ENABLE_KEY]) return root;
            return proxyFor(currentRouteInfo());
        }

        function scopedSaveCfg() {
            saveRoot(rootCfg());
        }

        scopedGetCfg.__ppPerChatWorlds = true;
        scopedSaveCfg.__ppPerChatWorlds = true;
        window.getCfg = scopedGetCfg;
        window.saveCfg = scopedSaveCfg;

        function snapshotGlobalWorld(root) {
            const world = {};
            for (const [key, fallback] of Object.entries(WORLD_DEFAULTS)) {
                world[key] = cloneValue(root[key] === undefined ? fallback : root[key]);
            }
            return normalizeWorld(world);
        }

        function setEnabled(enabled) {
            const root = rootCfg();
            const route = currentRouteInfo();
            if (enabled && !root[ENABLE_KEY]) {
                if (!root[WORLDS_KEY][route.key]) root[WORLDS_KEY][route.key] = snapshotGlobalWorld(root);
                root[ENABLE_KEY] = true;
            } else if (!enabled && root[ENABLE_KEY]) {
                root[ENABLE_KEY] = false;
            }
            saveRoot(root);
            try {
                const url = new URL(window.location.href);
                url.searchParams.set('pp_world', `${enabled ? 'on' : 'off'}-${Date.now()}`);
                window.location.replace(url.href);
            } catch {
                window.location.reload();
            }
        }

        function makeControls(compact = false) {
            const root = rootCfg();
            const route = currentRouteInfo();
            const wrapper = document.createElement('div');
            wrapper.className = CONTROL_CLASS;
            wrapper.style.cssText = compact
                ? 'margin:10px 0;padding:10px;border:1px solid rgba(255,255,255,.14);border-radius:10px;'
                : 'margin:12px 0;padding:12px;border:1px solid rgba(255,255,255,.14);border-radius:12px;background:rgba(255,255,255,.035);';
            const title = document.createElement('div');
            title.textContent = 'Per-chat phone worlds';
            title.style.cssText = 'font-weight:700;margin-bottom:6px;';
            const label = document.createElement('label');
            label.style.cssText = 'display:flex;align-items:center;gap:10px;cursor:pointer;';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = Boolean(root[ENABLE_KEY]);
            const text = document.createElement('span');
            text.textContent = 'Keep contacts, messages, feed, wallet, calls, groups, and activity separate for every SillyTavern chat';
            label.append(checkbox, text);
            const help = document.createElement('div');
            help.style.cssText = 'font-size:12px;opacity:.7;margin-top:7px;line-height:1.45;';
            help.textContent = `Current route: ${route.label}. This option is off by default. Enabling it copies the current global phone into this chat, while new chats start with a fresh phone.`;
            checkbox.addEventListener('change', () => {
                const enabling = checkbox.checked;
                const message = enabling
                    ? 'Enable per-chat phone worlds?\n\nThe current global Pocket Phone data will be copied into this SillyTavern chat. Other chats will receive separate fresh phone data. Existing global data is preserved.'
                    : 'Disable per-chat phone worlds?\n\nPocket Phone will return to the preserved global phone. Per-chat worlds remain stored and can be enabled again later.';
                if (!window.confirm(message)) {
                    checkbox.checked = !enabling;
                    return;
                }
                setEnabled(enabling);
            });
            wrapper.append(title, label, help);
            return wrapper;
        }

        function attachWorldControls() {
            const drawer = document.querySelector('#pp-ext-drawer .inline-drawer-content');
            if (drawer && !drawer.querySelector(`.${CONTROL_CLASS}`)) drawer.appendChild(makeControls(true));
            const settings = document.querySelector('#pp-settings-body');
            if (settings && !settings.querySelector(`.${CONTROL_CLASS}`)) settings.appendChild(makeControls(false));
        }

        async function deleteContactData(contactId) {
            const cfg = scopedGetCfg();
            const contact = typeof window.findContact === 'function'
                ? window.findContact(contactId)
                : cfg.contacts.find(item => item.id === contactId);
            if (!contact) return false;
            const displayName = typeof window.dname === 'function'
                ? window.dname(contact)
                : (contact.customName || contact.name || contactId);
            const mediaKeys = new Set();
            const removedThreadValues = [];

            cfg.contacts = (cfg.contacts || []).filter(item => String(item.id) !== String(contactId));
            removeMapEntries(cfg.threads, contactId, removedThreadValues);
            removeMapEntries(cfg.chatStyle, contactId);
            removeMapEntries(cfg.starred, contactId);
            removeMapEntries(cfg.unread, contactId);
            removeMapEntries(cfg.drafts, contactId);
            removeMapEntries(cfg.scheduled, contactId);
            if (cfg.botNotes) delete cfg.botNotes[contactId];
            if (cfg.botWallets) delete cfg.botWallets[contactId];

            cfg.pinned = (cfg.pinned || []).filter(id => String(id) !== String(contactId));
            cfg.mutedChats = (cfg.mutedChats || []).filter(id => String(id) !== String(contactId));
            cfg.archivedChats = (cfg.archivedChats || []).filter(id => String(id) !== String(contactId));
            cfg.callLog = (cfg.callLog || []).filter(entry => String(entry?.cid) !== String(contactId));
            cfg.walletHistory = (cfg.walletHistory || []).filter(entry => !recordReferencesContact(entry, contactId));
            cfg.walletRequests = scrubContactReferences(cfg.walletRequests || [], contactId);
            cfg.notifCenter = scrubContactReferences(cfg.notifCenter || [], contactId);

            const removedPosts = (cfg.feedPosts || []).filter(post => recordReferencesContact(post, contactId));
            const removedStories = (cfg.stories || []).filter(story => recordReferencesContact(story, contactId));
            collectMediaKeys(removedPosts, mediaKeys);
            collectMediaKeys(removedStories, mediaKeys);
            const removedPostIds = new Set(removedPosts.map(post => String(post?.id || '')).filter(Boolean));
            const removedStoryIds = new Set(removedStories.map(story => String(story?.id || '')).filter(Boolean));

            cfg.feedPosts = scrubContactReferences(cfg.feedPosts || [], contactId);
            cfg.stories = scrubContactReferences(cfg.stories || [], contactId);
            cfg.followRequests = scrubContactReferences(cfg.followRequests || [], contactId);
            cfg.followers = scrubContactReferences(cfg.followers || [], contactId);
            cfg.following = scrubContactReferences(cfg.following || [], contactId);
            cfg.closeFriends = scrubContactReferences(cfg.closeFriends || [], contactId);
            cfg.blocked = scrubContactReferences(cfg.blocked || [], contactId);
            cfg.restricted = scrubContactReferences(cfg.restricted || [], contactId);
            cfg.savedPosts = (cfg.savedPosts || []).filter(id => !removedPostIds.has(String(id)));
            cfg.archivedPosts = (cfg.archivedPosts || []).filter(id => !removedPostIds.has(String(id)));
            cfg.storyHighlights = (cfg.storyHighlights || []).filter(item => {
                const id = typeof item === 'object' ? item?.id ?? item?.storyId : item;
                return !removedStoryIds.has(String(id));
            });
            if (cfg.storySeen && typeof cfg.storySeen === 'object') {
                for (const storyId of removedStoryIds) delete cfg.storySeen[storyId];
            }
            if (String(cfg.periodSharedWith) === String(contactId)) cfg.periodSharedWith = null;

            const removedGroupIds = [];
            cfg.groups = (cfg.groups || []).map(group => ({
                ...group,
                members: (group.members || []).filter(memberId => String(memberId) !== String(contactId)),
            })).filter(group => {
                const keep = (group.members || []).length >= 2;
                if (!keep) removedGroupIds.push(group.id);
                return keep;
            });
            for (const groupId of removedGroupIds) {
                removeMapEntries(cfg.threads, groupId, removedThreadValues);
                removeMapEntries(cfg.chatStyle, groupId);
                removeMapEntries(cfg.starred, groupId);
                removeMapEntries(cfg.unread, groupId);
                removeMapEntries(cfg.drafts, groupId);
                removeMapEntries(cfg.scheduled, groupId);
                cfg.pinned = (cfg.pinned || []).filter(id => String(id) !== String(groupId));
                cfg.mutedChats = (cfg.mutedChats || []).filter(id => String(id) !== String(groupId));
                cfg.archivedChats = (cfg.archivedChats || []).filter(id => String(id) !== String(groupId));
            }
            removedThreadValues.forEach(value => collectMediaKeys(value, mediaKeys));

            const nameNeedle = String(displayName || '').toLowerCase();
            cfg.actionLog = (cfg.actionLog || []).filter(entry => {
                const content = JSON.stringify(entry || '').toLowerCase();
                return !content.includes(String(contactId).toLowerCase()) && (!nameNeedle || !content.includes(nameNeedle));
            });
            cfg.logStamps = scrubContactReferences(cfg.logStamps || [], contactId);

            scopedSaveCfg();
            for (const mediaKey of mediaKeys) {
                try {
                    if (typeof window.delMedia === 'function') await window.delMedia(mediaKey);
                } catch {}
            }
            try {
                if (typeof window.ppNav === 'function') window.ppNav('messages');
                window.renderNotesRow?.();
                window.renderContactList?.();
                window.updateHomeWidgets?.();
                window.ppToast?.(`Deleted ${displayName} and their Pocket Phone data`);
            } catch {}
            return true;
        }

        function confirmDeleteContact(contactId) {
            const cfg = scopedGetCfg();
            const contact = typeof window.findContact === 'function'
                ? window.findContact(contactId)
                : cfg.contacts.find(item => item.id === contactId);
            if (!contact) return;
            const displayName = typeof window.dname === 'function'
                ? window.dname(contact)
                : (contact.customName || contact.name || contactId);
            const message = `Delete ${displayName} from this Pocket Phone world and permanently remove their messages, calls, feed/story activity, wallet records, notifications, and group membership?\n\nThis does not delete the SillyTavern character card.`;
            const run = () => { deleteContactData(contactId).catch(error => console.error('[Pocket Phone] Contact deletion failed.', error)); };
            if (typeof window.ppConfirm === 'function') window.ppConfirm('Delete contact and data', message, run, 'Delete');
            else if (window.confirm(message)) run();
        }

        function attachDeleteControl() {
            const body = document.querySelector('#pp-chatsettings-body');
            if (!body || document.getElementById(DELETE_CONTROL_ID)) return;
            const contactId = typeof window.curTid === 'function' ? window.curTid() : '';
            if (!contactId || (typeof window.isGroupId === 'function' && window.isGroupId(contactId))) return;

            const section = document.createElement('div');
            section.id = DELETE_CONTROL_ID;
            section.innerHTML = `
                <div class="pp-sec-label">Contact management</div>
                <button type="button" class="pp-btn wide" style="border-color:rgba(255,69,58,.55);color:#ff453a;">Delete contact and all data</button>
                <div class="pp-hint" style="margin-top:6px;">Removes this contact only from the current Pocket Phone world. The SillyTavern character card is not deleted.</div>`;
            section.querySelector('button')?.addEventListener('click', () => confirmDeleteContact(contactId));
            body.appendChild(section);
        }

        if (originalDeleteChat) {
            window.ppDeleteChat = function enhancedDeleteChat(threadId) {
                if (typeof window.isGroupId === 'function' && window.isGroupId(threadId)) return originalDeleteChat(threadId);
                const contact = typeof window.findContact === 'function' ? window.findContact(threadId) : null;
                if (!contact || typeof window.ppSheet !== 'function') return originalDeleteChat(threadId);
                const displayName = typeof window.dname === 'function'
                    ? window.dname(contact)
                    : (contact.customName || contact.name || threadId);
                window.ppSheet(displayName, [
                    { label: 'Delete conversation only', danger: true, onClick: () => originalDeleteChat(threadId) },
                    { label: 'Delete contact and all associated data', danger: true, onClick: () => confirmDeleteContact(threadId) },
                ]);
            };
        }

        function handleRouteChange() {
            const route = currentRouteInfo();
            if (route.key === lastRoute.key) return;
            const root = rootCfg();
            migrateProvisionalRoute(root, route);
            lastRoute = route;
            if (!root[ENABLE_KEY]) return;
            worldFor(route, true);
            saveRoot(root);
            try {
                if (typeof window.ppNav === 'function') window.ppNav('home');
                window.renderNotesRow?.();
                window.renderContactList?.();
                window.updateHomeWidgets?.();
            } catch {}
        }

        function installUiObserver() {
            const attach = () => {
                attachWorldControls();
                attachDeleteControl();
            };
            attach();
            const observer = new MutationObserver(() => attach());
            observer.observe(document.documentElement, { childList: true, subtree: true });
        }

        function installRouteHooks() {
            const c = context();
            try {
                if (c?.eventSource && c?.event_types) {
                    for (const [name, event] of Object.entries(c.event_types)) {
                        if (!/CHAT_CHANGED|CHAT_LOADED|CHARACTER_SELECTED|GROUP_CHAT_SELECTED|CHAT_CREATED/i.test(name)) continue;
                        c.eventSource.on(event, () => window.setTimeout(handleRouteChange, 80));
                    }
                }
            } catch (error) {
                console.warn('[Pocket Phone chat worlds] Could not attach route events.', error);
            }
            window.setInterval(handleRouteChange, 1000);
        }

        installUiObserver();
        installRouteHooks();

        window[INSTALL_KEY] = {
            version: VERSION,
            get enabled() { return Boolean(rootCfg()[ENABLE_KEY]); },
            get route() { return currentRouteInfo(); },
            get world() { return worldFor(currentRouteInfo(), true); },
            deleteContact: deleteContactData,
            setEnabled,
        };
        window.PP_CHAT_WORLDS = window[INSTALL_KEY];
        console.info(`[Pocket Phone ${VERSION}] Optional per-chat worlds and contact deletion installed.`);
    }

    let attempts = 0;
    const timer = window.setInterval(() => {
        attempts += 1;
        if (typeof window.getCfg === 'function' && typeof window.saveCfg === 'function' && typeof window.renderContactList === 'function') {
            window.clearInterval(timer);
            install();
        } else if (attempts > 800) {
            window.clearInterval(timer);
            console.error('[Pocket Phone chat worlds] Timed out waiting for the stable Pocket Phone core.');
        }
    }, 25);
})();
