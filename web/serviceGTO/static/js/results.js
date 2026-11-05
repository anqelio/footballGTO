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
const CMP_COLORS  = ['#d91e2b', '#0f2a5c', '#b8801a', '#0fa06a', '#6d28d9', '#0891b2', '#db2777'];

const SECTION_RU = {
    anthropometry: 'Антропометрия',
    athleticism:   'Атлетизм',
    speed:         'Быстрота',
    agility:       'Ловкость',
    dribbling:     'Дриблинг',
    technique:     'Техника',
    shots:         'Удары',
};
const RU_TO_KEY = Object.fromEntries(Object.entries(SECTION_RU).map(([k, v]) => [v, k]));

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
   STATIC ASSETS → DATA URI
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
    try { LOGO_URL = await toDataUrl(LOGO_URL_DEFAULT); }
    catch (e) { console.warn('[logo] fallback to url', e); }
})();

const photoCache = new Map();
async function resolvePhoto(url) {
    const src = url || PLACEHOLDER_PHOTO;
    if (src.startsWith('data:')) return src;
    if (photoCache.has(src)) return photoCache.get(src);

    const p = (async () => {
        try { return await toDataUrl(src); }
        catch {
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
    const photo    = opts.photoUrl || player.photo_url;

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
   RADAR CHART — single player (panel)
   ============================================================ */
function renderRadar(players, size = 320) {
    const n = STAT_LABELS.length;
    const cx = size / 2, cy = size / 2, maxR = size * 0.34;
    const levels = [0.25, 0.5, 0.75, 1];
    const polar = (r, i) => {
        const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
        return [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r];
    };
    const gridPolygons = levels.map(l => {
        const pts = Array.from({ length: n }, (_, i) => polar(maxR * l, i));
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
   RADAR CHART — сравнение (с hover-подсказками)
   ============================================================ */
function renderCompareRadar(players, size = 460) {
    const n = STAT_LABELS.length;
    const cx = size / 2, cy = size / 2, maxR = size * 0.32;
    const levels = [0.25, 0.5, 0.75, 1];

    const polar = (r, i) => {
        const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
        return [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r];
    };

    const gridPolygons = levels.map(l => {
        const pts = Array.from({ length: n }, (_, i) => polar(maxR * l, i));
        return `<polygon points="${pts.map(p => p.join(',')).join(' ')}" fill="none" stroke="#e5e7eb" stroke-width="1"/>`;
    }).join('');

    const axes = Array.from({ length: n }, (_, i) => {
        const [x, y] = polar(maxR, i);
        return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#e5e7eb" stroke-width="1"/>`;
    }).join('');

    const labelEls = STAT_LABELS.map((label, i) => {
        const [x, y] = polar(maxR + 34, i);
        const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
        const cos = Math.cos(angle);
        const anchor = Math.abs(cos) < 0.25 ? 'middle' : cos > 0 ? 'start' : 'end';
        return `<text x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="middle"
            font-family="Inter,sans-serif" font-size="11.5" font-weight="600"
            letter-spacing=".03em" fill="#4b5563">${esc(label)}</text>`;
    }).join('');

    const dataLayers = players.map(p => {
        const pts = p.values.map((val, i) => {
            const v = Math.min(100, Math.max(0, Number(val) || 0));
            return polar((v / 100) * maxR, i);
        });
        const d = pts.map((pt, i) => (i === 0 ? 'M' : 'L') + pt[0] + ',' + pt[1]).join(' ') + ' Z';
        const dots = pts.map((pt, i) => {
            const val = Math.round(p.values[i] ?? 0);
            return `<circle cx="${pt[0]}" cy="${pt[1]}" r="4.5"
                fill="${p.color}" stroke="#fff" stroke-width="1.5"
                data-radar-dot
                data-player-name="${esc(p.name)}"
                data-stat-name="${esc(STAT_LABELS[i])}"
                data-stat-value="${val}"
                data-color="${p.color}"
                style="color:${p.color}"/>`;
        }).join('');
        return `
            <path d="${d}" fill="${p.color}" fill-opacity="0.12"
                  stroke="${p.color}" stroke-width="2" stroke-linejoin="round"/>
            ${dots}
        `;
    }).join('');

    return `<svg viewBox="0 0 ${size} ${size}" preserveAspectRatio="xMidYMid meet">
        ${gridPolygons}${axes}${labelEls}${dataLayers}
    </svg>`;
}

/* ============================================================
   RADAR TOOLTIPS
   ============================================================ */
function getRadarTooltip() {
    let t = document.getElementById('radarTooltip');
    if (!t) {
        t = document.createElement('div');
        t.id = 'radarTooltip';
        document.body.appendChild(t);
    }
    return t;
}

function bindRadarTooltips() {
    const wrap = document.getElementById('cmpRadarWrap');
    if (!wrap) return;
    const tooltip = getRadarTooltip();

    const place = (e, refEl) => {
        const rect = refEl.getBoundingClientRect();
        let left = e.clientX;
        let top  = e.clientY - rect.height - 10;
        if (top < 8) top = e.clientY + 18;
        if (left < 90) left = 90;
        if (left > window.innerWidth - 90) left = window.innerWidth - 90;
        tooltip.style.left = left + 'px';
        tooltip.style.top  = top  + 'px';
    };

    wrap.querySelectorAll('[data-radar-dot]').forEach(dot => {
        dot.addEventListener('mouseenter', e => {
            const name  = dot.getAttribute('data-player-name');
            const stat  = dot.getAttribute('data-stat-name');
            const value = dot.getAttribute('data-stat-value');
            const color = dot.getAttribute('data-color');
            tooltip.innerHTML =
                `<span class="tt-dot" style="background:${color}"></span>` +
                `<span class="tt-name">${esc(name)}</span>` +
                `<span class="tt-sep">·</span>` +
                `${esc(stat)}: <b>${esc(value)}</b>`;
            tooltip.classList.add('is-visible');
            place(e, tooltip);
        });
        dot.addEventListener('mousemove', e => place(e, tooltip));
        dot.addEventListener('mouseleave', () => {
            tooltip.classList.remove('is-visible');
        });
    });
}

/* ============================================================
   STAT BARS (player panel)
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
                    <div class="stat-row__fill" style="--w:${val}%; --i:${i}"></div>
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
    } catch (e) { console.error('[clubs]', e); }
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
            <div class="mt-5 space-y-3">
                ${Array.from({ length: 5 }).map(() => `<div class="h-2 bg-gray-100 rounded animate-pulse"></div>`).join('')}
            </div>
        </div>
    `).join('');

    const params = new URLSearchParams({
        page: state.page,
        size: state.perPage,
        sort_by: state.filters.sort,
    });
    if (state.filters.age !== 'all')    params.set('age_group', state.filters.age);
    if (state.filters.club !== 'all')   params.set('club_id', state.filters.club);
    if (state.filters.gender !== 'all') params.set('gender', state.filters.gender);
    if (state.filters.search)           params.set('search', state.filters.search);

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

    const currentYear = new Date().getFullYear();

    grid.innerHTML = players.map(p => {
        const id = Number(p.player_id ?? p.id);
        const isSel = state.selected.has(id);

        const rating    = Math.round(Number(p.total_rating) || 0);
        const ageGroup  = p.age ? `U${p.age}` : '—';
        const birthYear = p.age ? currentYear - p.age : '—';
        const team      = p.club_name || 'Без команды';

        const skills = [
            { abbr: 'PHY', value: Math.round(Number(p.athleticism) || 0) },
            { abbr: 'PAC', value: Math.round(Number(p.speed)       || 0) },
            { abbr: 'AGI', value: Math.round(Number(p.agility)     || 0) },
            { abbr: 'DRI', value: Math.round(Number(p.dribbling)   || 0) },
            { abbr: 'SHO', value: Math.round(Number(p.shots)       || 0) },
        ];

        const statsHTML = skills.map((s, i) => `
            <div class="pmc__stat">
                <div class="pmc__stat-label">${s.abbr}</div>
                <div class="pmc__stat-bar">
                    <div class="pmc__stat-fill" style="--w:${s.value}%; --i:${i}"></div>
                </div>
                <div class="pmc__stat-value">${s.value}</div>
            </div>
        `).join('');

        const photo = p.photo_url || PLACEHOLDER_PHOTO;

        return `
            <article class="pmc ${isSel ? 'is-selected' : ''}">
                <div class="pmc__top">
                    <div class="pmc__badges">
                        <div class="pmc__badges-row">
                            <span class="pmc__rating">${rating}</span>
                            <span class="pmc__age">${esc(ageGroup)}</span>
                        </div>
                        <div class="pmc__badges-row">
                            <span class="pmc__year">${birthYear}</span>
                        </div>
                    </div>
                    <div class="pmc__actions">
                        <button type="button"
                                class="pmc__icon-btn ${isSel ? 'is-active' : ''}"
                                data-compare="${id}"
                                aria-label="Сравнить"
                                aria-pressed="${isSel}">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                 stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="3" y="3" width="13" height="13" rx="2"/>
                                <rect x="8" y="8" width="13" height="13" rx="2"/>
                            </svg>
                        </button>
                        <button type="button"
                                class="pmc__icon-btn"
                                data-panel="${id}"
                                aria-label="Открыть профиль">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                 stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                                <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="pmc__main">
                    <div class="pmc__photo">
                        <img src="${esc(photo)}"
                            alt="Фото игрока ${esc(p.first_name)} ${esc(p.last_name)}"
                            width="64" height="64"
                            loading="lazy" decoding="async">
                    </div>
                    <div class="pmc__info">
                        <div class="pmc__name">${esc(p.first_name)} ${esc(p.last_name)}</div>
                        <div class="pmc__team" title="${esc(team)}">${esc(team)}</div>
                    </div>
                </div>
                <div class="pmc__stats">${statsHTML}</div>
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
   COMPARISON STATE
   ============================================================ */
function updateCompareUI() {
    const notice  = $('#compareNotice');
    const countEl = $('#compareCount');
    const openBtn = $('#openCompare');
    const n = state.selected.size;

    if (countEl) countEl.textContent = n;

    if (notice) {
        if (n >= 1) notice.classList.remove('hidden');
        else notice.classList.add('hidden');

        // Делаем уведомление кликабельным только при 2+ игроках
        if (n >= 2) notice.classList.add('is-clickable');
        else notice.classList.remove('is-clickable');
    }

    if (openBtn) {
        if (n >= 2) {
            openBtn.classList.remove('hidden');
            openBtn.textContent = `Сравнить (${n})`;
        } else {
            openBtn.classList.add('hidden');
        }
    }
}

function togglePlayer(id, btnEl) {
    const n = Number(id);
    if (state.selected.has(n)) state.selected.delete(n);
    else state.selected.add(n);
    updateCompareUI();

    if (btnEl) {
        const isSel = state.selected.has(n);
        btnEl.classList.toggle('is-active', isSel);
        btnEl.setAttribute('aria-pressed', isSel ? 'true' : 'false');
        btnEl.closest('.pmc')?.classList.toggle('is-selected', isSel);
    }
}

/* ============================================================
   PLAYER PANEL
   ============================================================ */
async function openPlayerPanel(id) {
    const player = state.playerCache.get(Number(id));
    if (!player) return;

    const panel = $('#playerPanel');
    const content = $('#panelContent');

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
            ...player, ...full,
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
    if (content) content.innerHTML = '';
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
   TEST RESULTS FETCH
   ============================================================ */
async function fetchPlayerTestResults(playerId, detail = null) {
    // 1. Данные могут прийти прямо в деталях игрока
    if (detail?.results?.length)      return detail.results;
    if (detail?.test_results?.length) return detail.test_results;
    if (detail?.tests?.length)        return detail.tests;
    if (detail?.protocols?.length)    return detail.protocols;
    if (detail?.scores?.length)       return detail.scores;

    // 2. Пробуем отдельные эндпоинты
    const endpoints = [
        `${API_BASE}/players/${playerId}/results`,
        `${API_BASE}/players/${playerId}/tests`,
        `${API_BASE}/players/${playerId}/protocols`,
        `${API_BASE}/results/?player_id=${playerId}&size=100`,
        `${API_BASE}/test-results/?player_id=${playerId}&size=100`,
        `${API_BASE}/protocols/?player_id=${playerId}&size=100`,
    ];
    for (const url of endpoints) {
        try {
            const res = await fetch(url);
            if (!res.ok) continue;
            const data = await res.json();
            const items =
                data.items ||
                data.results ||
                data.tests ||
                data.protocols ||
                data.scores ||
                (Array.isArray(data) ? data : []);
            if (Array.isArray(items) && items.length) return items;
        } catch { /* ignore */ }
    }
    return [];
}

/* Нормализация ключа секции */
function normalizeSectionKey(raw) {
    if (!raw) return null;
    const s = String(raw).trim().toLowerCase();

    if (STAT_KEYS.includes(s)) return s;

    // Точное совпадение с русским названием
    for (const [key, ru] of Object.entries(SECTION_RU)) {
        if (ru.toLowerCase() === s) return key;
    }
    // Частичное совпадение (в т.ч. "speed_test", "section_speed")
    for (const [key, ru] of Object.entries(SECTION_RU)) {
        if (s.includes(ru.toLowerCase()) || s.includes(key)) return key;
    }
    return null;
}

/* Определение секции по имени теста (fallback) */
function guessSectionFromTestName(name) {
    const s = String(name || '').toLowerCase();
    if (!s) return null;
    if (/антропометр|рост|вес|длина|масса|anthropometr|height|weight/i.test(s)) return 'anthropometry';
    if (/атлети|athletic|физподготов|сила|прыжок в длину|strength/i.test(s))   return 'athleticism';
    if (/быстр|speed|бег|спринт|sprint|30\s*м|15\s*м/i.test(s))                return 'speed';
    if (/ловк|agility|координац|слалом|челночн/i.test(s))                        return 'agility';
    if (/дрибл|dribbl|ведение|обводк/i.test(s))                                  return 'dribbling';
    if (/техник|technique|пас|pass|жонгл|набив/i.test(s))                        return 'technique';
    if (/удар|shot|бросок|гол|точность/i.test(s))                                return 'shots';
    return null;
}

/* Группировка результатов по секции */
function groupResultsBySection(results) {
    const map = {};
    for (const r of results) {
        const rawSection =
            r.section ||
            r.test_section ||
            r.test?.section ||
            r.category ||
            r.group ||
            r.section_key ||
            r.test?.category ||
            null;

        let key = normalizeSectionKey(rawSection);

        // Если секция не определена — пробуем по имени теста
        if (!key) {
            const nameHint =
                r.test_name ||
                r.test?.name ||
                r.name ||
                r.test_code ||
                '';
            key = guessSectionFromTestName(nameHint);
        }

        if (!key) continue;
        if (!map[key]) map[key] = [];
        map[key].push(r);
    }
    return map;
}

function extractTestName(r) {
    return r.test_name || r.test?.name || r.name || r.test_code || 'Тест';
}
function extractTestValue(r) {
    const v = r.value ?? r.result ?? r.raw_value ?? r.raw ?? r.measure;
    if (v == null) return '—';
    const n = Number(v);
    if (Number.isNaN(n)) return String(v);
    return n % 1 === 0 ? String(n) : n.toFixed(1);
}
function extractTestUnit(r) {
    return r.unit || r.test?.unit || r.unit_name || '';
}
function extractTestScore(r) {
    const s = r.score ?? r.points ?? r.rating ?? r.normalized;
    if (s == null) return null;
    const n = Number(s);
    if (Number.isNaN(n) || n < 0 || n > 100) return null;
    return n;
}

/* ============================================================
   COMPARE MODAL — cards + radar + progress bars
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

    let fullData;
    try {
        fullData = await Promise.all(ids.map(async (id, idx) => {
            const ranking = state.playerCache.get(id) || {};
            const detail = await fetch(`${API_BASE}/players/${id}`)
                .then(r => r.ok ? r.json() : {}).catch(() => ({}));

            const [results, photoData] = await Promise.all([
                fetchPlayerTestResults(id, detail),
                resolvePhoto(ranking.photo_url || detail.photo_url),
            ]);

            const merged = {
                ...ranking, ...detail,
                club_name: ranking.club_name || detail.club?.name,
                photo_url: photoData,
                _results: results,
                _color:   CMP_COLORS[idx % CMP_COLORS.length],
            };
            merged._grouped = groupResultsBySection(results);
            return merged;
        }));
    } catch (e) {
        console.error('[compare]', e);
        content.innerHTML = `<div class="panel-loading">Не удалось загрузить сравнение</div>`;
        return;
    }

    /* ===== 1. Карточки ===== */
    const cardsHTML = fullData.map(p => `
        <div class="rating-card-wrap">
            ${renderRatingCard(p, undefined, { photoUrl: p.photo_url })}
        </div>
    `).join('');

    /* ===== 2. Радар-диаграмма (общая) ===== */
    const radarPlayers = fullData.map(p => ({
        name:   `${p.first_name} ${p.last_name}`,
        color:  p._color,
        values: STAT_KEYS.map(k => Math.round(p[k] ?? 0)),
    }));

    const legendHTML = fullData.map(p => `
        <div class="cmp-legend__item">
            <span class="cmp-legend__dot" style="background:${p._color}"></span>
            <span>${esc(p.first_name)} ${esc(p.last_name)}</span>
            <span class="cmp-legend__score">${Math.round(p.total_rating ?? 0)}</span>
        </div>
    `).join('');

    /* ===== 3. Блоки по показателям (progress-bars + тесты) ===== */
    const blocksHTML = STAT_KEYS.map((key) => {
        const label = SECTION_RU[key];

        const rowsHTML = fullData.map((p, i) => {
            const val = Math.round(p[key] ?? 0);
            return `
                <div class="cmp-row">
                    <span class="cmp-row__name" title="${esc(p.first_name)} ${esc(p.last_name)}">
                        ${esc(p.first_name)} ${esc(p.last_name)}
                    </span>
                    <div class="cmp-row__track">
                        <div class="cmp-row__fill" style="--w:${val}%; --c:${p._color}; --i:${i}"></div>
                    </div>
                    <span class="cmp-row__value">${val}</span>
                </div>
            `;
        }).join('');

        // Детализация тестов по игрокам
        const detailsHTML = fullData.map(p => {
            const list = p._grouped[key] || [];
            const testsHTML = list.length
                ? list.map(r => {
                    const name  = extractTestName(r);
                    const value = extractTestValue(r);
                    const unit  = extractTestUnit(r);
                    const score = extractTestScore(r);
                    const valueText = `${value}${unit ? ' ' + unit : ''}`;
                    if (score != null) {
                        return `
                            <div class="cmp-details-test">
                                <span class="cmp-details-test__name">${esc(name)}</span>
                                <div class="cmp-details-test__bar">
                                    <div class="cmp-details-test__fill" style="--w:${score}%; --c:${p._color}"></div>
                                </div>
                                <span class="cmp-details-test__value">${esc(valueText)}</span>
                            </div>
                        `;
                    }
                    return `
                        <div class="cmp-details-test">
                            <span class="cmp-details-test__name">${esc(name)}</span>
                            <span></span>
                            <span class="cmp-details-test__value">${esc(valueText)}</span>
                        </div>
                    `;
                }).join('')
                : `<div class="cmp-details-test cmp-details-test--empty">Нет данных по тестам</div>`;

            return `
                <div class="cmp-details-player">
                    <div class="cmp-details-player__head">
                        <span class="cmp-details-player__dot" style="background:${p._color}"></span>
                        <span>${esc(p.first_name)} ${esc(p.last_name)}</span>
                    </div>
                    <div class="cmp-details-player__tests">${testsHTML}</div>
                </div>
            `;
        }).join('');

        return `
            <div class="cmp-block" data-section="${key}">
                <button type="button" class="cmp-block__header" aria-expanded="false">
                    <span class="cmp-block__title">${esc(label)}</span>
                    <svg class="cmp-block__chevron" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6"/>
                    </svg>
                </button>
                <div class="cmp-block__rows">${rowsHTML}</div>
                <div class="cmp-block__details" hidden>${detailsHTML}</div>
            </div>
        `;
    }).join('');

    const n = fullData.length;
    content.innerHTML = `
        <header class="compare-header">
            <h2>Сравнение игроков</h2>
            <p>${n} ${pluralizePlayers(n)} · наведите на точку диаграммы или раскройте показатель ниже</p>
        </header>

        <section class="compare-cards">${cardsHTML}</section>

        <section class="cmp-radar-wrap" id="cmpRadarWrap">
            <div class="cmp-radar">
                ${renderCompareRadar(radarPlayers, 460)}
            </div>
            <div class="cmp-legend">${legendHTML}</div>
        </section>

        <section class="compare-indicators">${blocksHTML}</section>
    `;

    bindCompareBlocks();
    bindRadarTooltips();
}

function pluralizePlayers(n) {
    const mod10 = n % 10, mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 'игрок';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'игрока';
    return 'игроков';
}

function bindCompareBlocks() {
    $$('#compareContent .cmp-block').forEach(block => {
        const header  = block.querySelector('.cmp-block__header');
        const details = block.querySelector('.cmp-block__details');
        if (!header || !details) return;

        header.addEventListener('click', () => {
            const willOpen = !block.classList.contains('is-open');
            block.classList.toggle('is-open', willOpen);
            header.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
            if (willOpen) details.removeAttribute('hidden');
            else details.setAttribute('hidden', '');
        });
    });
}

function closeCompareModal() {
    const modal = $('#compareModal');
    const content = $('#compareContent');
    modal?.classList.add('hidden');
    modal?.setAttribute('aria-hidden', 'true');
    if (content) content.innerHTML = '';
    document.body.style.overflow = '';

    // Скрываем tooltip диаграммы
    const tooltip = document.getElementById('radarTooltip');
    if (tooltip) tooltip.classList.remove('is-visible');
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
    if (cardEl) cardEl.style.setProperty('font-size', DOWNLOAD_BASE_FONT + 'px', 'important');

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
            scale: 2, backgroundColor: null, logging: false,
            useCORS: true, allowTaint: false, imageTimeout: 4000,
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
    document.body.appendChild(a); a.click(); a.remove();
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
            @media print { body { background: #fff; padding: 0; } img { max-height: 100vh; } }
        </style></head>
        <body><img src="${dataUrl}" onload="setTimeout(() => window.print(), 200);"></body>
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
        } catch { alert('Не удалось поделиться'); }
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
        state.page = 1; loadPlayers();
    }, 350));
    on('clubFilter',   'change', e => { state.filters.club   = e.target.value; state.page = 1; loadPlayers(); });
    on('ageFilter',    'change', e => { state.filters.age    = e.target.value; state.page = 1; loadPlayers(); });
    on('genderFilter', 'change', e => { state.filters.gender = e.target.value; state.page = 1; loadPlayers(); });
    on('sortFilter',   'change', e => { state.filters.sort   = e.target.value; state.page = 1; loadPlayers(); });

    // Клик по уведомлению: открывает сравнение (при 2+), либо кнопку очистки
    const notice = document.getElementById('compareNotice');
    if (notice) {
        notice.addEventListener('click', (e) => {
            if (e.target.closest('#clearCompare')) return; // своя кнопка
            if (state.selected.size >= 2) openCompareModal();
        });
    }

    // Кнопка "Очистить"
    on('clearCompare', 'click', (e) => {
        e.stopPropagation();
        state.selected.clear();
        updateCompareUI();
        loadPlayers();
        closeCompareModal();
    });
}

function bindGrid() {
    const grid = $('#playersResults');
    if (!grid) return;

    grid.addEventListener('click', e => {
        const compareBtn = e.target.closest('[data-compare]');
        if (compareBtn) {
            togglePlayer(Number(compareBtn.dataset.compare), compareBtn);
            return;
        }
        const panelBtn = e.target.closest('[data-panel]');
        if (panelBtn) openPlayerPanel(Number(panelBtn.dataset.panel));
    });
}

function bindModalClosers() {
    document.addEventListener('click', e => {
        if (e.target.closest('[data-close-panel]'))   closePlayerPanel();
        if (e.target.closest('[data-close-compare]')) closeCompareModal();
    });
    document.addEventListener('keydown', e => {
        if (e.key !== 'Escape') return;
        const panel   = $('#playerPanel');
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