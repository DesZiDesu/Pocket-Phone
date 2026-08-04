
function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
        #${DIALOG_ID}{width:min(760px,94vw);max-height:88vh;border:1px solid rgba(127,127,127,.35);border-radius:22px;padding:0;background:var(--pp-bg,#111);color:var(--pp-txt,#fff);box-shadow:0 30px 100px rgba(0,0,0,.55)}
        #${DIALOG_ID}::backdrop{background:rgba(0,0,0,.66);backdrop-filter:blur(8px)}
        .ppfs-head{position:sticky;top:0;z-index:3;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px;background:rgba(20,20,22,.96);border-bottom:1px solid rgba(127,127,127,.25)}
        .ppfs-title{font-size:17px;font-weight:750}
        .ppfs-close{border:0;border-radius:50%;width:34px;height:34px;background:rgba(127,127,127,.2);color:inherit;font-size:20px;cursor:pointer}
        .ppfs-content{padding:16px;overflow:auto;max-height:calc(88vh - 68px)}
        .ppfs-intro{margin:0 0 14px;color:rgba(235,235,245,.75);line-height:1.5}
        .ppfs-section{border:1px solid rgba(127,127,127,.25);border-radius:16px;padding:14px;margin:0 0 14px;background:rgba(127,127,127,.07)}
        .ppfs-section h3{margin:0 0 10px;font-size:15px}
        .ppfs-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:10px 2px;border-bottom:1px solid rgba(127,127,127,.16)}
        .ppfs-row:last-child{border-bottom:0}
        .ppfs-row span{display:flex;flex-direction:column;gap:3px}
        .ppfs-row strong{font-size:14px}
        .ppfs-row small,.ppfs-list-item small{display:block;color:rgba(235,235,245,.62);font-size:12px;line-height:1.35}
        .ppfs-row input[type=checkbox]{width:20px;height:20px;accent-color:var(--pp-accent,#0a84ff);flex:0 0 auto}
        .ppfs-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:12px}
        .ppfs-field{display:flex;flex-direction:column;gap:6px;font-size:12px;color:rgba(235,235,245,.72)}
        .ppfs-field input,.ppfs-field select,.ppfs-field textarea{width:100%;box-sizing:border-box;border:1px solid rgba(127,127,127,.3);border-radius:10px;padding:9px 10px;background:rgba(0,0,0,.24);color:inherit;font:inherit}
        .ppfs-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
        .ppfs-actions button,.ppfs-list-item button,#${SETTINGS_CARD_ID} button{border:0;border-radius:10px;padding:9px 12px;background:var(--pp-accent,#0a84ff);color:#fff;font-weight:650;cursor:pointer}
        .ppfs-list{display:flex;flex-direction:column;gap:8px}
        .ppfs-list-item{display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid rgba(127,127,127,.2);border-radius:12px;padding:10px;background:rgba(0,0,0,.16)}
        .ppfs-list-item>div{min-width:0}
        .ppfs-list-item span{display:flex;gap:6px}
        .ppfs-days{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
        .ppfs-days label{display:flex;align-items:center;gap:4px;font-size:12px}
        .ppfs-log{white-space:pre-wrap;word-break:break-word;max-height:48vh;overflow:auto;border-radius:12px;padding:12px;background:#050506;color:#d7f7d7;font-size:11px;line-height:1.5}
        #${SETTINGS_CARD_ID}{margin-top:14px}
        #${SETTINGS_CARD_ID} .ppfs-summary{padding:12px 14px;border-radius:14px;background:rgba(127,127,127,.1);border:1px solid rgba(127,127,127,.2)}
        #${SETTINGS_CARD_ID} p{margin:0 0 10px;font-size:12px;line-height:1.45;color:var(--pp-txt3,#999)}
        .pp-suite-message-extras{display:flex;justify-content:flex-end;align-items:center;gap:6px;flex-wrap:wrap;margin-top:3px;font-size:10px;color:var(--pp-txt3,#999)}
        .pp-suite-reactions{display:flex;gap:3px;flex-wrap:wrap}
        .pp-suite-reaction{padding:2px 6px;border-radius:10px;background:var(--pp-fill3,rgba(127,127,127,.2));font-size:11px}
        .pp-suite-tts{border:0;border-radius:9px;padding:3px 7px;background:var(--pp-fill3,rgba(127,127,127,.2));color:inherit;font-size:10px;cursor:pointer}
        @media(max-width:600px){.ppfs-grid{grid-template-columns:1fr}#${DIALOG_ID}{width:96vw;max-height:92vh}.ppfs-content{max-height:calc(92vh - 68px)}}
    `;
    document.head.appendChild(style);
}

function ensureDialog() {
    let dialog = document.getElementById(DIALOG_ID);
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.id = DIALOG_ID;
    dialog.innerHTML = `<div class="ppfs-head"><div class="ppfs-title"></div><button class="ppfs-close" aria-label="Close">×</button></div><div class="ppfs-content"></div>`;
    document.body.appendChild(dialog);
    dialog.querySelector('.ppfs-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
        if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener('change', handleDialogChange);
    dialog.addEventListener('click', handleDialogClick);
    return dialog;
}

function openFeatureSuite(view = 'main') {
    ensureStyles();
    const dialog = ensureDialog();
    dialog.dataset.view = view;
    renderView(dialog);
    if (!dialog.open) dialog.showModal();
}

function renderView(dialog) {
    const view = dialog.dataset.view || 'main';
    if (view === 'contacts') renderContactView(dialog);
    else if (view === 'scheduler') renderSchedulerView(dialog);
    else if (view === 'memories') renderMemoryView(dialog);
    else if (view === 'calendar') renderCalendarView(dialog);
    else if (view === 'backup') renderBackupView(dialog);
    else if (view === 'diagnostics') renderDiagnosticsView(dialog);
    else renderMainView(dialog);
}

function handleDialogChange(event) {
    const target = event.target;
    const state = suiteConfig();

    if (target.matches('[data-ppfs-toggle]')) {
        const key = target.dataset.ppfsToggle;
        state[key] = target.checked;
        saveAll();
        logDiagnostic('info', `Feature ${key} ${target.checked ? 'enabled' : 'disabled'}`);
        if (key === 'browserNotificationsEnabled' && target.checked && Notification.permission === 'default') {
            toast('Use “Request notification permission” to allow browser notifications.');
        }
        return;
    }

    if (target.matches('[data-ppfs-value]')) {
        const key = target.dataset.ppfsValue;
        state[key] = target.type === 'number' ? Number(target.value) : target.value;
        saveAll();
        return;
    }

    if (target.matches('[data-ppfs-contact-select]')) {
        target.closest('dialog').dataset.contactId = target.value;
        renderContactView(target.closest('dialog'));
        return;
    }

    const contactId = target.closest('dialog')?.dataset.contactId;
    if (contactId && target.matches('[data-ppfs-contact-toggle]')) {
        contactPolicy(contactId)[target.dataset.ppfsContactToggle] = target.checked;
        saveAll();
        return;
    }
    if (contactId && target.matches('[data-ppfs-contact-value]')) {
        const key = target.dataset.ppfsContactValue;
        const policy = contactPolicy(contactId);
        if (key === 'aliases') policy.aliases = target.value.split(',').map(value => value.trim()).filter(Boolean);
        else if (target.type === 'number') policy[key] = Number(target.value);
        else policy[key] = target.value;
        saveAll();
        return;
    }
    if (contactId && target.matches('[data-ppfs-contact-day]')) {
        const day = Number(target.dataset.ppfsContactDay);
        const policy = contactPolicy(contactId);
        const set = new Set(policy.availableDays || []);
        if (target.checked) set.add(day); else set.delete(day);
        policy.availableDays = [...set].sort();
        saveAll();
    }
}

async function handleDialogClick(event) {
    const button = event.target.closest('button');
    if (!button) return;
    const dialog = button.closest('dialog');
    const action = button.dataset.ppfsAction;

    if (action === 'back') {
        dialog.dataset.view = 'main';
        renderMainView(dialog);
        return;
    }
    if (action === 'contacts') {
        dialog.dataset.view = 'contacts';
        renderContactView(dialog);
        return;
    }
    if (action === 'scheduler') {
        dialog.dataset.view = 'scheduler';
        renderSchedulerView(dialog);
        return;
    }
    if (action === 'memories') {
        dialog.dataset.view = 'memories';
        renderMemoryView(dialog);
        return;
    }
    if (action === 'calendar') {
        dialog.dataset.view = 'calendar';
        renderCalendarView(dialog);
        return;
    }
    if (action === 'backup') {
        dialog.dataset.view = 'backup';
        renderBackupView(dialog);
        return;
    }
    if (action === 'diagnostics') {
        dialog.dataset.view = 'diagnostics';
        renderDiagnosticsView(dialog);
        return;
    }
    if (action === 'notification-permission') {
        await requestNotificationPermission();
        return;
    }
    if (action === 'autonomy-test') {
        await runAutonomyCheck(true);
        toast('Autonomy test completed. Check diagnostics or Pocket Phone activity.');
        return;
    }
    if (action === 'schedule-add') {
        const type = dialog.querySelector('#ppfs-schedule-type')?.value || 'message';
        const contactId = dialog.querySelector('#ppfs-schedule-contact')?.value || '';
        const at = parseDateTime(dialog.querySelector('#ppfs-schedule-at')?.value || '');
        const repeat = dialog.querySelector('#ppfs-schedule-repeat')?.value || 'none';
        const text = dialog.querySelector('#ppfs-schedule-text')?.value || '';
        if (!Number.isFinite(at) || (!contactId && type !== 'reminder')) {
            toast('Choose a valid time and contact.', 'warning');
            return;
        }
        scheduleEvent({ type, contactId, at, repeat, text });
        renderSchedulerView(dialog);
        return;
    }
    if (action === 'memory-add') {
        const subject = dialog.querySelector('#ppfs-memory-subject')?.value || '';
        const fact = dialog.querySelector('#ppfs-memory-fact')?.value || '';
        if (!subject || !fact) return;
        addMemory(subject, fact);
        renderMemoryView(dialog);
        return;
    }
    if (action === 'calendar-add') {
        const title = dialog.querySelector('#ppfs-calendar-title')?.value || '';
        const atText = dialog.querySelector('#ppfs-calendar-at')?.value || '';
        const note = dialog.querySelector('#ppfs-calendar-note')?.value || '';
        if (!title || !addCalendarEvent(null, title, atText, note, false)) {
            toast('Enter a valid title and date.', 'warning');
            return;
        }
        const eventItem = suiteConfig().calendarEvents.at(-1);
        if (eventItem) eventItem.accepted = true;
        saveAll();
        renderCalendarView(dialog);
        return;
    }
    if (action === 'backup-export') {
        await exportBackup();
        return;
    }
    if (action === 'backup-import') {
        dialog.querySelector('#ppfs-backup-file')?.click();
        return;
    }
    if (action === 'diagnostics-export') {
        exportDiagnostics();
        return;
    }
    if (action === 'diagnostics-clear') {
        suiteConfig().diagnostics = [];
        saveAll();
        renderDiagnosticsView(dialog);
        return;
    }
    if (action === 'test-notification') {
        nativeNotification('Pocket Phone', 'Feature-suite test notification');
        return;
    }
    if (action === 'test-message') {
        const contact = contacts()[0];
        if (contact) pushIncoming(contact, { text: 'Pocket Phone feature-suite test message.' }, 'Feature-suite test message');
        else toast('No contacts are available.', 'warning');
        return;
    }

    if (button.dataset.ppfsDeleteSchedule) {
        suiteConfig().scheduledEvents = suiteConfig().scheduledEvents.filter(item => item.id !== button.dataset.ppfsDeleteSchedule);
        saveAll();
        renderSchedulerView(dialog);
        return;
    }
    if (button.dataset.ppfsDeleteMemory) {
        suiteConfig().memories = suiteConfig().memories.filter(item => item.id !== button.dataset.ppfsDeleteMemory);
        saveAll();
        renderMemoryView(dialog);
        return;
    }
    if (button.dataset.ppfsAcceptCalendar) {
        const item = suiteConfig().calendarEvents.find(eventItem => eventItem.id === button.dataset.ppfsAcceptCalendar);
        if (item) {
            item.accepted = true;
            item.proposed = false;
            saveAll();
        }
        renderCalendarView(dialog);
        return;
    }
    if (button.dataset.ppfsDeleteCalendar) {
        suiteConfig().calendarEvents = suiteConfig().calendarEvents.filter(item => item.id !== button.dataset.ppfsDeleteCalendar);
        saveAll();
        renderCalendarView(dialog);
    }
}

function injectSettingsCard() {
    const body = document.getElementById('pp-settings-body');
    if (!body || document.getElementById(SETTINGS_CARD_ID)) return;
    const wrapper = document.createElement('div');
    wrapper.id = SETTINGS_CARD_ID;
    wrapper.innerHTML = `
        <div class="pp-sec-label">Optional feature suite</div>
        <div class="ppfs-summary">
            <p>Autonomy, scheduling, availability, receipts, reactions, TTS, browser notifications, images, social events, calendar, memory, aliases, backup, diagnostics, transactions, and offline cache. Every new feature defaults to off.</p>
            <button type="button">Open optional features</button>
        </div>`;
    wrapper.querySelector('button').addEventListener('click', () => openFeatureSuite('main'));
    body.appendChild(wrapper);
}

function installSettingsObserver() {
    ensureStyles();
    const observer = new MutationObserver(() => {
        injectSettingsCard();
        decorateThreadMessages();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    injectSettingsCard();
}

function installMessageInteractions() {
    document.addEventListener('click', event => {
        const ttsButton = event.target.closest('[data-tts-mid]');
        if (ttsButton && enabled('ttsEnabled')) {
            const resolved = findVisibleMessage(ttsButton.dataset.ttsMid);
            if (resolved) speakText(resolved.message.text || '', resolved.contact);
            return;
        }
    });

    document.addEventListener('dblclick', event => {
        if (!enabled('reactionsEnabled')) return;
        const row = event.target.closest('#pp-msgs .pp-brow[data-mid]');
        if (!row) return;
        const resolved = findVisibleMessage(row.dataset.mid);
        if (!resolved) return;
        const reaction = window.prompt('Reaction label', '♥');
        if (!reaction) return;
        if (!Array.isArray(resolved.message.reactions)) resolved.message.reactions = [];
        resolved.message.reactions.push({ by: 'user', reaction: reaction.slice(0, 30) });
        saveAll();
        decorateThreadMessages();
    });

    document.addEventListener('change', async event => {
        if (event.target?.id !== 'ppfs-backup-file') return;
        const file = event.target.files?.[0];
        if (!file) return;
        try { await importBackup(file); }
        catch (error) {
            logDiagnostic('error', 'Backup import failed', error?.stack || error?.message);
            toast(`Backup import failed: ${error?.message || error}`, 'error');
        } finally {
            event.target.value = '';
        }
    });
}

function installEventHooks() {
    const context = getContext();
    const events = context?.event_types || {};
    if (context?.eventSource) {
        if (events.MESSAGE_RECEIVED) context.eventSource.on(events.MESSAGE_RECEIVED, () => setTimeout(parseFeatureTags, 250));
        if (events.CHARACTER_MESSAGE_RENDERED) context.eventSource.on(events.CHARACTER_MESSAGE_RENDERED, () => setTimeout(parseFeatureTags, 250));
        if (events.MESSAGE_SENT) context.eventSource.on(events.MESSAGE_SENT, () => {
            setTimeout(processReceipts, 1200);
            setTimeout(runAutonomyCheck, 2000);
        });
    }
}

function startTimers() {
    setInterval(() => {
        try {
            processScheduler();
            processReceipts();
            runAutonomyCheck();
            decorateThreadMessages();
        } catch (error) {
            logDiagnostic('error', 'Feature-suite timer failed', error?.stack || error?.message);
        }
    }, 30000);

    setInterval(() => {
        try { decorateThreadMessages(); } catch {}
    }, 2500);
}

function initialize() {
    suiteConfig(); // Backfill defaults; all optional features remain off.
    saveAll();
    ensureStyles();
    installSettingsObserver();
    installMessageInteractions();
    installEventHooks();
    startTimers();
    window.ppGenInterceptor = window.__deszidesuPocketPhoneInterceptorWrapper0100 || window.ppGenInterceptor;
    window.PP_FEATURE_SUITE = {
        version: SUITE_VERSION,
        open: openFeatureSuite,
        config: suiteConfig,
        runAutonomyCheck,
        parseFeatureTags,
        processScheduler,
        exportBackup,
        exportDiagnostics,
    };
    logDiagnostic('info', 'Feature suite initialized', `Version ${SUITE_VERSION}`);
    console.info(`[Pocket Phone] Optional feature suite ${SUITE_VERSION} initialized. All added features default to off.`);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
} else {
    initialize();
}
})();
