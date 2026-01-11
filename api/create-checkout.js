import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PRICE_ID = 'price_1Sk25hFndNMqnWuf1pXzHb87';
const SITE_URL = process.env.SITE_URL || 'https://www.maximeaugiat.com';

export default async function handler(req, res) {
  // Handle CORS for POST
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: PRICE_ID,
          quantity: 1,
        },
      ],
      success_url: `${SITE_URL}/success.html`,
      cancel_url: `${SITE_URL}/paiement.html`,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      tax_id_collection: {
        enabled: true,
      },
    });

    res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
}
