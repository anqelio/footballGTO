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
    playerCache: new Map(),
};

const STAT_LABELS = ['Антропометрия', 'Атлетизм', 'Быстрота', 'Ловкость', 'Дриблинг', 'Техника', 'Удары'];
const STAT_KEYS   = ['anthropometry', 'athleticism', 'speed', 'agility', 'dribbling', 'technique', 'shots'];
const CMP_COLORS  = ['#d91e2b', '#0f2a5c', '#b8801a', '#0fa06a', '#6d28d9'];

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
   STATIC ASSETS → DATA URI (для html2canvas)
   ============================================================ */
const PLACEHOLDER_PHOTO = '/static/img/noimg.png';
const LOGO_URL_DEFAULT  = '/static/img/logo-new.svg';
let LOGO_URL = LOGO_URL_DEFAULT;

async function toDataUrl(url) {
    const res = await fetch(url, { mode: 'cors', cache: 'force-cache' });
    if (!res.ok) throw new Error(`fetch ${url} failed`);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result);
        fr.onerror = reject;
        fr.readAsDataURL(blob);
    });
}

const logoReady = (async () => {
    try {
        LOGO_URL = await toDataUrl(LOGO_URL_DEFAULT);
    } catch (e) {
        console.warn('[logo] fallback to url', e);
    }
})();

const photoCache = new Map();
async function resolvePhoto(url) {
    const src = url || PLACEHOLDER_PHOTO;
    if (src.startsWith('data:')) return src;
    if (photoCache.has(src)) return photoCache.get(src);

    const p = (async () => {
        try {
            return await toDataUrl(src);
        } catch {
            if (src !== PLACEHOLDER_PHOTO) {
                try { return await toDataUrl(PLACEHOLDER_PHOTO); }
                catch { return PLACEHOLDER_PHOTO; }
            }
            return src;
        }
    })();

    photoCache.set(src, p);
    return p;
}

/* ============================================================
   CARD VARIANTS + RENDER
   ============================================================ */
const CARD_VARIANTS = {
    gold:     { label: 'Gold',     className: 'rating-card--gold' },
    emerald:  { label: 'Emerald',  className: 'rating-card--emerald' },
    obsidian: { label: 'Obsidian', className: 'rating-card--obsidian' },
};

function pickVariantByRating(rating) {
    const r = Number(rating) || 0;
    if (r >= 90) return 'gold';
    if (r >= 80) return 'emerald';
    return 'obsidian';
}

function footLabel(foot) {
    if (foot === 'left')  return 'левая';
    if (foot === 'right') return 'правая';
    return '';
}

function renderRatingCard(player, variant, opts = {}) {
    const vKey = variant || pickVariantByRating(player.total_rating);
    const v = CARD_VARIANTS[vKey] || CARD_VARIANTS.obsidian;

    const rating   = Math.round(player.total_rating ?? 0);
    const club     = player.club_name || '—';
    const ageGroup = player.age ? `U-${player.age}` : '—';
    const age      = player.age ? `${player.age} лет` : '';
    const foot     = footLabel(player.preferred_foot);
    const sub      = [club, age, foot].filter(Boolean).join(' · ');

    const photo = opts.photoUrl || player.photo_url;

    const statRows = [
        { val: Math.round(player.athleticism ?? 0), key: 'Атлетизм' },
        { val: Math.round(player.speed ?? 0),       key: 'Быстрота' },
        { val: Math.round(player.agility ?? 0),     key: 'Ловкость' },
        { val: Math.round(player.dribbling ?? 0),   key: 'Дриблинг' },
        { val: Math.round(player.technique ?? 0),   key: 'Техника' },
        { val: Math.round(player.shots ?? 0),       key: 'Удары' },
    ];
    const anthro = Math.round(player.anthropometry ?? 0);

    const statsHTML = statRows.map(s => `
        <div class="rating-card__stat">
            <span class="rating-card__stat-val">${s.val}</span>
            <span class="rating-card__stat-key">${esc(s.key)}</span>
        </div>
    `).join('');

    return `
        <div class="rating-card-wrap">
            <article class="rating-card ${v.className}">
                <span class="rating-card__grain" aria-hidden="true"></span>
                <span class="rating-card__frame" aria-hidden="true"></span>

                <header class="rating-card__top">
                    <div class="rating-card__rating">
                        <span class="rating-card__rating-num">${rating}</span>
                        <img src="${LOGO_URL}" alt="УФС" class="rating-card__logo" decoding="sync">
                    </div>
                    <div class="rating-card__tags">
                        <span class="rating-card__tag">${esc(ageGroup)}</span>
                        <span class="rating-card__tag rating-card__tag--club" title="${esc(club)}">${esc(club)}</span>
                    </div>
                </header>

                <div class="rating-card__portrait">
                    <img src="${esc(photo)}" alt="Фото игрока ${esc(player.first_name)} ${esc(player.last_name)}" class="rating-card__photo" decoding="async">
                </div>

                <div class="rating-card__stats">
                    ${statsHTML}
                    <div class="rating-card__stat rating-card__stat--wide">
                        <span class="rating-card__stat-val">${anthro}</span>
                        <span class="rating-card__stat-key">Антропометрия</span>
                    </div>
                </div>

                <footer class="rating-card__bottom">
                    <h3 class="rating-card__name">${esc(player.first_name)} ${esc(player.last_name)}</h3>
                    <p class="rating-card__sub">${esc(sub)}</p>
                </footer>
            </article>
        </div>
    `;
}

