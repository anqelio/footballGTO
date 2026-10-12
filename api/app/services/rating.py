# app/services/rating.py

from sqlmodel import Session, select, func, and_
from datetime import date
from typing import List, Tuple, Optional, Dict

from app.models.models import Player, Test, Result, Anthropometry


# ============================================================
# Константы / хелперы
# ============================================================

# Если название теста содержит эти слова, то меньше = лучше (время)
_LOWER_BETTER_KEYWORDS = (
    'бег', 'челнок', 'лесенка', 'zig-zag', 'зигзаг', 'zig',
    'реакц', 'дриблинг', 'ведение', 'введение',
)


def _is_lower_better(test: Test) -> bool:
    """True, если меньшее значение = лучше (время в секундах)."""
    unit = (test.unit or '').strip().lower()
    if unit in ('сек', 'с', 's', 'мин', 'min'):
        return True

    name = (test.name or '').lower()

    # Явные исключения: для этих тестов больше = лучше
    if any(k in name for k in ('прыжок', 'бросок', 'удар', 'жонглирование',
                                'отжимания', 'передач', 'касаний', 'финт')):
        return False

    return any(k in name for k in _LOWER_BETTER_KEYWORDS)


def _to_float(x) -> float:
    if x is None:
        return 0.0
    try:
        return float(x)
    except (TypeError, ValueError):
        return 0.0


def calculate_age(birth_date: date, on_date: Optional[date] = None) -> int:
    if on_date is None:
        on_date = date.today()
    return (on_date.year - birth_date.year
            - ((on_date.month, on_date.day) < (birth_date.month, birth_date.day)))


# ============================================================
# Получение «референсных» значений группы (возраст + пол)
# ============================================================

def get_latest_results_for_group(
    session: Session,
    test_ids: List[int],
    gender: Optional[str],
    min_age: int,
    max_age: int,
    on_date: Optional[date] = None,
) -> Dict[int, List[float]]:
    """
    Возвращает {test_id: [values]} — по одному последнему значению
    от каждого игрока группы для каждого теста.
    """
    if on_date is None:
        on_date = date.today()
    if not test_ids:
        return {}

    subq = (
        select(
            Result.player_id,
            Result.test_id,
            func.max(Result.test_date).label("max_date"),
        )
        .join(Player, Result.player_id == Player.id)
        .where(Result.test_id.in_(test_ids))
        .where(Result.test_date <= on_date)
    )
    if gender:
        subq = subq.where(Player.gender == gender)

    subq = subq.where(
        func.extract('year', func.age(on_date, Player.birth_date)).between(min_age, max_age)
    )

    subq = subq.group_by(Result.player_id, Result.test_id).subquery()

    stmt = (
        select(Result.test_id, Result.value)
        .join(subq, and_(
            Result.player_id == subq.c.player_id,
            Result.test_id == subq.c.test_id,
            Result.test_date == subq.c.max_date,
        ))
    )

    rows = session.exec(stmt).all()
    out: Dict[int, List[float]] = {}
    for test_id, value in rows:
        out.setdefault(test_id, []).append(value)
    return out


def get_latest_anthropometry_for_group(
    session: Session,
    gender: Optional[str],
    min_age: int,
    max_age: int,
    on_date: Optional[date] = None,
) -> Dict[str, List[float]]:
    """
    Возвращает {height: [...], weight: [...], chest: [...]} —
    по одному последнему значению на каждого игрока группы.
    """
    if on_date is None:
        on_date = date.today()

    subq = (
        select(
            Anthropometry.player_id,
            func.max(Anthropometry.test_date).label("max_date"),
        )
        .join(Player, Anthropometry.player_id == Player.id)
        .where(Anthropometry.test_date <= on_date)
    )
    if gender:
        subq = subq.where(Player.gender == gender)

    subq = subq.where(
        func.extract('year', func.age(on_date, Player.birth_date)).between(min_age, max_age)
    )
    subq = subq.group_by(Anthropometry.player_id).subquery()

    stmt = (
        select(
            Anthropometry.height,
            Anthropometry.weight,
            Anthropometry.chest_circumference,
        )
        .join(subq, and_(
            Anthropometry.player_id == subq.c.player_id,
            Anthropometry.test_date == subq.c.max_date,
        ))
    )

    rows = session.exec(stmt).all()
    return {
        'height': [r[0] for r in rows],
        'weight': [r[1] for r in rows],
        'chest':  [r[2] for r in rows],
    }


# ============================================================
# Веса разделов при расчёте общего рейтинга
# ============================================================

SECTION_WEIGHTS: Dict[str, float] = {
    'Координация': 0.17,
    'Атлетизм':    0.12,
    'Дриблинг':    0.22,
    'Техника':     0.19,
    'Быстрота':    0.15,
    'Удары':       0.15,
}


# ============================================================
# Основной расчёт
# ============================================================

