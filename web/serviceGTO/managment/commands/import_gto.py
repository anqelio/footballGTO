import openpyxl
from datetime import datetime, date
from decimal import Decimal, InvalidOperation
from django.core.management.base import BaseCommand
from django.db import transaction
from serviceGTO.models import Club, Player, Test, Result, Anthropometry

# (col_index, test_name, section, unit, weight)
TEST_COLUMNS = [
    (11, 'Отжимания', 'Атлетизм', 'кол-во', 0.3),
    (12, 'Лесенка (лево-право)', 'Атлетизм', 'сек', 0.25),
    (13, 'Прыжок в высоту', 'Атлетизм', 'см', 0.25),
    (14, 'Бросок мяча из-за головы', 'Атлетизм', 'м', 0.2),
    (15, 'Бег 10м со старта', 'Быстрота', 'сек', 0.3),
    (16, 'Бег 15м с ходу', 'Быстрота', 'сек', 0.3),
    (17, 'Челнок 10х9х9х10', 'Быстрота', 'сек', 0.3),
    (18, 'Тест на реакцию', 'Ловкость', 'сек', 0.2),
    (19, 'Наклон на скамье', 'Ловкость', 'см', 0.2),
    (20, 'Тест Zig-Zag без мяча', 'Ловкость', 'сек', 0.3),
    (21, 'Скоростной дриблинг', 'Дриблинг', 'сек', 0.3),
    (22, 'Введение 15м удобной ногой', 'Дриблинг', 'сек', 0.25),
    (23, 'Кол-во касаний удобной ногой', 'Дриблинг', 'кол-во', 0.0),
    (24, 'Качество ведения удобной', 'Дриблинг', 'сек', 0.0),
    (25, 'Введение 15м неудобной ногой', 'Дриблинг', 'сек', 0.2),
    (26, 'Кол-во касаний неудобной ногой', 'Дриблинг', 'кол-во', 0.0),
    (27, 'Качество ведения неудобной', 'Дриблинг', 'сек', 0.0),
    (28, 'Тест Zig-Zag с мячом', 'Дриблинг', 'сек', 0.25),
    (29, 'Исполнение финтов', 'Техника', 'баллы', 0.2),
    (30, 'Жонглирование за 1 минуту', 'Техника', 'кол-во', 0.15),
    (31, 'Серия передач удобной ногой', 'Техника', 'кол-во', 0.15),
    (32, 'Серия передач неудобной ногой', 'Техника', 'кол-во', 0.1),
    (33, 'Контроль мяча', 'Техника', 'сек', 0.15),
    (34, 'Точность удара с места', 'Удары', 'кол-во', 0.25),
    (35, 'Сила удара удобной ногой', 'Удары', 'км/ч', 0.3),
    (36, 'Сила удара неудобной ногой', 'Удары', 'км/ч', 0.2),
    (37, 'Длина 1 удара', 'Удары', 'м', 0.0),
    (38, 'Ширина 1 удара', 'Удары', 'м', 0.0),
    (39, 'Длина 2 удара', 'Удары', 'м', 0.0),
    (40, 'Ширина 2 удара', 'Удары', 'м', 0.0),
    (41, 'Длина 3 удара', 'Удары', 'м', 0.0),
    (42, 'Ширина 3 удара', 'Удары', 'м', 0.0),
    (43, 'Дальний и точный удар', 'Удары', 'м', 0.25),
]

def parse_date(val):
    if isinstance(val, datetime):
        return val.date()
    if isinstance(val, date):
        return val
    if isinstance(val, str):
        val = val.strip()
        for fmt in ('%Y-%m-%d', '%d.%m.%Y', '%d.%m.%y', '%d.%m %Y'):
            try:
                return datetime.strptime(val, fmt).date()
            except ValueError:
                pass
    return None

def parse_decimal(val):
    if val is None:
        return None
    if isinstance(val, (int, float, Decimal)):
        return Decimal(str(val))
    if isinstance(val, str):
        val = val.strip().replace(',', '.')
        if val in ('', '-', 'Формула нужна'):
            return None
        try:
            return Decimal(val)
        except InvalidOperation:
            return None
    return None

