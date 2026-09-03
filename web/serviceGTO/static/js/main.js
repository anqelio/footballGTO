const API_BASE = '/api/v1';

// --- Helper: получение токена ---
function getToken() { return localStorage.getItem('access_token'); }

// --- Загрузка статистики (кол-во участников и клубов) ---
async function loadStats() {
    try {
        // Получаем всех игроков (без пагинации, большой size)
        const playersRes = await fetch(`${API_BASE}/players/rankings?page=1&size=100`)
        if (!playersRes.ok) throw new Error();
        const playersData = await playersRes.json();
        // playersData – PaginatedResponse, содержит items и total
        const totalPlayers = playersData.total || playersData.items?.length || 0;
        document.getElementById('statParticipants').innerText = totalPlayers;

        // Клубы – используем пагинированный ответ
        const clubsRes = await fetch(`${API_BASE}/clubs?page=1&size=100`);
        const clubsData = await clubsRes.json();
        const clubsCount = clubsData.total || clubsData.items?.length || 0;
        document.getElementById('statClubs').innerText = clubsCount;
    } catch(e) { console.error(e); }
}

// --- Загрузка топ-5 игроков по возрасту и рендер в Swiper ---
async function loadTopPlayers(ageGroup = 'U9') {
    try {
        // gender теперь 'male' (бэкенд изменён)
        const res = await fetch(`${API_BASE}/rankings/top/by-category?category=Атлетизм&age_group=${ageGroup}&gender=male&limit=10`);
        if (!res.ok) throw new Error();
        const players = await res.json();
        const container = document.getElementById('topPlayersCarousel');
        if (!container) return;
        container.innerHTML = players.map(p => `
            <div class="swiper-slide">
                <div class="bg-white rounded-xl shadow-lg overflow-hidden card-hover">
                    <img src="${p.photo_url || 'https://via.placeholder.com/300x200?text=No+Photo'}" class="w-full h-48 object-cover">
                    <div class="p-4 text-center">
                        <h3 class="font-bold text-lg">${p.first_name} ${p.last_name}</h3>
                        <p class="text-gray-500">${p.age} лет</p>
                        <p class="text-blue-600 font-bold mt-2">Рейтинг: ${p.rating}</p>
                    </div>
                </div>
            </div>
        `).join('');
        // инициализация/обновление Swiper
        if (window.topSwiper) window.topSwiper.destroy(true, true);
        window.topSwiper = new Swiper('.ratingSwiper', {
            slidesPerView: 1,
            spaceBetween: 20,
            loop: players.length > 1,
            navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' },
            pagination: { el: '.swiper-pagination', clickable: true },
            breakpoints: { 640: { slidesPerView: 2 }, 1024: { slidesPerView: 4 } }
        });
    } catch(e) { console.error('Ошибка загрузки топа', e); }
}

// --- Загрузка мероприятий ---
async function loadEvents() {
    try {
        const res = await fetch(`${API_BASE}/events?size=6`);
        const data = await res.json();
        const events = data.items || [];
        const grid = document.getElementById('eventsGrid');
        if (!grid) return;
        grid.innerHTML = events.map(ev => `
            <div class="bg-white rounded-xl overflow-hidden shadow-md card-hover">
                <img src="${ev.photo_url || 'https://via.placeholder.com/400x250'}" class="w-full h-48 object-cover">
                <div class="p-4">
                    <div class="flex items-center gap-2 text-sm text-gray-500">
                        <span>📅 ${new Date(ev.event_date).toLocaleDateString()}</span>
                        <span>📍 ${ev.location || 'Екатеринбург'}</span>
                    </div>
                    <h3 class="font-bold text-lg mt-2">${ev.title}</h3>
                    <p class="text-gray-600 mt-1">${ev.description?.substring(0, 100)}</p>
                    <button class="mt-3 text-blue-600 font-medium">Смотреть галерею →</button>
                </div>
            </div>
        `).join('');
    } catch(e) { console.error(e); }
}

// --- Отправка заявки на тестирование ---
async function submitRegistration(formData) {
    const payload = {
        parent_name: formData.get('parent_name'),
        parent_phone: formData.get('parent_phone'),
        child_name: formData.get('child_name'),
        child_age: parseInt(formData.get('child_age')) || null,
        club_name: formData.get('club_name') || null
    };
    const res = await fetch(`${API_BASE}/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    if (res.ok) alert('Заявка отправлена! Мы свяжемся с вами.');
    else alert('Ошибка. Попробуйте позже.');
}

// --- Обратная связь ---
async function submitFeedback(formData) {
    const payload = {
        name: formData.get('name'),
        phone: formData.get('phone'),
        email: formData.get('email') || null,
        message: formData.get('message')
    };
    const res = await fetch(`${API_BASE}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    if (res.ok) alert('Сообщение отправлено!');
    else alert('Ошибка');
}

// --- Инициализация ---
document.addEventListener('DOMContentLoaded', () => {
    AOS.init({ duration: 800, once: true });
    loadStats();
    loadEvents();
    loadTopPlayers('U9');

    // Переключение возрастных групп в рейтинге
    document.querySelectorAll('.age-tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.age-tab-btn').forEach(b => b.classList.remove('active', 'bg-blue-600', 'text-white'));
            btn.classList.add('active', 'bg-blue-600', 'text-white');
            const age = btn.dataset.age;
            loadTopPlayers(age);
        });
    });

    // Формы
    document.getElementById('registrationForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await submitRegistration(new FormData(e.target));
        e.target.reset();
    });
    document.getElementById('contactForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await submitFeedback(new FormData(e.target));
        e.target.reset();
    });
    document.getElementById('buyTicketBtn')?.addEventListener('click', () => {
        alert('Переход на страницу оплаты (интеграция с платежной системой)');
    });
    // Мобильное меню
    document.getElementById('menuToggle')?.addEventListener('click', () => {
        document.getElementById('mobileMenu').classList.toggle('hidden');
    });
});