def compute_player_ratings(
    session: Session,
    player_id: int,
    age_group: Optional[Tuple[int, int]] = None,
    gender: Optional[str] = None,
    as_of_date: Optional[date] = None,
) -> Dict:
    """
    Считает рейтинги игрока по разделам и общий рейтинг.

    Логика:
      * Для каждого теста берём последнее значение игрока (до as_of_date).
      * Для группы (пол + возраст) берём последнее значение каждого игрока.
      * Считаем score = 100 * player_value / max(group) — если больше = лучше,
        или score = 100 * min(group) / player_value — если меньше = лучше.
      * Умножаем score на вес теста, делим на сумму весов раздела.
      * Общий рейтинг = сумма(раздел * вес раздела) / сумма весов.
    """
    if as_of_date is None:
        as_of_date = date.today()

    player = session.get(Player, player_id)
    if not player:
        return {}

    # Определяем возрастную группу и пол
    if age_group is None:
        age = calculate_age(player.birth_date, as_of_date)
        min_age = max_age = age
        gender = player.gender or gender
    else:
        min_age, max_age = age_group

    tests = session.exec(select(Test)).all()

    # Маппинг «сырой раздел из БД» → «стандартный раздел рейтинга»
    section_map = {
        'Атлетизм':          'Атлетизм',
        'Атлетизм new':      'Атлетизм',
        'Быстрота':          'Быстрота',
        'Координация':       'Координация',
        'Ловкость':          'Координация',
        'Дриблинг с мячом':  'Дриблинг',
        'Дриблинг':          'Дриблинг',
        'Техника':           'Техника',
        'Техника new':       'Техника',
        'Удары':             'Удары',
        'Антропометрия':     'Антропометрия',
    }

    sections: Dict[str, List[Test]] = {}
    for t in tests:
        if t.section == 'Антропометрия':
            continue  # считаем отдельно
        std = section_map.get(t.section, t.section)
        sections.setdefault(std, []).append(t)

    # Последние результаты игрока по каждому тесту
    sub = (
        select(Result.test_id, func.max(Result.test_date).label("max_date"))
        .where(Result.player_id == player_id)
        .where(Result.test_date <= as_of_date)
        .group_by(Result.test_id)
        .subquery()
    )
    player_results = session.exec(
        select(Result)
        .join(sub, (Result.test_id == sub.c.test_id) & (Result.test_date == sub.c.max_date))
        .where(Result.player_id == player_id)
    ).all()
    player_results_dict: Dict[int, float] = {r.test_id: r.value for r in player_results}

    # Антропометрия игрока (последняя)
    anthro = session.exec(
        select(Anthropometry)
        .where(Anthropometry.player_id == player_id)
        .where(Anthropometry.test_date <= as_of_date)
        .order_by(Anthropometry.test_date.desc())
    ).first()

    category_scores: Dict[str, float] = {}

    # ---------- Разделы на основе Test/Result ----------
    for section_name, test_list in sections.items():
        group_values_by_test = get_latest_results_for_group(
            session,
            [t.id for t in test_list],
            gender,
            min_age,
            max_age,
            as_of_date,
        )

        section_score = 0.0
        total_weight = 0.0

        for test in test_list:
            pv_raw = player_results_dict.get(test.id)
            if pv_raw is None:
                continue

            pv = _to_float(pv_raw)
            if pv == 0:
                continue

            gv = [_to_float(v) for v in group_values_by_test.get(test.id, [])]
            gv = [v for v in gv if v != 0]
            if not gv:
                continue

            weight = _to_float(test.weight)
            if weight <= 0:
                continue

            if _is_lower_better(test):
                best = min(gv)
                score = (100.0 * best / pv) if pv > 0 else 0.0
            else:
                best = max(gv)
                score = (100.0 * pv / best) if best > 0 else 0.0

            # Ограничиваем 0..100 — защита от аномалий
            score = max(0.0, min(score, 100.0))

            section_score += score * weight
            total_weight += weight

        if total_weight > 0:
            category_scores[section_name] = section_score / total_weight

    # ---------- Антропометрия ----------
    if anthro:
        height = _to_float(anthro.height)
        weight = _to_float(anthro.weight)
        chest = _to_float(anthro.chest_circumference)

        if height > 0:
            group_anthro = get_latest_anthropometry_for_group(
                session, gender, min_age, max_age, as_of_date
            )

            # ИМТ = масса / рост_м^2
            height_m = height / 100.0
            player_bmi = weight / (height_m * height_m) if height_m > 0 else 0.0
            # ИКТ = рост - (масса + ОГ)
            player_ikt = height - (weight + chest)

            group_bmi: List[float] = []
            group_ikt: List[float] = []

            for h, w, c in zip(
                group_anthro['height'],
                group_anthro['weight'],
                group_anthro['chest'],
            ):
                h_f = _to_float(h)
                w_f = _to_float(w)
                c_f = _to_float(c)
                if h_f <= 0:
                    continue
                h_m = h_f / 100.0
                group_bmi.append(w_f / (h_m * h_m) if h_m > 0 else 0.0)
                group_ikt.append(h_f - (w_f + c_f))

            group_bmi = [v for v in group_bmi if v > 0]
            group_ikt = [v for v in group_ikt if v > 0]

            # ИМТ: меньше = лучше (в разумных пределах)
            bmi_score = 0.0
            if group_bmi and player_bmi > 0:
                bmi_score = min(100.0, 100.0 * min(group_bmi) / player_bmi)

            # ИКТ: больше = лучше
            ikt_score = 0.0
            if group_ikt and max(group_ikt) > 0:
                ikt_score = max(0.0, min(100.0, 100.0 * player_ikt / max(group_ikt)))

            category_scores['Антропометрия'] = bmi_score * 0.6 + ikt_score * 0.4

    # ---------- Общий рейтинг ----------
    total_rating = 0.0
    weight_sum = 0.0
    for section, weight in SECTION_WEIGHTS.items():
        if section in category_scores:
            total_rating += category_scores[section] * weight
            weight_sum += weight

    if weight_sum > 0:
        total_rating = total_rating / weight_sum

    return {
        "category_ratings": category_scores,
        "total_rating": float(total_rating),
    }