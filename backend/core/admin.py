"""Django admin configuration for the premium question bank models.

Registers the BankQuestion and BankCase models so staff can browse, search, and
moderate imported content through the Django admin site.
"""
from django.contrib import admin

from .models import (
    BankCase, BankQuestion, BankDistractor,
    Organization, OrgMembership, OrgInvite,
)


# Edit a question's answer options (distractors) inline on the question page,
# rather than as separate admin records. extra=0 shows no blank rows by default.
class BankDistractorInline(admin.TabularInline):
    model = BankDistractor
    extra = 0


# Admin for bank questions: rich list columns, filters across the NOTCE 2026
# Blueprint descriptors, full-text-ish search on id/stem/topic, and the
# distractors edited inline.
@admin.register(BankQuestion)
class BankQuestionAdmin(admin.ModelAdmin):
    list_display = ('id', 'domain', 'difficulty', 'format', 'cognitive_level',
                    'practice_setting', 'diagnosis_category', 'status', 'topic', 'correct_label')
    list_filter = ('status', 'domain', 'difficulty', 'format', 'cognitive_level',
                   'client_type', 'practice_setting', 'age_group', 'pronouns',
                   'representation', 'diagnosis_category')
    search_fields = ('id', 'stem', 'topic')
    inlines = [BankDistractorInline]


# Admin for bank cases (shared vignettes that case-based questions attach to),
# with list columns/filters on the case's domain and Blueprint descriptors and
# search over id/title/vignette.
@admin.register(BankCase)
class BankCaseAdmin(admin.ModelAdmin):
    list_display = ('id', 'title', 'domain', 'setting', 'practice_setting',
                    'client_type', 'diagnosis_category')
    list_filter = ('domain', 'client_type', 'practice_setting', 'age_group',
                   'pronouns', 'representation', 'diagnosis_category')
    search_fields = ('id', 'title', 'vignette')


# --- B2B multi-tenancy admin ---
# Lets staff onboard a pilot org by hand: create the Organization, set its seat
# license (seats_total + license_active), and add members with roles — all of
# which the API and entitlement layer pick up immediately.

class OrgMembershipInline(admin.TabularInline):
    model = OrgMembership
    extra = 0
    autocomplete_fields = ('user',)


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'license_tier', 'license_active',
                    'seats_total', 'seats_used', 'license_expires_at')
    list_filter = ('license_active', 'license_tier')
    search_fields = ('name', 'slug')
    prepopulated_fields = {'slug': ('name',)}
    readonly_fields = ('seats_used', 'seats_available', 'created_at', 'updated_at')
    inlines = [OrgMembershipInline]


@admin.register(OrgMembership)
class OrgMembershipAdmin(admin.ModelAdmin):
    list_display = ('user', 'organization', 'role', 'status', 'joined_at')
    list_filter = ('role', 'status', 'organization')
    search_fields = ('user__username', 'user__email', 'organization__name')
    autocomplete_fields = ('user', 'organization')


@admin.register(OrgInvite)
class OrgInviteAdmin(admin.ModelAdmin):
    list_display = ('email', 'organization', 'role', 'accepted_at', 'expires_at', 'created_at')
    list_filter = ('role', 'organization')
    search_fields = ('email', 'organization__name')
    autocomplete_fields = ('organization', 'invited_by')
