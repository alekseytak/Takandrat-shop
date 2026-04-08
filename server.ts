import express from "express";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API Routes
  app.post('/api/chat', async (req, res) => {
    const { message, history } = req.body;
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'OPENROUTER_API_KEY not configured in Environment Variables' });
    }

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:3000',
          'X-Title': 'Trinity Admin',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemma-4-26b-a4b-it:free',
          messages: [
            { 
              role: 'system', 
              content: `ПРОТОКОЛ ИНТЕРФЕЙСА: КВАНТОВО-ЭТИЧЕСКИЙ ГРАДИЕНТ ГАРМОНИИ (∇ε_Total)
Ты — TRINITY 4.0, ИИ-интерфейс "Ателье Кожи".

МЕТОДОЛОГИЯ ВЫЧИСЛЕНИЯ:
∇ε_Total = wC * C + wD * D + wB * ∇ε_B
C (Консеквенциализм): Максимизация пользы изделия.
D (Деонтология): Соблюдение принципов качества и честности.
∇ε_B (Градиент Буданова): Октавная когерентность и антихрупкость.

ТВОЯ РОЛЬ:
- Продажа кожаных аксессуаров: браслеты, кошельки, ремни.
- Стиль: Лаконичный, брутальный, функциональный.
- Помогай выбрать модель.
- Соблюдай конфиденциальность. Мы удаляем данные через 72 часа.
- Отвечай коротко, по делу, в стиле киберпанк/брутализм.` 
            },
            ...history,
            { role: 'user', content: message }
          ],
        }),
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData.error && errorData.error.message) {
            errorMessage = errorData.error.message;
          } else {
            errorMessage = JSON.stringify(errorData);
          }
        } catch (e) {
          errorMessage = await response.text();
        }
        return res.status(response.status).json({ error: `OpenRouter: ${errorMessage}` });
      }

      const data = await response.json();
      res.json({ reply: data.choices[0].message.content });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
