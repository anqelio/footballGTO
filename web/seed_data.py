#!/usr/bin/env python3
"""
Скрипт для заполнения базы данных тестовыми данными через API FastAPI.
Предполагается, что сервер запущен на http://localhost:8001.
Для работы требуется учётная запись администратора (по умолчанию admin/admin).
"""

import requests
import random
from datetime import date, timedelta
from decimal import Decimal
import time
import sys

# ========== НАСТРОЙКИ ==========
BASE_URL = "http://localhost:8001"          # Без /api/v1
API_PREFIX = "/api/v1"
AUTH_URL = f"{BASE_URL}/api/v1/login"             # /login без префикса
ADMIN_USERNAME = "Test"
ADMIN_PASSWORD = "123"

# Количество генерируемых записей
NUM_PLAYERS = 20
NUM_EVENTS = 6
NUM_APPLICATIONS = 10
NUM_FEEDBACKS = 8
NUM_USERS = 2  # операторов

# ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
def get_token():
    """Получает токен доступа для администратора."""
    response = requests.post(AUTH_URL, json={
        "username": ADMIN_USERNAME,
        "password": ADMIN_PASSWORD
    })
    response.raise_for_status()
    token = response.json()["access_token"]
    return token

def get_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

def safe_post(url, json_data, headers=None, need_auth=True):
    """Выполняет POST-запрос с обработкой ошибок."""
    if need_auth and headers is None:
        raise ValueError("Headers required for authenticated requests")
    if headers is None:
        headers = {}
    resp = requests.post(url, json=json_data, headers=headers)
    if resp.status_code >= 400:
        print(f"Ошибка {resp.status_code} при POST {url}: {resp.text}")
        # Не прерываем, чтобы продолжить заполнение
        return None
    return resp.json()

def safe_get(url, headers=None, need_auth=True):
    """GET запрос с обработкой ошибок."""
    if need_auth and headers is None:
        raise ValueError("Headers required for authenticated requests")
    if headers is None:
        headers = {}
    resp = requests.get(url, headers=headers)
    if resp.status_code >= 400:
        print(f"Ошибка {resp.status_code} при GET {url}: {resp.text}")
        return None
    return resp.json()

# ========== ГЕНЕРАЦИЯ ДАННЫХ ==========
# Списки имён, фамилий, клубов
FIRST_NAMES_MALE = ["Иван", "Петр", "Сергей", "Алексей", "Дмитрий", "Андрей", "Егор", "Максим", "Артём", "Никита",
                    "Михаил", "Роман", "Константин", "Владислав", "Ярослав", "Даниил", "Тимофей", "Матвей", "Глеб", "Лев"]
FIRST_NAMES_FEMALE = ["Анна", "Мария", "Елена", "Ольга", "Екатерина", "Полина", "Виктория", "Анастасия", "София", "Варвара",
                      "Алиса", "Дарья", "Ксения", "Юлия", "Александра", "Кристина", "Василиса", "Милана", "Арина", "Вероника"]
LAST_NAMES = ["Иванов", "Петров", "Сидоров", "Кузнецов", "Морозов", "Смирнов", "Волков", "Лебедев", "Новиков", "Козлов",
              "Михайлов", "Федоров", "Семенов", "Егоров", "Тихонов", "Соколов", "Попов", "Орлов", "Зайцев", "Баранов"]
CLUB_NAMES = ["Спартак", "Динамо", "Локомотив", "Зенит", "ЦСКА", "Краснодар", "Рубин", "Урал", "Крылья Советов", "Ростов",
              "Торпедо", "Шинник", "Енисей", "Ахмат", "Тамбов", "Химки", "Оренбург", "Сочи", "Балтика", "Факел"]