class Command(BaseCommand):
    help = 'Импорт данных из листа ПОКАЗАНИЯ Excel в БД'

    def add_arguments(self, parser):
        parser.add_argument('--file', type=str, required=True, help='Путь к xlsx')
        parser.add_argument('--clear', action='store_true', help='Удалить старые данные')

    @transaction.atomic
    def handle(self, *args, **options):
        if options['clear']:
            self.stdout.write('Удаляем старые данные...')
            Result.objects.all().delete()
            Anthropometry.objects.all().delete()
            Player.objects.all().delete()
            Club.objects.all().delete()
            Test.objects.all().delete()
            self.stdout.write('Старые данные удалены.')

        wb = openpyxl.load_workbook(options['file'], data_only=True)
        ws = wb['ПОКАЗАНИЯ']

        # Создаём/обновляем тесты
        for _, name, section, unit, weight in TEST_COLUMNS:
            if name:
                Test.objects.update_or_create(
                    name=name,
                    defaults={'section': section, 'unit': unit, 'weight': weight}
                )
        self.stdout.write('Тесты созданы/обновлены.')

        row_count = 0
        for row in ws.iter_rows(min_row=3, values_only=True):
            test_date = parse_date(row[0])
            full_name = row[1]
            if not test_date or not full_name:
                continue

            birth_date = parse_date(row[2])
            if not birth_date:
                continue

            club_name = row[4]
            height = parse_decimal(row[5])
            weight = parse_decimal(row[6])
            chest = parse_decimal(row[7])

            parts = str(full_name).strip().split()
            last_name = parts[0] if parts else ''
            first_name = parts[1] if len(parts) > 1 else ''

            club = None
            if club_name:
                club, _ = Club.objects.get_or_create(name=str(club_name).strip())

            player, created = Player.objects.get_or_create(
                first_name=first_name,
                last_name=last_name,
                birth_date=birth_date,
                defaults={'club': club, 'gender': 'male'}
            )
            if not created and club and player.club != club:
                player.club = club
                player.save()

            if height and weight and chest:
                Anthropometry.objects.update_or_create(
                    player=player,
                    test_date=test_date,
                    defaults={
                        'height': float(height),
                        'weight': float(weight),
                        'chest_circumference': float(chest)
                    }
                )

            # Основные результаты
            for col_idx, test_name, section, unit, weight in TEST_COLUMNS:
                if not test_name:
                    continue
                val = parse_decimal(row[col_idx - 1])
                if val is None:
                    continue
                test = Test.objects.get(name=test_name)
                Result.objects.update_or_create(
                    player=player,
                    test=test,
                    test_date=test_date,
                    defaults={'value': val}
                )

            # Досчёт "Качество ведения удобной" = V / W
            if row[23] is None:  # X пусто
                v = parse_decimal(row[21])
                w = parse_decimal(row[22])
                if v and w and w != 0:
                    quality = v / w
                    test = Test.objects.get(name='Качество ведения удобной')
                    Result.objects.update_or_create(
                        player=player, test=test, test_date=test_date,
                        defaults={'value': quality}
                    )

            # Досчёт "Качество ведения неудобной" = Y / Z
            if row[26] is None:  # AA пусто
                y = parse_decimal(row[24])
                z = parse_decimal(row[25])
                if y and z and z != 0:
                    quality = y / z
                    test = Test.objects.get(name='Качество ведения неудобной')
                    Result.objects.update_or_create(
                        player=player, test=test, test_date=test_date,
                        defaults={'value': quality}
                    )

            # Досчёт "Дальний и точный удар" = среднее из длин AK, AM, AO
            if row[42] is None:  # AQ пусто
                lengths = [parse_decimal(row[i-1]) for i in (37, 39, 41)]
                lengths = [l for l in lengths if l is not None]
                if lengths:
                    avg = sum(lengths) / len(lengths)
                    test = Test.objects.get(name='Дальний и точный удар')
                    Result.objects.update_or_create(
                        player=player, test=test, test_date=test_date,
                        defaults={'value': avg}
                    )

            row_count += 1

        self.stdout.write(self.style.SUCCESS(f'Импортировано строк: {row_count}'))