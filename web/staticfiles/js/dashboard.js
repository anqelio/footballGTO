const API_BASE = '/api/v1';

function getAuthHeaders() {
    const token = localStorage.getItem('access_token');
    return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function fetchApplications() {
    const res = await fetch(`${API_BASE}/applications?size=50`, { headers: getAuthHeaders() });
    const data = await res.json();
    const apps = data.items || [];
    document.getElementById('applicationsList').innerHTML = apps.map(a => `<div class="border-b py-2">${a.parent_name} (${a.parent_phone}) - ребёнок ${a.child_name} (${a.child_age}) - статус: ${a.status}</div>`).join('');
}

async function fetchPlayers() {
    const res = await fetch(`${API_BASE}/players?size=100`, { headers: getAuthHeaders() });
    const data = await res.json();
    const players = data.items || [];
    document.getElementById('playersList').innerHTML = players.map(p => `<div>${p.first_name} ${p.last_name} (${p.club?.name || 'без клуба'})</div>`).join('');
}

async function loadTestOptions() {
    const res = await fetch(`${API_BASE}/tests?size=100`, { headers: getAuthHeaders() });
    const data = await res.json();
    const tests = data.items || [];
    const select = document.getElementById('testSelect');
    select.innerHTML = tests.map(t => `<option value="${t.id}">${t.name} (${t.section})</option>`).join('');
}

document.getElementById('resultForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
        player_id: parseInt(document.getElementById('playerSelect').value),
        test_id: parseInt(document.getElementById('testSelect').value),
        test_date: document.getElementById('testDate').value,
        value: parseFloat(document.getElementById('testValue').value),
        notes: document.getElementById('testNotes').value
    };
    const res = await fetch(`${API_BASE}/results`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(payload) });
    if (res.ok) alert('Результат сохранён');
    else alert('Ошибка');
});

document.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
        document.getElementById(`${tab}Tab`).classList.remove('hidden');
        if (tab === 'applications') fetchApplications();
        if (tab === 'players') fetchPlayers();
        if (tab === 'results') loadTestOptions();
    });
});

document.getElementById('logoutBtn')?.addEventListener('click', () => {
    localStorage.removeItem('access_token');
    window.location.href = '/login';
});

// Проверка авторизации
if (!localStorage.getItem('access_token')) window.location.href = '/login';