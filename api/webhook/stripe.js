import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Discord config
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_GUILD_ID = '1378255287902929037';
const DISCORD_ROLE_ID = '1459574364596080650';

// Brevo config
const BREVO_API_KEY = process.env.BREVO_API_KEY;

// Helper: Generate unique token
function generateToken() {
  return 'tok_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Helper: Remove Discord role
async function removeDiscordRole(discordUserId) {
  if (!discordUserId) return;
  
  try {
    await fetch(
      `https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members/${discordUserId}/roles/${DISCORD_ROLE_ID}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bot ${DISCORD_BOT_TOKEN}`
        }
      }
    );
    console.log(`Removed role from Discord user ${discordUserId}`);
  } catch (error) {
    console.error('Error removing Discord role:', error);
  }
}

// Helper: Send welcome email via Brevo
async function sendWelcomeEmail(email, accessToken) {
  const accessLink = `${process.env.SITE_URL || 'https://www.maximeaugiat.com'}/api/discord-access?token=${accessToken}`;
  
  await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': BREVO_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sender: { name: 'Maxime Augiat', email: 'contact@maximeaugiat.com' },
      to: [{ email }],
      subject: '🎉 Bienvenue dans Scaling MAX !',
      htmlContent: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <h1 style="color: #0a0a0a; font-size: 28px; margin-bottom: 24px;">Bienvenue dans Scaling MAX ! 🚀</h1>
          
          <p style="color: #555; font-size: 16px; line-height: 1.7;">
            Ton paiement a bien été reçu. Tu as maintenant accès à :
          </p>
          
          <ul style="color: #555; font-size: 16px; line-height: 2;">
            <li>📚 Le Notion Scaling MAX complet</li>
            <li>💬 Le Discord privé</li>
            <li>🎯 Toutes mes méthodes</li>
          </ul>
          
          <h2 style="color: #0a0a0a; font-size: 20px; margin-top: 32px;">Étape 1 : Rejoins le Discord</h2>
          
          <p style="color: #555; font-size: 16px; line-height: 1.7;">
            Clique sur le bouton ci-dessous pour lier ton compte Discord et accéder au serveur privé :
          </p>
          
          <div style="text-align: center; margin: 32px 0;">
            <a href="${accessLink}" style="display: inline-block; background: #ff4d00; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
              Accéder au Discord →
            </a>
          </div>
          
          <p style="color: #999; font-size: 14px; margin-top: 40px;">
            Ce lien est unique et personnel. Ne le partage pas.<br>
            Si tu as la moindre question, réponds directement à cet email.
          </p>
          
          <p style="color: #0a0a0a; font-size: 16px; margin-top: 32px;">
            À très vite sur le Discord !<br>
            <strong>Max</strong>
          </p>
        </div>
      `
    })
  });
}

// Helper: Send cancellation email via Brevo
async function sendCancellationEmail(email) {
  await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': BREVO_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sender: { name: 'Maxime Augiat', email: 'contact@maximeaugiat.com' },
      to: [{ email }],
      subject: 'Ton accès Scaling MAX a été désactivé',
      htmlContent: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <h1 style="color: #0a0a0a; font-size: 28px; margin-bottom: 24px;">Ton accès a été désactivé</h1>
          
          <p style="color: #555; font-size: 16px; line-height: 1.7;">
            Ton abonnement Scaling MAX a été annulé ou le paiement a échoué.
          </p>
          
          <p style="color: #555; font-size: 16px; line-height: 1.7;">
            Tu n'as plus accès au Discord privé ni aux contenus réservés aux membres.
          </p>
          
          <p style="color: #555; font-size: 16px; line-height: 1.7;">
            Si c'est une erreur ou si tu veux te réabonner, tu peux le faire ici :
          </p>
          
          <div style="text-align: center; margin: 32px 0;">
            <a href="https://www.maximeaugiat.com/#pricing" style="display: inline-block; background: #0a0a0a; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
              Se réabonner →
            </a>
          </div>
          
          <p style="color: #999; font-size: 14px; margin-top: 40px;">
            Si tu as des questions, réponds à cet email.
          </p>
          
          <p style="color: #0a0a0a; font-size: 16px; margin-top: 32px;">
            Max
          </p>
        </div>
      `
    })
  });
}

export const config = {
  api: {
    bodyParser: false,
  },
};

// Helper to get raw body
async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rawBody = await getRawBody(req);
  const sig = req.headers['stripe-signature'];

  let event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  console.log('Received Stripe event:', event.type);

  try {
    switch (event.type) {
      // New subscription created and paid
      case 'checkout.session.completed': {
        const session = event.data.object;
        
        if (session.mode === 'subscription') {
          const email = session.customer_email || session.customer_details?.email;
          const stripeCustomerId = session.customer;
          
          if (email) {
            const token = generateToken();
            
            // Store token in Stripe customer metadata
            await stripe.customers.update(stripeCustomerId, {
              metadata: {
                discord_access_token: token,
                status: 'active'
              }
            });
            
            // Send welcome email with Discord access link
            await sendWelcomeEmail(email, token);
            
            console.log(`New member: ${email}`);
          }
        }
        break;
      }

      // Payment failed
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const stripeCustomerId = invoice.customer;
        
        // Get customer from Stripe
        const customer = await stripe.customers.retrieve(stripeCustomerId);
        const discordUserId = customer.metadata?.discord_user_id;
        
        // Update status in metadata
        await stripe.customers.update(stripeCustomerId, {
          metadata: {
            ...customer.metadata,
            status: 'payment_failed'
          }
        });
        
        // Remove Discord role
        await removeDiscordRole(discordUserId);
        
        // Send email
        await sendCancellationEmail(customer.email);
        
        console.log(`Payment failed for: ${customer.email}`);
        break;
      }

      // Subscription cancelled
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const stripeCustomerId = subscription.customer;
        
        // Get customer from Stripe
        const customer = await stripe.customers.retrieve(stripeCustomerId);
        const discordUserId = customer.metadata?.discord_user_id;
        
        // Update status in metadata
        await stripe.customers.update(stripeCustomerId, {
          metadata: {
            ...customer.metadata,
            status: 'cancelled'
          }
        });
        
        // Remove Discord role
        await removeDiscordRole(discordUserId);
        
        // Send email
        await sendCancellationEmail(customer.email);
        
        console.log(`Subscription cancelled for: ${customer.email}`);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
}
