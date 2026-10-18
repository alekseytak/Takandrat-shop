import type { VercelRequest, VercelResponse } from '@vercel/node';

const DEFAULT_SOL_WALLET = '4QoVmYDgTAH99PVWT13e77FXnWxdSUkhd42bakeJ7zBA';
const DEFAULT_TON_WALLET = 'UQCPCI52jq76GTKAZq0HHxMalghb6A_SRVJxSdU0LXpyfat7';

export default function handler(_request: VercelRequest, response: VercelResponse) {
  response.setHeader('Cache-Control', 'no-store');
  response.status(200).json({
    card: process.env.PAYMENT_CARD_NUMBER || null,
    cardRecipient: process.env.PAYMENT_CARD_RECIPIENT || null,
    crypto: process.env.PAYMENT_CRYPTO_ADDRESS || DEFAULT_TON_WALLET,
    cryptoNetwork: process.env.PAYMENT_CRYPTO_NETWORK || 'TON (Toncoin / USDT)',
    wallets: [
      { network: 'SOL (Solana / USDC / USDT)', label: 'Solana', address: DEFAULT_SOL_WALLET },
      { network: 'TON (Toncoin / USDT TON)', label: 'Ton', address: DEFAULT_TON_WALLET },
    ],
  });
}
