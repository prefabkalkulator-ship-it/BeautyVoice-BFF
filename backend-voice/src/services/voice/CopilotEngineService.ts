import { WebSocket } from 'ws';
import { GoogleGenAI } from '@google/genai';
import { prisma } from '../../prisma';
import { AI_MODELS } from '../../config/aiModels';

export interface BattlecardPayload {
  category: 'OBJECTION' | 'FACT_QUERY' | 'BUYING_SIGNAL' | 'DEESCALATION';
  heading: string;
  bullets: string[];
  faqSource?: 'current' | 'permanent' | 'confidential' | null;
  faqSnippet?: string;
  urgency: 'high' | 'medium' | 'low';
}

export interface CopilotChecklistItem {
  id: string;
  text: string;
  checked: boolean;
}

export interface CopilotSession {
  sessionId: string;
  tenantId: string;
  ownerPhone: string;
  customerPhone: string;
  customerName: string;
  scenario: string;
  createdAt: Date;
  uiSockets: Set<WebSocket>;
  twilioStreamSid?: string;
  isRepSpeaking: boolean;
  lastRepSpeechTime: number;
  checklist: CopilotChecklistItem[];
  activeBattlecard?: BattlecardPayload;
  faqs: {
    current: any[];
    permanent: any[];
    confidential: any[];
  };
  customerHistory: {
    recentCallSummaries: string[];
    recentAppointments: string[];
  };
  inboundAudioBuffer: Buffer[];
  lastInboundAudioTime: number;
  evaluatingInbound: boolean;
}

export class CopilotEngineService {
  private static instance: CopilotEngineService;
  private sessions = new Map<string, CopilotSession>();
  private ai: GoogleGenAI;

