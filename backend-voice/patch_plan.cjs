const fs = require('fs');
let code = fs.readFileSync('C:/Users/Dymitr Mitrafanau/.gemini/antigravity/brain/d0a0ca76-785e-41ba-987f-3e8858666748/plan_marketing_ai_scenarios.md', 'utf8');

// Append new content
code += `
---

## ETAP 4 (Outbound Voice z własnym silnikiem)

### 6. Własny silnik głosowy (Zadarma & Twilio)
**Scenariusz:** Rezygnacja z Vapi.ai na rzecz pełnej kontroli. Kiedy uruchamiasz Kartę Akcji dla przypomnienia głosowego (np. zaproszenie VIP na wydarzenie), nasz serwer dzwoni do klienta korzystając z SIP Trunkingu (Zadarma / Twilio) i naszego własnego silnika Voice/LLM.
* **Wdrożenie (Backend):**
  - Stworzenie serwisu \`VoiceOutboundService\`.
  - Inicjowanie połączeń przez API Zadarma (\`/v1/request/callback/\` lub podobne dla SIP).
  - WebRTC / Twilio Media Streams do streamowania dźwięku w czasie rzeczywistym między klientem (przez telefon) a silnikiem LLM (np. ElevenLabs + OpenAI/Gemini po naszej stronie).
  - Przeniesienie logiki \`OutboundProcessor.ts\` dla \`channel === 'voice'\` z trybu "Symulacja" do pełnego wywołania naszej bramki.
`;

fs.writeFileSync('C:/Users/Dymitr Mitrafanau/.gemini/antigravity/brain/d0a0ca76-785e-41ba-987f-3e8858666748/plan_marketing_ai_scenarios.md', code, 'utf8');