# Тесты по разделам (данные из ТЗ)
TESTS_SPEC = [
    # Антропометрия – отдельная таблица, не тесты
    # Атлетизм
    {"name": "Отжимания", "section": "Атлетизм", "physical_quality": "Силовая выносливость", "unit": "раз", "weight": 0.30},
    {"name": "Лесенка (лево-право)", "section": "Атлетизм", "physical_quality": "Координационная выносливость", "unit": "сек", "weight": 0.25},
    {"name": "Прыжок в длину", "section": "Атлетизм", "physical_quality": "Прыгучесть", "unit": "см", "weight": 0.25},
    {"name": "Бросок мяча из-за головы", "section": "Атлетизм", "physical_quality": "Взрывная сила броска", "unit": "м", "weight": 0.20},
    # Быстрота
    {"name": "Бег 10м со старта", "section": "Быстрота", "physical_quality": "Спринтерская скорость", "unit": "сек", "weight": 0.30},
    {"name": "Бег 15м с хода", "section": "Быстрота", "physical_quality": "Максимальная скорость", "unit": "сек", "weight": 0.30},
    {"name": "Челнок 10х9х9х10м", "section": "Быстрота", "physical_quality": "Интервальная взрывная быстрота", "unit": "сек", "weight": 0.30},
    # Координация (ловкость)
    {"name": "Тест на реакцию", "section": "Координация", "physical_quality": "Реакция", "unit": "сек", "weight": 0.20},
    {"name": "Наклон на скамье", "section": "Координация", "physical_quality": "Гибкость", "unit": "см", "weight": 0.20},
    {"name": "Тест Zig-Zag без мяча", "section": "Координация", "physical_quality": "Смена направления", "unit": "сек", "weight": 0.30},
    # Дриблинг
    {"name": "Скоростной дриблинг", "section": "Дриблинг", "physical_quality": "Дриблинг на скорости", "unit": "сек", "weight": 0.30},
    {"name": "Введение 15м удобной ногой", "section": "Дриблинг", "physical_quality": "Качество ведения", "unit": "сек", "weight": 0.25},
    {"name": "Введение 15м неудобной ногой", "section": "Дриблинг", "physical_quality": "Качество ведения", "unit": "сек", "weight": 0.20},
    {"name": "Тест Zig-Zag с мячом", "section": "Дриблинг", "physical_quality": "Дриблинг со сменой направления", "unit": "сек", "weight": 0.25},
    # Техника
    {"name": "Жонглирование", "section": "Техника", "physical_quality": "Жонглирование", "unit": "кол-во", "weight": 0.15},
    {"name": "Серия передач удобной ногой", "section": "Техника", "physical_quality": "Короткие передачи", "unit": "кол-во", "weight": 0.15},
    {"name": "Серия передач неудобной ногой", "section": "Техника", "physical_quality": "Короткие передачи", "unit": "кол-во", "weight": 0.10},
    {"name": "Исполнение финтов", "section": "Техника", "physical_quality": "Финты", "unit": "баллы", "weight": 0.20},
    {"name": "Чувство мяча (Смарт-арена)", "section": "Техника", "physical_quality": "Когнитивная обработка мяча", "unit": "кол-во", "weight": 0.15},
    {"name": "Контроль мяча", "section": "Техника", "physical_quality": "Когнитивный контроль мяча", "unit": "сек", "weight": 0.15},
    # Удары
    {"name": "Точность удара с места", "section": "Удары", "physical_quality": "Точность удара", "unit": "баллы", "weight": 0.25},
    {"name": "Сила удара удобной ногой", "section": "Удары", "physical_quality": "Сила удара", "unit": "км/ч", "weight": 0.30},
    {"name": "Сила удара неудобной ногой", "section": "Удары", "physical_quality": "Сила удара", "unit": "км/ч", "weight": 0.20},
    {"name": "Дальний и точный удар", "section": "Удары", "physical_quality": "Дальность и точность", "unit": "м", "weight": 0.25},
]

