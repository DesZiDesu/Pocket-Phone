
function toggleRow(key, label, description) {
    const state = suiteConfig();
    return `<label class="ppfs-row">
        <span><strong>${escapeHtml(label)}</strong><small>${escapeHtml(description)}</small></span>
        <input type="checkbox" data-ppfs-toggle="${escapeHtml(key)}"${state[key] ? ' checked' : ''}>
    </label>`;
}

function numberField(key, label, min, max, step = 1) {
    const state = suiteConfig();
    return `<label class="ppfs-field"><span>${escapeHtml(label)}</span>
        <input type="number" data-ppfs-value="${escapeHtml(key)}" value="${escapeHtml(state[key])}" min="${min}" max="${max}" step="${step}">
    </label>`;
}

function textField(key, label, type = 'text', placeholder = '') {
    const state = suiteConfig();
    return `<label class="ppfs-field"><span>${escapeHtml(label)}</span>
        <input type="${type}" data-ppfs-value="${escapeHtml(key)}" value="${escapeHtml(state[key])}" placeholder="${escapeHtml(placeholder)}">
    </label>`;
}

function renderMainView(dialog) {
    dialog.querySelector('.ppfs-title').textContent = `Pocket Phone Feature Suite ${SUITE_VERSION}`;
    dialog.querySelector('.ppfs-content').innerHTML = `
        <p class="ppfs-intro">Every feature below is independent and defaults to off. The existing Pocket Phone functions continue to use their original settings.</p>

        <section class="ppfs-section">
            <h3>Autonomy and world intelligence</h3>
            ${toggleRow('autonomyEnabled', 'Autonomous NPC activity', 'Contacts may message, call, post, or send gifts while SillyTavern remains open.')}
            ${toggleRow('perContactControlsEnabled', 'Per-contact controls', 'Apply individual contact permissions, aliases, schedules, and cooldowns.')}
            ${toggleRow('availabilityEnabled', 'Contact availability and routines', 'Respect each contact’s days and available hours.')}
            ${toggleRow('worldMemoryEnabled', 'Structured world memory', 'Store persistent story facts and inject them into Pocket Phone generation.')}
            ${toggleRow('aliasResolverEnabled', 'Contact alias resolver', 'Resolve nicknames and alternate names safely.')}
            <div class="ppfs-grid">
                ${numberField('autonomyCheckMinutes', 'Autonomy check interval (minutes)', 1, 1440)}
                ${numberField('autonomyChancePercent', 'Chance per check (%)', 0, 100)}
                ${numberField('autonomyCooldownMinutes', 'Global contact cooldown (minutes)', 1, 10080)}
                ${numberField('autonomyMaxPerHour', 'Maximum autonomous events/hour', 1, 20)}
                ${numberField('quietHoursStart', 'Quiet hours start', 0, 23)}
                ${numberField('quietHoursEnd', 'Quiet hours end', 0, 23)}
            </div>
            <div class="ppfs-actions">
                <button data-ppfs-action="contacts">Contact rules</button>
                <button data-ppfs-action="autonomy-test">Run autonomy test</button>
                <button data-ppfs-action="memories">World memories</button>
            </div>
        </section>

        <section class="ppfs-section">
            <h3>Messages and notifications</h3>
            ${toggleRow('schedulerEnabled', 'Real scheduler', 'Run persisted messages, calls, voice notes, gifts, and reminders at real times while SillyTavern is open.')}
            ${toggleRow('receiptsEnabled', 'Delivery and read receipts', 'Track sent, delivered, and read states.')}
            ${toggleRow('reactionsEnabled', 'Message reactions', 'Add reactions and allow NPC reaction commands.')}
            ${toggleRow('ttsEnabled', 'Voice playback (browser TTS)', 'Play voice-message text using speech synthesis.')}
            ${toggleRow('browserNotificationsEnabled', 'Browser notifications', 'Show optional native notifications outside the phone window.')}
            <div class="ppfs-grid">
                ${numberField('receiptReadDelaySeconds', 'Read delay (seconds)', 1, 3600)}
                ${numberField('ttsRate', 'TTS rate', 0.5, 2, 0.1)}
                ${numberField('ttsPitch', 'TTS pitch', 0, 2, 0.1)}
                ${numberField('ttsVolume', 'TTS volume', 0, 1, 0.1)}
            </div>
            ${toggleRow('ttsAutoPlayVoice', 'Autoplay autonomous voice messages', 'Automatically speak voice events created by the autonomy system.')}
            ${toggleRow('notificationPreview', 'Show notification previews', 'Display message content in browser notifications.')}
            <div class="ppfs-actions">
                <button data-ppfs-action="scheduler">Scheduler</button>
                <button data-ppfs-action="notification-permission">Request notification permission</button>
            </div>
        </section>

        <section class="ppfs-section">
            <h3>Media, social, and planning</h3>
            ${toggleRow('imageBridgeEnabled', 'Image-message bridge', 'Accept image URLs or use a configurable image-generation endpoint.')}
            ${toggleRow('socialBridgeEnabled', 'Feed and story bridge', 'Allow roleplay and autonomy to create posts, stories, comments, and likes.')}
            ${toggleRow('calendarEnabled', 'Calendar and reminders', 'Store proposed events, accept or reject them, and notify when due.')}
            <div class="ppfs-grid">
                ${textField('imageEndpoint', 'Image endpoint URL', 'url', 'Optional POST endpoint')}
                ${textField('imageEndpointKey', 'Image endpoint bearer key', 'password', 'Optional')}
            </div>
            <div class="ppfs-actions">
                <button data-ppfs-action="calendar">Calendar</button>
            </div>
        </section>

        <section class="ppfs-section">
            <h3>Reliability and data</h3>
            ${toggleRow('backupToolsEnabled', 'Full backup and restore', 'Export and restore phone configuration, histories, and media.')}
            ${toggleRow('diagnosticsEnabled', 'Diagnostics panel and logs', 'Record command processing, failures, and capability checks.')}
            ${toggleRow('transactionQueueEnabled', 'Event deduplication and transactions', 'Persist processed event hashes and reject duplicates.')}
            ${toggleRow('offlineCacheEnabled', 'Optional offline upstream cache', 'Cache the pinned upstream source after a successful load; takes effect after reload.')}
            <div class="ppfs-actions">
                <button data-ppfs-action="backup">Backup and restore</button>
                <button data-ppfs-action="diagnostics">Diagnostics</button>
            </div>
        </section>
    `;
}

