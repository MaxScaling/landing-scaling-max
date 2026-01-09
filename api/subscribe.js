export default async function handler(req, res) {
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

  // Formater le numéro de téléphone en format international (si présent)
  let formattedPhone = '';
  if (phone) {
    let cleaned = phone.replace(/[\s.\-\(\)]/g, '');
    
    if (cleaned.startsWith('+33')) {
      formattedPhone = cleaned;
    } else if (cleaned.startsWith('0033')) {
      formattedPhone = '+33' + cleaned.substring(4);
    } else if (cleaned.startsWith('33') && cleaned.length === 11) {
      formattedPhone = '+' + cleaned;
    } else if (cleaned.startsWith('0') && cleaned.length === 10) {
      formattedPhone = '+33' + cleaned.substring(1);
    } else if (cleaned.length === 9 && !cleaned.startsWith('0')) {
      formattedPhone = '+33' + cleaned;
    } else if (cleaned.length > 0) {
      formattedPhone = cleaned.startsWith('+') ? cleaned : '+' + cleaned;
    }
  }

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
          SMS: formattedPhone,
          SOURCE: source || 'scalingmax-landing'
        },
        listIds: [6],
        updateEnabled: true
      })
    });

    const data = await response.json();

    if (!response.ok) {
      if (data.code === 'duplicate_parameter') {
        return res.status(200).json({ success: true, message: 'Contact existant' });
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
