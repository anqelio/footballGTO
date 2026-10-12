from django.contrib.admin import AdminSite
from django.contrib.auth.models import User, Group
from django.contrib.auth.admin import UserAdmin, GroupAdmin
from django.db import models
from django.urls import reverse, NoReverseMatch
from datetime import datetime, timedelta
from .models import (
    Player, Result, Application, Event, Test, Club, Feedback
)


class CustomAdminSite(AdminSite):
    site_header = 'Футбольное ГТО'
    site_title = 'Футбольное ГТО'
    index_title = 'Панель управления'
    index_template = 'admin/index.html'

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
        }
        if extra_context:
            context.update(extra_context)
        return super().index(request, extra_context=context)


custom_admin_site = CustomAdminSite(name='custom_admin')

custom_admin_site.register(Player)
custom_admin_site.register(Result)
custom_admin_site.register(Application)
custom_admin_site.register(Event)
custom_admin_site.register(Test)
custom_admin_site.register(Club)
custom_admin_site.register(Feedback)

# Auth-модели нужны на кастомном сайте — на стандартном они регистрируются
# автоматически из django.contrib.auth.admin, здесь регистрируем вручную.
custom_admin_site.register(User, UserAdmin)
custom_admin_site.register(Group, GroupAdmin)