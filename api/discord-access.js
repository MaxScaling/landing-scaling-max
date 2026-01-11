import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Discord OAuth config
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_GUILD_ID = '1378255287902929037';
const SITE_URL = process.env.SITE_URL || 'https://www.maximeaugiat.com';

// Helper: Find customer by access token in Stripe
async function findCustomerByToken(token) {
  // Search all customers with this token in metadata
  const customers = await stripe.customers.search({
    query: `metadata['discord_access_token']:'${token}'`
  });

  if (customers.data.length > 0) {
    const customer = customers.data[0];
    
    // Check if customer has active subscription
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'active',
      limit: 1
    });

    if (subscriptions.data.length > 0) {
      return {
        valid: true,
        customerId: customer.id,
        email: customer.email,
        discordUserId: customer.metadata?.discord_user_id
      };
    }
  }
  
  return { valid: false };
}

export default async function handler(req, res) {
  const { token } = req.query;

  if (!token) {
    return res.status(400).send(errorPage('Token manquant', 'Le lien est invalide. Vérifie ton email.'));
  }

  // Verify token in Stripe
  const verification = await findCustomerByToken(token);

  if (!verification.valid) {
    return res.status(403).send(errorPage(
      'Accès refusé',
      'Ce lien est invalide ou expiré. Si tu as un abonnement actif, contacte-nous.'
    ));
  }

  // If user already has Discord linked, redirect to Discord server
  if (verification.discordUserId) {
    return res.redirect(`https://discord.com/channels/${DISCORD_GUILD_ID}`);
  }

  // Build Discord OAuth URL
  const redirectUri = `${SITE_URL}/api/discord-callback`;
  const state = Buffer.from(JSON.stringify({ token, customerId: verification.customerId })).toString('base64');
  
  const discordAuthUrl = new URL('https://discord.com/api/oauth2/authorize');
  discordAuthUrl.searchParams.set('client_id', DISCORD_CLIENT_ID);
  discordAuthUrl.searchParams.set('redirect_uri', redirectUri);
  discordAuthUrl.searchParams.set('response_type', 'code');
  discordAuthUrl.searchParams.set('scope', 'identify guilds.join');
  discordAuthUrl.searchParams.set('state', state);

  // Show access page
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(`
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Accès Discord | Scaling MAX</title>
      <link rel="icon" type="image/png" href="/favicon.png">
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'DM Sans', sans-serif;
          background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .card {
          background: #fafafa;
          border-radius: 24px;
          padding: 48px;
          max-width: 480px;
          width: 100%;
          text-align: center;
          box-shadow: 0 30px 80px rgba(0,0,0,0.5);
        }
        .badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: #10b981;
          color: white;
          padding: 8px 16px;
          border-radius: 50px;
          font-size: 0.85rem;
          font-weight: 600;
          margin-bottom: 24px;
        }
        h1 {
          font-size: 1.8rem;
          margin-bottom: 16px;
          color: #0a0a0a;
        }
        p {
          color: #555;
          margin-bottom: 24px;
          line-height: 1.7;
        }
        .email {
          background: #f5f5f5;
          padding: 12px 20px;
          border-radius: 8px;
          font-weight: 600;
          color: #0a0a0a;
          margin-bottom: 32px;
        }
        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          background: #5865F2;
          color: white;
          padding: 18px 36px;
          border-radius: 12px;
          text-decoration: none;
          font-weight: 600;
          font-size: 1.1rem;
          transition: all 0.2s;
          width: 100%;
        }
        .btn:hover {
          background: #4752C4;
          transform: translateY(-2px);
          box-shadow: 0 10px 30px rgba(88, 101, 242, 0.4);
        }
        .btn svg {
          width: 24px;
          height: 24px;
          fill: currentColor;
        }
        .note {
          margin-top: 24px;
          font-size: 0.85rem;
          color: #999;
        }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="badge">✓ Abonnement actif</div>
        <h1>Bienvenue ! 🎉</h1>
        <p>Connecte ton compte Discord pour accéder au serveur privé Scaling MAX.</p>
        <div class="email">${verification.email}</div>
        <a href="${discordAuthUrl.toString()}" class="btn">
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
          </svg>
          Connecter Discord
        </a>
        <p class="note">Tu seras redirigé vers Discord pour autoriser l'accès.</p>
      </div>
    </body>
    </html>
  `);
}

function errorPage(title, message) {
  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title} | Scaling MAX</title>
      <link rel="icon" type="image/png" href="/favicon.png">
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'DM Sans', sans-serif;
          background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .card {
          background: #fafafa;
          border-radius: 24px;
          padding: 48px;
          max-width: 480px;
          width: 100%;
          text-align: center;
          box-shadow: 0 30px 80px rgba(0,0,0,0.5);
        }
        .badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: #ef4444;
          color: white;
          padding: 8px 16px;
          border-radius: 50px;
          font-size: 0.85rem;
          font-weight: 600;
          margin-bottom: 24px;
        }
        h1 {
          font-size: 1.8rem;
          margin-bottom: 16px;
          color: #0a0a0a;
        }
        p {
          color: #555;
          margin-bottom: 24px;
          line-height: 1.7;
        }
        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: #0a0a0a;
          color: white;
          padding: 16px 32px;
          border-radius: 8px;
          text-decoration: none;
          font-weight: 600;
          transition: all 0.2s;
        }
        .btn:hover {
          background: #ff4d00;
          transform: translateY(-2px);
        }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="badge">✕ Erreur</div>
        <h1>${title}</h1>
        <p>${message}</p>
        <a href="https://www.maximeaugiat.com" class="btn">Retour au site →</a>
      </div>
    </body>
    </html>
  `;
}
