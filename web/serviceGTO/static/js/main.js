const API_BASE = '/api/v1';

/* ============================================================
   HELPERS
   ============================================================ */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function getToken() { return localStorage.getItem('access_token'); }

function esc(str) {
    return String(str ?? '').replace(/[&<>"']/g, s => ({
        '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[s]));
}

function formatDate(iso) {
    if (!iso) return '';
    try {
        return new Date(iso).toLocaleDateString('ru-RU', {
            day: '2-digit', month: 'long', year: 'numeric'
        });
    } catch { return ''; }
}

/** Плавная анимация числа от 0 до target */
function animateNumber(el, target, duration = 1200) {
    if (!el) return;
    const to = Number(target) || 0;
    const startTime = performance.now();

    function tick(now) {
        const p = Math.min((now - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(to * eased).toLocaleString('ru-RU');
        if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}

/** Кнопка формы: loading-состояние */
function setButtonLoading(btn, loading, idleText) {
    if (!btn) return;
    btn.disabled = loading;
    btn.dataset.idleText = btn.dataset.idleText || idleText || btn.textContent;
    btn.textContent = loading ? 'Отправка…' : btn.dataset.idleText;
    btn.style.opacity = loading ? '0.65' : '';
}

/** Inline-сообщение под формой */
function showFormMessage(form, type, text) {
    let box = form.querySelector('.form-message');
    if (!box) {
        box = document.createElement('div');
        box.className = 'form-message mt-4 text-sm';
        form.appendChild(box);
    }
    box.className = `form-message mt-4 text-sm ${type === 'error' ? 'text-red-600' : 'text-green-700'}`;
    box.textContent = text;

    if (type === 'success') {
        setTimeout(() => box.remove(), 6000);
    }
}

/* ============================================================
   STATS — кол-во игроков и клубов
   ============================================================ */
async function loadStats() {
    try {
        const [playersRes, clubsRes] = await Promise.all([
            fetch(`${API_BASE}/players/rankings?page=1&size=1`),
            fetch(`${API_BASE}/clubs/?page=1&size=1`)
        ]);

        if (playersRes.ok) {
            const pd = await playersRes.json();
            const total = pd.total ?? pd.items?.length ?? 0;
            animateNumber($('#statParticipants'), total);
        }
        if (clubsRes.ok) {
            const cd = await clubsRes.json();
            const total = cd.total ?? cd.items?.length ?? 0;
            animateNumber($('#statClubs'), total);
        }
    } catch (e) {
        console.error('[stats]', e);
    }
}

/* ============================================================
   TOP PLAYERS — Swiper в рейтинге
   ============================================================ */
async function loadTopPlayers(ageGroup = 'U9') {
    const container = $('#topPlayersCarousel');
    if (!container) return;

    // skeleton
    container.innerHTML = Array.from({ length: 4 }).map(() => `
        <div class="swiper-slide">
            <div class="border border-gray-200 rounded bg-white overflow-hidden">
                <div class="aspect-[4/3] bg-gray-100 animate-pulse"></div>
                <div class="p-5 space-y-3">
                    <div class="h-3 w-20 bg-gray-100 rounded animate-pulse"></div>
                    <div class="h-4 w-32 bg-gray-100 rounded animate-pulse"></div>
                    <div class="h-8 w-16 bg-gray-100 rounded animate-pulse"></div>
                </div>
            </div>
        </div>
    `).join('');

    try {
        const res = await fetch(
            `${API_BASE}/rankings/top/by-category?category=Атлетизм&age_group=${ageGroup}&gender=male&limit=10`
        );
        if (!res.ok) throw new Error('network');
        const players = await res.json();

        if (!Array.isArray(players) || !players.length) {
            container.innerHTML = `
                <div class="swiper-slide">
                    <div class="border border-dashed border-gray-300 rounded p-12 text-center text-gray-500">
                        Пока нет данных за ${ageGroup}
                    </div>
                </div>
            `;
            rebuildTopSwiper(0);
            return;
        }

        container.innerHTML = players.map((p, i) => `
            <div class="swiper-slide h-auto">
                <article class="border border-gray-200 rounded bg-white overflow-hidden h-full flex flex-col group">
                    <div class="relative aspect-[4/3] bg-gray-100 overflow-hidden">
                        <img
                            src="${esc(p.photo_url) || 'https://via.placeholder.com/400x300?text=—'}"
                            alt="${esc(p.first_name)} ${esc(p.last_name)}"
                            class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            loading="lazy"
                        >
                        <span class="absolute top-3 left-3 text-[11px] font-bold tracking-widest uppercase bg-white/95 text-gray-900 px-2 py-1 rounded-sm">
                            #${i + 1}
                        </span>
                    </div>
                    <div class="p-5 flex flex-col flex-1">
                        <div class="eyebrow" style="color: var(--muted)">
                            ${esc(ageGroup)} · Атлетизм
                        </div>
                        <h3 class="font-bold text-lg mt-2 leading-tight">
                            ${esc(p.first_name)} ${esc(p.last_name)}
                        </h3>
                        <div class="mt-auto pt-4 flex items-end justify-between border-t border-gray-100">
                            <div>
                                <div class="text-[11px] uppercase tracking-widest text-gray-500">Рейтинг</div>
                                <div class="text-2xl font-bold tnum leading-none mt-1">${esc(p.rating)}</div>
                            </div>
                            <div class="text-xs text-gray-500 text-right">
                                ${esc(p.age ?? '')} лет
                            </div>
                        </div>
                    </div>
                </article>
            </div>
        `).join('');

        rebuildTopSwiper(players.length);
    } catch (e) {
        console.error('[top]', e);
        container.innerHTML = `
            <div class="swiper-slide">
                <div class="border border-dashed border-gray-300 rounded p-12 text-center text-gray-500">
                    Не удалось загрузить рейтинг
                </div>
            </div>
        `;
        rebuildTopSwiper(0);
    }
}

function rebuildTopSwiper(count) {
    if (window.topSwiper) {
        window.topSwiper.destroy(true, true);
        window.topSwiper = null;
    }
    if (!document.querySelector('.ratingSwiper')) return;

    window.topSwiper = new Swiper('.ratingSwiper', {
        slidesPerView: 1,
        spaceBetween: 20,
        loop: count > 4,
        watchOverflow: true,
        autoHeight: false,
        navigation: {
            nextEl: '.ratingSwiper .swiper-button-next',
            prevEl: '.ratingSwiper .swiper-button-prev',
        },
        pagination: {
            el: '.ratingSwiper .swiper-pagination',
            clickable: true,
        },
        breakpoints: {
            640:  { slidesPerView: 2, spaceBetween: 20 },
            1024: { slidesPerView: 4, spaceBetween: 24 },
        },
    });
}

/* ============================================================
   EVENTS
   ============================================================ */
async function loadEvents() {
    const grid = $('#eventsGrid');
    if (!grid) return;

    grid.innerHTML = Array.from({ length: 3 }).map(() => `
        <div class="border border-gray-200 rounded bg-white overflow-hidden">
            <div class="aspect-[16/10] bg-gray-100 animate-pulse"></div>
            <div class="p-6 space-y-3">
                <div class="h-3 w-24 bg-gray-100 rounded animate-pulse"></div>
                <div class="h-4 w-3/4 bg-gray-100 rounded animate-pulse"></div>
                <div class="h-3 w-full bg-gray-100 rounded animate-pulse"></div>
            </div>
        </div>
    `).join('');

    try {
        const res = await fetch(`${API_BASE}/events/?size=6`);
        const data = await res.json();
        const events = data.items || [];

        if (!events.length) {
            grid.innerHTML = `
                <div class="md:col-span-3 border border-dashed border-gray-300 rounded p-12 text-center text-gray-500">
                    Мероприятия скоро появятся
                </div>`;
            return;
        }

        grid.innerHTML = events.map(ev => {
            const href = ev.video_url || '#events';
            const desc = ev.description ? esc(ev.description.slice(0, 110)) + (ev.description.length > 110 ? '…' : '') : '';
            return `
                <a href="${esc(href)}" class="group block border border-gray-200 rounded bg-white overflow-hidden transition-colors hover:border-gray-400">
                    <div class="aspect-[16/10] bg-gray-100 overflow-hidden">
                        <img
                            src="${esc(ev.photo_url) || 'https://via.placeholder.com/600x400?text=—'}"
                            alt="${esc(ev.title)}"
                            class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            loading="lazy"
                        >
                    </div>
                    <div class="p-6">
                        <div class="flex items-center gap-3 text-[11px] uppercase tracking-widest text-gray-500">
                            <span class="tnum">${formatDate(ev.event_date)}</span>
                            <span class="w-1 h-1 bg-gray-300 rounded-full"></span>
                            <span>${esc(ev.location || 'Екатеринбург')}</span>
                        </div>
                        <h3 class="font-bold text-lg mt-3 leading-snug group-hover:text-red-600 transition-colors">
                            ${esc(ev.title)}
                        </h3>
                        <p class="text-gray-600 text-sm mt-2 leading-relaxed">${desc}</p>
                        <div class="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between">
                            <span class="text-xs text-gray-500">Отчёт с мероприятия</span>
                            <span class="inline-flex items-center gap-1.5 text-sm font-semibold text-red-600">
                                Смотреть
                                <svg class="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M13 5l7 7-7 7"/>
                                </svg>
                            </span>
                        </div>
                    </div>
                </a>
            `;
        }).join('');
    } catch (e) {
        console.error('[events]', e);
        grid.innerHTML = `
            <div class="md:col-span-3 border border-dashed border-gray-300 rounded p-12 text-center text-gray-500">
                Не удалось загрузить мероприятия
            </div>`;
    }
}

/* ============================================================
   FORMS
   ============================================================ */
async function submitRegistration(form) {
    const btn = form.querySelector('button[type="submit"]');
    const fd = new FormData(form);

    const payload = {
        parent_name:  (fd.get('parent_name') || '').trim(),
        parent_phone: (fd.get('parent_phone') || '').trim(),
        child_name:   (fd.get('child_name') || '').trim(),
        child_age:    parseInt(fd.get('child_age'), 10) || null,
        club_name:    (fd.get('club_name') || '').trim() || null,
    };

    setButtonLoading(btn, true, 'Отправить заявку');
    try {
        const res = await fetch(`${API_BASE}/applications/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('bad_status');
        showFormMessage(form, 'success', 'Заявка отправлена. Менеджер свяжется с вами.');
        form.reset();
    } catch (e) {
        showFormMessage(form, 'error', 'Не удалось отправить заявку. Попробуйте ещё раз.');
    } finally {
        setButtonLoading(btn, false);
    }
}

async function submitFeedback(form) {
    const btn = form.querySelector('button[type="submit"]');
    const fd = new FormData(form);

    const payload = {
        name:    (fd.get('name') || '').trim(),
        phone:   (fd.get('phone') || '').trim(),
        email:   (fd.get('email') || '').trim() || null,
        message: (fd.get('message') || '').trim(),
    };

    setButtonLoading(btn, true, 'Отправить сообщение');
    try {
        const res = await fetch(`${API_BASE}/feedback/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('bad_status');
        showFormMessage(form, 'success', 'Сообщение отправлено. Спасибо!');
        form.reset();
    } catch (e) {
        showFormMessage(form, 'error', 'Не удалось отправить. Попробуйте позже.');
    } finally {
        setButtonLoading(btn, false);
    }
}

/* ============================================================
   ABOUT SLIDER + PROGRESS
   ============================================================ */
function initAboutSlider() {
    const el = $('.about-slider');
    if (!el) return;

    const AUTOPLAY_MS = 5000;
    const bar = el.querySelector('.about-slider-progress span');

    const swiper = new Swiper('.about-slider', {
        loop: true,
        speed: 900,
        effect: 'fade',
        fadeEffect: { crossFade: true },
        autoplay: {
            delay: AUTOPLAY_MS,
            disableOnInteraction: false,
            pauseOnMouseEnter: true,
        },
        pagination: {
            el: '.about-slider .swiper-pagination',
            clickable: true,
        },
        navigation: {
            nextEl: '.about-slider .swiper-button-next',
            prevEl: '.about-slider .swiper-button-prev',
        },
        on: {
            init() { restartProgress(); },
            slideChangeTransitionStart() { restartProgress(); },
        },
    });

    function restartProgress() {
        if (!bar) return;
        bar.style.transition = 'none';
        bar.style.width = '0%';
        void bar.offsetWidth;
        bar.style.transition = `width ${AUTOPLAY_MS}ms linear`;
        bar.style.width = '100%';
    }
}

/* ============================================================
   AGE TABS (в новой вёрстке — .tag-age)
   ============================================================ */
function initAgeTabs() {
    const tabs = $$('[data-age]');
    if (!tabs.length) return;

    tabs.forEach(btn => {
        btn.addEventListener('click', () => {
            tabs.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const age = btn.dataset.age;
            if (age) loadTopPlayers(age);
        });
    });
}

/* ============================================================
   VIDEO MODAL
   ============================================================ */
function initVideoModal() {
    const modal  = $('#videoModal');
    const openBtn = $('#openVideoModal');
    const video  = $('#videoGTO');
    if (!modal || !openBtn || !video) return;

    function open() {
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        video.play().catch(() => {});
    }
    function close() {
        modal.classList.add('hidden');
        document.body.style.overflow = '';
        video.pause();
        video.currentTime = 0;
    }

    openBtn.addEventListener('click', open);
    $$('[data-close-video]', modal).forEach(el => el.addEventListener('click', close));
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) close();
    });
}

/* ============================================================
   MOBILE MENU
   ============================================================ */
function initMobileMenu() {
    const btn  = $('#menuToggle');
    const menu = $('#mobileMenu');
    if (!btn || !menu) return;

    btn.addEventListener('click', () => menu.classList.toggle('hidden'));

    // закрываем при клике по ссылке
    $$('a', menu).forEach(a => a.addEventListener('click', () => menu.classList.add('hidden')));
}

/* ============================================================
   BUY TICKET
   ============================================================ */
function initBuyTicket() {
    $('#buyTicketBtn')?.addEventListener('click', () => {
        // TODO: интеграция с платёжной системой
        alert('Переход на страницу оплаты (интеграция с платёжной системой)');
    });
}

/* ============================================================
   BOOTSTRAP
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
    if (window.AOS) AOS.init({ duration: 700, once: true, offset: 60 });

    initMobileMenu();
    initAboutSlider();
    initVideoModal();
    initAgeTabs();
    initBuyTicket();

    loadStats();
    loadEvents();
    loadTopPlayers('U9');

    $('#registrationForm')?.addEventListener('submit', e => {
        e.preventDefault();
        submitRegistration(e.target);
    });
    $('#contactForm')?.addEventListener('submit', e => {
        e.preventDefault();
        submitFeedback(e.target);
    });
});