/* ============================================================
   RADAR CHART (SVG)
   ============================================================ */
function renderRadar(players, size = 320) {
    const n = STAT_LABELS.length;
    const cx = size / 2;
    const cy = size / 2;
    const maxR = size * 0.34;
    const levels = [0.25, 0.5, 0.75, 1];

    const polar = (r, i) => {
        const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
        return [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r];
    };

    const gridPolygons = levels.map(level => {
        const pts = Array.from({ length: n }, (_, i) => polar(maxR * level, i));
        return `<polygon points="${pts.map(p => p.join(',')).join(' ')}" fill="none" stroke="#e5e7eb" stroke-width="1"/>`;
    }).join('');

    const axes = Array.from({ length: n }, (_, i) => {
        const [x, y] = polar(maxR, i);
        return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#e5e7eb" stroke-width="1"/>`;
    }).join('');

    const labelEls = STAT_LABELS.map((label, i) => {
        const [x, y] = polar(maxR + 30, i);
        const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
        const cos = Math.cos(angle);
        const anchor = Math.abs(cos) < 0.25 ? 'middle' : cos > 0 ? 'start' : 'end';
        return `<text x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="middle"
            font-family="Inter,sans-serif" font-size="10.5" font-weight="600"
            letter-spacing=".04em" fill="#6b7280">${esc(label)}</text>`;
    }).join('');

    const dataPolygons = players.map(p => {
        const pts = p.values.map((val, i) => {
            const v = Math.min(100, Math.max(0, Number(val) || 0));
            return polar((v / 100) * maxR, i);
        });
        const d = pts.map((pt, i) => (i === 0 ? 'M' : 'L') + pt[0] + ',' + pt[1]).join(' ') + ' Z';
        return `
            <path d="${d}" fill="${p.color}" fill-opacity="0.16" stroke="${p.color}" stroke-width="2" stroke-linejoin="round"/>
            ${pts.map(pt => `<circle cx="${pt[0]}" cy="${pt[1]}" r="3" fill="${p.color}"/>`).join('')}
        `;
    }).join('');

    return `<svg viewBox="0 0 ${size} ${size}" preserveAspectRatio="xMidYMid meet">${gridPolygons}${axes}${labelEls}${dataPolygons}</svg>`;
}

/* ============================================================
   STAT BARS
   ============================================================ */