# Базовые диапазоны для генерации значений в зависимости от возраста и пола
# Структура: {age: {"male": (min, max), "female": (min, max)}}
# Для тестов, где "меньше лучше" (время, сек) – генерируем значения, уменьшающиеся с возрастом.
# Для остальных – увеличивающиеся.
def get_test_range(test_name, age, gender):
    """Возвращает кортеж (min, max) для реалистичного значения теста."""
    # Приблизительные средние для U9 (возраст 9 лет)
    base = {
        "Отжимания": (5, 25),
        "Лесенка (лево-право)": (25, 45),  # сек
        "Прыжок в длину": (120, 190),       # см
        "Бросок мяча из-за головы": (4, 9), # м
        "Бег 10м со старта": (2.6, 3.5),    # сек
        "Бег 15м с хода": (2.7, 3.4),       # сек
        "Челнок 10х9х9х10м": (10.0, 13.5),  # сек
        "Тест на реакцию": (0.2, 0.4),      # сек
        "Наклон на скамье": (2, 15),         # см
        "Тест Zig-Zag без мяча": (15, 22),  # сек
        "Скоростной дриблинг": (16, 22),    # сек
        "Введение 15м удобной ногой": (4.5, 7.5), # сек
        "Введение 15м неудобной ногой": (5.5, 9.0), # сек
        "Тест Zig-Zag с мячом": (22, 30),   # сек
        "Жонглирование": (5, 35),            # кол-во
        "Серия передач удобной ногой": (15, 35), # кол-во
        "Серия передач неудобной ногой": (10, 25), # кол-во
        "Исполнение финтов": (2, 10),        # баллы
        "Чувство мяча (Смарт-арена)": (5, 20), # кол-во
        "Контроль мяча": (0.5, 1.5),         # сек
        "Точность удара с места": (5, 20),   # баллы
        "Сила удара удобной ногой": (40, 70), # км/ч
        "Сила удара неудобной ногой": (30, 55), # км/ч
        "Дальний и точный удар": (10, 25),   # м
    }
    if test_name not in base:
        return (0, 10)  # fallback
    low, high = base[test_name]
    # Корректировка по возрасту: добавляем/убавляем в зависимости от типа
    # Возраст от 6 до 14
    age_factor = age - 9  # от -3 до +5
    # Для тестов "меньше лучше" (сек, время) – уменьшаем с возрастом
    if any(unit in test_name for unit in ["Бег", "Челнок", "Лесенка", "Zig-Zag", "реакцию", "Контроль мяча", "Введение"]):
        # возрастной коэффициент: чем старше, тем меньше время
        low = max(0.5, low - 0.3 * age_factor)
        high = max(1.0, high - 0.2 * age_factor)
    else:
        # остальные – увеличиваются с возрастом
        low = low + 1.5 * age_factor
        high = high + 2.0 * age_factor
    # Пол: девочки могут иметь чуть меньшие показатели в силовых
    if gender == "female" and test_name in ["Отжимания", "Прыжок в длину", "Бросок мяча", "Сила удара"]:
        low = low * 0.85
        high = high * 0.90
    # Округляем до разумных значений
    low = max(0.1, round(low, 1))
    high = max(low + 0.1, round(high, 1))
    return (low, high)

def generate_value(test_name, age, gender):
    """Генерирует случайное значение для теста."""
    low, high = get_test_range(test_name, age, gender)
    if test_name in ["Отжимания", "Прыжок в длину", "Бросок мяча", "Жонглирование", "Серия передач", "Точность удара", "Сила удара", "Дальний и точный удар", "Чувство мяча", "Исполнение финтов"]:
        # целые числа
        return random.randint(int(low), int(high))
    else:
        # дробные
        return round(random.uniform(low, high), 2)

def generate_anthropometry(age, gender):
    """Генерирует рост, вес, окружность груди для возраста и пола."""
    if gender == "male":
        height_mean = 110 + 5*age  # примерно
        weight_mean = 20 + 3*age
        chest_mean = 55 + 2*age
    else:
        height_mean = 108 + 4.5*age
        weight_mean = 19 + 2.8*age
        chest_mean = 54 + 2*age
    # Разброс
    height = random.randint(int(height_mean*0.9), int(height_mean*1.1))
    weight = round(random.uniform(weight_mean*0.8, weight_mean*1.2), 1)
    chest = random.randint(int(chest_mean*0.9), int(chest_mean*1.1))
    return height, weight, chest

