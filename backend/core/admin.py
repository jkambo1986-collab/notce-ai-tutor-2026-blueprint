from django.contrib import admin

from .models import BankCase, BankQuestion, BankDistractor


class BankDistractorInline(admin.TabularInline):
    model = BankDistractor
    extra = 0


@admin.register(BankQuestion)
class BankQuestionAdmin(admin.ModelAdmin):
    list_display = ('id', 'domain', 'difficulty', 'format', 'cognitive_level',
                    'practice_setting', 'diagnosis_category', 'status', 'topic', 'correct_label')
    list_filter = ('status', 'domain', 'difficulty', 'format', 'cognitive_level',
                   'client_type', 'practice_setting', 'age_group', 'pronouns',
                   'representation', 'diagnosis_category')
    search_fields = ('id', 'stem', 'topic')
    inlines = [BankDistractorInline]


@admin.register(BankCase)
class BankCaseAdmin(admin.ModelAdmin):
    list_display = ('id', 'title', 'domain', 'setting', 'practice_setting',
                    'client_type', 'diagnosis_category')
    list_filter = ('domain', 'client_type', 'practice_setting', 'age_group',
                   'pronouns', 'representation', 'diagnosis_category')
    search_fields = ('id', 'title', 'vignette')
