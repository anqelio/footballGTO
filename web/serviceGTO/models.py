from django.db import models


class Club(models.Model):
    name = models.CharField(max_length=100, unique=True, verbose_name='Название')

    class Meta:
        db_table = 'clubs'
        managed = False
        verbose_name = 'Клуб'
        verbose_name_plural = 'Клубы'

    def __str__(self):
        return self.name


class Player(models.Model):
    GENDER_CHOICES = [
        ('male', 'Мужской'),
        ('female', 'Женский'),
    ]
    FOOT_CHOICES = [
        ('left', 'Левая'),
        ('right', 'Правая'),
    ]

    first_name = models.CharField(max_length=50, verbose_name='Имя')
    last_name = models.CharField(max_length=50, verbose_name='Фамилия')
    birth_date = models.DateField(verbose_name='Дата рождения')
    gender = models.CharField(
        max_length=10, choices=GENDER_CHOICES,
        blank=True, null=True, verbose_name='Пол',
    )
    preferred_foot = models.CharField(
        max_length=10, choices=FOOT_CHOICES,
        blank=True, null=True, verbose_name='Рабочая нога',
    )
    club = models.ForeignKey(
        Club, on_delete=models.SET_NULL, null=True, blank=True,
        db_column='club_id', verbose_name='Клуб',
    )
    created_at = models.DateTimeField(
        auto_now_add=True, blank=True, null=True, verbose_name='Создан',
    )
    photo_url = models.CharField(
        max_length=500, blank=True, null=True, verbose_name='Фото (URL)',
    )

    class Meta:
        db_table = 'players'
        managed = False
        verbose_name = 'Игрок'
        verbose_name_plural = 'Игроки'
        indexes = [
            models.Index(fields=['birth_date']),
            models.Index(fields=['club']),
        ]

    def __str__(self):
        return f"{self.first_name} {self.last_name}"


class Test(models.Model):
    name = models.CharField(max_length=100, unique=True, verbose_name='Название')
    section = models.CharField(max_length=50, verbose_name='Раздел')
    physical_quality = models.CharField(
        max_length=100, blank=True, null=True,
        verbose_name='Физическое качество',
    )
    unit = models.CharField(
        max_length=20, blank=True, null=True,
        verbose_name='Единица измерения',
    )
    weight = models.DecimalField(
        max_digits=5, decimal_places=3, default=0.0, verbose_name='Вес',
    )

    class Meta:
        db_table = 'tests'
        managed = False
        verbose_name = 'Тест'
        verbose_name_plural = 'Тесты'

    def __str__(self):
        return self.name


class Result(models.Model):
    player = models.ForeignKey(
        Player, on_delete=models.CASCADE,
        db_column='player_id', verbose_name='Игрок',
    )
    test = models.ForeignKey(
        Test, on_delete=models.CASCADE,
        db_column='test_id', verbose_name='Тест',
    )
    test_date = models.DateField(verbose_name='Дата теста')
    value = models.DecimalField(
        max_digits=10, decimal_places=3, verbose_name='Результат',
    )
    notes = models.TextField(blank=True, null=True, verbose_name='Примечания')

    class Meta:
        db_table = 'results'
        managed = False
        verbose_name = 'Результат'
        verbose_name_plural = 'Результаты'
        indexes = [
            models.Index(fields=['player', 'test_date']),
            models.Index(fields=['test']),
        ]

    def __str__(self):
        return f"{self.player} – {self.test} – {self.value}"


class Event(models.Model):
    title = models.CharField(max_length=200, verbose_name='Название')
    event_date = models.DateField(verbose_name='Дата')
    location = models.CharField(
        max_length=200, blank=True, null=True, verbose_name='Место',
    )
    description = models.TextField(
        blank=True, null=True, verbose_name='Описание',
    )
    participants_count = models.IntegerField(
        blank=True, null=True, verbose_name='Кол-во участников',
    )
    photo_url = models.TextField(
        blank=True, null=True, verbose_name='Фото (URL)',
    )
    video_url = models.TextField(
        blank=True, null=True, verbose_name='Видео (URL)',
    )

    class Meta:
        db_table = 'events'
        managed = False
        verbose_name = 'Мероприятие'
        verbose_name_plural = 'Мероприятия'
        indexes = [
            models.Index(fields=['event_date']),
        ]

    def __str__(self):
        return self.title


class Application(models.Model):
    STATUS_CHOICES = [
        ('new', 'Новая'),
        ('processed', 'Обработана'),
        ('canceled', 'Отменена'),
    ]
    parent_name = models.CharField(max_length=100, verbose_name='ФИО родителя')
    parent_phone = models.CharField(max_length=20, verbose_name='Телефон')
    child_name = models.CharField(max_length=100, verbose_name='Имя ребёнка')
    child_age = models.IntegerField(
        blank=True, null=True, verbose_name='Возраст ребёнка',
    )
    club_name = models.CharField(
        max_length=100, blank=True, null=True, verbose_name='Клуб',
    )
    created_at = models.DateTimeField(
        auto_now_add=True, blank=True, null=True, verbose_name='Создана',
    )
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES,
        default='new', verbose_name='Статус',
    )

    class Meta:
        db_table = 'applications'
        managed = False
        verbose_name = 'Заявка'
        verbose_name_plural = 'Заявки'

    def __str__(self):
        return f"{self.parent_name} – {self.child_name}"


class Feedback(models.Model):
    STATUS_CHOICES = [
        ('new', 'Новый'),
        ('processed', 'Обработан'),
    ]

    name = models.CharField(max_length=100, verbose_name='Имя')
    phone = models.CharField(max_length=20, verbose_name='Телефон')
    email = models.CharField(
        max_length=100, blank=True, null=True, verbose_name='Email',
    )
    message = models.TextField(verbose_name='Сообщение')
    created_at = models.DateTimeField(
        auto_now_add=True, verbose_name='Создан',
    )
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES,
        default='new', verbose_name='Статус',
    )

    class Meta:
        db_table = 'feedback'
        managed = False
        verbose_name = 'Отзыв'
        verbose_name_plural = 'Отзывы'

    def __str__(self):
        return f"{self.name} – {self.created_at}"
    

class Anthropometry(models.Model):
    player = models.ForeignKey(
        Player, on_delete=models.CASCADE,
        db_column='player_id', verbose_name='Игрок'
    )
    test_date = models.DateField(verbose_name='Дата теста')
    height = models.FloatField(verbose_name='Рост, см')
    weight = models.FloatField(verbose_name='Вес, кг')
    chest_circumference = models.FloatField(verbose_name='ОГ на выдохе, см')

    class Meta:
        db_table = 'anthropometry'
        managed = False
        verbose_name = 'Антропометрия'
        verbose_name_plural = 'Антропометрия'