# ========== ОСНОВНЫЕ ФУНКЦИИ ЗАПОЛНЕНИЯ ==========
def create_clubs(token):
    """Создаёт клубы, если их нет."""
    headers = get_headers(token)
    existing = safe_get(f"{BASE_URL}{API_PREFIX}/clubs?size=100", headers=headers)
    existing_names = {c["name"] for c in existing.get("items", [])} if existing else set()
    created = []
    for name in CLUB_NAMES:
        if name in existing_names:
            print(f"Клуб '{name}' уже существует.")
            continue
        result = safe_post(f"{BASE_URL}{API_PREFIX}/clubs/", {"name": name}, headers=headers)
        if result:
            created.append(result)
            print(f"Клуб создан: {name} (id={result['id']})")
    return created

def create_tests(token):
    """Создаёт тесты, если их нет."""
    headers = get_headers(token)
    existing = safe_get(f"{BASE_URL}{API_PREFIX}/tests?size=100", headers=headers)
    existing_names = {t["name"] for t in existing.get("items", [])} if existing else set()
    created = []
    for spec in TESTS_SPEC:
        if spec["name"] in existing_names:
            print(f"Тест '{spec['name']}' уже существует.")
            continue
        result = safe_post(f"{BASE_URL}{API_PREFIX}/tests/", spec, headers=headers)
        if result:
            created.append(result)
            print(f"Тест создан: {spec['name']} (id={result['id']})")
    return created

def create_players(token, clubs):
    """Создаёт игроков с реалистичными данными."""
    headers = get_headers(token)
    # Получаем существующих игроков, чтобы не дублировать
    existing_players = safe_get(f"{BASE_URL}{API_PREFIX}/players?size=200", headers=headers)
    existing_names = set()
    if existing_players:
        for p in existing_players.get("items", []):
            existing_names.add((p["first_name"], p["last_name"]))
    created = []
    # Генерируем игроков разного возраста и пола
    for i in range(NUM_PLAYERS):
        # Определяем пол
        gender = random.choice(["male", "female"])
        first_name = random.choice(FIRST_NAMES_MALE if gender == "male" else FIRST_NAMES_FEMALE)
        last_name = random.choice(LAST_NAMES)
        if (first_name, last_name) in existing_names:
            continue
        # Возраст от 6 до 14
        age = random.randint(6, 14)
        birth_year = date.today().year - age
        birth_month = random.randint(1, 12)
        birth_day = random.randint(1, 28)
        birth_date = date(birth_year, birth_month, birth_day)
        foot = random.choice(["left", "right"])
        club = random.choice(clubs) if clubs else None
        club_id = club["id"] if club else None
        photo_url = f"https://randomuser.me/api/portraits/{gender}/{random.randint(0, 99)}.jpg"
        player_data = {
            "first_name": first_name,
            "last_name": last_name,
            "birth_date": birth_date.isoformat(),
            "gender": gender,
            "preferred_foot": foot,
            "club_id": club_id,
            "photo_url": photo_url,
        }
        result = safe_post(f"{BASE_URL}{API_PREFIX}/players/", player_data, headers=headers)
        if result:
            created.append(result)
            print(f"Игрок создан: {first_name} {last_name} (id={result['id']})")
        time.sleep(0.1)
    return created

def create_anthropometry(token, players):
    """Создаёт записи антропометрии для каждого игрока на несколько дат."""
    headers = get_headers(token)
    created = []
    # Для каждого игрока сделаем 2-3 замера с разными датами
    for player in players:
        # Количество замеров: 1-3
        num_measurements = random.randint(1, 3)
        for _ in range(num_measurements):
            # Дата замера: от 6 месяцев назад до сегодня
            days_ago = random.randint(0, 180)
            test_date = date.today() - timedelta(days=days_ago)
            age = date.today().year - player["birth_date"].year
            # Корректируем возраст на момент замера
            # (упрощённо)
            height, weight, chest = generate_anthropometry(age, player["gender"])
            anthro_data = {
                "player_id": player["id"],
                "test_date": test_date.isoformat(),
                "height": height,
                "weight": weight,
                "chest_circumference": chest,
            }
            # Антропометрия - отдельный эндпоинт? В роутерах нет, но в модели есть. Добавим прямой POST? Пока не реализован эндпоинт, пропускаем.
            # Можно добавить через SQL напрямую, но по API нет. Оставим пока без, но учтём, что для рейтинга она нужна.
            print(f"Антропометрия для игрока {player['id']}: рост {height}, вес {weight}, грудь {chest} (не добавлена, т.к. нет эндпоинта)")
            # Временно пропускаем, т.к. эндпоинт отсутствует. Можно добавить позже через прямые SQL-запросы.
    return created