function renderStatBars(values) {
    return STAT_LABELS.map((label, i) => {
        const val = Math.round(values[i] ?? 0);
        return `
            <div class="stat-row ${val >= 80 ? 'stat-row--high' : ''}">
                <div class="stat-row__head">
                    <span>${esc(label)}</span>
                    <span class="stat-row__value">${val}</span>
                </div>
                <div class="stat-row__track">
                    <div class="stat-row__fill" style="--w:${val}%"></div>
                </div>
            </div>
        `;
    }).join('');
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
   PLAYERS LIST
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
                ${Array.from({ length: 4 }).map(() => `<div class="h-3 bg-gray-100 rounded animate-pulse"></div>`).join('')}
            </div>
        </div>
    `).join('');

    const params = new URLSearchParams({
        page: state.page,
        size: state.perPage,
        sort_by: state.filters.sort,
    });
    if (state.filters.age !== 'all') params.set('age_group', state.filters.age);
    if (state.filters.club !== 'all') params.set('club_id', state.filters.club);
    if (state.filters.gender !== 'all') params.set('gender', state.filters.gender);
    if (state.filters.search) params.set('search', state.filters.search);

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

    players.forEach(p => {
        const id = p.player_id ?? p.id;
        if (id != null) state.playerCache.set(Number(id), p);
    });

    grid.innerHTML = players.map(p => {
        const id = Number(p.player_id ?? p.id);
        const isSel = state.selected.has(id);
        const tone = ratingTone(p.total_rating);

        return `
            <article class="border rounded bg-white flex flex-col transition-colors ${isSel ? 'border-gray-900 ring-1 ring-gray-900' : 'border-gray-200 hover:border-gray-400'}">
                <div class="p-5">
                    <div class="flex items-start gap-4">
                        <img
                            src="${esc(p.photo_url) || PLACEHOLDER_PHOTO}"
                            alt="Фото игрока ${esc(p.first_name)} ${esc(p.last_name)}"
                            class="w-16 h-16 rounded object-cover bg-gray-100"
                            width="64" height="64"
                            loading="lazy" decoding="async"
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
                            <div class="text-2xl font-bold tnum leading-none ${tone.cls}">${esc(p.total_rating ?? '—')}</div>
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
                        <input type="checkbox" class="w-4 h-4 accent-gray-900" data-compare="${id}" ${isSel ? 'checked' : ''}>
                        Сравнить
                    </label>
                    <button type="button" data-panel="${id}" class="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-900 hover:text-red-600">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                            <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                        </svg>
                        Профиль
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
        <button type="button" data-page="${p}" ${disabled ? 'disabled' : ''}
            class="min-w-[36px] h-9 px-3 border rounded text-sm font-medium tnum transition-colors
                ${active ? 'bg-gray-900 text-white border-gray-900'
                        : disabled ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                        : 'border-gray-200 text-gray-700 hover:border-gray-900 hover:text-gray-900'}">
            ${label}
        </button>`;

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
   COMPARISON STATE (checkbox только добавляет/убирает)
   ============================================================ */
function updateCompareUI() {
    const notice  = $('#compareNotice');
    const countEl = $('#compareCount');
    const openBtn = $('#openCompare');

    const n = state.selected.size;
    if (countEl) countEl.textContent = n;

    if (n >= 1 && notice) notice.classList.remove('hidden');
    else notice?.classList.add('hidden');

    if (openBtn) {
        if (n >= 2) {
            openBtn.classList.remove('hidden');
            openBtn.textContent = `Сравнить (${n})`;
        } else {
            openBtn.classList.add('hidden');
        }
    }
}

function togglePlayer(id) {
    const n = Number(id);
    if (state.selected.has(n)) state.selected.delete(n);
    else state.selected.add(n);
    updateCompareUI();
    loadPlayers();
}

/* ============================================================
   PLAYER PANEL — open / close / render
   ============================================================ */
let panelOpenId = null;

async function openPlayerPanel(id) {
    const player = state.playerCache.get(Number(id));
    if (!player) return;

    const panel = $('#playerPanel');
    const content = $('#panelContent');

    panelOpenId = Number(id);
    content.innerHTML = `<div class="panel-loading">Загрузка профиля…</div>`;
    panel.classList.remove('hidden');
    panel.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    try {
        const [full, photo] = await Promise.all([
            fetch(`${API_BASE}/players/${id}`).then(r => r.ok ? r.json() : {}).catch(() => ({})),
            resolvePhoto(player.photo_url),
        ]);

        const merged = {
            ...player,
            ...full,
            club_name: player.club_name || full.club?.name,
            photo_url: photo,
        };

        const values = STAT_KEYS.map(k => Math.round(merged[k] ?? 0));

        content.innerHTML = `
            <div class="player-panel">
                <div class="player-panel__left">
                    ${renderRatingCard(merged)}
                    <div class="player-panel__actions">
                        <button type="button" class="btn-panel" data-share>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                            </svg>
                            Поделиться
                        </button>
                        <button type="button" class="btn-panel" data-print>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="6 9 6 2 18 2 18 9"/>
                                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                                <rect x="6" y="14" width="12" height="8"/>
                            </svg>
                            Печать
                        </button>
                        <button type="button" class="btn-panel btn-panel--primary" data-dl>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                <polyline points="7 10 12 15 17 10"/>
                                <line x1="12" y1="15" x2="12" y2="3"/>
                            </svg>
                            Скачать PNG
                        </button>
                    </div>
                </div>

                <div class="player-panel__right">
                    <div class="player-panel__head">
                        <div class="eyebrow">Профиль игрока</div>
                        <h2>${esc(merged.first_name)} ${esc(merged.last_name)}</h2>
                        <p>
                            ${esc(merged.club_name || '— без клуба')}
                            ${merged.age ? ` · ${esc(merged.age)} лет` : ''}
                            ${merged.preferred_foot ? ` · ${esc(footLabel(merged.preferred_foot))} нога` : ''}
                        </p>
                    </div>

                    <div class="player-panel__radar">
                        ${renderRadar([{ values, color: '#d91e2b' }], 320)}
                    </div>

                    <div class="player-panel__bars">
                        ${renderStatBars(values)}
                    </div>
                </div>
            </div>
        `;

        bindPanelActions(merged);

        requestAnimationFrame(() => requestAnimationFrame(() => {
            content.classList.add('is-ready');
        }));
    } catch (e) {
        console.error('[panel]', e);
        content.innerHTML = `<div class="panel-loading">Не удалось загрузить профиль</div>`;
    }
}

function closePlayerPanel() {
    const panel = $('#playerPanel');
    const content = $('#panelContent');
    panel?.classList.add('hidden');
    panel?.setAttribute('aria-hidden', 'true');
    content?.classList.remove('is-ready');
    panelOpenId = null;
    document.body.style.overflow = '';
}

function bindPanelActions(player) {
    const content = $('#panelContent');
    if (!content) return;

    content.querySelector('[data-share]')?.addEventListener('click', () => shareCard(player));

    content.querySelector('[data-print]')?.addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        const idle = btn.innerHTML;
        btn.disabled = true; btn.innerHTML = 'Готовим…';
        try { await printCard(player); }
        catch (err) { console.error('[print]', err); alert('Не удалось подготовить печать'); }
        finally { btn.disabled = false; btn.innerHTML = idle; }
    });

    content.querySelector('[data-dl]')?.addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        const idle = btn.innerHTML;
        btn.disabled = true; btn.innerHTML = 'Готовим PNG…';
        try { await downloadCard(player); }
        catch (err) { console.error('[dl]', err); alert('Не удалось создать карточку'); }
        finally { btn.disabled = false; btn.innerHTML = idle; }
    });
}

/* ============================================================
   COMPARE MODAL
   ============================================================ */
async function openCompareModal() {
    if (state.selected.size < 2) return;

    const modal = $('#compareModal');
    const content = $('#compareContent');

    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    content.innerHTML = `<div class="panel-loading">Загрузка сравнения…</div>`;

    await logoReady;

    const ids = Array.from(state.selected);

    const fullData = await Promise.all(ids.map(async (id) => {
        const ranking = state.playerCache.get(id) || {};
        const full = await fetch(`${API_BASE}/players/${id}`)
            .then(r => r.ok ? r.json() : {}).catch(() => ({}));
        const merged = {
            ...ranking,
            ...full,
            club_name: ranking.club_name || full.club?.name,
            photo_url: ranking.photo_url || full.photo_url,
        };
        merged._photoData = await resolvePhoto(merged.photo_url);
        return merged;
    }));

    const valuesByPlayer = fullData.map(p => STAT_KEYS.map(k => Math.round(p[k] ?? 0)));

    // Radar
    const radar = renderRadar(
        fullData.map((p, i) => ({
            values: valuesByPlayer[i],
            color: CMP_COLORS[i % CMP_COLORS.length],
        })),
        340
    );

    // Legend
    const legend = fullData.map((p, i) => `
        <div class="compare-legend__item" style="--c:${CMP_COLORS[i % CMP_COLORS.length]}">
            <span class="compare-legend__dot" style="background:${CMP_COLORS[i % CMP_COLORS.length]}"></span>
            <span>${esc(p.first_name)} ${esc(p.last_name)}</span>
            <span class="compare-legend__rating">${Math.round(p.total_rating ?? 0)}</span>
        </div>
    `).join('');

    // Cards
    const cardsHTML = fullData.map((p, i) => `
        <div class="rating-card-wrap">
            ${renderRatingCard(p, undefined, { photoUrl: p._photoData })}
        </div>
    `).join('');

    // Stat rows — сгруппированы по показателям
    const statGroups = STAT_LABELS.map((label, si) => {
        const rows = fullData.map((p, i) => {
            const val = valuesByPlayer[i][si];
            return `
                <div class="cmp-row">
                    <span class="cmp-row__name" title="${esc(p.first_name)} ${esc(p.last_name)}">
                        ${esc(p.first_name)}
                    </span>
                    <div class="cmp-row__track">
                        <div class="cmp-row__fill" style="--w:${val}%; --c:${CMP_COLORS[i % CMP_COLORS.length]}"></div>
                    </div>
                    <span class="cmp-row__value">${val}</span>
                </div>
            `;
        }).join('');
        return `
            <div class="cmp-stat">
                <h4 class="cmp-stat__title">${esc(label)}</h4>
                <div class="cmp-stat__rows">${rows}</div>
            </div>
        `;
    }).join('');

    content.innerHTML = `
        <header class="compare-header">
            <h2>Сравнение игроков</h2>
            <p>${fullData.length} ${pluralizePlayers(fullData.length)}</p>
        </header>

        <div class="compare-radar">
            <div class="compare-radar__chart">${radar}</div>
            <div class="compare-legend">${legend}</div>
        </div>

        <div class="compare-cards">${cardsHTML}</div>

        <div class="compare-stats">${statGroups}</div>
    `;

    requestAnimationFrame(() => requestAnimationFrame(() => {
        content.classList.add('is-ready');
    }));
}

function pluralizePlayers(n) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 'игрок';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'игрока';
    return 'игроков';
}

function closeCompareModal() {
    const modal = $('#compareModal');
    const content = $('#compareContent');
    modal?.classList.add('hidden');
    modal?.setAttribute('aria-hidden', 'true');
    content?.classList.remove('is-ready');
    document.body.style.overflow = '';
}

/* ============================================================
   CARD EXPORT — CANVAS GENERATOR
   ============================================================ */
const DOWNLOAD_WIDTH  = 700;
const DOWNLOAD_HEIGHT = Math.round(DOWNLOAD_WIDTH * 1.4);
const DOWNLOAD_BASE_FONT = (DOWNLOAD_WIDTH * 2.857) / 100;

async function generateCardCanvas(player, variant) {
    await logoReady;

    const vKey = variant || pickVariantByRating(player.total_rating);
    const photoUrl = await resolvePhoto(player.photo_url);
    const exportUid = `rating-export-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const host = document.createElement('div');
    host.setAttribute('data-export-uid', exportUid);
    host.style.cssText = `position:fixed;left:-99999px;top:0;width:${DOWNLOAD_WIDTH}px;pointer-events:none;`;
    host.innerHTML = renderRatingCard(player, vKey, { photoUrl });

    const wrapEl = host.querySelector('.rating-card-wrap');
    const cardEl = host.querySelector('.rating-card');

    if (wrapEl) {
        wrapEl.style.width    = DOWNLOAD_WIDTH  + 'px';
        wrapEl.style.maxWidth = DOWNLOAD_WIDTH  + 'px';
        wrapEl.style.height   = DOWNLOAD_HEIGHT + 'px';
        wrapEl.style.position = 'relative';
    }
    if (cardEl) {
        cardEl.style.setProperty('font-size', DOWNLOAD_BASE_FONT + 'px', 'important');
    }

    document.body.appendChild(host);

    try {
        if (document.fonts?.ready) {
            await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1500))]);
        }

        await Promise.all(
            Array.from(host.querySelectorAll('img')).map(img =>
                img.complete ? Promise.resolve() : new Promise(r => {
                    img.addEventListener('load', r, { once: true });
                    img.addEventListener('error', r, { once: true });
                    setTimeout(r, 2500);
                })
            )
        );

        if (!cardEl) throw new Error('card node not found');

        return await html2canvas(cardEl, {
            scale: 2,
            backgroundColor: null,
            logging: false,
            useCORS: true,
            allowTaint: false,
            imageTimeout: 4000,
            removeContainer: true,
            onclone: (clonedDoc) => {
                const clonedHost = clonedDoc.querySelector(`[data-export-uid="${exportUid}"]`);
                if (!clonedHost) return;
                const cw = clonedHost.querySelector('.rating-card-wrap');
                const cc = clonedHost.querySelector('.rating-card');
                if (cw) {
                    cw.style.width    = DOWNLOAD_WIDTH  + 'px';
                    cw.style.maxWidth = DOWNLOAD_WIDTH  + 'px';
                    cw.style.height   = DOWNLOAD_HEIGHT + 'px';
                    cw.style.position = 'relative';
                }
                if (cc) cc.style.setProperty('font-size', DOWNLOAD_BASE_FONT + 'px', 'important');
                clonedHost.querySelectorAll('.rating-card__grain').forEach(el => { el.style.display = 'none'; });
            }
        });
    } finally {
        host.remove();
    }
}

