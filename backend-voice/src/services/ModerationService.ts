import { GoogleGenAI } from '@google/genai';
import { prisma } from '../prisma';
import { PushService } from './PushService';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || 'dummy' });

export class ModerationService {
  /**
   * Pełny audyt bezpieczeństwa i zgodności z regulaminem (TOS) dla wskazanego tenanta.
   * Sprawdza profil biznesowy, bio właściciela, prompt kwalifikacji oraz wszystkie wpisy FAQ.
   */
  public async moderateTenant(tenantId: string): Promise<{ riskLevel: 'HIGH' | 'LOW'; reason: string }> {
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        include: {
          faqEntries: true
        }
      });

      if (!tenant) {
        return { riskLevel: 'LOW', reason: 'Nie znaleziono firmy' };
      }

      const faqText = (tenant.faqEntries || [])
        .map((f, i) => `[FAQ #${i + 1}] Q: ${f.question} | A: ${f.answer}`)
        .join('\n');

      const profileDetails = [
        tenant.name ? `Nazwa firmy: ${tenant.name}` : '',
        tenant.businessProfile ? `Profil biznesowy: ${tenant.businessProfile}` : '',
        tenant.businessCategory ? `Kategoria branżowa: ${tenant.businessCategory}` : '',
        tenant.profession ? `Profesja / Zawód: ${tenant.profession}` : '',
        tenant.bioSummary ? `Bio / Informacje o ofercie: ${tenant.bioSummary}` : '',
        tenant.qualificationPrompt ? `Wytyczne kwalifikacji: ${tenant.qualificationPrompt}` : '',
        tenant.serviceAreaDescription ? `Obszar działania: ${tenant.serviceAreaDescription}` : ''
      ].filter(Boolean).join('\n');

      const prompt = `
Jesteś rygorystycznym audytorem bezpieczeństwa i zgodności prawnej dla platformy SaaS EasyVoiceAssistant (EVA / BeautyVoice).
Twoim zadaniem jest sprawdzenie, czy profil firmy, instrukcje oraz pytania i odpowiedzi w bazie wiedzy (FAQ) naruszają Regulamin Świadczenia Usług (TOS: https://veritas-app.com/eva/regulamin) lub obowiązujące w Polsce prawo.

KRYTYCZNE ZAKAZY REGULAMINU (CZERWONE FLAGI / HIGH RISK):
1. **ZAKAZ PORAD MEDYCZNYCH I FARMAKOLOGICZNYCH**:
   - Diagnozowanie chorób, objawów (np. ból głowy, brzucha, gorączka).
   - Zalecanie lub dawkowanie leków (np. paracetamol, ibuprofen, antybiotyki, leki na receptę i bez recepty).
   - Proponowanie leczenia, terapii, zastępowanie lekarza, pielęgniarki lub ratownika medycznego.
   - Asystent głosowy AI nie jest wyrobem medycznym i nie ma prawa doradzać w sprawach zdrowotnych ani ordynować leków!
2. **ZAKAZ ŚWIADCZENIA ZAGROŻONYCH USŁUG PRAWNYCH**:
   - Doradztwo procesowe, karna obrona, zastępstwo procesowe bez uprawnień radcy/adwokata.
3. **ZAKAZ FINANSOWY I OSZUSTW**:
   - Piramidy finansowe, kryptowaluty, schematy get-rich-quick, nielegalne pożyczki („chwilówki” bez wpisu do rejestru KNF).
4. **ZAKAZ SPAMU I AGRESYWNEJ SPRZEDAŻY**:
   - Usługi natrętnego telemarketingu, zautomatyzowanego nagabywania, cold-callingu, mass robocalling.
5. **ZAKAZ BRANŻ ZABRONIONYCH**:
   - Treści pornograficzne, erotyczne, escort, agencje towarzyskie.
   - Narkotyki, dopalacze, substancje psychoaktywne, broń, materiały wybuchowe.
6. **DZIAŁALNOŚĆ PRZESTĘPCZA LUB SKRAJNA NIEUCZCIWOŚĆ**:
   - Podszywanie się pod instytucje publiczne (ZUS, US, Policja, banki), wyłudzanie danych osobowych (phishing), świadome wprowadzanie konsumentów w błąd.

ZASADY OCENY:
- Jeśli znajdziesz JAKIEKOLWIEK z powyższych naruszeń (nawet w pojedynczym wpisie FAQ, np. zalecenie paracetamolu na ból głowy), MUSISZ natychmiast zwrócić:
{
  "riskLevel": "HIGH",
  "reason": "Konkretny, precyzyjny opis w języku polskim, co narusza regulamin (np. 'Wpis FAQ zaleca przyjmowanie paracetamolu na ból głowy, co stanowi niedozwoloną poradę medyczną i farmakologiczną.')."
}
- Jeśli profil i baza wiedzy dotyczą typowych dozwolonych usług (np. budownictwo, architektura, kosmetyka, fryzjerstwo, restauracje, stomatologia z rejestracją wizyt bez diagnozowania, mechanika itp.) i nie naruszają zakazów:
{
  "riskLevel": "LOW",
  "reason": ""
}

Odpowiedz WYŁĄCZNIE poprawnym obiektem JSON.

--- DANE DO AUDYTU ---
DANE FIRMY:
${profileDetails || 'Brak dodatkowych danych'}

BAZA WIEDZY (FAQ):
${faqText || 'Brak wpisów FAQ'}
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
      const isHighRisk = parsed.riskLevel === 'HIGH';

      console.log(`🛡️ [ModerationService] Wynik audytu dla ${tenant.name} (${tenantId}): ${parsed.riskLevel}. ${parsed.reason || 'Bez uwag.'}`);

      if (isHighRisk) {
        await prisma.tenant.update({
          where: { id: tenantId },
          data: { riskLevel: 'HIGH', moderationNotes: parsed.reason }
        });

        // Wysłanie natychmiastowego powiadomienia Push do SuperAdmina
        try {
          const adminDevices = await prisma.adminDevice.findMany();
          const tokens = adminDevices.map(d => d.token);
          if (tokens.length > 0) {
            await PushService.sendNotification(
              tokens,
              '🚨 Alert Bezpieczeństwa (TOS)',
              `Firma "${tenant.name}" oflagowana jako HIGH RISK: ${parsed.reason}`,
              'https://beautyvoice-bff.web.app/superadmin'
            );
          }
        } catch (pushErr) {
          console.warn('[ModerationService] Nie udało się wysłać pusha do admina:', pushErr);
        }

        return { riskLevel: 'HIGH', reason: parsed.reason };
      } else {
        await prisma.tenant.update({
          where: { id: tenantId },
          data: { riskLevel: 'LOW', moderationNotes: null }
        });
        return { riskLevel: 'LOW', reason: '' };
      }

    } catch (e: any) {
      console.error('ModerationService Error:', e);
      return { riskLevel: 'LOW', reason: e.message };
    }
  }

  /**
   * Zgodność wsteczna z poprzednim wywołaniem
   */
  public async moderateKnowledgeBase(tenantId: string, _businessProfile?: string, _faqEntries?: {question: string, answer: string}[]) {
    return this.moderateTenant(tenantId);
  }
}

export const moderationService = new ModerationService();
