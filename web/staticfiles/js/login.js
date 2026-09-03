const API_BASE = '/api/v1';

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    try {
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        if (res.ok) {
            const data = await res.json();
            localStorage.setItem('access_token', data.access_token);
            window.location.href = '/dashboard';
        } else {
            document.getElementById('error').innerText = 'Неверные данные';
        }
    } catch (err) {
        document.getElementById('error').innerText = 'Ошибка сервера';
    }
});