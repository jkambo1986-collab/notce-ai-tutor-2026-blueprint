"""
Stripe billing service.

Encapsulates the payment flows for the app's pricing tiers:
  * ``create_checkout_session`` -- starts a hosted Stripe Checkout (one-time
    ``payment`` for most tiers, ``subscription`` for the beta tier);
  * ``handle_stripe_webhook`` -- verifies and dispatches incoming webhook events,
    fulfilling orders on ``checkout.session.completed``;
  * ``fulfill_order`` -- upgrades the user's profile and emails confirmation;
  * ``verify_payment_status`` -- a manual reconciliation fallback for when a
    webhook never arrives.

The Stripe secret key is read from the ``STRIPE_SECRET_KEY`` environment
variable at import time.
"""

import stripe
import os
from django.conf import settings
from .models import UserProfile

stripe.api_key = os.getenv('STRIPE_SECRET_KEY')

# Mapping tiers to Stripe Price IDs
PRICE_IDS = {
    'crammer': 'price_1SrnrH1UsBRjzf7okChfu91p',
    'guarantee': 'price_1SrnrJ1UsBRjzf7onwoPc1xy',
    'beta': 'price_1SrnrL1UsBRjzf7onxY3r1pU' # I will create this one in code or assuming it exists
}

# B2B per-seat subscription price (org licensing). A recurring price billed
# per-unit, so a checkout with quantity=N sells N seats. Overridable via env so
# it can be set without a code change once created in the Stripe dashboard.
ORG_SEAT_PRICE_ID = os.getenv('STRIPE_ORG_SEAT_PRICE_ID', 'price_REPLACE_ME_ORG_SEAT')

def create_checkout_session(user, tier, success_url, cancel_url):
    """
    Create a Stripe Checkout Session for the given user and pricing tier.

    Args:
        user: The Django ``User`` purchasing the tier.
        tier: One of the keys in ``PRICE_IDS`` ('crammer', 'guarantee', 'beta').
        success_url: URL Stripe redirects to on success (a ``session_id`` query
            param placeholder is appended).
        cancel_url: URL Stripe redirects to if the user cancels.

    Returns:
        The created ``stripe.checkout.Session`` (its ``url`` is the redirect
        target for the client).

    Raises:
        ValueError: If ``tier`` has no configured price id.

    Side effects:
        May create a Stripe Customer and persist its id on the user's profile;
        always creates a Checkout Session via the Stripe API.
    """
    price_id = PRICE_IDS.get(tier)
    if not price_id:
        raise ValueError(f"Invalid tier: {tier}")

    # The beta tier is recurring; every other tier is a one-time purchase.
    mode = 'subscription' if tier == 'beta' else 'payment'

    # Ensure the user has a backing Stripe Customer, creating one on first
    # purchase and caching its id so future checkouts reuse it.
    profile, created = UserProfile.objects.get_or_create(user=user)
    if not profile.stripe_customer_id:
        customer = stripe.Customer.create(
            email=user.email,
            name=user.username,
            metadata={'user_id': user.id}
        )
        profile.stripe_customer_id = customer.id
        profile.save()

    # metadata (user_id, tier) is what fulfill_order later reads to know who to
    # upgrade and to which tier.
    session = stripe.checkout.Session.create(
        customer=profile.stripe_customer_id,
        payment_method_types=['card'],
        line_items=[{
            'price': price_id,
            'quantity': 1,
        }],
        mode=mode,
        success_url=success_url + '?session_id={CHECKOUT_SESSION_ID}',
        cancel_url=cancel_url,
        metadata={
            'user_id': user.id,
            'tier': tier
        }
    )
    return session

