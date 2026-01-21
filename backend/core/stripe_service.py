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

def create_checkout_session(user, tier, success_url, cancel_url):
    price_id = PRICE_IDS.get(tier)
    if not price_id:
        raise ValueError(f"Invalid tier: {tier}")

    # Check if this is a subscription tier
    mode = 'subscription' if tier == 'beta' else 'payment'

    # Get or create stripe customer
    profile, created = UserProfile.objects.get_or_create(user=user)
    if not profile.stripe_customer_id:
        customer = stripe.Customer.create(
            email=user.email,
            name=user.username,
            metadata={'user_id': user.id}
        )
        profile.stripe_customer_id = customer.id
        profile.save()

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

def handle_stripe_webhook(payload, sig_header):
    event = None
    endpoint_secret = os.getenv('STRIPE_WEBHOOK_SECRET')

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, endpoint_secret
        )
    except ValueError as e:
        raise e
    except stripe.error.SignatureVerificationError as e:
        raise e

    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        fulfill_order(session)
    
    return event

def fulfill_order(session):
    user_id = session.get('metadata', {}).get('user_id')
    tier = session.get('metadata', {}).get('tier')
    
    if user_id and tier:
        from django.contrib.auth.models import User
        user = User.objects.get(id=user_id)
        profile = user.userprofile
        profile.subscription_tier = tier
        profile.is_paid = True
        profile.save()

        # Send Confirmation Email
        from django.core.mail import send_mail
        from django.conf import settings
        
        try:
            send_mail(
                subject="Payment Successful - NOTCE AI Tutor",
                message=f"Hi {user.username},\n\nYour payment was successful and your account has been upgraded to the {tier.upper()} tier.\n\nThank you for your business!",
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=False,
            )
        except Exception as e:
            print(f"Failed to send confirmation email: {e}")

def verify_payment_status(user):
    """
    Manually check Stripe for any successful checkout sessions for this user
    and update their profile if found. Useful if webhooks fail.
    """
    profile = user.userprofile
    if not profile.stripe_customer_id:
        return False
    
    try:
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
