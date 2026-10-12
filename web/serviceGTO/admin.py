"""
Настройка административной панели «Футбольное ГТО».
Кастомный сайт с дашбордом + расширенные ModelAdmin
для удобной работы с игроками, результатами, заявками и т.д.
"""
from django.contrib.admin import (
    AdminSite, ModelAdmin, TabularInline, display, action,
)
from django.contrib.auth.models import User, Group
from django.contrib.auth.admin import UserAdmin, GroupAdmin
from django.db import models
from django.urls import reverse, NoReverseMatch
from django.utils.html import format_html
from datetime import datetime, timedelta
from .models import (
    Player, Result, Application, Event, Test, Club, Feedback,
)


# ============================================================
#  INLINE
# ============================================================
class ResultInline(TabularInline):
    """Результаты тестов прямо в карточке игрока."""
    model = Result
    extra = 0
    fields = ('test', 'test_date', 'value', 'notes')
    autocomplete_fields = ('test',)
    ordering = ('-test_date',)
    verbose_name = 'результат'
    verbose_name_plural = 'Результаты тестирования'
    show_change_link = True


# ============================================================
#  CLUB
# ============================================================
class ClubAdmin(ModelAdmin):
    list_display  = ('name', 'players_count')
    search_fields = ('name',)
    ordering      = ('name',)
    list_per_page = 30

    @display(description='Игроков')
    def players_count(self, obj):
        return Player.objects.filter(club=obj).count()


# ============================================================
#  PLAYER
# ============================================================
class PlayerAdmin(ModelAdmin):
    list_display        = ('full_name', 'age_display', 'club',
                           'gender_display', 'preferred_foot_display',
                           'created_at')
    list_filter         = ('gender', 'preferred_foot', 'club')
    search_fields       = ('first_name', 'last_name')
    date_hierarchy      = 'birth_date'
    ordering            = ('last_name', 'first_name')
    autocomplete_fields = ('club',)
    readonly_fields     = ('created_at', 'photo_preview')
    inlines             = (ResultInline,)
    save_on_top         = True
    list_per_page       = 25

    fieldsets = (
        ('Личные данные', {
            'fields': ('first_name', 'last_name', 'birth_date',
                       'gender', 'preferred_foot'),
        }),
        ('Клуб', {
            'fields': ('club',),
        }),
        ('Фото', {
            'fields': ('photo_url', 'photo_preview'),
        }),
        ('Служебное', {
            'fields': ('created_at',),
            'classes': ('collapse',),
        }),
    )

    @display(description='ФИО', ordering='last_name')
    def full_name(self, obj):
        return f'{obj.last_name} {obj.first_name}'

    @display(description='Возраст')
    def age_display(self, obj):
        if not obj.birth_date:
            return '—'
        today = datetime.now().date()
        age = today.year - obj.birth_date.year - (
            (today.month, today.day) < (obj.birth_date.month, obj.birth_date.day)
        )
        return f'{age} лет'

    @display(description='Пол')
    def gender_display(self, obj):
        return obj.get_gender_display() or '—'

    @display(description='Рабочая нога')
    def preferred_foot_display(self, obj):
        return obj.get_preferred_foot_display() or '—'

    @display(description='Превью')
    def photo_preview(self, obj):
        if not obj.photo_url:
            return '—'
        return format_html(
            '<img src="{}" style="max-height:180px;max-width:180px;'
            'border-radius:6px;border:1px solid #e5e7eb;">',
            obj.photo_url,
        )


# ============================================================
#  TEST
# ============================================================
class TestAdmin(ModelAdmin):
    list_display  = ('name', 'section', 'physical_quality',
                     'unit', 'weight', 'results_count')
    list_filter   = ('section',)
    search_fields = ('name', 'section', 'physical_quality')
    ordering      = ('section', 'name')
    list_per_page = 30

    @display(description='Результатов')
    def results_count(self, obj):
        return Result.objects.filter(test=obj).count()