  private constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || 'dummy' });
  }

  public static getInstance(): CopilotEngineService {
    if (!CopilotEngineService.instance) {
      CopilotEngineService.instance = new CopilotEngineService();
    }
    return CopilotEngineService.instance;
  }

  /**
   * Inicjalizuje nową sesję Copilota z pre-ładowaniem Bazy Wiedzy FAQ i historii CRM
   */
  public async createSession(options: {
    tenantId: string;
    customerPhone: string;
    customerName?: string;
    scenario?: string;
  }): Promise<CopilotSession> {
    const sessionId = `copilot_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    
    // Pobierz dane tenanta
    const tenant = await prisma.tenant.findUnique({
      where: { id: options.tenantId },
      include: {
        faqEntries: true
      }
    });

    const ownerPhone = tenant?.phoneNumber || '';

    // Podział Bazy Wiedzy FAQ na 3 poziomy: Czasowa, Stała i Poufna
    const allFaqs = tenant?.faqEntries || [];
    const currentFaqs = allFaqs.filter(f => f.category === 'current');
    const confidentialFaqs = allFaqs.filter(f => f.isConfidential);
    const permanentFaqs = allFaqs.filter(f => f.category !== 'current' && !f.isConfidential);

    // Dynamiczna checklista bazująca na pytaniach kwalifikacyjnych tenanta lub scenariuszu
    const checklist: CopilotChecklistItem[] = [];
    if (tenant?.leadQuestion1) checklist.push({ id: '1', text: tenant.leadQuestion1, checked: false });
    if (tenant?.leadQuestion2) checklist.push({ id: '2', text: tenant.leadQuestion2, checked: false });
    if (tenant?.leadQuestion3) checklist.push({ id: '3', text: tenant.leadQuestion3, checked: false });

    if (checklist.length === 0) {
      checklist.push(
        { id: '1', text: 'Zbadaj aktualny problem lub cel klienta', checked: false },
        { id: '2', text: 'Przedstaw dopasowany wariant i warunki cenowe', checked: false },
        { id: '3', text: 'Ustal twardy termin kolejnego kroku / podpisania', checked: false }
      );
    }

    // Pobierz historię klienta (CallLog i Appointment)
    const normPhone = options.customerPhone.replace(/[\s\-\+]/g, '');
    const last9 = normPhone.length >= 9 ? normPhone.slice(-9) : normPhone;

    const [recentCalls, recentAppts] = await Promise.all([
      prisma.callLog.findMany({
        where: {
          tenantId: options.tenantId,
          callerPhone: { contains: last9 }
        },
        orderBy: { createdAt: 'desc' },
        take: 3
      }),
      prisma.appointment.findMany({
        where: {
          tenantId: options.tenantId,
          customerPhone: { contains: last9 }
        },
        include: { service: true },
        orderBy: { startTime: 'desc' },
        take: 3
      })
    ]);

    const session: CopilotSession = {
      sessionId,
      tenantId: options.tenantId,
      ownerPhone,
      customerPhone: options.customerPhone,
      customerName: options.customerName || 'Klient',
      scenario: options.scenario || 'sales',
      createdAt: new Date(),
      uiSockets: new Set(),
      isRepSpeaking: false,
      lastRepSpeechTime: 0,
      checklist,
      faqs: {
        current: currentFaqs,
        permanent: permanentFaqs,
        confidential: confidentialFaqs
      },
      customerHistory: {
        recentCallSummaries: recentCalls.map(c => c.summary || '').filter(Boolean),
        recentAppointments: recentAppts.map(a => `${a.service?.name} (${new Date(a.startTime).toLocaleDateString()})`)
      },
      inboundAudioBuffer: [],
      lastInboundAudioTime: 0,
      evaluatingInbound: false,
      activeBattlecard: {
        category: 'BUYING_SIGNAL',
        heading: 'Otwarcie rozmowy i nawiązanie relacji',
        bullets: [
          'Nawiąż do ostatniego kontaktu',
          'Zapytaj o priorytet na ten kwartał',
          'Trzymaj tempo: zwięźle i partnersko'
        ],
        faqSource: 'permanent',
        urgency: 'low'
      }
    };

    this.sessions.set(sessionId, session);
    console.log(`🎧 [CopilotEngine] Utworzono sesję Copilota: ${sessionId} dla klienta: ${options.customerPhone}`);
    return session;
  }

  public getSession(sessionId: string): CopilotSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Rejestracja połączenia WebSocket z kokpitu w przeglądarce PWA
   */
  public registerUiSocket(sessionId: string, ws: WebSocket) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      ws.close(1008, 'Session not found');
      return;
    }

    session.uiSockets.add(ws);
    console.log(`💻 [CopilotEngine] Podłączono kokpit UI do sesji: ${sessionId}`);

    // Wyślij stan początkowy sesji do przeglądarki
    ws.send(JSON.stringify({
      type: 'SESSION_SNAPSHOT',
      sessionId: session.sessionId,
      customerName: session.customerName,
      customerPhone: session.customerPhone,
      checklist: session.checklist,
      activeBattlecard: session.activeBattlecard,
      faqsCount: {
        current: session.faqs.current.length,
        permanent: session.faqs.permanent.length,
        confidential: session.faqs.confidential.length
      }
    }));

    ws.on('close', () => {
      session.uiSockets.delete(ws);
      console.log(`💻 [CopilotEngine] Odłączono kokpit UI od sesji: ${sessionId}`);
    });
  }

  /**
   * Rozgłoszenie zdarzenia do wszystkich podłączonych kokpitów UI danej sesji
   */
  public broadcastToUi(session: CopilotSession, payload: any) {
    const message = JSON.stringify(payload);
    for (const ws of session.uiSockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    }
  }

  /**
   * Obsługa forkowanego strumienia audio z centrali telekomunikacyjnej (Twilio)
   * Asymetria dwukanałowa:
   * - 'outbound' (Właściciel): VAD -> UI Freeze (zamrożenie ekranu, by nie rozpraszać mówiącego)
   * - 'inbound' (Klient): VAD + Fast Intent Gatekeeper -> generowanie karty bojowej z FAQ
   */
  public async handleMediaStream(sessionId: string, track: 'inbound' | 'outbound', payloadBase64: string) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const audioChunk = Buffer.from(payloadBase64, 'base64');

    // Prosta detekcja energii głosu (RMS na próbkach audio 8kHz mulaw)
    let sumSquares = 0;
    for (let i = 0; i < audioChunk.length; i++) {
      const sample = audioChunk[i] - 128;
      sumSquares += sample * sample;
    }
    const rms = Math.sqrt(sumSquares / audioChunk.length);
    const hasVoiceEnergy = rms > 22; // próg mowy

    const now = Date.now();

    if (track === 'outbound') {
      // Ścieżka Właściciela / Handlowca
      if (hasVoiceEnergy) {
        session.lastRepSpeechTime = now;
        if (!session.isRepSpeaking) {
          session.isRepSpeaking = true;
          this.broadcastToUi(session, {
            type: 'REP_SPEAKING',
            isSpeaking: true
          });
        }
      } else if (session.isRepSpeaking && (now - session.lastRepSpeechTime > 800)) {
        session.isRepSpeaking = false;
        this.broadcastToUi(session, {
          type: 'REP_SPEAKING',
          isSpeaking: false
        });
      }
    } else if (track === 'inbound') {
      // Ścieżka Klienta (Klient mówi)
      if (hasVoiceEnergy) {
        session.lastInboundAudioTime = now;
        // Trzymamy tylko ostatnie 4 sekundy w RAM dla analizy intencji (ZDR - Zero Data Retention)
        session.inboundAudioBuffer.push(audioChunk);
        if (session.inboundAudioBuffer.length > 200) { // ok. 4 sekundy
          session.inboundAudioBuffer.shift();
        }
      } else if (session.inboundAudioBuffer.length > 25 && (now - session.lastInboundAudioTime > 700)) {
        // Klient właśnie skończył wypowiedź (cisza po mowie)
        if (!session.evaluatingInbound) {
          session.evaluatingInbound = true;
          const bufferToEvaluate = Buffer.concat(session.inboundAudioBuffer);
          session.inboundAudioBuffer = []; // natychmiastowe czyszczenie RAM (ZDR)

          this.evaluateCustomerIntent(session, bufferToEvaluate)
            .finally(() => {
              session.evaluatingInbound = false;
            });
        }
      }
    }
  }

  /**
   * Błyskawiczna ewaluacja wypowiedzi klienta i dopasowanie do 3-poziomowej Bazy Wiedzy FAQ
   */
  private async evaluateCustomerIntent(session: CopilotSession, audioBuffer: Buffer) {
    try {
      // Skrót Bazy Wiedzy do promptu decyzyjnego Flash
      const currentPromos = session.faqs.current.map(f => `[PROMO] ${f.question}: ${f.answer}`).join('\n');
      const permanentKnowledge = session.faqs.permanent.map(f => `[FAQ] ${f.question}: ${f.answer}`).join('\n');
      const confidentialLimits = session.faqs.confidential.map(f => `[POUFNE] ${f.question}: ${f.answer}`).join('\n');

      const systemPrompt = `
Jesteś ultranowoczesnym asystentem czasu rzeczywistego (Live Call Copilot) wspomagającym handlowca podczas rozmowy telefonicznej.
Twoim celem jest wygenerowanie TELEGRAFICZNEJ KARTY BOJOWEJ (Glanceable Battlecard) do odczytania w ułamku sekundy (<400ms scan time).

BAZA WIEDZY CZASOWA (Aktualne promocje, rabaty, akcje marketingowe):
${currentPromos || 'Brak aktywnych promocji czasowych.'}

BAZA WIEDZY STAŁA (Parametry, godziny, procedury, cenniki):
${permanentKnowledge || 'Standardowe warunki handlowe.'}

BAZA WIEDZY POUFNA (Maksymalny rabat, koszty, próg negocjacyjny):
${confidentialLimits || 'Brak poufnych progów.'}

WYMOGI FORMATOWANIA:
- Odpowiedz WYŁĄCZNIE poprawnym obiektem JSON:
{
  "category": "OBJECTION" | "FACT_QUERY" | "BUYING_SIGNAL" | "DEESCALATION",
  "heading": "Zwięzły tytuł sytuacji (maks. 5 słów)",
  "bullets": [
    "Pierwszy argument (3-5 słów)",
    "Drugi argument (3-5 słów z konkretną ceną/liczbą)",
    "Trzeci argument (3-5 słów z propozycją kroku)"
  ],
  "faqSource": "current" | "permanent" | "confidential" | null,
  "urgency": "high" | "medium" | "low"
}
BEZWZGLĘDNY ZAKAZ ścian tekstu i pełnych zdań. Wyłącznie telegraficzne hasła z twardymi liczbami.
`;

      const response = await this.ai.models.generateContent({
        model: AI_MODELS.TEXT_FLASH,
        contents: [
          {
            role: 'user',
            parts: [
              { text: systemPrompt },
              { text: `Ostatnia wypowiedź klienta (klient zadaje pytanie lub zgłasza wątpliwość). Przygotuj telegraficzną odpowiedź opartą o bazę wiedzy:` }
            ]
          }
        ],
        config: {
          responseMimeType: 'application/json'
        }
      });

      const responseText = response.text?.trim() || '{}';
      const battlecard = JSON.parse(responseText);

      if (battlecard && battlecard.heading && Array.isArray(battlecard.bullets)) {
        session.activeBattlecard = battlecard;
        this.broadcastToUi(session, {
          type: 'BATTLECARD_UPDATE',
          battlecard
        });
        console.log(`🎯 [CopilotEngine] Wygenerowano kartę bojową: "${battlecard.heading}" (źródło: ${battlecard.faqSource || 'ogólne'})`);
      }
    } catch (err: any) {
      console.warn('[CopilotEngine] Błąd generowania karty bojowej:', err.message);
    }
  }

  /**
   * Zakończenie sesji Copilota i czyszczenie pamięci
   */
  public endSession(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    this.broadcastToUi(session, { type: 'CALL_ENDED' });
    for (const ws of session.uiSockets) {
      try { ws.close(); } catch (e) {}
    }
    this.sessions.delete(sessionId);
    console.log(`🛑 [CopilotEngine] Zamknięto sesję Copilota: ${sessionId}`);
  }
}

export const copilotEngineService = CopilotEngineService.getInstance();