def create_results(token, players, tests):
    """Создаёт результаты тестов для каждого игрока на несколько дат."""
    headers = get_headers(token)
    created = []
    # Преобразуем тесты в словарь по имени
    test_by_name = {t["name"]: t for t in tests}
    # Для каждого игрока
    for player in players:
        # Определим возраст
        birth_date = date.fromisoformat(player["birth_date"])
        age = date.today().year - birth_date.year
        gender = player["gender"]
        # Количество дат тестирования: 1-2
        num_dates = random.randint(1, 2)
        for _ in range(num_dates):
            days_ago = random.randint(0, 120)
            test_date = date.today() - timedelta(days=days_ago)
            # Для каждого теста создаём результат
            for test_name, test_obj in test_by_name.items():
                # Пропускаем антропометрию - она отдельно
                if test_obj["section"] == "Антропометрия":
                    continue
                value = generate_value(test_name, age, gender)
                result_data = {
                    "player_id": player["id"],
                    "test_id": test_obj["id"],
                    "test_date": test_date.isoformat(),
                    "value": float(value),
                    "notes": None,
                }
                result = safe_post(f"{BASE_URL}{API_PREFIX}/results/", result_data, headers=headers)
                if result:
                    created.append(result)
                    # print(f"Результат добавлен: игрок {player['id']}, тест {test_name}, дата {test_date}, значение {value}")
                time.sleep(0.05)
    print(f"Создано {len(created)} результатов.")
    return created

def create_events(token):
    """Создаёт события."""
    headers = get_headers(token)
    existing = safe_get(f"{BASE_URL}{API_PREFIX}/events?size=100", headers=headers)
    existing_titles = {e["title"] for e in existing.get("items", [])} if existing else set()
    event_titles = [
        "Турнир 'Золотая осень'", "Мастер-класс от ветеранов", "Открытая тренировка",
        "Кубок Дружбы", "Зимний Кубок", "Весенний фестиваль", "День футбола",
        "Соревнования 'Юный чемпион'", "Футбольный лагерь"
    ]
    created = []
    for title in event_titles[:NUM_EVENTS]:
        if title in existing_titles:
            print(f"Событие '{title}' уже существует.")
            continue
        event_date = date.today() + timedelta(days=random.randint(5, 100))
        location = random.choice(["Москва", "СПб", "Казань", "Екатеринбург", "Сочи", "Краснодар"])
        participants = random.randint(20, 200)
        description = f"Описание события: {title}"
        event_data = {
            "title": title,
            "event_date": event_date.isoformat(),
            "location": location,
            "description": description,
            "participants_count": participants,
            "photo_url": f"https://picsum.photos/400/300?random={random.randint(1, 1000)}",
            "video_url": None,
        }
        result = safe_post(f"{BASE_URL}{API_PREFIX}/events/", event_data, headers=headers)
        if result:
            created.append(result)
            print(f"Событие создано: {title} (id={result['id']})")
    return created

def create_applications():
    """Создаёт заявки (публичный эндпоинт)."""
    created = []
    for _ in range(NUM_APPLICATIONS):
        parent_name = f"{random.choice(LAST_NAMES)} {random.choice(FIRST_NAMES_MALE)}"
        parent_phone = f"+7-9{random.randint(10,99)}-{random.randint(100,999)}-{random.randint(10,99)}-{random.randint(10,99)}"
        child_name = random.choice(FIRST_NAMES_MALE + FIRST_NAMES_FEMALE)
        child_age = random.randint(6, 14)
        club = random.choice(CLUB_NAMES) if random.random() > 0.3 else None
        status = random.choice(["new", "approved", "rejected"])
        app_data = {
            "parent_name": parent_name,
            "parent_phone": parent_phone,
            "child_name": child_name,
            "child_age": child_age,
            "club_name": club,
            "status": status,
        }
        result = safe_post(f"{BASE_URL}{API_PREFIX}/applications/", app_data, need_auth=False)
        if result:
            created.append(result)
            print(f"Заявка создана: {child_name} (id={result['id']})")
    return created

