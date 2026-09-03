def init_test_weights(session: Session):
    # Пример заполнения
    tests_data = [
        {"name": "Отжимания", "category": "Атлетизм", "unit": "раз", "better_direction": "more", "weight": 0.3},
        # ... все тесты из листа «Значимость теста в %»
    ]
    for t in tests_data:
        test = session.exec(select(Test).where(Test.name == t["name"])).first()
        if not test:
            test = Test(**t)
            session.add(test)
    # Веса категорий
    cat_weights = [
        {"category": "Атлетизм", "weight": 0.12},
        {"category": "Быстрота", "weight": 0.15},
        # ...
    ]
    for cw in cat_weights:
        obj = session.exec(select(CategoryWeight).where(CategoryWeight.category == cw["category"])).first()
        if not obj:
            obj = CategoryWeight(**cw)
            session.add(obj)
    session.commit()