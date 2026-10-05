const API_BASE = '/api/v1';

/* ============================================================
   STATE
   ============================================================ */
const state = {
    page: 1,
    pages: 1,
    perPage: 12,
    filters: { search: '', club: 'all', age: 'all', gender: 'all', sort: 'total_rating' },
    selected: new Set(),
};

/* ============================================================
   HELPERS
   ============================================================ */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

const esc = str => String(str ?? '').replace(/[&<>"']/g, s => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[s]));

function debounce(fn, wait = 300) {
    let t;
    return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn.apply(this, args), wait);
    };
}

/* ============================================================
   CLUBS
   ============================================================ */
async function fetchClubs() {
    const select = $('#clubFilter');
    if (!select) return;
    try {
        const res = await fetch(`${API_BASE}/clubs/?size=100`);
        const data = await res.json();
        const clubs = data.items || [];
        select.innerHTML = `<option value="all">Все клубы</option>` +
            clubs.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
    } catch (e) {
        console.error('[clubs]', e);
    }
}

/* ============================================================
   PLAYERS
   ============================================================ */
async function loadPlayers() {
    const grid = $('#playersResults');
    if (!grid) return;

    grid.innerHTML = Array.from({ length: 6 }).map(() => `
        <div class="border border-gray-200 rounded bg-white p-5">
            <div class="flex gap-4">
                <div class="w-16 h-16 rounded bg-gray-100 animate-pulse"></div>
                <div class="flex-1 space-y-2">
                    <div class="h-4 w-2/3 bg-gray-100 rounded animate-pulse"></div>
                    <div class="h-3 w-1/2 bg-gray-100 rounded animate-pulse"></div>
                </div>
            </div>
            <div class="mt-5 space-y-2">
                ${Array.from({ length: 4 }).map(() =>
                    `<div class="h-3 bg-gray-100 rounded animate-pulse"></div>`
                ).join('')}
            </div>
        </div>
    `).join('');

    const params = new URLSearchParams({
        page: state.page,
        size: state.perPage,
        sort_by: state.filters.sort,
    });
    if (state.filters.age !== 'all')    params.set('age_group', `U${state.filters.age}`);
    if (state.filters.club !== 'all')   params.set('club_id',   state.filters.club);
    if (state.filters.gender !== 'all') params.set('gender',    state.filters.gender);
    if (state.filters.search)           params.set('search',    state.filters.search);

    try {
        const res = await fetch(`${API_BASE}/players/rankings?${params}`);
        if (!res.ok) throw new Error('bad_status');
        const data = await res.json();

        state.page  = data.page  ?? 1;
        state.pages = data.pages ?? 1;

        renderPlayers(data.items || []);
        renderPagination();
    } catch (e) {
        console.error('[players]', e);
        grid.innerHTML = `
            <div class="md:col-span-3 border border-dashed border-gray-300 rounded p-12 text-center text-gray-500">
                Не удалось загрузить игроков
            </div>`;
        $('#noResults')?.classList.add('hidden');
        $('#pagination').innerHTML = '';
    }
}

function ratingTone(v) {
    const n = Number(v) || 0;
    if (n >= 85) return { cls: 'text-green-700',  label: 'Отлично' };
    if (n >= 70) return { cls: 'text-blue-700',   label: 'Хорошо'  };
    if (n >= 55) return { cls: 'text-yellow-600', label: 'Средне'  };
    return { cls: 'text-gray-700', label: 'Базово' };
}