async function downloadCard(player, variant) {
    const canvas = await generateCardCanvas(player, variant);
    const vKey = variant || pickVariantByRating(player.total_rating);
    const safeName = `${player.last_name || 'player'}_${player.first_name || ''}`
        .trim().replace(/\s+/g, '_').replace(/[^\w\-]+/g, '');

    const a = document.createElement('a');
    a.download = `${safeName}_${vKey}.png`;
    a.href = canvas.toDataURL('image/png');
    document.body.appendChild(a);
    a.click();
    a.remove();
}

async function printCard(player) {
    const canvas = await generateCardCanvas(player);
    const dataUrl = canvas.toDataURL('image/png');
    const win = window.open('', '_blank');
    if (!win) { alert('Разрешите всплывающие окна для печати'); return; }
    win.document.write(`
        <!DOCTYPE html><html><head>
        <title>Печать — ${esc(player.first_name)} ${esc(player.last_name)}</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f5f5f5; padding: 20px; }
            img { max-width: 100%; max-height: calc(100vh - 40px); display: block; }
            @media print {
                body { background: #fff; padding: 0; }
                img { max-height: 100vh; }
            }
        </style></head>
        <body><img src="${dataUrl}" onload="setTimeout(() => { window.print(); }, 200);"></body>
        </html>
    `);
    win.document.close();
}

