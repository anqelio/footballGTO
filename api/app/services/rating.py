from sqlmodel import Session, select, func, and_
from datetime import date
from typing import List, Tuple, Optional, Dict
from decimal import Decimal
from app.models.models import Player, Test, Result, Anthropometry

def calculate_age(birth_date: date, on_date: date = None) -> int:
    if on_date is None:
        on_date = date.today()
    return on_date.year - birth_date.year - ((on_date.month, on_date.day) < (birth_date.month, birth_date.day))

def get_latest_results_for_group(
    session: Session,
    test_ids: List[int],
    gender: Optional[str],
    min_age: int,
    max_age: int,
    on_date: date = None
) -> Dict[int, List[Decimal]]:
    """
    Возвращает словарь {test_id: [values]} – список последних значений
    для каждого теста, по одному от каждого игрока в группе.
    """
    if on_date is None:
        on_date = date.today()

    subq = (
        select(
            Result.player_id,
            Result.test_id,
            func.max(Result.test_date).label("max_date")
        )
        .join(Player, Result.player_id == Player.id)
        .where(Result.test_id.in_(test_ids))
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
            Result.test_date == subq.c.max_date
        ))
    )
    rows = session.exec(stmt).all()
    result_dict = {}
    for test_id, value in rows:
        result_dict.setdefault(test_id, []).append(value)
    return result_dict

def get_latest_anthropometry_for_group(
    session: Session,
    gender: Optional[str],
    min_age: int,
    max_age: int,
    on_date: date = None
) -> Dict[str, List[float]]:
    """
    Возвращает словарь с полями 'height', 'weight', 'chest' – списки последних
    значений антропометрии для каждого игрока в группе.
    """
    if on_date is None:
        on_date = date.today()

    subq = (
        select(
            Anthropometry.player_id,
            func.max(Anthropometry.test_date).label("max_date")
        )
        .join(Player, Anthropometry.player_id == Player.id)
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
            Anthropometry.chest_circumference
        )
        .join(subq, and_(
            Anthropometry.player_id == subq.c.player_id,
            Anthropometry.test_date == subq.c.max_date
        ))
    )
    rows = session.exec(stmt).all()
    return {
        'height': [r[0] for r in rows],
        'weight': [r[1] for r in rows],
        'chest': [r[2] for r in rows],
    }