# ============================================================
#  RESULT
# ============================================================
class ResultAdmin(ModelAdmin):
    list_display        = ('player_link', 'test', 'test_date',
                           'value', 'notes_short')
    list_filter         = ('test', 'test_date')
    search_fields       = ('player__first_name', 'player__last_name',
                           'test__name')
    date_hierarchy      = 'test_date'
    autocomplete_fields = ('player', 'test')
    ordering            = ('-test_date',)
    list_select_related = ('player', 'test')
    list_per_page       = 25

    @display(description='Игрок', ordering='player__last_name')
    def player_link(self, obj):
        return str(obj.player)

    @display(description='Примечание')
    def notes_short(self, obj):
        if not obj.notes:
            return '—'
        return obj.notes[:60] + ('…' if len(obj.notes) > 60 else '')


# ============================================================
#  EVENT
# ============================================================
class EventAdmin(ModelAdmin):
    list_display   = ('title', 'event_date', 'location',
                      'participants_count', 'has_photo', 'has_video')
    list_filter    = ('event_date',)
    search_fields  = ('title', 'location', 'description')
    date_hierarchy = 'event_date'
    ordering       = ('-event_date',)
    save_on_top    = True
    list_per_page  = 25

    @display(description='Фото', boolean=True)
    def has_photo(self, obj):
        return bool(obj.photo_url)

    @display(description='Видео', boolean=True)
    def has_video(self, obj):
        return bool(obj.video_url)


# ============================================================
#  APPLICATION
# ============================================================
class ApplicationAdmin(ModelAdmin):
    list_display    = ('parent_name', 'child_name', 'child_age',
                       'parent_phone', 'club_name', 'status', 'created_at')
    list_filter     = ('status', 'created_at')
    search_fields   = ('parent_name', 'parent_phone',
                       'child_name', 'club_name')
    date_hierarchy  = 'created_at'
    ordering        = ('-created_at',)
    list_editable   = ('status',)
    readonly_fields = ('created_at',)
    actions         = ('mark_processed', 'mark_canceled', 'mark_new')
    list_per_page   = 30

    fieldsets = (
        ('Родитель', {
            'fields': ('parent_name', 'parent_phone'),
        }),
        ('Ребёнок', {
            'fields': ('child_name', 'child_age', 'club_name'),
        }),
        ('Статус', {
            'fields': ('status', 'created_at'),
        }),
    )

    @action(description='Отметить как «Обработана»')
    def mark_processed(self, request, queryset):
        n = queryset.update(status='processed')
        self.message_user(request, f'Обработано заявок: {n}')

    @action(description='Отметить как «Отменена»')
    def mark_canceled(self, request, queryset):
        n = queryset.update(status='canceled')
        self.message_user(request, f'Отменено заявок: {n}')

    @action(description='Вернуть в «Новые»')
    def mark_new(self, request, queryset):
        n = queryset.update(status='new')
        self.message_user(request, f'Возвращено в «Новые»: {n}')


# ============================================================
#  FEEDBACK
# ============================================================
class FeedbackAdmin(ModelAdmin):
    list_display    = ('name', 'phone', 'email', 'status',
                       'created_at', 'message_short')
    list_filter     = ('status', 'created_at')
    search_fields   = ('name', 'phone', 'email', 'message')
    date_hierarchy  = 'created_at'
    ordering        = ('-created_at',)
    list_editable   = ('status',)
    readonly_fields = ('created_at',)
    actions         = ('mark_processed', 'mark_new')
    list_per_page   = 30

    @display(description='Сообщение')
    def message_short(self, obj):
        if not obj.message:
            return '—'
        return obj.message[:80] + ('…' if len(obj.message) > 80 else '')

    @action(description='Отметить как «Обработан»')
    def mark_processed(self, request, queryset):
        n = queryset.update(status='processed')
        self.message_user(request, f'Обработано отзывов: {n}')

    @action(description='Вернуть в «Новые»')
    def mark_new(self, request, queryset):
        n = queryset.update(status='new')
        self.message_user(request, f'Возвращено в «Новые»: {n}')


