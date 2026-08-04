
function buildIntegrationInstruction() {
    const state = suiteConfig();
    const lines = [
        '[Pocket Phone extension integration — invisible machine commands.]',
        'Write the normal roleplay response first. Append a command only when a phone-side event genuinely occurs.',
        'Put each command on its own final line outside narration and dialogue. Never explain, quote, or roleplay commands.',
        'Use exact saved contact names. Do not force phone activity every turn or decide user actions.',
        '',
        'Text: [PP_MSG:Contact Name|message]',
        'New NPC first thread: [PP_NEWCHAT:New NPC Name|first message]',
        'Incoming call: [PP_CALL:Contact Name]',
        'Voice message: [PP_VOICE:Contact Name|spoken transcription]',
        'Sticker: [PP_STICKER:Contact Name|exact sticker label]',
        'Location: [PP_LOCATION:Contact Name|place|optional note]',
        'Status note: [PP_NOTE:Contact Name|short status]',
        'Poll: [PP_POLL:Contact Name|question|option 1|option 2]',
        'Gift: [PP_GIFT:Contact Name|gift name|optional whole-number value]',
        'Contact card: [PP_CONTACT:Contact Name|Shared Contact Name]',
        'Incoming payment: [PP_PAY:Contact Name|whole-number amount|reason]',
        'Story-earned money: [PP_EARN:whole-number amount|reason]',
        'Follow/request: [PP_FOLLOW:Contact Name]',
    ];

    if (state.reactionsEnabled) lines.push('React to the latest user message: [PP_REACT:Contact Name|reaction]');
    if (state.imageBridgeEnabled) lines.push('Image message: [PP_IMAGE:Contact Name|image URL or generation prompt|optional caption]');
    if (state.socialBridgeEnabled) {
        lines.push('Feed post: [PP_POST:Contact Name|post text]');
        lines.push('Text story: [PP_STORY:Contact Name|story text]');
        lines.push('Comment on latest post by target: [PP_COMMENT:Contact Name|Target Contact Name|comment]');
        lines.push('Like latest post by target: [PP_LIKE:Contact Name|Target Contact Name]');
    }
    if (state.calendarEnabled) {
        lines.push('Propose calendar event: [PP_CALENDAR:Contact Name|title|YYYY-MM-DD HH:mm|optional note]');
        lines.push('Create reminder: [PP_REMINDER:title|YYYY-MM-DD HH:mm|optional note]');
    }
    if (state.worldMemoryEnabled) lines.push('Store important world fact: [PP_MEMORY:subject|fact]');

    if (state.availabilityEnabled) {
        const statuses = contacts().slice(0, 30).map(contact =>
            `${displayName(contact)}=${isContactAvailable(contact) ? 'available' : 'unavailable'}`
        );
        if (statuses.length) lines.push('', `Current contact availability: ${statuses.join('; ')}`);
    }

    if (state.worldMemoryEnabled) {
        const facts = state.memories.filter(item => item.enabled !== false).slice(-20);
        if (facts.length) {
            lines.push('', 'Persistent Pocket Phone world facts:');
            for (const fact of facts) lines.push(`- ${fact.subject}: ${fact.fact}`);
        }
    }

    const upcoming = state.calendarEnabled
        ? state.calendarEvents.filter(event => event.enabled !== false && Number(event.at) > Date.now()).sort((a,b) => a.at - b.at).slice(0, 8)
        : [];
    if (upcoming.length) {
        lines.push('', 'Upcoming accepted/proposed phone calendar events:');
        for (const event of upcoming) lines.push(`- ${new Date(event.at).toLocaleString()}: ${event.title}${event.note ? ` — ${event.note}` : ''}`);
    }

    lines.push('', 'Never invent unsupported PP_ commands. Do not put ] inside fields.');
    return lines.join('\n');
}

window.__ppFeatureSuiteInterceptor = function featureSuiteInterceptor(...args) {
    const upstream = window.__ppUpstreamInterceptor;
    if (typeof upstream === 'function') {
        try { upstream.apply(this, args); }
        catch (error) { logDiagnostic('error', 'Upstream interceptor failed', error?.message); }
    }

    try {
        const chat = args[0];
        const cfg = baseConfig();
        if (!cfg.universeAffectsRP || !Array.isArray(chat)) return;
        if (chat.some(message => String(message?.mes || '').includes('[Pocket Phone extension integration'))) return;
        chat.push({
            is_user: false,
            is_system: true,
            name: 'PocketPhoneFeatureSuite',
            mes: buildIntegrationInstruction(),
        });
    } catch (error) {
        logDiagnostic('error', 'Feature-suite interceptor failed', error?.message);
    }
};