function renderPlayers(players) {
    const grid = $('#playersResults');
    const noResults = $('#noResults');

    if (!players.length) {
        grid.innerHTML = '';
        noResults?.classList.remove('hidden');
        return;
    }
    noResults?.classList.add('hidden');

    grid.innerHTML = players.map(p => {
        const id = p.player_id ?? p.id;
        const isSel = state.selected.has(id);
        const tone = ratingTone(p.total_rating);

        return `
            <article class="border rounded bg-white flex flex-col transition-colors ${isSel ? 'border-gray-900 ring-1 ring-gray-900' : 'border-gray-200 hover:border-gray-400'}">
                <div class="p-5">
                    <div class="flex items-start gap-4">
                        <img
                            src="${esc(p.photo_url) || 'https://via.placeholder.com/80'}"
                            alt=""
                            class="w-16 h-16 rounded object-cover bg-gray-100"
                            loading="lazy"
                        >
                        <div class="min-w-0 flex-1">
                            <h3 class="font-bold text-lg leading-tight truncate">
                                ${esc(p.first_name)} ${esc(p.last_name)}
                            </h3>
                            <p class="text-sm text-gray-500 mt-1 truncate">
                                ${esc(p.club_name || '— без клуба')} · ${esc(p.age)} лет
                            </p>
                        </div>
                        <div class="text-right shrink-0">
                            <div class="text-2xl font-bold tnum leading-none ${tone.cls}">
                                ${esc(p.total_rating ?? '—')}
                            </div>
                            <div class="text-[10px] uppercase tracking-widest text-gray-400 mt-1">${tone.label}</div>
                        </div>
                    </div>

                    <dl class="mt-5 pt-4 border-t border-gray-100 space-y-1.5 text-sm">
                        ${[
                            ['Антропометрия', p.anthropometry],
                            ['Атлетизм',      p.athleticism],
                            ['Быстрота',      p.speed],
                            ['Ловкость',      p.agility],
                            ['Дриблинг',      p.dribbling],
                            ['Техника',       p.technique],
                            ['Удары',         p.shots],
                        ].map(([label, val]) => `
                            <div class="flex justify-between">
                                <dt class="text-gray-500">${label}</dt>
                                <dd class="font-medium tnum">${val ?? '—'}</dd>
                            </div>
                        `).join('')}
                    </dl>
                </div>

                <div class="mt-auto px-5 py-4 border-t border-gray-100 flex items-center justify-between">
                    <label class="inline-flex items-center gap-2 text-sm cursor-pointer select-none">
                        <input
                            type="checkbox"
                            class="w-4 h-4 accent-gray-900"
                            data-compare="${esc(id)}"
                            ${isSel ? 'checked' : ''}
                        >
                        Сравнить
                    </label>
                    <button
                        type="button"
                        data-download="${esc(id)}"
                        class="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-900 hover:text-red-600"
                    >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"/>
                        </svg>
                        Карточка
                    </button>
                </div>
            </article>
        `;
    }).join('');
}

/* ============================================================
   PAGINATION
   ============================================================ */
