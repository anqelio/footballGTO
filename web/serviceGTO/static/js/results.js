const API_BASE = '/api/v1';
let currentPage = 1;
let totalPages = 1;
let currentFilters = { search: '', club: 'all', age: 'all', gender: 'all', sort: 'total_rating' };
let selectedPlayers = [];

async function fetchClubs() {
    const res = await fetch(`${API_BASE}/clubs?size=100`);
    const data = await res.json();
    const clubs = data.items || [];
    const select = document.getElementById('clubFilter');
    select.innerHTML = '<option value="all">Все клубы</option>' + clubs.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

async function loadPlayers() {
    const params = new URLSearchParams({
        page: currentPage,
        size: 12,
        ...(currentFilters.age !== 'all' && { age_group: `U${currentFilters.age}` }),
        ...(currentFilters.club !== 'all' && { club_id: currentFilters.club }),
        ...(currentFilters.gender !== 'all' && { gender: currentFilters.gender }),
        ...(currentFilters.search && { search: currentFilters.search }),
        sort_by: currentFilters.sort
    });
    try {
        const res = await fetch(`${API_BASE}/players/rankings?${params}`);
        if (!res.ok) throw new Error();
        const data = await res.json();   // PaginatedResponse
        const players = data.items;
        totalPages = data.pages;
        currentPage = data.page;
        renderPlayers(players);
        renderPagination();
    } catch(e) { console.error(e); /* ... */ }
}

function renderPlayers(players) {
    const container = document.getElementById('playersResults');
    const noResults = document.getElementById('noResults');
    if (!players.length) {
        container.innerHTML = '';
        noResults.classList.remove('hidden');
        return;
    }
    noResults.classList.add('hidden');
    container.innerHTML = players.map(p => `
        <div class="bg-white rounded-xl shadow-md overflow-hidden ${selectedPlayers.includes(p.player_id) ? 'selected ring-2 ring-blue-500' : ''}">
            <div class="p-5">
                <div class="flex gap-4">
                    <img src="${p.photo_url || 'https://via.placeholder.com/80'}" class="w-20 h-20 rounded-full object-cover">
                    <div><h3 class="font-bold text-xl">${p.first_name} ${p.last_name}</h3><p class="text-gray-500">${p.club_name || '—'} • ${p.age} лет</p></div>
                    <div class="ml-auto"><span class="px-3 py-1 rounded-full ${p.total_rating >= 80 ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'} font-bold">${p.total_rating}</span></div>
                </div>
                <div class="mt-4 space-y-2">
                    <div class="flex justify-between text-sm"><span>Антропометрия</span><span class="font-medium">${p.anthropometry ?? '-'}</span></div>
                    <div class="flex justify-between text-sm"><span>Атлетизм</span><span>${p.athleticism ?? '-'}</span></div>
                    <div class="flex justify-between text-sm"><span>Быстрота</span><span>${p.speed ?? '-'}</span></div>
                    <div class="flex justify-between text-sm"><span>Ловкость</span><span>${p.agility ?? '-'}</span></div>
                    <div class="flex justify-between text-sm"><span>Дриблинг</span><span>${p.dribbling ?? '-'}</span></div>
                    <div class="flex justify-between text-sm"><span>Техника</span><span>${p.technique ?? '-'}</span></div>
                    <div class="flex justify-between text-sm"><span>Удары</span><span>${p.shots ?? '-'}</span></div>
                </div>
                <div class="mt-5 flex justify-between items-center">
                    <label class="flex items-center gap-2"><input type="checkbox" ${selectedPlayers.includes(p.player_id) ? 'checked' : ''} onchange="togglePlayerSelection(${p.player_id})" class="w-4 h-4"> Сравнить</label>
                    <button onclick="downloadCard(${p.player_id})" class="text-blue-600 text-sm">📄 Карточка</button>
                </div>
            </div>
        </div>
    `).join('');
}

async function downloadCard(playerId) {
    const res = await fetch(`${API_BASE}/players/${playerId}`);
    const player = await res.json();
    // Создаём временный элемент для карточки
    const cardHtml = `
        <div id="tempCard" style="width: 500px; background: white; padding: 20px; border-radius: 16px; font-family: sans-serif;">
            <div style="display: flex; gap: 16px;">
                <img src="${player.photo_url || 'https://via.placeholder.com/100'}" style="width: 100px; height: 100px; border-radius: 50%;">
                <div><h2>${player.first_name} ${player.last_name}</h2><p>${player.club?.name || ''} • Возраст: ${new Date().getFullYear() - new Date(player.birth_date).getFullYear()} лет</p></div>
            </div>
            <hr style="margin: 16px 0;">
            <p><strong>Дата рождения:</strong> ${player.birth_date}</p>
            <p><strong>Пол:</strong> ${player.gender === 'male' ? 'Мужской' : 'Женский'}</p>
            <p><strong>Удобная нога:</strong> ${player.preferred_foot === 'left' ? 'Левая' : 'Правая'}</p>
        </div>
    `;
    const div = document.createElement('div');
    div.innerHTML = cardHtml;
    document.body.appendChild(div);
    const element = div.firstElementChild;
    const canvas = await html2canvas(element);
    const link = document.createElement('a');
    link.download = `player_${playerId}.png`;
    link.href = canvas.toDataURL();
    link.click();
    div.remove();
}

function togglePlayerSelection(playerId) {
    const idx = selectedPlayers.indexOf(playerId);
    if (idx === -1) selectedPlayers.push(playerId);
    else selectedPlayers.splice(idx, 1);
    document.getElementById('compareCount').innerText = selectedPlayers.length;
    if (selectedPlayers.length >= 2) document.getElementById('comparisonSection').classList.remove('hidden');
    else document.getElementById('comparisonSection').classList.add('hidden');
    loadPlayers(); // перерисовка с выделением
    if (selectedPlayers.length >= 2) renderComparison();
}

async function renderComparison() {
    if (selectedPlayers.length < 2) return;
    const promises = selectedPlayers.map(id => fetch(`${API_BASE}/players/${id}`).then(r => r.json()));
    const players = await Promise.all(promises);
    const grid = document.getElementById('comparisonGrid');
    grid.innerHTML = players.map(p => `
        <div class="bg-gray-50 p-4 rounded-lg">
            <h3 class="font-bold">${p.first_name} ${p.last_name}</h3>
            <p>Клуб: ${p.club?.name || '—'}</p>
            <p>Возраст: ${new Date().getFullYear() - new Date(p.birth_date).getFullYear()}</p>
            <hr class="my-2">
            <p>Предпочт. нога: ${p.preferred_foot === 'left' ? 'Левая' : 'Правая'}</p>
        </div>
    `).join('');
}

function renderPagination() {
    const container = document.getElementById('pagination');
    if (totalPages <= 1) { container.innerHTML = ''; return; }
    let html = '';
    for (let i = 1; i <= totalPages; i++) {
        html += `<button class="px-3 py-1 border rounded ${currentPage === i ? 'bg-blue-600 text-white' : 'bg-white'}" data-page="${i}">${i}</button>`;
    }
    container.innerHTML = html;
    document.querySelectorAll('#pagination button').forEach(btn => {
        btn.addEventListener('click', () => {
            currentPage = parseInt(btn.dataset.page);
            loadPlayers();
        });
    });
}

document.getElementById('searchInput')?.addEventListener('input', (e) => { currentFilters.search = e.target.value; currentPage = 1; loadPlayers(); });
document.getElementById('clubFilter')?.addEventListener('change', (e) => { currentFilters.club = e.target.value; currentPage = 1; loadPlayers(); });
document.getElementById('ageFilter')?.addEventListener('change', (e) => { currentFilters.age = e.target.value; currentPage = 1; loadPlayers(); });
document.getElementById('genderFilter')?.addEventListener('change', (e) => { currentFilters.gender = e.target.value; currentPage = 1; loadPlayers(); });
document.getElementById('sortFilter')?.addEventListener('change', (e) => { currentFilters.sort = e.target.value; currentPage = 1; loadPlayers(); });
document.getElementById('clearCompare')?.addEventListener('click', () => { selectedPlayers = []; loadPlayers(); document.getElementById('comparisonSection').classList.add('hidden'); });

document.addEventListener('DOMContentLoaded', () => {
    fetchClubs();
    loadPlayers();
    AOS.init();
    document.getElementById('menuToggle')?.addEventListener('click', () => document.getElementById('mobileMenu').classList.toggle('hidden'));
});