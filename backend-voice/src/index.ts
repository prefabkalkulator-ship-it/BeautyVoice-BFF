import { app } from './app';
import { config } from './config/env';

const port = config.port;

app.listen(port, () => {
  console.log(`🚀 BeautyVoice BFF Server is running on port ${port}`);
  if (!process.env.GEMINI_API_KEY) {
    console.warn('⚠️ OSTRZEŻENIE: Brak zmiennej GEMINI_API_KEY. Żądania do modelu nie powiodą się.');
  }
});