function renderPagination() {
    const box = $('#pagination');
    if (!box) return;

    const { page, pages } = state;
    if (pages <= 1) { box.innerHTML = ''; return; }

    const parts = [];
    const push = html => parts.push(html);

    const btn = (p, label = p, active = false, disabled = false) => `
        <button
            type="button"
            data-page="${p}"
            ${disabled ? 'disabled' : ''}
            class="min-w-[36px] h-9 px-3 border rounded text-sm font-medium tnum transition-colors
                ${active
                    ? 'bg-gray-900 text-white border-gray-900'
                    : disabled
                        ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                        : 'border-gray-200 text-gray-700 hover:border-gray-900 hover:text-gray-900'}"
        >${label}</button>`;

    push(btn(page - 1, '←', false, page === 1));

    const win = [];
    const add = p => { if (p >= 1 && p <= pages && !win.includes(p)) win.push(p); };
    add(1); add(2);
    for (let p = page - 1; p <= page + 1; p++) add(p);
    add(pages - 1); add(pages);
    win.sort((a, b) => a - b);

    let last = 0;
    for (const p of win) {
        if (p - last > 1) push(`<span class="px-1 text-gray-400 select-none">…</span>`);
        push(btn(p, p, p === page));
        last = p;
    }

    push(btn(page + 1, '→', false, page === pages));

    box.innerHTML = parts.join('');

    $$('#pagination button[data-page]').forEach(b => {
        b.addEventListener('click', () => {
            const p = Number(b.dataset.page);
            if (!p || p === state.page || p < 1 || p > state.pages) return;
            state.page = p;
            loadPlayers();
            $('#playersResults')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });
}

/* ============================================================
   COMPARISON
   ============================================================ */
function updateCompareUI() {
    const notice  = $('#compareNotice');
    const countEl = $('#compareCount');
    const section = $('#comparisonSection');

    const n = state.selected.size;
    if (countEl) countEl.textContent = n;

    if (n >= 1 && notice) notice.classList.remove('hidden');
    else notice?.classList.add('hidden');

    if (n >= 2 && section) {
        section.classList.remove('hidden');
        renderComparison();
    } else {
        section?.classList.add('hidden');
        const g = $('#comparisonGrid');
        if (g) g.innerHTML = '';
    }
}

function togglePlayer(id) {
    if (state.selected.has(id)) state.selected.delete(id);
    else state.selected.add(id);
    updateCompareUI();
    loadPlayers(); // перерисовать карточки (checked / рамка)
}

async function renderComparison() {
    const grid = $('#comparisonGrid');
    if (!grid || state.selected.size < 2) return;

    grid.innerHTML = Array.from({ length: state.selected.size }).map(() => `
        <div class="border border-gray-200 rounded p-6 bg-white">
            <div class="space-y-3">
                <div class="h-4 w-2/3 bg-gray-100 rounded animate-pulse"></div>
                <div class="h-3 w-1/2 bg-gray-100 rounded animate-pulse"></div>
            </div>
        </div>
    `).join('');

    try {
        const ids = Array.from(state.selected);
        const players = await Promise.all(
            ids.map(id => fetch(`${API_BASE}/players/${id}`).then(r => r.json()))
        );

        grid.innerHTML = players.map(p => {
            const birthYear = p.birth_date ? new Date(p.birth_date).getFullYear() : null;
            const age = birthYear ? new Date().getFullYear() - birthYear : '—';
            const foot = p.preferred_foot === 'left' ? 'Левая' : 'Правая';
            const gender = p.gender === 'male' ? 'Мужской' : 'Женский';

            return `
                <article class="border border-gray-200 rounded p-6 bg-white">
                    <header class="flex items-start gap-4 pb-4 border-b border-gray-100">
                        <img
                            src="${esc(p.photo_url) || 'https://via.placeholder.com/64'}"
                            alt=""
                            class="w-14 h-14 rounded object-cover bg-gray-100"
                        >
                        <div class="min-w-0">
                            <h3 class="font-bold leading-tight truncate">
                                ${esc(p.first_name)} ${esc(p.last_name)}
                            </h3>
                            <p class="text-xs text-gray-500 mt-1 truncate">
                                ${esc(p.club?.name || '— без клуба')}
                            </p>
                        </div>
                    </header>

                    <dl class="mt-4 space-y-2 text-sm">
                        <div class="flex justify-between"><dt class="text-gray-500">Возраст</dt><dd class="font-medium tnum">${age} лет</dd></div>
                        <div class="flex justify-between"><dt class="text-gray-500">Дата рождения</dt><dd class="font-medium tnum">${esc(p.birth_date || '—')}</dd></div>
                        <div class="flex justify-between"><dt class="text-gray-500">Пол</dt><dd class="font-medium">${gender}</dd></div>
                        <div class="flex justify-between"><dt class="text-gray-500">Рабочая нога</dt><dd class="font-medium">${foot}</dd></div>
                    </dl>

                    <button
                        type="button"
                        data-remove="${esc(p.id ?? p.player_id)}"
                        class="mt-5 w-full text-xs font-semibold uppercase tracking-widest text-gray-500 hover:text-red-600 border border-gray-200 hover:border-red-600 rounded py-2 transition-colors"
                    >
                        Убрать из сравнения
                    </button>
                </article>
            `;
        }).join('');

        $$('#comparisonGrid [data-remove]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = isNaN(Number(btn.dataset.remove))
                    ? btn.dataset.remove
                    : Number(btn.dataset.remove);
                state.selected.delete(id);
                updateCompareUI();
                loadPlayers();
            });
        });
    } catch (e) {
        console.error('[compare]', e);
        grid.innerHTML = `
            <div class="md:col-span-3 border border-dashed border-gray-300 rounded p-8 text-center text-gray-500">
                Не удалось загрузить сравнение
            </div>`;
    }
}

/* ============================================================
   DOWNLOAD CARD
   ============================================================ */
