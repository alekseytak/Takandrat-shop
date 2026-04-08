import { Router } from 'express';

const router = Router();

router.post('/chat', async (req, res) => {
  const { message, history } = req.body;
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'OPENROUTER_API_KEY not configured' });
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:5173',
        'X-Title': 'Trinity Admin',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemma-4-26b-a4b-it:free',
        messages: [
          { role: 'system', content: 'You are an AI assistant for a store admin panel.' },
          ...history,
          { role: 'user', content: message }
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      return res.status(response.status).json({ error: `OpenRouter error: ${errorData}` });
    }

    const data = await response.json();
    res.json({ reply: data.choices[0].message.content });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export { router as chatRouter };
