// Pocket Phone 0.11.2 — robust feed generation and normal-ST-chat feed bridge.
(() => {
    'use strict';

    const VERSION = '0.11.2';
    const INSTALL_KEY = '__ppFeedBridge0112';
    const PROCESSED_KEY = 'ppFeedBridge0112';
    const REQUEST_MARKER = '[Pocket Phone feed request bridge';
    const processing = new Set();

    function context() {
        try { return window.SillyTavern?.getContext?.() || null; }
        catch { return null; }
    }

    function normalizeGenerated(value, depth = 0, seen = new WeakSet()) {
        if (value == null || depth > 8) return '';
        if (typeof value === 'string') return value;
        if (typeof value === 'number' || typeof value === 'boolean') return String(value);
        if (Array.isArray(value)) {
            return value.map(item => normalizeGenerated(item, depth + 1, seen)).filter(Boolean).join('\n');
        }
        if (typeof value !== 'object') return '';
        if (seen.has(value)) return '';
        seen.add(value);

        const priorityKeys = [
            'output_text', 'text', 'content', 'response', 'reply', 'result', 'completion',
            'message', 'mes', 'answer', 'generated_text', 'output', 'choices', 'data',
        ];
        for (const key of priorityKeys) {
            if (!(key in value)) continue;
            const text = normalizeGenerated(value[key], depth + 1, seen).trim();
            if (text) return text;
        }

        const collected = [];
        for (const [key, item] of Object.entries(value)) {
            if (!/(?:text|content|message|response|reply|output|result|completion)/i.test(key)) continue;
            const text = normalizeGenerated(item, depth + 1, seen).trim();
            if (text) collected.push(text);
        }
        return collected.join('\n');
    }

    function stripCodeFence(text) {
        return String(text || '')
            .replace(/^\s*```(?:json|text|markdown|md)?\s*/i, '')
            .replace(/\s*```\s*$/i, '')
            .trim();
    }

    function extractJsonPost(text) {
        const source = stripCodeFence(text);
        if (!source || (!source.startsWith('{') && !source.startsWith('['))) return '';
        try {
            const parsed = JSON.parse(source);
            const candidates = Array.isArray(parsed) ? parsed : [parsed];
            for (const item of candidates) {
                if (typeof item === 'string' && item.trim()) return item.trim();
                if (!item || typeof item !== 'object') continue;
                for (const key of ['post', 'caption', 'text', 'content', 'message', 'body']) {
                    const value = normalizeGenerated(item[key]).trim();
                    if (value) return value;
                }
            }
        } catch {}
        return '';
    }

    function extractFeedLines(raw, maxLines = 4) {
        let text = normalizeGenerated(raw).trim();
        if (!text) return [];

        const jsonPost = extractJsonPost(text);
        if (jsonPost) text = jsonPost;

        try {
            if (typeof window.cleanReply === 'function') text = window.cleanReply(text);
        } catch {}

        text = stripCodeFence(text)
            .replace(/\[LIKES\]\s*\d+/gi, '')
            .replace(/\[PP_POST:[^\]]*\]/gi, '')
            .replace(/<think>[\s\S]*?<\/think>/gi, '')
            .trim();
        if (!text || /^\[object Object\]$/i.test(text)) return [];

        const quoted = [];
        const quotePattern = /["“”„«»「」『』]([^"“”„«»「」『』\r\n]{1,1000})["“”„«»「」『』]/g;
        let match;
        while ((match = quotePattern.exec(text))) {
            const line = match[1].trim();
            if (line) quoted.push(line);
        }
        if (quoted.length) return quoted.slice(0, maxLines);

        return text
            .split(/\n+/)
            .map(line => line
                .replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '')
                .replace(/^\s*(?:post|caption|content|ข้อความโพสต์|โพสต์)\s*[:：]\s*/i, '')
                .replace(/^["'“”‘’„«»「」『』]+|["'“”‘’„«»「」『』]+$/g, '')
                .trim())
            .filter(Boolean)
            .filter(line => !/^\[?likes?\]?\s*[:：]?\s*\d*$/i.test(line))
            .filter(line => !/^(?:here(?:'s| is)|โพสต์(?:คือ|มีดังนี้)|คำตอบ)\b/i.test(line))
            .slice(0, maxLines);
    }

    function generationAborted() {
        try {
            const normalAbort = typeof ppGenAbort !== 'undefined' && ppGenAbort;
            const feedAbort = typeof ppFeedGenAbort !== 'undefined' && ppFeedGenAbort;
            return Boolean(normalAbort || feedAbort);
        } catch {
            return false;
        }
    }

    async function robustGenOnce(prompt) {
        const c = context();
        const methods = [];
        if (typeof c?.generateQuietPrompt === 'function') {
            methods.push(() => c.generateQuietPrompt(prompt, false, false));
        }
        if (typeof window.generateQuietPrompt === 'function' && window.generateQuietPrompt !== robustGenOnce) {
            methods.push(() => window.generateQuietPrompt(prompt, false, false));
        }
        if (typeof c?.generateRaw === 'function') {
            methods.push(() => c.generateRaw(prompt, '', false, false));
        }

        if (!methods.length) throw new Error('No SillyTavern quiet/raw generation API is available.');
        let lastError = null;
        for (const method of methods) {
            try {
                const raw = await method();
                const text = normalizeGenerated(raw).trim();
                if (text) return text;
            } catch (error) {
                lastError = error;
            }
        }
        if (lastError) throw lastError;
        throw new Error('SillyTavern returned an empty generation result.');
    }

    async function robustGenWithRetry(prompt, tries = 3) {
        let lastError = null;
        const count = Math.max(1, Number.parseInt(tries, 10) || 3);
        for (let attempt = 0; attempt < count; attempt += 1) {
            if (generationAborted()) return '';
            try {
                const raw = await robustGenOnce(prompt);
                const text = normalizeGenerated(raw).trim();
                let cleaned = text;
                try {
                    if (typeof window.cleanReply === 'function') cleaned = window.cleanReply(text);
                } catch {}
                if (cleaned.trim()) return text;
            } catch (error) {
                lastError = error;
                console.warn(`[Pocket Phone feed fix] generation attempt ${attempt + 1}/${count} failed`, error);
            }
            await new Promise(resolve => setTimeout(resolve, 450 * (attempt + 1)));
        }
        if (lastError) throw lastError;
        return '';
    }

    function displayName(contact) {
        try {
            if (typeof window.dname === 'function') return window.dname(contact);
        } catch {}
        return contact?.customName || contact?.name || '?';
    }

    function contacts() {
        try {
            if (typeof window.getContacts === 'function') return window.getContacts() || [];
        } catch {}
        try { return window.getCfg?.().contacts || []; }
        catch { return []; }
    }

    function findContactByName(rawName) {
        const wanted = String(rawName || '').trim().toLocaleLowerCase();
        if (!wanted) return null;
        const list = contacts();
        return list.find(contact => displayName(contact).trim().toLocaleLowerCase() === wanted)
            || list.find(contact => {
                const shown = displayName(contact).trim().toLocaleLowerCase();
                return shown && (wanted.includes(shown) || shown.includes(wanted));
            })
            || null;
    }

    function makeId() {
        try {
            if (typeof window.newId === 'function') return window.newId();
        } catch {}
        return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    }

    function savePhone() {
        try { window.saveCfg?.(); }
        catch (error) { console.warn('[Pocket Phone feed fix] saveCfg failed', error); }
    }

    function resolveOrCreateContact(rawName) {
        const name = String(rawName || '').trim();
        if (!name) return null;
        const existing = findContactByName(name);
        if (existing) return existing;

        let character = null;
        try {
            const listed = typeof window.listStCharacters === 'function'
                ? window.listStCharacters()
                : (context()?.characters || []).map(item => ({ id: item.avatar || item.name, name: item.name, avatar: item.avatar }));
            character = (listed || []).find(item => String(item?.name || '').trim().toLocaleLowerCase() === name.toLocaleLowerCase()) || null;
        } catch {}

        const cfg = window.getCfg?.();
        if (!cfg || !Array.isArray(cfg.contacts)) return null;
        const contact = character
            ? { id: character.id, name: character.name, avatar: character.avatar }
            : { id: `npc:${makeId()}`, name, avatar: '', npc: true, customNpc: true };
        cfg.contacts.push(contact);
        savePhone();
        return contact;
    }

    function createFeedPost(contact, rawText, options = {}) {
        if (!contact) return null;
        const lines = extractFeedLines(rawText, 4);
        const text = lines.join('\n').trim();
        if (!text) return null;

        const cfg = window.getCfg?.();
        if (!cfg) return null;
        if (!Array.isArray(cfg.feedPosts)) cfg.feedPosts = [];
        const post = {
            id: makeId(),
            author: contact.id,
            kind: 'post',
            authorName: displayName(contact),
            handle: contact.handle || undefined,
            text: text.slice(0, 1000),
            mediaKeys: [],
            captions: [],
            responders: null,
            knowEachOther: true,
            visibility: 'all',
            ts: Date.now(),
            likes: [],
            extraLikes: Number.isFinite(options.extraLikes)
                ? Math.max(0, Math.floor(options.extraLikes))
                : Math.floor(Math.random() * 36) + 3,
            comments: [],
            views: {},
            saves: 0,
            source: options.source || 'st-chat-bridge',
        };
        cfg.feedPosts.push(post);
        savePhone();

        try { window.renderFeed?.(); } catch {}
        try { window.updateHomeWidgets?.(); } catch {}
        try { window.pushNotif?.(contact.id, 'feed', `${displayName(contact)} โพสต์ใหม่`); } catch {}
        try {
            if (!document.getElementById('pp-dialog')?.open) window.islandNotify?.(contact, `${displayName(contact)} โพสต์ใหม่`);
        } catch {}
        try { window.ppToast?.(`${displayName(contact)} โพสต์ลงฟีดแล้ว`); } catch {}
        return post;
    }

    function currentCharacterName() {
        const c = context();
        try {
            const character = Array.isArray(c?.characters) && c.characterId != null ? c.characters[c.characterId] : null;
            return character?.name || c?.name2 || '';
        } catch {
            return '';
        }
    }

    function detectFeedIntent(rawText) {
        const text = String(rawText || '')
            .replace(/<!--[\s\S]*?-->/g, ' ')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        if (!text) return null;
        const hasPostVerb = /(?:โพสต์|โพส|ลงโพสต์|อัปโพสต์|ทำโพสต์|post|publish)/i.test(text);
        const hasFeedTarget = /(?:ฟีด|feed|ไทม์ไลน์|timeline)/i.test(text);
        if (!hasPostVerb || !hasFeedTarget) return null;

        let contact = null;
        const sorted = contacts().slice().sort((a, b) => displayName(b).length - displayName(a).length);
        const lowered = text.toLocaleLowerCase();
        contact = sorted.find(item => {
            const name = displayName(item).trim().toLocaleLowerCase();
            return name && lowered.includes(name);
        }) || null;

        let candidateName = '';
        if (!contact) {
            const patterns = [
                /(?:ให้|บอก|สั่ง)\s*([^,，:：]{1,40}?)\s*(?:ช่วย\s*)?(?:โพสต์|โพส|ลงโพสต์|อัปโพสต์|ทำโพสต์)/i,
                /^\s*([^,，:：]{1,40}?)\s*(?:ช่วย\s*)?(?:โพสต์|โพส|ลงโพสต์|อัปโพสต์|ทำโพสต์)/i,
                /(?:have|tell|ask)\s+([^,.:]{1,40}?)\s+(?:to\s+)?(?:post|publish)/i,
                /^\s*([^,.:]{1,40}?)\s+(?:please\s+)?(?:post|publish)/i,
            ];
            for (const pattern of patterns) {
                const match = text.match(pattern);
                if (!match) continue;
                candidateName = match[1]
                    .replace(/^(?:ให้|บอก|สั่ง|ช่วย)\s*/i, '')
                    .replace(/\s*(?:ช่วย|หน่อย|ที)$/i, '')
                    .trim();
                if (candidateName) break;
            }
        }
        if (!contact && candidateName) contact = findContactByName(candidateName);
        if (!contact) {
            const mainName = currentCharacterName();
            if (mainName) contact = findContactByName(mainName) || resolveOrCreateContact(mainName);
        }
        const contactName = contact ? displayName(contact) : candidateName;
        if (!contactName) return null;

        let explicitText = '';
        const explicitMatch = text.match(/(?:ข้อความ|แคปชั่น|caption)?\s*(?:ว่า|:|：)\s*["“]?([\s\S]+?)["”]?$/i);
        if (explicitMatch) explicitText = explicitMatch[1].trim();

        return { contact, contactName, explicitText, userText: text };
    }

    function feedPrompt(intent, contact) {
        let persona = '';
        let story = '';
        let phone = '';
        try { persona = window.getEffectivePersona?.(contact.id) || ''; } catch {}
        try { story = window.mainChatRecap?.(12) || ''; } catch {}
        try { phone = window.phoneContextFor?.(contact.id) || ''; } catch {}
        const requested = intent.explicitText
            ? `The user requested this exact idea/text: ${intent.explicitText}`
            : `The user's request was: ${intent.userText}`;
        return [
            `[Social media feed generation — write strictly as ${displayName(contact)}.]`,
            persona ? `Character persona: ${persona}` : null,
            story ? `Recent roleplay context:\n${story}` : null,
            phone ? `Relevant phone context:\n${phone}` : null,
            requested,
            `Write one natural in-character social feed post in the language normally used in the current chat.`,
            `Use 1-3 concise lines. Do not narrate posting, do not explain, do not include metadata, hashtags only when natural, and do not output JSON.`,
            `Output only the post text.`,
        ].filter(Boolean).join('\n');
    }

    function previousUserMessage(chat, assistantIndex) {
        for (let index = assistantIndex - 1; index >= 0; index -= 1) {
            if (chat[index]?.is_user) return chat[index];
        }
        return null;
    }

    function appendFeedRequestInstruction(chat) {
        if (!Array.isArray(chat) || !chat.length) return;
        const latestUser = [...chat].reverse().find(message => message?.is_user);
        if (!latestUser) return;
        const intent = detectFeedIntent(latestUser.mes);
        if (!intent) return;
        if (chat.some(message => String(message?.mes || '').includes(REQUEST_MARKER))) return;

        const exact = intent.explicitText
            ? `Use this requested post content/idea: ${intent.explicitText}`
            : `Invent a short in-character post that naturally fulfills the user's request.`;
        chat.push({
            is_user: false,
            is_system: true,
            name: 'PocketPhoneFeedBridge',
            mes: `${REQUEST_MARKER} — invisible command contract.]\nThe latest user message asks ${intent.contactName} to post on the Pocket Phone feed. Reply to the user normally. Then append exactly one hidden command on its own final line:\n[PP_POST:${intent.contactName}|post text]\n${exact}\nNever explain, quote, or put the PP_POST command in a code fence. Do not put ] inside the post text.`,
        });
    }

    function installGenerationInterceptor() {
        const previous = window.ppGenInterceptor;
        if (typeof previous !== 'function' || previous.__ppFeedBridge) return;
        function feedBridgeInterceptor(...args) {
            try { previous.apply(this, args); }
            catch (error) { console.warn('[Pocket Phone feed bridge] previous interceptor failed', error); }
            try { appendFeedRequestInstruction(args[0]); }
            catch (error) { console.warn('[Pocket Phone feed bridge] instruction injection failed', error); }
        }
        feedBridgeInterceptor.__ppFeedBridge = true;
        feedBridgeInterceptor.__ppNormalRoleplayBridge = true;
        feedBridgeInterceptor.previous = previous;
        window.ppGenInterceptor = feedBridgeInterceptor;
    }

    async function saveAssistantMessage(chat, message, index) {
        try {
            const node = document.querySelector(`#chat .mes[mesid="${index}"] .mes_text`);
            const c = context();
            if (node && typeof c?.messageFormatting === 'function') {
                node.innerHTML = c.messageFormatting(message.mes || '', message.name, false, false, index);
            }
        } catch {}
        try {
            const c = context();
            if (typeof c?.saveChatDebounced === 'function') c.saveChatDebounced();
            else if (typeof c?.saveChat === 'function') await c.saveChat();
        } catch {}
    }

    async function processLatestAssistant() {
        const c = context();
        const chat = c?.chat;
        if (!Array.isArray(chat) || !chat.length) return;
        const index = chat.length - 1;
        const message = chat[index];
        if (!message || message.is_user) return;
        if (!message.extra || typeof message.extra !== 'object') message.extra = {};
        if (message.extra[PROCESSED_KEY]) return;

        const fingerprint = `${index}:${String(message.mes || '').length}:${String(message.mes || '').slice(-80)}`;
        if (processing.has(fingerprint)) return;
        processing.add(fingerprint);

        try {
            const original = String(message.mes || '');
            const commandPattern = /\[PP_POST:\s*([^|\]]+?)\s*\|\s*([^\]]+?)\s*\]/gi;
            let match;
            let created = 0;
            while ((match = commandPattern.exec(original))) {
                const contact = resolveOrCreateContact(match[1]);
                if (contact && createFeedPost(contact, match[2], { source: 'pp-post-command' })) created += 1;
            }

            const cleaned = original
                .replace(commandPattern, '')
                .replace(/[ \t]{2,}/g, ' ')
                .replace(/\n{3,}/g, '\n\n')
                .trim();
            if (cleaned !== original) message.mes = cleaned;

            const userMessage = previousUserMessage(chat, index);
            const intent = detectFeedIntent(userMessage?.mes || '');
            if (!created && intent) {
                const contact = intent.contact || resolveOrCreateContact(intent.contactName);
                if (contact) {
                    if (intent.explicitText) {
                        created = createFeedPost(contact, intent.explicitText, { source: 'st-chat-explicit' }) ? 1 : 0;
                    } else {
                        const raw = await robustGenWithRetry(feedPrompt(intent, contact), 3);
                        const postText = extractFeedLines(raw, 4).join('\n');
                        created = createFeedPost(contact, postText, { source: 'st-chat-fallback' }) ? 1 : 0;
                    }
                }
            }

            message.extra[PROCESSED_KEY] = {
                at: Date.now(),
                created,
                intent: Boolean(intent),
            };
            await saveAssistantMessage(chat, message, index);
            if (intent && !created) {
                console.error('[Pocket Phone feed bridge] Feed request was detected but no post could be produced.', { intent, message });
                try { window.ppToast?.('สร้างโพสต์ไม่สำเร็จ กรุณาตรวจ Console'); } catch {}
            }
        } catch (error) {
            console.error('[Pocket Phone feed bridge] Assistant feed processing failed.', error);
            try { window.ppToast?.(`สร้างโพสต์ไม่สำเร็จ: ${error?.message || error}`); } catch {}
        } finally {
            processing.delete(fingerprint);
        }
    }

    function installEventHooks() {
        const c = context();
        if (!c?.eventSource || !c?.event_types) return;
        const handler = () => setTimeout(() => processLatestAssistant(), 240);
        const events = c.event_types;
        if (events.MESSAGE_RECEIVED) c.eventSource.on(events.MESSAGE_RECEIVED, handler);
        if (events.CHARACTER_MESSAGE_RENDERED) c.eventSource.on(events.CHARACTER_MESSAGE_RENDERED, handler);
    }

    function install() {
        if (window[INSTALL_KEY]) return;

        const originalSpokenOrFallback = typeof window.spokenOrFallback === 'function'
            ? window.spokenOrFallback
            : null;
        window.genOnce = robustGenOnce;
        window.genWithRetry = robustGenWithRetry;
        if (originalSpokenOrFallback) {
            window.spokenOrFallback = function patchedSpokenOrFallback(raw, maxLines) {
                const normalized = normalizeGenerated(raw);
                let lines = [];
                try { lines = originalSpokenOrFallback(normalized, maxLines) || []; }
                catch {}
                lines = lines.filter(line => line && !/^\[object Object\]$/i.test(String(line).trim()));
                return lines.length ? lines : extractFeedLines(normalized, maxLines || 3);
            };
        }

        installGenerationInterceptor();
        installEventHooks();
        window[INSTALL_KEY] = {
            version: VERSION,
            normalizeGenerated,
            extractFeedLines,
            detectFeedIntent,
            createFeedPost,
            processLatestAssistant,
            generatePostFor: async (contactName, instruction = '') => {
                const contact = resolveOrCreateContact(contactName);
                if (!contact) throw new Error(`Contact not found: ${contactName}`);
                const intent = { contact, contactName: displayName(contact), explicitText: '', userText: instruction || `${displayName(contact)} post to feed` };
                const raw = await robustGenWithRetry(feedPrompt(intent, contact), 3);
                return createFeedPost(contact, raw, { source: 'manual-api' });
            },
        };
        window.PP_FEED_BRIDGE = window[INSTALL_KEY];
        console.info(`[Pocket Phone ${VERSION}] Robust feed generation and normal-chat feed bridge installed.`);
    }

    let attempts = 0;
    const timer = setInterval(() => {
        attempts += 1;
        const bridgeReady = Object.keys(window).some(key => key.startsWith('__deszidesuPocketPhoneNormalRoleplayBridge'));
        const coreReady = window.PP_LOADED === 'ok'
            && bridgeReady
            && typeof window.getCfg === 'function'
            && typeof window.saveCfg === 'function'
            && typeof window.ppGenInterceptor === 'function';
        if (coreReady) {
            clearInterval(timer);
            install();
        } else if (attempts > 1200) {
            clearInterval(timer);
            console.error('[Pocket Phone feed fix] Timed out waiting for Pocket Phone core.');
        }
    }, 25);
})();
