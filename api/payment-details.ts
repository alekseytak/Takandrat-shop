import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_request: VercelRequest, response: VercelResponse) {
  response.setHeader('Cache-Control', 'no-store');
  response.status(200).json({
    card: process.env.PAYMENT_CARD_NUMBER || null,
    cardRecipient: process.env.PAYMENT_CARD_RECIPIENT || null,
    crypto: process.env.PAYMENT_CRYPTO_ADDRESS || null,
    cryptoNetwork: process.env.PAYMENT_CRYPTO_NETWORK || null
  });
}
