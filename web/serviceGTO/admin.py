from django.contrib.admin import AdminSite
from django.contrib.auth.models import User, Group
from django.db import models
from datetime import datetime, timedelta
from .models import (
    Player, Result, Application, Event, Test, Club, Feedback  # ContentBlock убрали, т.к. нет
)

class CustomAdminSite(AdminSite):
    site_header = 'Футбольное ГТО'
    site_title = 'Футбольное ГТО Администрирование'
    index_template = 'admin/index.html'

    def index(self, request, extra_context=None):
        # --- Основная статистика ---
        total_players = Player.objects.count()
        total_results = Result.objects.count()
        total_applications = Application.objects.count()
        total_events = Event.objects.count()
        total_tests = Test.objects.count()
        total_clubs = Club.objects.count()
        new_applications = Application.objects.filter(status='new').count()
        new_feedback = Feedback.objects.filter(status='new').count()   # вместо is_read=False

        # --- Временные срезы ---
        now = datetime.now()
        week_ago = now - timedelta(days=7)
        month_ago = now - timedelta(days=30)
        results_this_week = Result.objects.filter(test_date__gte=week_ago).count()
        results_this_month = Result.objects.filter(test_date__gte=month_ago).count()

        # --- Статусы заявок ---
        apps_by_status = (
            Application.objects
            .values('status')
            .annotate(count=models.Count('id'))
        )
        apps_status_dict = {item['status']: item['count'] for item in apps_by_status}

        # --- Распределение по возрастам ---
        age_groups = {
            '6-7': 0, '8-9': 0, '10-11': 0, '12-13': 0, '14+': 0
        }
        for player in Player.objects.all():
            if player.birth_date:
                age = now.year - player.birth_date.year
                # корректировка, если день рождения ещё не наступил
                if (now.month, now.day) < (player.birth_date.month, player.birth_date.day):
                    age -= 1
                if 6 <= age <= 7:
                    age_groups['6-7'] += 1
                elif 8 <= age <= 9:
                    age_groups['8-9'] += 1
                elif 10 <= age <= 11:
                    age_groups['10-11'] += 1
                elif 12 <= age <= 13:
                    age_groups['12-13'] += 1
                elif age >= 14:
                    age_groups['14+'] += 1

        # --- Среднее количество результатов на игрока ---
        avg_results = 0
        if total_players > 0:
            avg_results = round(total_results / total_players, 1)

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

        context = {
            'dashboard_stats': dashboard_stats,
        }
        if extra_context:
            context.update(extra_context)

        return super().index(request, extra_context=context)

# Создаём экземпляр кастомного административного сайта
custom_admin_site = CustomAdminSite(name='custom_admin')

# Регистрируем модели
custom_admin_site.register(Player)
custom_admin_site.register(Result)
custom_admin_site.register(Application)
custom_admin_site.register(Event)
custom_admin_site.register(Test)
custom_admin_site.register(Club)
custom_admin_site.register(Feedback)