def create_org_seat_checkout(org, user, seats, success_url, cancel_url):
    """Start a Stripe Checkout for an organization's seat subscription.

    Args:
        org: The ``Organization`` purchasing seats.
        user: The admin/owner initiating checkout (billing contact).
        seats: Number of seats to buy (becomes the line-item quantity).
        success_url / cancel_url: Post-checkout redirect targets.

    Returns:
        The created ``stripe.checkout.Session``.

    Side effects:
        Ensures the org has a backing Stripe Customer (created + cached on first
        purchase). The org's license is activated later by ``fulfill_org_order``
        when the ``checkout.session.completed`` webhook arrives.
    """
    try:
        seats = int(seats)
    except (TypeError, ValueError):
        raise ValueError("seats must be an integer")
    if seats < 1:
        raise ValueError("seats must be >= 1")

    # Cache a Stripe Customer on the org so renewals/seat changes reuse it.
    if not org.stripe_customer_id:
        customer = stripe.Customer.create(
            email=user.email,
            name=org.name,
            metadata={'org_id': org.id, 'org_slug': org.slug},
        )
        org.stripe_customer_id = customer.id
        org.save(update_fields=['stripe_customer_id'])

    # metadata (org_id, seats) is what fulfill_org_order reads to activate the
    # right tenant's license with the right seat count.
    session = stripe.checkout.Session.create(
        customer=org.stripe_customer_id,
        payment_method_types=['card'],
        line_items=[{'price': ORG_SEAT_PRICE_ID, 'quantity': seats}],
        mode='subscription',
        success_url=success_url + '?session_id={CHECKOUT_SESSION_ID}',
        cancel_url=cancel_url,
        metadata={'org_id': org.id, 'seats': seats, 'kind': 'org_seats'},
    )
    return session


def fulfill_org_order(session):
    """Activate an organization's seat license from a completed checkout.

    Reads ``org_id``/``seats`` from the session metadata, turns on the license,
    sets the seat count, and records the Stripe subscription id. No-op if the
    metadata is missing or the org no longer exists.
    """
    metadata = session.get('metadata', {}) or {}
    org_id = metadata.get('org_id')
    seats = metadata.get('seats')
    if not org_id:
        return

    from .models import Organization
    try:
        org = Organization.objects.get(id=org_id)
    except Organization.DoesNotExist:
        return

    if seats:
        try:
            org.seats_total = int(seats)
        except (TypeError, ValueError):
            pass
    org.license_active = True
    org.license_tier = 'org'
    if session.get('subscription'):
        org.stripe_subscription_id = session['subscription']
    org.save()


def handle_stripe_webhook(payload, sig_header):
    """
    Verify and process an incoming Stripe webhook request.

    Args:
        payload: The raw request body bytes from Stripe.
        sig_header: The value of the ``Stripe-Signature`` header.

    Returns:
        The verified Stripe ``event`` object.

    Raises:
        ValueError: If the payload is malformed.
        stripe.error.SignatureVerificationError: If signature validation fails.

    Side effects:
        On a ``checkout.session.completed`` event, fulfills the order (profile
        upgrade + confirmation email).
    """
    event = None
    endpoint_secret = os.getenv('STRIPE_WEBHOOK_SECRET')

    # construct_event validates the signature against the endpoint secret; both
    # failure modes are re-raised so the caller can return an HTTP 400.
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, endpoint_secret
        )
    except ValueError as e:
        raise e
    except stripe.error.SignatureVerificationError as e:
        raise e

    # Only completed checkouts trigger fulfillment; other event types are
    # acknowledged but ignored. Org seat purchases (metadata.kind == 'org_seats')
    # activate a tenant license; everything else is an individual upgrade.
    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        metadata = session.get('metadata', {}) or {}
        if metadata.get('kind') == 'org_seats' or metadata.get('org_id'):
            fulfill_org_order(session)
        else:
            fulfill_order(session)

    return event

