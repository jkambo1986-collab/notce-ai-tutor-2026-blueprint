from django.contrib import admin

from .models import BankCase, BankQuestion, BankDistractor


class BankDistractorInline(admin.TabularInline):
    model = BankDistractor
    extra = 0


@admin.register(BankQuestion)
class BankQuestionAdmin(admin.ModelAdmin):
    list_display = ('id', 'domain', 'difficulty', 'format', 'status', 'topic', 'correct_label')
    list_filter = ('status', 'domain', 'difficulty', 'format', 'cognitive_level')
    search_fields = ('id', 'stem', 'topic')
    inlines = [BankDistractorInline]


@admin.register(BankCase)
class BankCaseAdmin(admin.ModelAdmin):
    list_display = ('id', 'title', 'domain', 'setting')
    list_filter = ('domain',)
    search_fields = ('id', 'title', 'vignette')