async function shareCard(player) {
    try {
        const canvas = await generateCardCanvas(player);
        const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
        if (!blob) throw new Error('no blob');
        const safeName = `${player.last_name || 'player'}-${player.first_name || ''}`
            .trim().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '');
        const file = new File([blob], `${safeName}.png`, { type: 'image/png' });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                files: [file],
                title: `${player.first_name} ${player.last_name} — Футбольное ГТО`,
                text: `Профиль игрока: ${player.first_name} ${player.last_name}`,
            });
        } else {
            await navigator.clipboard.writeText(window.location.href);
            alert('Ссылка на результаты скопирована в буфер обмена');
        }
    } catch (e) {
        if (e.name === 'AbortError') return;
        console.error('[share]', e);
        try {
            await navigator.clipboard.writeText(window.location.href);
            alert('Ссылка скопирована');
        } catch {
            alert('Не удалось поделиться');
        }
    }
}

/* ============================================================
   FILTERS + GRID EVENTS
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
        closeCompareModal();
    });

    on('openCompare', 'click', openCompareModal);
}

function bindGrid() {
    const grid = $('#playersResults');
    if (!grid) return;

    grid.addEventListener('change', e => {
        const cb = e.target.closest('input[data-compare]');
        if (!cb) return;
        togglePlayer(Number(cb.dataset.compare));
    });

    grid.addEventListener('click', e => {
        const btn = e.target.closest('button[data-panel]');
        if (!btn) return;
        openPlayerPanel(Number(btn.dataset.panel));
    });
}

/* ============================================================
   GLOBAL CLOSE HANDLERS
   ============================================================ */
function bindModalClosers() {
    document.addEventListener('click', e => {
        if (e.target.closest('[data-close-panel]')) closePlayerPanel();
        if (e.target.closest('[data-close-compare]')) closeCompareModal();
    });

    document.addEventListener('keydown', e => {
        if (e.key !== 'Escape') return;
        const panel = $('#playerPanel');
        const compare = $('#compareModal');
        if (panel && !panel.classList.contains('hidden')) closePlayerPanel();
        else if (compare && !compare.classList.contains('hidden')) closeCompareModal();
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
    bindModalClosers();

    $('#menuToggle')?.addEventListener('click',
        () => $('#mobileMenu')?.classList.toggle('hidden'));
});