# ============================================================
#  КАСТОМНЫЙ САЙТ (dashboard)
# ============================================================
class CustomAdminSite(AdminSite):
    site_header         = 'Футбольное ГТО'
    site_title          = 'Футбольное ГТО'
    index_title         = 'Панель управления'
    index_template      = 'admin/index.html'
    empty_value_display = '—'

    def index(self, request, extra_context=None):
        # --- Основная статистика ---
        total_players      = Player.objects.count()
        total_results      = Result.objects.count()
        total_applications = Application.objects.count()
        total_events       = Event.objects.count()
        total_tests        = Test.objects.count()
        total_clubs        = Club.objects.count()
        new_applications   = Application.objects.filter(status='new').count()
        new_feedback       = Feedback.objects.filter(status='new').count()

        # --- Временные срезы ---
        now = datetime.now()
        week_ago  = now - timedelta(days=7)
        month_ago = now - timedelta(days=30)
        results_this_week  = Result.objects.filter(test_date__gte=week_ago).count()
        results_this_month = Result.objects.filter(test_date__gte=month_ago).count()

        # --- Статусы заявок ---
        apps_by_status = (
            Application.objects
            .values('status')
            .annotate(count=models.Count('id'))
        )
        apps_status_dict = {item['status']: item['count'] for item in apps_by_status}

        # --- Распределение по возрастам ---
        age_groups = {'6-7': 0, '8-9': 0, '10-11': 0, '12-13': 0, '14+': 0}
        for player in Player.objects.all():
            if player.birth_date:
                age = now.year - player.birth_date.year
                if (now.month, now.day) < (player.birth_date.month, player.birth_date.day):
                    age -= 1
                if 6 <= age <= 7:     age_groups['6-7']   += 1
                elif 8 <= age <= 9:   age_groups['8-9']   += 1
                elif 10 <= age <= 11: age_groups['10-11'] += 1
                elif 12 <= age <= 13: age_groups['12-13'] += 1
                elif age >= 14:       age_groups['14+']   += 1

        avg_results = round(total_results / total_players, 1) if total_players else 0

        dashboard_stats = {
            'total_players': total_players,
            'total_results': total_results,
            'total_applications': total_applications,
            'new_applications': new_applications,
            'total_events': total_events,
            'total_tests': total_tests,
            'new_feedback': new_feedback,
            'total_clubs': total_clubs,
            'results_this_week': results_this_week,
            'results_this_month': results_this_month,
            'applications_by_status': apps_status_dict,
            'players_by_age': age_groups,
            'avg_results_per_player': avg_results,
        }

        # --- URL-ы для быстрых действий ---
        app = Player._meta.app_label

        def u(suffix):
            try:
                return reverse(f'custom_admin:{app}_{suffix}')
            except NoReverseMatch:
                return '#'

        quick_actions = {
            'player_add':       u('player_add'),
            'player_list':      u('player_changelist'),
            'result_add':       u('result_add'),
            'result_list':      u('result_changelist'),
            'application_list': u('application_changelist'),
            'event_add':        u('event_add'),
            'event_list':       u('event_changelist'),
            'feedback_list':    u('feedback_changelist'),
            'test_add':         u('test_add'),
            'test_list':        u('test_changelist'),
            'club_add':         u('club_add'),
            'club_list':        u('club_changelist'),
        }

        context = {
            'dashboard_stats': dashboard_stats,
            'quick_actions': quick_actions,
            'now': now,
        }
        if extra_context:
            context.update(extra_context)
        return super().index(request, extra_context=context)


custom_admin_site = CustomAdminSite(name='custom_admin')

custom_admin_site.register(Club,        ClubAdmin)
custom_admin_site.register(Player,      PlayerAdmin)
custom_admin_site.register(Test,        TestAdmin)
custom_admin_site.register(Result,      ResultAdmin)
custom_admin_site.register(Event,       EventAdmin)
custom_admin_site.register(Application, ApplicationAdmin)
custom_admin_site.register(Feedback,    FeedbackAdmin)

# Auth-модели нужны на кастомном сайте — на стандартном они регистрируются
# автоматически из django.contrib.auth.admin, здесь регистрируем вручную.
custom_admin_site.register(User, UserAdmin)
custom_admin_site.register(Group, GroupAdmin)