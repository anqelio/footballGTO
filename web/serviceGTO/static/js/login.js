const API_BASE = '/api/v1';

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('loginForm');
    if (!form) return;

    const errorBox = document.getElementById('error');

    form.addEventListener('submit', async e => {
        e.preventDefault();

        const btn = form.querySelector('button[type="submit"]');
        const username = form.username.value.trim();
        const password = form.password.value;

        if (errorBox) errorBox.textContent = '';
        if (btn) {
            btn.dataset.idle = btn.textContent;
            btn.disabled = true;
            btn.textContent = 'Вход…';
        }

        try {
            const res = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            if (!res.ok) {
                if (errorBox) errorBox.textContent = 'Неверный логин или пароль';
                return;
            }

            const data = await res.json();
            localStorage.setItem('access_token', data.access_token);
            window.location.href = '/dashboard';
        } catch {
            if (errorBox) errorBox.textContent = 'Ошибка сервера. Попробуйте позже.';
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = btn.dataset.idle || 'Войти';
            }
        }
    });
});