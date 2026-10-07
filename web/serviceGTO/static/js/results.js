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

/** Логотип грузим один раз как data URI */
const logoReady = (async () => {
    try {
        LOGO_URL = await toDataUrl(LOGO_URL_DEFAULT);
    } catch (e) {
        console.warn('[logo] fallback to url', e);
    }
})();

/** Кэш фото игроков → data URI */
const photoCache = new Map();
async function resolvePhoto(url) {
    const src = url || PLACEHOLDER_PHOTO;
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

/**
 * Градация по общему рейтингу:
 *   100–90 → gold
 *    89–80 → emerald
 *    79–0  → obsidian
 */
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

/**
 * @param {object} player
 * @param {'gold'|'emerald'|'obsidian'} [variant]
 * @param {object} [opts] — { photoUrl: dataURI }
 */
function renderRatingCard(player, variant, opts = {}) {
    const vKey = variant || pickVariantByRating(player.total_rating);
    const v = CARD_VARIANTS[vKey] || CARD_VARIANTS.obsidian;

    const rating   = Math.round(player.total_rating ?? 0);
    const club     = player.club_name || '—';
    const ageGroup = player.age ? `U-${player.age}` : '—';
    const age      = player.age ? `${player.age} лет` : '';
    const foot     = footLabel(player.preferred_foot);
    const sub      = [club, age, foot].filter(Boolean).join(' · ');

    const photo = opts.photoUrl || player.photo_url || PLACEHOLDER_PHOTO;

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
                        <img
                            src="${LOGO_URL}"
                            alt="УФС"
                            class="rating-card__logo"
                            decoding="sync"
                        >
                    </div>
                    <div class="rating-card__tags">
                        <span class="rating-card__tag">${esc(ageGroup)}</span>
                        <span class="rating-card__tag rating-card__tag--club" title="${esc(club)}">${esc(club)}</span>
                    </div>
                </header>

                <div class="rating-card__portrait">
                    <img
                        src="${esc(photo)}"
                        alt=""
                        class="rating-card__photo"
                        decoding="sync"
                    >
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
                            data-compare="${id}"
                            ${isSel ? 'checked' : ''}
                        >
                        Сравнить
                    </label>
                    <button
                        type="button"
                        data-download="${id}"
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
    const n = Number(id);
    if (state.selected.has(n)) state.selected.delete(n);
    else state.selected.add(n);
    updateCompareUI();
    loadPlayers();
}

async function renderComparison() {
    const grid = $('#comparisonGrid');
    if (!grid || state.selected.size < 2) return;

    await logoReady;

    const ids = Array.from(state.selected);

    // Скелетон
    grid.innerHTML = ids.map(() => `
        <div class="rating-card-wrap" style="opacity:.5">
            <div class="rating-card rating-card--obsidian" style="display:flex;align-items:center;justify-content:center;color:#fff;font-size:1.4em;">
                Загрузка…
            </div>
        </div>
    `).join('');

    try {
        const fullPlayers = await Promise.all(
            ids.map(id => fetch(`${API_BASE}/players/${id}`).then(r => r.ok ? r.json() : null).catch(() => null))
        );

        const merged = ids.map((id, i) => {
            const ranking = state.playerCache.get(Number(id)) || {};
            const full = fullPlayers[i] || {};
            return {
                ...ranking,
                preferred_foot: full.preferred_foot || ranking.preferred_foot,
                club_name: ranking.club_name || full.club?.name,
                photo_url: ranking.photo_url || full.photo_url,
            };
        });

        // Предзагружаем фото в data URI — тогда html2canvas не будет ломаться
        const photos = await Promise.all(merged.map(p => resolvePhoto(p.photo_url)));

        grid.innerHTML = merged.map((p, i) => `
            <div class="flex flex-col items-center gap-3">
                ${renderRatingCard(p, undefined, { photoUrl: photos[i] })}
                <button
                    type="button"
                    data-remove="${ids[i]}"
                    class="text-xs font-semibold uppercase tracking-widest text-gray-500 hover:text-red-600 border border-gray-200 hover:border-red-600 rounded px-4 py-2 transition-colors"
                >
                    Убрать из сравнения
                </button>
            </div>
        `).join('');

        $$('#comparisonGrid [data-remove]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = Number(btn.dataset.remove);
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
   DOWNLOAD CARD (PNG)
   ============================================================ */
const DOWNLOAD_WIDTH = 700;
// font-size карточки = 2.857cqw → при ширине wrap 700px базовый = 20px
const DOWNLOAD_BASE_FONT = (DOWNLOAD_WIDTH * 2.857) / 100;

async function downloadCard(player, variant) {
    await logoReady;

    const vKey = variant || pickVariantByRating(player.total_rating);
    const photoUrl = await resolvePhoto(player.photo_url);

    const host = document.createElement('div');
    host.style.cssText = `position:fixed;left:-99999px;top:0;width:${DOWNLOAD_WIDTH}px;pointer-events:none;`;
    host.innerHTML = renderRatingCard(player, vKey, { photoUrl });
    document.body.appendChild(host);

    try {
        // Ждём шрифты (с таймаутом — иначе можно зависнуть)
        if (document.fonts?.ready) {
            await Promise.race([
                document.fonts.ready,
                new Promise(r => setTimeout(r, 1500)),
            ]);
        }

        // Ждём все <img> внутри карточки
        await Promise.all(
            Array.from(host.querySelectorAll('img')).map(img =>
                img.complete ? Promise.resolve() : new Promise(r => {
                    img.addEventListener('load', r, { once: true });
                    img.addEventListener('error', r, { once: true });
                    setTimeout(r, 2500);
                })
            )
        );

        const node = host.querySelector('.rating-card');
        if (!node) throw new Error('card node not found');

        const canvas = await html2canvas(node, {
            scale: 2,
            backgroundColor: null,
            logging: false,
            useCORS: true,
            allowTaint: false,
            imageTimeout: 4000,
            removeContainer: true,
            onclone: (clonedDoc) => {
                const wrap = clonedDoc.querySelector('.rating-card-wrap');
                if (wrap) {
                    wrap.style.maxWidth = DOWNLOAD_WIDTH + 'px';
                    wrap.style.width    = DOWNLOAD_WIDTH + 'px';
                }
                const card = clonedDoc.querySelector('.rating-card');
                if (card) card.style.fontSize = DOWNLOAD_BASE_FONT + 'px';

                // Отключаем шум — сильно ускоряет рендер
                clonedDoc.querySelectorAll('.rating-card__grain').forEach(el => {
                    el.style.display = 'none';
                });
            }
        });

        const safeName = `${player.last_name || 'player'}_${player.first_name || ''}`
            .trim().replace(/\s+/g, '_').replace(/[^\w\-]+/g, '');

        const a = document.createElement('a');
        a.download = `${safeName}_${vKey}.png`;
        a.href = canvas.toDataURL('image/png');
        document.body.appendChild(a);
        a.click();
        a.remove();
    } finally {
        host.remove();
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
    });
}

function bindGrid() {
    const grid = $('#playersResults');
    if (!grid) return;

    grid.addEventListener('change', e => {
        const cb = e.target.closest('input[data-compare]');
        if (!cb) return;
        togglePlayer(Number(cb.dataset.compare));
    });

    grid.addEventListener('click', async e => {
        const btn = e.target.closest('button[data-download]');
        if (!btn) return;

        const id = Number(btn.dataset.download);
        const player = state.playerCache.get(id);
        if (!player) {
            alert('Данные игрока ещё не загружены');
            return;
        }

        const originalHTML = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = 'Готовим PNG…';

        try {
            await downloadCard(player);
        } catch (err) {
            console.error('[card]', err);
            alert('Не удалось создать карточку');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalHTML;
        }
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