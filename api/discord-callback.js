import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Discord config
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_GUILD_ID = '1378255287902929037';
const DISCORD_ROLE_ID = '1459574364596080650';
const SITE_URL = process.env.SITE_URL || 'https://www.maximeaugiat.com';

// Helper: Exchange code for Discord access token
async function exchangeCodeForToken(code) {
  const redirectUri = `${SITE_URL}/api/discord-callback`;
  
  const response = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      client_id: DISCORD_CLIENT_ID,
      client_secret: DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri
    })
  });

  return response.json();
}

// Helper: Get Discord user info
async function getDiscordUser(accessToken) {
  const response = await fetch('https://discord.com/api/users/@me', {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  return response.json();
}

// Helper: Add user to Discord guild with role
async function addUserToGuild(userId, accessToken) {
  // First, add user to guild
  const addResponse = await fetch(
    `https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members/${userId}`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bot ${DISCORD_BOT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        access_token: accessToken,
        roles: [DISCORD_ROLE_ID]
      })
    }
  );

  // If user already in guild (204 or 201), add role separately
  if (addResponse.status === 204 || addResponse.status === 200) {
    // User already in guild, add role
    await fetch(
      `https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members/${userId}/roles/${DISCORD_ROLE_ID}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bot ${DISCORD_BOT_TOKEN}`
        }
      }
    );
  }

  return true;
}

// Helper: Verify customer has active subscription
async function verifyCustomer(customerId) {
  const customer = await stripe.customers.retrieve(customerId);
  
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: 'active',
    limit: 1
  });

  if (subscriptions.data.length > 0) {
    return {
      valid: true,
      customer
    };
  }
  
  return { valid: false };
}

// Helper: Update Stripe customer with Discord info
async function updateCustomerWithDiscord(customerId, discordUserId, discordUsername) {
  const customer = await stripe.customers.retrieve(customerId);
  
  await stripe.customers.update(customerId, {
    metadata: {
      ...customer.metadata,
      discord_user_id: discordUserId,
      discord_username: discordUsername
    }
  });
}

export default async function handler(req, res) {
  const { code, state, error } = req.query;

  // Handle Discord OAuth errors
  if (error) {
    return res.status(400).send(errorPage('Autorisation refusée', 'Tu as refusé l\'autorisation Discord. Réessaie si c\'était une erreur.'));
  }

  if (!code || !state) {
    return res.status(400).send(errorPage('Paramètres manquants', 'Le lien est invalide. Retourne à ton email.'));
  }

  // Decode state to get customerId
  let customerId;
  try {
    const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    customerId = stateData.customerId;
  } catch (e) {
    return res.status(400).send(errorPage('État invalide', 'Le lien est corrompu. Retourne à ton email.'));
  }

  // Verify customer has active subscription
  const verification = await verifyCustomer(customerId);
  if (!verification.valid) {
    return res.status(403).send(errorPage('Abonnement invalide', 'Ton abonnement n\'est plus actif. Contacte-nous si c\'est une erreur.'));
  }

  try {
    // Exchange code for Discord access token
    const tokenData = await exchangeCodeForToken(code);
    
    if (tokenData.error) {
      console.error('Discord token error:', tokenData);
      return res.status(400).send(errorPage('Erreur Discord', 'Impossible d\'obtenir l\'accès. Réessaie.'));
    }

    // Get Discord user info
    const discordUser = await getDiscordUser(tokenData.access_token);
    
    if (!discordUser.id) {
      return res.status(400).send(errorPage('Erreur Discord', 'Impossible de récupérer ton profil. Réessaie.'));
    }

    // Add user to guild with role
    await addUserToGuild(discordUser.id, tokenData.access_token);

    // Update Stripe customer with Discord info
    await updateCustomerWithDiscord(
      customerId,
      discordUser.id,
      discordUser.username
    );

    // Success! Show success page
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(successPage(discordUser.username));

  } catch (error) {
    console.error('Discord callback error:', error);
    return res.status(500).send(errorPage('Erreur serveur', 'Une erreur est survenue. Réessaie ou contacte-nous.'));
  }
}

function successPage(username) {
  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Bienvenue ! | Scaling MAX</title>
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
        .emoji {
          font-size: 4rem;
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
        .username {
          background: #f5f5f5;
          padding: 12px 20px;
          border-radius: 8px;
          font-weight: 600;
          color: #5865F2;
          margin-bottom: 32px;
          font-size: 1.1rem;
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
        .steps {
          text-align: left;
          margin: 32px 0;
          padding: 20px;
          background: #f5f5f5;
          border-radius: 12px;
        }
        .steps h3 {
          font-size: 1rem;
          margin-bottom: 12px;
          color: #0a0a0a;
        }
        .steps ul {
          list-style: none;
        }
        .steps li {
          padding: 8px 0;
          padding-left: 28px;
          position: relative;
          color: #555;
          font-size: 0.95rem;
        }
        .steps li::before {
          content: "✓";
          position: absolute;
          left: 0;
          color: #10b981;
          font-weight: 700;
        }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="emoji">🎉</div>
        <div class="badge">✓ Compte lié</div>
        <h1>Bienvenue ${username} !</h1>
        <p>Ton compte Discord est maintenant connecté. Tu as accès au serveur privé Scaling MAX.</p>
        
        <div class="steps">
          <h3>Prochaines étapes :</h3>
          <ul>
            <li>Présente-toi dans #présentations</li>
            <li>Explore le Notion Scaling MAX</li>
            <li>Pose tes questions dans #questions</li>
          </ul>
        </div>
        
        <a href="https://discord.com/channels/${DISCORD_GUILD_ID}" class="btn">
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
          </svg>
          Ouvrir Discord →
        </a>
      </div>
    </body>
    </html>
  `;
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
