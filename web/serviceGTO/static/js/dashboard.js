const API_BASE = '/api/v1';

/* ============================================================
   AUTH
   ============================================================ */
function getAuthHeaders() {
    return {
        'Authorization': `Bearer ${localStorage.getItem('access_token') || ''}`,
        'Content-Type': 'application/json',
    };
}

/* ============================================================
   HELPERS
   ============================================================ */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

const esc = str => String(str ?? '').replace(/[&<>"']/g, s => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[s]));

function statusBadge(status) {
    const map = {
        new:      ['Новая',       'bg-blue-50 text-blue-700 border-blue-200'],
        pending:  ['В работе',    'bg-yellow-50 text-yellow-700 border-yellow-200'],
        approved: ['Подтверждена','bg-green-50 text-green-700 border-green-200'],
        rejected: ['Отклонена',   'bg-red-50 text-red-700 border-red-200'],
        done:     ['Завершена',   'bg-gray-100 text-gray-700 border-gray-200'],
    };
    const [label, cls] = map[status] || [status || '—', 'bg-gray-100 text-gray-700 border-gray-200'];
    return `<span class="inline-block text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 border rounded-sm ${cls}">${esc(label)}</span>`;
}

function listShell(rows, emptyText) {
    if (!rows) return `<div class="text-sm text-gray-500 py-8 text-center">${emptyText}</div>`;
    return rows;
}

/* ============================================================
   APPLICATIONS
   ============================================================ */
async function fetchApplications() {
    const box = $('#applicationsList');
    if (!box) return;

    box.innerHTML = Array.from({ length: 4 }).map(() =>
        `<div class="h-10 bg-gray-100 rounded animate-pulse"></div>`
    ).join('');

    try {
        const res = await fetch(`${API_BASE}/applications/?size=50`, { headers: getAuthHeaders() });
        const data = await res.json();
        const apps = data.items || [];

        if (!apps.length) {
            box.innerHTML = listShell('', 'Заявок пока нет');
            return;
        }

        box.innerHTML = `
            <ul class="divide-y divide-gray-100 border border-gray-200 rounded bg-white">
                ${apps.map(a => `
                    <li class="p-4 flex flex-col md:flex-row md:items-center gap-3 md:gap-6">
                        <div class="min-w-0 flex-1">
                            <div class="font-semibold truncate">${esc(a.parent_name)}</div>
                            <a href="tel:${esc(a.parent_phone)}" class="text-sm text-gray-500 tnum hover:text-red-600">
                                ${esc(a.parent_phone)}
                            </a>
                        </div>
                        <div class="min-w-0 flex-1">
                            <div class="text-sm text-gray-800 truncate">
                                Ребёнок: <strong>${esc(a.child_name)}</strong>${a.child_age ? ` · ${esc(a.child_age)} лет` : ''}
                            </div>
                            ${a.club_name ? `<div class="text-xs text-gray-500 truncate mt-1">${esc(a.club_name)}</div>` : ''}
                        </div>
                        <div class="shrink-0">${statusBadge(a.status)}</div>
                    </li>
                `).join('')}
            </ul>
        `;
    } catch (e) {
        console.error('[applications]', e);
        box.innerHTML = listShell('', 'Не удалось загрузить заявки');
    }
}

/* ============================================================
   PLAYERS
   ============================================================ */
async function fetchPlayers() {
    const box = $('#playersList');
    if (!box) return;

    box.innerHTML = Array.from({ length: 6 }).map(() =>
        `<div class="h-12 bg-gray-100 rounded animate-pulse"></div>`
    ).join('');

    try {
        const res = await fetch(`${API_BASE}/players/?size=100`, { headers: getAuthHeaders() });
        const data = await res.json();
        const players = data.items || [];

        if (!players.length) {
            box.innerHTML = listShell('', 'Игроков пока нет');
            return;
        }

        box.innerHTML = `
            <ul class="divide-y divide-gray-100 border border-gray-200 rounded bg-white">
                ${players.map(p => `
                    <li class="p-4 flex items-center gap-4">
                        <img
                            src="${esc(p.photo_url) || 'https://via.placeholder.com/40'}"
                            class="w-10 h-10 rounded object-cover bg-gray-100"
                            loading="lazy"
                            alt=""
                        >
                        <div class="min-w-0 flex-1">
                            <div class="font-semibold truncate">${esc(p.first_name)} ${esc(p.last_name)}</div>
                            <div class="text-xs text-gray-500 truncate">${esc(p.club?.name || '— без клуба')}</div>
                        </div>
                    </li>
                `).join('')}
            </ul>
        `;
    } catch (e) {
        console.error('[players]', e);
        box.innerHTML = listShell('', 'Не удалось загрузить игроков');
    }
}

/* ============================================================
   TEST OPTIONS + RESULT FORM
   ============================================================ */
async function loadTestOptions() {
    const select = $('#testSelect');
    const playerSelect = $('#playerSelect');
    if (!select) return;

    try {
        const [testsRes, playersRes] = await Promise.all([
            fetch(`${API_BASE}/tests/?size=100`,    { headers: getAuthHeaders() }),
            fetch(`${API_BASE}/players/?size=100`, { headers: getAuthHeaders() }),
        ]);

        const tests   = (await testsRes.json()).items   || [];
        const players = (await playersRes.json()).items || [];

        select.innerHTML = tests.map(t =>
            `<option value="${esc(t.id)}">${esc(t.name)} — ${esc(t.section)}</option>`
        ).join('') || '<option value="">Нет доступных тестов</option>';

        if (playerSelect) {
            playerSelect.innerHTML = players.map(p =>
                `<option value="${esc(p.id)}">${esc(p.first_name)} ${esc(p.last_name)}</option>`
            ).join('') || '<option value="">Нет игроков</option>';
        }
    } catch (e) {
        console.error('[tests]', e);
        select.innerHTML = '<option value="">Ошибка загрузки</option>';
    }
}

function initResultForm() {
    const form = $('#resultForm');
    if (!form) return;

    form.addEventListener('submit', async e => {
        e.preventDefault();
        const btn = form.querySelector('button[type="submit"]');
        const fd = new FormData(form);

        const payload = {
            player_id: Number(fd.get('player_id')),
            test_id:   Number(fd.get('test_id')),
            test_date: fd.get('test_date'),
            value:     parseFloat(fd.get('value')),
            notes:     (fd.get('notes') || '').toString().trim(),
        };

        if (!payload.player_id || !payload.test_id || Number.isNaN(payload.value)) {
            showInline(form, 'error', 'Заполните все обязательные поля');
            return;
        }

        const idle = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Сохранение…';

        try {
            const res = await fetch(`${API_BASE}/results/`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error();
            showInline(form, 'success', 'Результат сохранён');
            form.reset();
        } catch {
            showInline(form, 'error', 'Не удалось сохранить результат');
        } finally {
            btn.disabled = false;
            btn.textContent = idle;
        }
    });
}

function showInline(form, type, text) {
    let box = form.querySelector('.form-message');
    if (!box) {
        box = document.createElement('div');
        box.className = 'form-message mt-4 text-sm';
        form.appendChild(box);
    }
    box.className = `form-message mt-4 text-sm ${type === 'error' ? 'text-red-600' : 'text-green-700'}`;
    box.textContent = text;
    if (type === 'success') setTimeout(() => box.remove(), 5000);
}

/* ============================================================
   TABS
   ============================================================ */
function initTabs() {
    const tabs = $$('[data-tab]');
    if (!tabs.length) return;

    tabs.forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;

            tabs.forEach(b => b.classList.toggle('active', b === btn));
            $$('.tab-content').forEach(el => el.classList.add('hidden'));
            $(`#${tab}Tab`)?.classList.remove('hidden');

            if (tab === 'applications') fetchApplications();
            if (tab === 'players')      fetchPlayers();
            if (tab === 'results')      loadTestOptions();
        });
    });
}

/* ============================================================
   LOGOUT
   ============================================================ */
function initLogout() {
    $('#logoutBtn')?.addEventListener('click', () => {
        localStorage.removeItem('access_token');
        window.location.href = '/login';
    });
}

/* ============================================================
   GUARD
   ============================================================ */
if (!localStorage.getItem('access_token')) {
    window.location.href = '/login';
}

/* ============================================================
   BOOTSTRAP
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initResultForm();
    initLogout();

    // грузим стартовую вкладку
    fetchApplications();
});