function eventHash(text, index) {
    let hash = 2166136261;
    const input = `${index}|${text}`;
    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return `evt:${(hash >>> 0).toString(16)}`;
}

function transactionSeen(id) {
    if (!enabled('transactionQueueEnabled')) return false;
    const state = suiteConfig();
    return Boolean(state.processedEvents[id]);
}

function markTransaction(id, status, detail = '') {
    const state = suiteConfig();
    if (!enabled('transactionQueueEnabled')) return;
    state.processedEvents[id] = { ts: Date.now(), status, detail: String(detail || '').slice(0, 300) };
    const keys = Object.keys(state.processedEvents);
    if (keys.length > 500) {
        keys.sort((a,b) => state.processedEvents[a].ts - state.processedEvents[b].ts)
            .slice(0, keys.length - 400)
            .forEach(key => delete state.processedEvents[key]);
    }
    saveAll();
}

async function mediaDataFromSource(source, contact) {
    const state = suiteConfig();
    const raw = String(source || '').trim();
    if (!raw) throw new Error('Image source is empty');

    if (/^data:image\//i.test(raw)) return raw;
    if (/^https?:\/\//i.test(raw)) {
        const response = await fetch(raw);
        if (!response.ok) throw new Error(`Image fetch HTTP ${response.status}`);
        return readBlobAsDataUrl(await response.blob());
    }

    if (!state.imageEndpoint) throw new Error('No image generation endpoint is configured');
    const headers = { 'Content-Type': 'application/json' };
    if (state.imageEndpointKey) headers.Authorization = `Bearer ${state.imageEndpointKey}`;
    const response = await fetch(state.imageEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ prompt: raw, contact: displayName(contact) }),
    });
    if (!response.ok) throw new Error(`Image endpoint HTTP ${response.status}`);
    const type = response.headers.get('content-type') || '';
    if (type.includes('application/json')) {
        const json = await response.json();
        if (json.dataUrl) return json.dataUrl;
        if (json.url) return mediaDataFromSource(json.url, contact);
        throw new Error('Image endpoint returned no dataUrl or url');
    }
    if (type.startsWith('image/')) return readBlobAsDataUrl(await response.blob());
    throw new Error('Unsupported image endpoint response');
}

async function addImageMessage(contact, source, caption) {
    if (!enabled('imageBridgeEnabled')) return false;
    if (!canContact(contact, 'message')) return false;
    const dataUrl = await mediaDataFromSource(source, contact);
    const mediaKey = `suite-image-${uid('media')}`;
    const saved = await callGlobal('saveMedia', mediaKey, dataUrl);
    if (!saved) throw new Error('Pocket Phone media storage rejected the image');
    return pushIncoming(contact, { type: 'image', mediaKey, caption: String(caption || '').slice(0, 500) }, `${displayName(contact)} sent an image`);
}

function addFeedPost(contact, text) {
    if (!enabled('socialBridgeEnabled') || !canContact(contact, 'social')) return false;
    const cfg = baseConfig();
    if (!Array.isArray(cfg.feedPosts)) cfg.feedPosts = [];
    cfg.feedPosts.push({
        id: uid('post'),
        author: contact.id,
        kind: 'post',
        authorName: displayName(contact),
        text: String(text || '').slice(0, 1000),
        mediaKeys: [],
        captions: [],
        responders: null,
        knowEachOther: true,
        visibility: 'all',
        ts: Date.now(),
        likes: [],
        extraLikes: 0,
        comments: [],
        views: {},
        saves: 0,
    });
    saveAll();
    callGlobal('pushNotif', contact.id, 'feed', `${displayName(contact)} posted`);
    refreshPhone();
    nativeNotification(displayName(contact), 'New feed post', contact.id);
    return true;
}