function renderContactView(dialog) {
    const list = contacts();
    const currentId = dialog.dataset.contactId || list[0]?.id || '';
    dialog.dataset.contactId = currentId;
    const contact = list.find(item => item.id === currentId);
    const policy = contact ? contactPolicy(contact.id) : null;
    const dayLabels = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

    dialog.querySelector('.ppfs-title').textContent = 'Per-contact rules';
    dialog.querySelector('.ppfs-content').innerHTML = `
        <div class="ppfs-actions"><button data-ppfs-action="back">Back</button></div>
        <label class="ppfs-field"><span>Contact</span>
            <select data-ppfs-contact-select>
                ${list.map(item => `<option value="${escapeHtml(item.id)}"${item.id === currentId ? ' selected' : ''}>${escapeHtml(displayName(item))}</option>`).join('')}
            </select>
        </label>
        ${!contact ? '<p>No Pocket Phone contacts are available.</p>' : `
        <section class="ppfs-section">
            <h3>${escapeHtml(displayName(contact))}</h3>
            ${contactToggle('enabled', 'Feature-suite activity enabled', policy.enabled)}
            ${contactToggle('allowMessages', 'Allow autonomous messages', policy.allowMessages)}
            ${contactToggle('allowCalls', 'Allow autonomous calls', policy.allowCalls)}
            ${contactToggle('allowVoice', 'Allow voice messages', policy.allowVoice)}
            ${contactToggle('allowSocial', 'Allow posts and stories', policy.allowSocial)}
            ${contactToggle('allowGifts', 'Allow gifts', policy.allowGifts)}
            ${contactToggle('allowPayments', 'Allow payments', policy.allowPayments)}
            ${contactToggle('ignoreQuietHours', 'Ignore global quiet hours', policy.ignoreQuietHours)}
            <label class="ppfs-field"><span>Aliases, comma separated</span>
                <input data-ppfs-contact-value="aliases" value="${escapeHtml((policy.aliases || []).join(', '))}">
            </label>
            <div class="ppfs-grid">
                <label class="ppfs-field"><span>Available from</span><input type="time" data-ppfs-contact-value="availableFrom" value="${escapeHtml(policy.availableFrom)}"></label>
                <label class="ppfs-field"><span>Available to</span><input type="time" data-ppfs-contact-value="availableTo" value="${escapeHtml(policy.availableTo)}"></label>
                <label class="ppfs-field"><span>Extra cooldown (minutes)</span><input type="number" min="0" max="10080" data-ppfs-contact-value="cooldownMinutes" value="${escapeHtml(policy.cooldownMinutes)}"></label>
                <label class="ppfs-field"><span>TTS voice name</span><input data-ppfs-contact-value="ttsVoice" value="${escapeHtml(policy.ttsVoice || '')}" placeholder="Exact browser voice name"></label>
            </div>
            <div class="ppfs-days">
                ${dayLabels.map((label, index) => `<label><input type="checkbox" data-ppfs-contact-day="${index}"${policy.availableDays.includes(index) ? ' checked' : ''}>${label}</label>`).join('')}
            </div>
        </section>`}
    `;
}