def fulfill_order(session):
    """
    Apply the effects of a paid checkout session to the user's account.

    Reads the ``user_id`` and ``tier`` stored in the session metadata (set in
    ``create_checkout_session``), upgrades the matching profile, and sends a
    confirmation email.

    Args:
        session: A Stripe Checkout Session (dict-like) containing metadata.

    Returns:
        ``None``. No-op if required metadata is missing.

    Side effects:
        Updates the user's ``UserProfile`` (tier + paid flag) and attempts to
        send a confirmation email (failures are logged, not raised).
    """
    # Pull who/what to fulfill from the metadata we attached at checkout time.
    user_id = session.get('metadata', {}).get('user_id')
    tier = session.get('metadata', {}).get('tier')

    if user_id and tier:
        from django.contrib.auth.models import User
        user = User.objects.get(id=user_id)
        # Grant access: record the tier and mark the account as paid.
        profile = user.userprofile
        profile.subscription_tier = tier
        profile.is_paid = True
        profile.save()

        # Send Polished Confirmation Email
        dashboard_link = settings.FRONTEND_URL
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                .button {{
                    background-color: #0d9488;
                    border: none;
                    color: white !important;
                    padding: 12px 24px;
                    text-align: center;
                    text-decoration: none;
                    display: inline-block;
                    font-size: 16px;
                    margin: 4px 2px;
                    cursor: pointer;
                    border-radius: 12px;
                    font-weight: bold;
                }}
                .success-icon {{
                    font-size: 48px;
                    color: #0d9488;
                    margin-bottom: 20px;
                }}
            </style>
        </head>
        <body style="font-family: 'Inter', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #134e4a 0%, #0d9488 100%); padding: 40px; border-radius: 24px; color: white; text-align: center; margin-bottom: 30px;">
                <h1 style="margin: 0; font-size: 28px; font-weight: 900; letter-spacing: -0.025em;">Payment Successful!</h1>
                <p style="opacity: 0.9; margin-top: 10px;">Your NOTCE journey just leveled up.</p>
            </div>
            
            <div style="text-align: center;">
                <div class="success-icon">✓</div>
                <h2 style="font-size: 24px; font-weight: 800; color: #111; margin-bottom: 16px;">Hi {user.username},</h2>
                <p style="font-size: 16px; color: #444; margin-bottom: 24px;">
                    Great news! Your payment was successful and your account has been upgraded to the <strong style="color: #0d9488;">{tier.upper()}</strong> tier. 
                    You now have full, unlimited access to all AI-driven case studies, adaptive mock examinations, and clinical indicator analysis.
                </p>
                
                <div style="background-color: #f0fdfa; border: 1px solid #ccfbf1; padding: 20px; border-radius: 16px; display: inline-block; margin-bottom: 30px;">
                    <p style="margin: 0; font-weight: bold; color: #134e4a;">Tier Unlocked: {tier.capitalize()}</p>
                    <p style="margin: 5px 0 0 0; font-size: 12px; color: #0d9488;">Unlimited Access Active</p>
                </div>
                
                <div style="margin-bottom: 40px;">
                    <a href="{dashboard_link}" class="button">Go to My Dashboard</a>
                </div>
            </div>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 40px 0;">
            
            <p style="font-size: 12px; color: #999; text-align: center;">
                Need help? Reply to this email or visit our <a href="#" style="color: #0d9488;">support center</a>.
            </p>
        </body>
        </html>
        """
        
        # Email is best-effort: a send failure must not undo the upgrade, so it
        # is caught and logged with a traceback rather than propagated.
        try:
            send_mail(
                subject="Payment Successful - NOTCE AI Tutor",
                message=f"Hi {user.username}, your payment for {tier.upper()} was successful!",
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=False,
                html_message=html_content
            )
            import logging
            logger = logging.getLogger(__name__)
            logger.info(f"Payment confirmation email sent to {user.email}")
        except Exception as e:
            import logging
            import traceback
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to send confirmation email to {user.email}: {str(e)}")
            logger.error(traceback.format_exc())

def verify_payment_status(user):
    """
    Manually check Stripe for any successful checkout sessions for this user
    and update their profile if found. Useful if webhooks fail.

    Args:
        user: The Django ``User`` whose payment status to reconcile.

    Returns:
        ``True`` if a paid session was found and the profile was upgraded by
        this call; ``False`` otherwise (no customer, no paid session, already
        paid, or on error).

    Side effects:
        May call ``fulfill_order`` (profile upgrade + confirmation email).
    """
    profile = user.userprofile
    # No Stripe customer means the user never started checkout -> nothing to sync.
    if not profile.stripe_customer_id:
        return False

    try:
        # Inspect the most recent sessions for this customer looking for a paid one.
        sessions = stripe.checkout.Session.list(
            customer=profile.stripe_customer_id,
            limit=5,
        )

        for session in sessions.data:
            if session.payment_status == 'paid':
                # Found a paid session, ensure profile matches
                # We can reuse fulfill_order, but we need to ensure we don't double-email 
                # or we accept that as a side effect of manual sync.
                # Ideally check if already paid.
                if not profile.is_paid:
                     fulfill_order(session)
                     return True
    except Exception as e:
        print(f"Error checking stripe status: {e}")
        
    return False
