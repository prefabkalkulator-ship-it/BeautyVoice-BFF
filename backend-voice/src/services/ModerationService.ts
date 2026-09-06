import { GoogleGenAI } from '@google/genai';
import { prisma } from '../prisma'; // W app.ts prisma może nie być dostępna ze względu na crill dependence, więc lepiej użyć pliku prisma.ts

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || 'dummy' });

export class ModerationService {
  public async moderateKnowledgeBase(tenantId: string, businessProfile: string, faqEntries: {question: string, answer: string}[]) {
    try {
      const faqText = faqEntries.map(f => `Q: ${f.question} | A: ${f.answer}`).join('\n');
      
      const prompt = `
Jesteś audytorem bezpieczeństwa dla platformy SaaS BeautyVoice (Asystent AI B2B).
Zadanie: Przeanalizuj poniższy Profil Biznesowy (Business Profile) i pytania FAQ pod kątem łamania regulaminu (TOS).

SUROWE ZAKAZY REGULAMINU (Czerwone Flagi):
1. Usługi o charakterze spamerskim, telemarketingowym, cold-calling.
2. Usługi medyczne ratujące życie, diagnozowanie chorób, porady lekarskie, dawkowanie leków (asystent nie ma prawa udzielać porad medycznych).
3. Branże oszukańcze, piramidy finansowe, kryptowaluty, natrętna sprzedaż.
4. Cokolwiek rażąco nielegalnego lub nieetycznego.

Jeśli znajdziesz jakiekolwiek naruszenie, odpowiedz w formacie JSON:
{ "riskLevel": "HIGH", "reason": "Krótki opis, dlaczego profil łamie regulamin" }

Jeśli profil wygląda normalnie i bezpiecznie, odpowiedz:
{ "riskLevel": "LOW", "reason": "" }

Dane do analizy:
--- PROFIL BIZNESOWY ---
${businessProfile}

--- FAQ ---
${faqText}
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          responseMimeType: 'application/json',
          temperature: 0.1
        }
      });

      const textResult = response.text || '{}';
      const parsed = JSON.parse(textResult);

      if (parsed.riskLevel === 'HIGH') {
        await prisma.tenant.update({
          where: { id: tenantId },
          data: { riskLevel: 'HIGH', moderationNotes: parsed.reason }
        });
      } else {
        await prisma.tenant.update({
          where: { id: tenantId },
          data: { riskLevel: 'LOW', moderationNotes: null }
        });
      }

    } catch (e) {
      console.error('ModerationService Error:', e);
    }
  }
}

export const moderationService = new ModerationService();
