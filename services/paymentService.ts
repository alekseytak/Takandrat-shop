
// Frontend Service to talk to your Node.js Backend

const getEnv = (key: string, fallback: string) => {
    try {
        // @ts-ignore
        return (import.meta && import.meta.env && import.meta.env[key]) || fallback;
    } catch {
        return fallback;
    }
}

const API_URL = getEnv('VITE_API_URL', 'http://localhost:3000');

export const paymentService = {
  /**
   * Инициализация платежа через наш Backend
   */
  async createPayment(orderId: number, amount: number, description: string) {
    try {
      const response = await fetch(`${API_URL}/api/payments/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId,
          amount,
          description,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Payment creation failed');
      }

      // Ожидаем: { paymentId: string, confirmationUrl: string }
      return await response.json();
    } catch (error) {
      console.error('Payment Service Error:', error);
      throw error;
    }
  }
};