function contactToggle(key, label, checked) {
    return `<label class="ppfs-row"><span><strong>${escapeHtml(label)}</strong></span>
        <input type="checkbox" data-ppfs-contact-toggle="${escapeHtml(key)}"${checked ? ' checked' : ''}></label>`;
}

function renderSchedulerView(dialog) {
    const state = suiteConfig();
    dialog.querySelector('.ppfs-title').textContent = 'Scheduler';
    dialog.querySelector('.ppfs-content').innerHTML = `
        <div class="ppfs-actions"><button data-ppfs-action="back">Back</button></div>
        <section class="ppfs-section">
            <h3>Add scheduled event</h3>
            <div class="ppfs-grid">
                <label class="ppfs-field"><span>Type</span><select id="ppfs-schedule-type">
                    <option value="message">Incoming message</option><option value="call">Incoming call</option>
                    <option value="voice">Voice message</option><option value="note">Status note</option>
                    <option value="gift">Gift</option><option value="reminder">User reminder</option>
                </select></label>
                <label class="ppfs-field"><span>Contact</span><select id="ppfs-schedule-contact">
                    <option value="">None / reminder</option>
                    ${contacts().map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(displayName(item))}</option>`).join('')}
                </select></label>
                <label class="ppfs-field"><span>Date and time</span><input type="datetime-local" id="ppfs-schedule-at"></label>
                <label class="ppfs-field"><span>Repeat</span><select id="ppfs-schedule-repeat">
                    <option value="none">None</option><option value="daily">Daily</option><option value="weekly">Weekly</option>
                </select></label>
            </div>
            <label class="ppfs-field"><span>Message / title / gift</span><textarea id="ppfs-schedule-text" rows="3"></textarea></label>
            <div class="ppfs-actions"><button data-ppfs-action="schedule-add">Add event</button></div>
        </section>
        <section class="ppfs-section">
            <h3>Scheduled events</h3>
            <div class="ppfs-list">
                ${state.scheduledEvents.length ? state.scheduledEvents.sort((a,b) => a.at-b.at).map(event => `
                    <div class="ppfs-list-item">
                        <div><strong>${escapeHtml(event.type)}</strong> · ${escapeHtml(new Date(event.at).toLocaleString())}<small>${escapeHtml(event.text || '')}</small></div>
                        <button data-ppfs-delete-schedule="${escapeHtml(event.id)}">Delete</button>
                    </div>`).join('') : '<p>No scheduled events.</p>'}
            </div>
        </section>
    `;
}

function renderMemoryView(dialog) {
    const state = suiteConfig();
    dialog.querySelector('.ppfs-title').textContent = 'World memories';
    dialog.querySelector('.ppfs-content').innerHTML = `
        <div class="ppfs-actions"><button data-ppfs-action="back">Back</button></div>
        <section class="ppfs-section">
            <label class="ppfs-field"><span>Subject</span><input id="ppfs-memory-subject"></label>
            <label class="ppfs-field"><span>Fact</span><textarea id="ppfs-memory-fact" rows="4"></textarea></label>
            <div class="ppfs-actions"><button data-ppfs-action="memory-add">Add memory</button></div>
        </section>
        <section class="ppfs-section"><div class="ppfs-list">
            ${state.memories.length ? state.memories.slice().reverse().map(item => `
                <div class="ppfs-list-item"><div><strong>${escapeHtml(item.subject)}</strong><small>${escapeHtml(item.fact)}</small></div>
                <button data-ppfs-delete-memory="${escapeHtml(item.id)}">Delete</button></div>`).join('') : '<p>No stored memories.</p>'}
        </div></section>
    `;
}

function renderCalendarView(dialog) {
    const state = suiteConfig();
    dialog.querySelector('.ppfs-title').textContent = 'Calendar';
    dialog.querySelector('.ppfs-content').innerHTML = `
        <div class="ppfs-actions"><button data-ppfs-action="back">Back</button></div>
        <section class="ppfs-section">
            <label class="ppfs-field"><span>Title</span><input id="ppfs-calendar-title"></label>
            <label class="ppfs-field"><span>Date and time</span><input type="datetime-local" id="ppfs-calendar-at"></label>
            <label class="ppfs-field"><span>Note</span><textarea id="ppfs-calendar-note" rows="3"></textarea></label>
            <div class="ppfs-actions"><button data-ppfs-action="calendar-add">Add accepted event</button></div>
        </section>
        <section class="ppfs-section"><div class="ppfs-list">
            ${state.calendarEvents.length ? state.calendarEvents.sort((a,b) => a.at-b.at).map(event => `
                <div class="ppfs-list-item">
                    <div><strong>${escapeHtml(event.title)}</strong> · ${escapeHtml(new Date(event.at).toLocaleString())}
                    <small>${escapeHtml(event.note || '')}${event.proposed && !event.accepted ? ' · Proposed' : ''}</small></div>
                    <span>
                        ${event.proposed && !event.accepted ? `<button data-ppfs-accept-calendar="${escapeHtml(event.id)}">Accept</button>` : ''}
                        <button data-ppfs-delete-calendar="${escapeHtml(event.id)}">Delete</button>
                    </span>
                </div>`).join('') : '<p>No calendar events.</p>'}
        </div></section>
    `;
}

function renderBackupView(dialog) {
    dialog.querySelector('.ppfs-title').textContent = 'Backup and restore';
    dialog.querySelector('.ppfs-content').innerHTML = `
        <div class="ppfs-actions"><button data-ppfs-action="back">Back</button></div>
        <section class="ppfs-section">
            <p>Backups contain Pocket Phone settings, contacts, threads, calls, wallet, feed, stories, feature-suite data, and stored media.</p>
            <div class="ppfs-actions">
                <button data-ppfs-action="backup-export">Export full backup</button>
                <button data-ppfs-action="backup-import">Import backup</button>
            </div>
            <input type="file" id="ppfs-backup-file" accept="application/json" hidden>
        </section>
    `;
}

function renderDiagnosticsView(dialog) {
    const state = suiteConfig();
    dialog.querySelector('.ppfs-title').textContent = 'Diagnostics';
    dialog.querySelector('.ppfs-content').innerHTML = `
        <div class="ppfs-actions"><button data-ppfs-action="back">Back</button></div>
        <section class="ppfs-section">
            <div class="ppfs-actions">
                <button data-ppfs-action="diagnostics-export">Export report</button>
                <button data-ppfs-action="diagnostics-clear">Clear logs</button>
                <button data-ppfs-action="test-message">Test message</button>
                <button data-ppfs-action="test-notification">Test notification</button>
            </div>
            <pre class="ppfs-log">${escapeHtml(state.diagnostics.slice(-80).map(row =>
                `${new Date(row.ts).toLocaleTimeString()} [${row.level}] ${row.message}${row.detail ? ` — ${row.detail}` : ''}`
            ).join('\n') || 'No diagnostic entries.')}</pre>
        </section>
    `;
}