async function downloadCard(playerId) {
    try {
        const res = await fetch(`${API_BASE}/players/${playerId}`);
        const player = await res.json();

        const birthYear = player.birth_date ? new Date(player.birth_date).getFullYear() : null;
        const age = birthYear ? new Date().getFullYear() - birthYear : '—';

        const wrap = document.createElement('div');
        wrap.style.position = 'fixed';
        wrap.style.left = '-9999px';
        wrap.style.top = '0';
        wrap.innerHTML = `
            <div style="
                width: 560px;
                background: #fff;
                padding: 40px;
                font-family: 'SF-Pro', system-ui, sans-serif;
                color: #0b1220;
                border: 1px solid #e5e7eb;
            ">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:20px;border-bottom:1px solid #e5e7eb;">
                    <div>
                        <div style="font-size:11px;letter-spacing:.22em;text-transform:uppercase;font-weight:700;color:#d91e2b;">Уральский Футбольный Союз</div>
                        <div style="font-size:20px;font-weight:700;margin-top:8px;">Карточка игрока</div>
                    </div>
                    <div style="font-size:12px;color:#6b7280;">${new Date().toLocaleDateString('ru-RU')}</div>
                </div>

                <div style="display:flex;gap:24px;margin-top:28px;align-items:center;">
                    <img src="${esc(player.photo_url) || 'https://via.placeholder.com/120'}"
                         style="width:120px;height:120px;object-fit:cover;border-radius:4px;background:#f3f4f6;">
                    <div>
                        <div style="font-size:28px;font-weight:700;line-height:1.1;">${esc(player.first_name)} ${esc(player.last_name)}</div>
                        <div style="color:#6b7280;margin-top:6px;">${esc(player.club?.name || '—')} · ${age} лет</div>
                    </div>
                </div>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px 32px;margin-top:32px;padding-top:24px;border-top:1px solid #e5e7eb;font-size:14px;">
                    <div><div style="color:#6b7280;font-size:12px;">Дата рождения</div><div style="font-weight:600;">${esc(player.birth_date || '—')}</div></div>
                    <div><div style="color:#6b7280;font-size:12px;">Пол</div><div style="font-weight:600;">${player.gender === 'male' ? 'Мужской' : 'Женский'}</div></div>
                    <div><div style="color:#6b7280;font-size:12px;">Рабочая нога</div><div style="font-weight:600;">${player.preferred_foot === 'left' ? 'Левая' : 'Правая'}</div></div>
                    <div><div style="color:#6b7280;font-size:12px;">Клуб</div><div style="font-weight:600;">${esc(player.club?.name || '—')}</div></div>
                </div>

                <div style="margin-top:32px;padding-top:20px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;">
                    Сгенерировано автоматически · football-gto.ru
                </div>
            </div>
        `;
        document.body.appendChild(wrap);
        const node = wrap.firstElementChild;

        const canvas = await html2canvas(node, { scale: 2, backgroundColor: '#ffffff' });
        const a = document.createElement('a');
        a.download = `player_${playerId}.png`;
        a.href = canvas.toDataURL('image/png');
        a.click();
        wrap.remove();
    } catch (e) {
        console.error('[card]', e);
        alert('Не удалось создать карточку');
    }
}

/* ============================================================
   EVENTS
   ============================================================ */
function bindFilters() {
    const on = (id, evt, fn) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(evt, fn);
    };

    on('searchInput', 'input', debounce(e => {
        state.filters.search = e.target.value.trim();
        state.page = 1;
        loadPlayers();
    }, 350));

    on('clubFilter',   'change', e => { state.filters.club   = e.target.value; state.page = 1; loadPlayers(); });
    on('ageFilter',    'change', e => { state.filters.age    = e.target.value; state.page = 1; loadPlayers(); });
    on('genderFilter', 'change', e => { state.filters.gender = e.target.value; state.page = 1; loadPlayers(); });
    on('sortFilter',   'change', e => { state.filters.sort   = e.target.value; state.page = 1; loadPlayers(); });

    on('clearCompare', 'click', () => {
        state.selected.clear();
        updateCompareUI();
        loadPlayers();
    });
}

/** делегирование кликов по сетке игроков */
function bindGrid() {
    const grid = $('#playersResults');
    if (!grid) return;

    grid.addEventListener('change', e => {
        const cb = e.target.closest('input[data-compare]');
        if (!cb) return;
        const raw = cb.dataset.compare;
        const id = isNaN(Number(raw)) ? raw : Number(raw);
        togglePlayer(id);
    });

    grid.addEventListener('click', e => {
        const btn = e.target.closest('button[data-download]');
        if (!btn) return;
        const raw = btn.dataset.download;
        downloadCard(isNaN(Number(raw)) ? raw : Number(raw));
    });
}

/* ============================================================
   BOOTSTRAP
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
    if (window.AOS) AOS.init({ duration: 700, once: true });

    fetchClubs();
    loadPlayers();
    bindFilters();
    bindGrid();

    $('#menuToggle')?.addEventListener('click',
        () => $('#mobileMenu')?.classList.toggle('hidden'));
});