from django.db import models

class Club(models.Model):
    name = models.CharField(max_length=100, unique=True)

    class Meta:
        db_table = 'clubs'
        managed = False   # таблица уже существует, Django не будет её создавать

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

    first_name = models.CharField(max_length=50)
    last_name = models.CharField(max_length=50)
    birth_date = models.DateField()
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES, blank=True, null=True)
    preferred_foot = models.CharField(max_length=10, choices=FOOT_CHOICES, blank=True, null=True)
    club = models.ForeignKey(Club, on_delete=models.SET_NULL, null=True, blank=True, db_column='club_id')
    created_at = models.DateTimeField(auto_now_add=True, blank=True, null=True)
    photo_url = models.CharField(max_length=500, blank=True, null=True)

    class Meta:
        db_table = 'players'
        managed = False
        indexes = [
            models.Index(fields=['birth_date']),
            models.Index(fields=['club']),
        ]

    def __str__(self):
        return f"{self.first_name} {self.last_name}"


class Test(models.Model):
    name = models.CharField(max_length=100, unique=True)
    section = models.CharField(max_length=50)
    physical_quality = models.CharField(max_length=100, blank=True, null=True)
    unit = models.CharField(max_length=20, blank=True, null=True)
    weight = models.DecimalField(max_digits=5, decimal_places=3, default=0.0)

    class Meta:
        db_table = 'tests'
        managed = False

    def __str__(self):
        return self.name


class Result(models.Model):
    player = models.ForeignKey(Player, on_delete=models.CASCADE, db_column='player_id')
    test = models.ForeignKey(Test, on_delete=models.CASCADE, db_column='test_id')
    test_date = models.DateField()
    value = models.DecimalField(max_digits=10, decimal_places=3)
    notes = models.TextField(blank=True, null=True)

    class Meta:
        db_table = 'results'
        managed = False
        indexes = [
            models.Index(fields=['player', 'test_date']),
            models.Index(fields=['test']),
        ]

    def __str__(self):
        return f"{self.player} – {self.test} – {self.value}"


class Event(models.Model):
    title = models.CharField(max_length=200)
    event_date = models.DateField()
    location = models.CharField(max_length=200, blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    participants_count = models.IntegerField(blank=True, null=True)
    photo_url = models.TextField(blank=True, null=True)
    video_url = models.TextField(blank=True, null=True)

    class Meta:
        db_table = 'events'
        managed = False
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
    parent_name = models.CharField(max_length=100)
    parent_phone = models.CharField(max_length=20)
    child_name = models.CharField(max_length=100)
    child_age = models.IntegerField(blank=True, null=True)
    club_name = models.CharField(max_length=100, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True, blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='new')

    class Meta:
        db_table = 'applications'
        managed = False

    def __str__(self):
        return f"{self.parent_name} – {self.child_name}"


class Feedback(models.Model):
    name = models.CharField(max_length=100)
    phone = models.CharField(max_length=20)
    email = models.CharField(max_length=100, blank=True, null=True)
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=20, default='new')
    # Добавляем поле is_read для совместимости с шаблоном (можно вычислять из status)
    is_read = models.BooleanField(default=False)

    class Meta:
        db_table = 'feedback'
        managed = False

    def __str__(self):
        return f"{self.name} – {self.created_at}"