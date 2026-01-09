// api/subscribe.js - Vercel Serverless Function
// Inscription Brevo pour Scaling MAX (listId: 6)

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, firstName, phone, source } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email requis' });
  }

  // Liste Scaling MAX = 6
  const listId = 6;

  try {
    const response = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        email: email,
        attributes: {
          FIRSTNAME: firstName || '',
          SMS: phone || '',
          SOURCE: source || 'scaling-max-landing'
        },
        listIds: [listId],
        updateEnabled: true
      })
    });

    const data = await response.json();

    if (!response.ok) {
      if (data.code === 'duplicate_parameter') {
        return res.status(200).json({ success: true, message: 'Contact déjà existant' });
      }
      console.error('Brevo error:', data);
      return res.status(response.status).json({ error: data.message || 'Erreur Brevo' });
    }

    return res.status(200).json({ success: true, id: data.id });

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
}
