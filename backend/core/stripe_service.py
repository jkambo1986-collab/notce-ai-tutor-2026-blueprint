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

        # Send Polished Confirmation Email
        dashboard_link = "http://localhost:5173/"
        
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
        
        try:
            send_mail(
                subject="Payment Successful - NOTCE AI Tutor",
                message=f"Hi {user.username}, your payment for {tier.upper()} was successful!",
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=False,
                html_message=html_content
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