function addStory(contact, text) {
    if (!enabled('socialBridgeEnabled') || !canContact(contact, 'social')) return false;
    const cfg = baseConfig();
    if (!Array.isArray(cfg.stories)) cfg.stories = [];
    const backgrounds = [
        'linear-gradient(160deg,#5e5ce6,#bf5af2)',
        'linear-gradient(160deg,#ff375f,#ff9f0a)',
        'linear-gradient(160deg,#0a84ff,#30d158)',
    ];
    cfg.stories.push({
        id: uid('story'),
        author: contact.id,
        type: 'text',
        text: String(text || '').slice(0, 220),
        bg: backgrounds[Math.floor(Math.random() * backgrounds.length)],
        closeOnly: false,
        ts: Date.now(),
        likes: [],
        views: {},
        replies: [],
    });
    saveAll();
    refreshPhone();
    nativeNotification(displayName(contact), 'Posted a story', contact.id);
    return true;
}

function findLatestPostByContact(contact) {
    const posts = Array.isArray(baseConfig().feedPosts) ? baseConfig().feedPosts : [];
    return posts.filter(post => post.author === contact.id).sort((a,b) => Number(b.ts) - Number(a.ts))[0] || null;
}

function addComment(author, target, text) {
    if (!enabled('socialBridgeEnabled') || !canContact(author, 'social')) return false;
    const post = findLatestPostByContact(target);
    if (!post) return false;
    if (!Array.isArray(post.comments)) post.comments = [];
    post.comments.push({
        id: uid('comment'),
        author: author.id,
        authorName: displayName(author),
        text: String(text || '').slice(0, 500),
        ts: Date.now(),
        likes: [],
    });
    saveAll();
    refreshPhone();
    return true;
}

function addLike(author, target) {
    if (!enabled('socialBridgeEnabled') || !canContact(author, 'social')) return false;
    const post = findLatestPostByContact(target);
    if (!post) return false;
    if (!Array.isArray(post.likes)) post.likes = [];
    if (!post.likes.includes(author.id)) post.likes.push(author.id);
    saveAll();
    refreshPhone();
    return true;
}

function addMemory(subject, fact) {
    if (!enabled('worldMemoryEnabled')) return false;
    const state = suiteConfig();
    const existing = state.memories.find(item =>
        normalizeName(item.subject) === normalizeName(subject) &&
        normalizeName(item.fact) === normalizeName(fact)
    );
    if (existing) {
        existing.ts = Date.now();
        existing.enabled = true;
    } else {
        state.memories.push({
            id: uid('memory'),
            subject: String(subject || '').slice(0, 120),
            fact: String(fact || '').slice(0, 1000),
            enabled: true,
            ts: Date.now(),
        });
        if (state.memories.length > 300) state.memories = state.memories.slice(-300);
    }
    saveAll();
    return true;
}

function parseDateTime(value) {
    const raw = String(value || '').trim();
    const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
    const ms = Date.parse(normalized);
    return Number.isFinite(ms) ? ms : NaN;
}

function addCalendarEvent(contact, title, dateText, note, proposed = true) {
    if (!enabled('calendarEnabled')) return false;
    const at = parseDateTime(dateText);
    if (!Number.isFinite(at)) return false;
    const state = suiteConfig();
    state.calendarEvents.push({
        id: uid('calendar'),
        contactId: contact?.id || '',
        title: String(title || '').slice(0, 200),
        note: String(note || '').slice(0, 1000),
        at,
        proposed,
        accepted: !proposed,
        enabled: true,
        notified: false,
        ts: Date.now(),
    });
    saveAll();
    nativeNotification(contact ? displayName(contact) : 'Pocket Phone', `Calendar: ${title}`, contact?.id || '');
    return true;
}

function addReaction(contact, reaction) {
    if (!enabled('reactionsEnabled') || !contact) return false;
    const messages = thread(contact.id);
    const target = [...messages].reverse().find(message => message.from === 'me' && !message.unsent);
    if (!target) return false;
    if (!Array.isArray(target.reactions)) target.reactions = [];
    const existing = target.reactions.find(item => item.by === contact.id);
    if (existing) existing.reaction = String(reaction || '').slice(0, 30);
    else target.reactions.push({ by: contact.id, reaction: String(reaction || '').slice(0, 30) });
    saveAll();
    refreshPhone();
    return true;
}