def create_feedback():
    """Создаёт сообщения обратной связи (публичный эндпоинт)."""
    messages = [
        "Отличный сервис!", "Хочу записаться на тестирование", "Когда следующие мероприятия?",
        "Спасибо за организацию", "Не могу найти результаты", "Подскажите контакты тренера",
        "Как проходит оценка?", "Есть ли скидки?", "Очень понравилось!", "Будет ли повтор?"
    ]
    created = []
    for _ in range(NUM_FEEDBACKS):
        name = random.choice(FIRST_NAMES_MALE + FIRST_NAMES_FEMALE)
        phone = f"+7-9{random.randint(10,99)}-{random.randint(100,999)}-{random.randint(10,99)}-{random.randint(10,99)}"
        email = f"{name.lower()}@example.com" if random.random() > 0.3 else None
        message = random.choice(messages)
        status = random.choice(["new", "read", "replied"])
        fb_data = {
            "name": name,
            "phone": phone,
            "email": email,
            "message": message,
            "status": status,
        }
        result = safe_post(f"{BASE_URL}{API_PREFIX}/feedback/", fb_data, need_auth=False)
        if result:
            created.append(result)
            print(f"Сообщение создано: от {name} (id={result['id']})")
    return created

def create_users(token):
    """Создаёт пользователей-операторов (требуется admin)."""
    headers = get_headers(token)
    existing = safe_get(f"{BASE_URL}{API_PREFIX}/user?page=1&size=50", headers=headers)
    existing_usernames = {u["username"] for u in existing.get("items", [])} if existing else set()
    user_data = [
        {"username": "operator1", "password": "pass123", "role": "operator"},
        {"username": "operator2", "password": "pass456", "role": "operator"},
    ]
    created = []
    for ud in user_data[:NUM_USERS]:
        if ud["username"] in existing_usernames:
            print(f"Пользователь {ud['username']} уже существует.")
            continue
        result = safe_post(f"{BASE_URL}{API_PREFIX}/user", ud, headers=headers)
        if result:
            created.append(result)
            print(f"Пользователь создан: {ud['username']} (id={result['id']})")
    return created

# ========== ГЛАВНАЯ ФУНКЦИЯ ==========
def main():
    print("Получение токена администратора...")
    try:
        token = get_token()
        print("Токен получен.")
    except Exception as e:
        print(f"Ошибка авторизации: {e}")
        print("Убедитесь, что сервер запущен и администратор существует (Test/123).")
        sys.exit(1)

    print("\n=== Создание клубов ===")
    clubs = create_clubs(token)
    print("\n=== Создание тестов ===")
    tests = create_tests(token)
    print("\n=== Создание игроков ===")
    players = create_players(token, clubs)
    print("\n=== Создание антропометрии (пропущено, нет эндпоинта) ===")
    # anthropometry = create_anthropometry(token, players)  # временно закомментировано
    print("\n=== Создание результатов ===")
    results = create_results(token, players, tests)
    print("\n=== Создание событий ===")
    events = create_events(token)
    print("\n=== Создание заявок ===")
    apps = create_applications()
    print("\n=== Создание обратной связи ===")
    feedbacks = create_feedback()
    print("\n=== Создание пользователей ===")
    users = create_users(token)

    print("\n=== ИТОГО ===")
    print(f"Клубов: {len(clubs)}")
    print(f"Тестов: {len(tests)}")
    print(f"Игроков: {len(players)}")
    print(f"Результатов: {len(results)}")
    print(f"Событий: {len(events)}")
    print(f"Заявок: {len(apps)}")
    print(f"Сообщений обратной связи: {len(feedbacks)}")
    print(f"Пользователей (новых): {len(users)}")
    print("\nТестовые данные успешно добавлены через API!")

if __name__ == "__main__":
    main()