def compute_player_ratings(
    session: Session,
    player_id: int,
    age_group: Optional[Tuple[int, int]] = None,
    gender: Optional[str] = None,
    as_of_date: date = None
) -> Dict:
    """
    Рассчитывает рейтинг игрока по всем разделам (включая антропометрию)
    и общий рейтинг (без антропометрии).
    """
    if as_of_date is None:
        as_of_date = date.today()

    player = session.get(Player, player_id)
    if not player:
        return {}

    if age_group is None:
        age = calculate_age(player.birth_date, as_of_date)
        min_age = max_age = age
        gender = player.gender
    else:
        min_age, max_age = age_group

    tests = session.exec(select(Test)).all()

    section_map = {
        'Атлетизм': 'Атлетизм',
        'Атлетизм new': 'Атлетизм',
        'Быстрота': 'Быстрота',
        'Координация': 'Координация',
        'Дриблинг с мячом': 'Дриблинг',
        'Дриблинг': 'Дриблинг',
        'Техника': 'Техника',
        'Техника new': 'Техника',
        'Удары': 'Удары',
    }

    sections = {}
    for t in tests:
        std_section = section_map.get(t.section, t.section)
        sections.setdefault(std_section, []).append(t)

    # Последние результаты игрока
    sub = (
        select(Result.test_id, func.max(Result.test_date).label("max_date"))
        .where(Result.player_id == player_id)
        .group_by(Result.test_id)
        .subquery()
    )
    player_results = session.exec(
        select(Result).join(sub, (Result.test_id == sub.c.test_id) & (Result.test_date == sub.c.max_date))
        .where(Result.player_id == player_id)
    ).all()
    player_results_dict = {r.test_id: r.value for r in player_results}

    # Антропометрия игрока
    anthro = session.exec(
        select(Anthropometry)
        .where(Anthropometry.player_id == player_id)
        .order_by(Anthropometry.test_date.desc())
    ).first()
    player_anthro = {}
    if anthro:
        player_anthro = {
            'height': anthro.height,
            'weight': anthro.weight,
            'chest': anthro.chest_circumference,
        }

    category_scores = {}

    for section_name, test_list in sections.items():
        test_ids = [t.id for t in test_list]
        group_values_by_test = get_latest_results_for_group(
            session, test_ids, gender, min_age, max_age, as_of_date
        )

        section_score = Decimal(0)
        total_weight = Decimal(0)
        for test in test_list:
            player_val = player_results_dict.get(test.id)
            if player_val is None:
                continue
            group_vals = group_values_by_test.get(test.id, [])
            if not group_vals:
                continue

            is_lower_better = test.unit and ('сек' in test.unit.lower() or 'sec' in test.unit.lower())
            if is_lower_better:
                min_val = min(group_vals)
                if min_val == 0:
                    score = Decimal(0)
                else:
                    score = Decimal(100) * min_val / player_val
            else:
                max_val = max(group_vals)
                if max_val == 0:
                    score = Decimal(0)
                else:
                    score = Decimal(100) * player_val / max_val

            weighted = score * test.weight
            section_score += weighted
            total_weight += test.weight

        if total_weight > 0:
            category_scores[section_name] = float(section_score / total_weight)

    # Антропометрия
    anthro_scores = {}
    if player_anthro:
        group_anthro = get_latest_anthropometry_for_group(
            session, gender, min_age, max_age, as_of_date
        )

        if group_anthro['height'] and group_anthro['weight'] and group_anthro['chest']:
            height_m = player_anthro['height'] / 100
            player_bmi = player_anthro['weight'] / (height_m * height_m)
            player_ikt = player_anthro['height'] - (player_anthro['weight'] + player_anthro['chest'])

            group_bmi = []
            group_ikt = []
            for h, w, c in zip(group_anthro['height'], group_anthro['weight'], group_anthro['chest']):
                h_m = h / 100
                if h_m > 0:
                    group_bmi.append(w / (h_m * h_m))
                group_ikt.append(h - (w + c))

            if group_bmi:
                min_bmi = min(group_bmi)
                if min_bmi > 0:
                    bmi_score = Decimal(100) * min_bmi / player_bmi
                else:
                    bmi_score = Decimal(0)
            else:
                bmi_score = Decimal(0)

            if group_ikt:
                max_ikt = max(group_ikt)
                if max_ikt > 0:
                    ikt_score = Decimal(100) * player_ikt / max_ikt
                else:
                    ikt_score = Decimal(0)
            else:
                ikt_score = Decimal(0)

            weight_bmi = Decimal('0.6')
            weight_ikt = Decimal('0.4')
            total_anthro_weight = weight_bmi + weight_ikt
            anthro_total = bmi_score * weight_bmi + ikt_score * weight_ikt
            if total_anthro_weight > 0:
                anthro_scores['Антропометрия'] = float(anthro_total / total_anthro_weight)

    # Общий рейтинг
    section_weights = {
        'Координация': Decimal('0.17'),
        'Атлетизм': Decimal('0.12'),
        'Дриблинг': Decimal('0.22'),
        'Техника': Decimal('0.19'),
        'Быстрота': Decimal('0.15'),
        'Удары': Decimal('0.15'),
    }

    total_rating = Decimal(0)
    total_weight_sum = Decimal(0)
    for section, weight in section_weights.items():
        if section in category_scores:
            total_rating += Decimal(category_scores[section]) * weight
            total_weight_sum += weight

    if total_weight_sum > 0:
        total_rating = total_rating / total_weight_sum

    all_categories = {**category_scores, **anthro_scores}

    return {
        "category_ratings": all_categories,
        "total_rating": float(total_rating)
    }