import { WebSocket } from 'ws';
import { GoogleGenAI } from '@google/genai';
import { createRequire } from 'module';
import { prisma } from '../../prisma';
import { AI_MODELS } from '../../config/aiModels';
import { VoiceOutboundService } from './VoiceOutboundService';

const require = createRequire(import.meta.url);
const { mulaw } = require('alawmulaw');
const { WaveFile } = require('wavefile');

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
  mode?: 'bridge' | 'conference';
  createdAt: Date;
  uiSockets: Set<WebSocket>;
  callSid?: string;
  twilioStreamSid?: string;
  isRepSpeaking: boolean;
  lastRepSpeechTime: number;
  checklist: CopilotChecklistItem[];
  activeBattlecard?: BattlecardPayload;
  services: any[];
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
  private pendingConferenceByCaller = new Map<string, CopilotSession>();
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

  public getPendingConferenceSession(callerPhone: string, tenantId?: string): CopilotSession | undefined {
    const norm = callerPhone.replace(/[\s\-\+]/g, '');
    const session = this.pendingConferenceByCaller.get(norm) || this.pendingConferenceByCaller.get(`+${norm}`);
    if (session) {
      if (!tenantId || session.tenantId === tenantId) {
        return session;
      }
    }
    return undefined;
  }

  /**
   * Inicjalizuje nową sesję Copilota z pre-ładowaniem Bazy Wiedzy FAQ i historii CRM
   */
  public async createSession(options: {
    tenantId: string;
    customerPhone: string;
    customerName?: string;
    scenario?: string;
    mode?: 'bridge' | 'conference';
  }): Promise<CopilotSession> {
    const sessionId = `copilot_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    
    // Pobierz dane tenanta
    const tenant = await prisma.tenant.findUnique({
      where: { id: options.tenantId },
      include: {
        faqEntries: true,
        services: true
      }
    });

    const ownerPhone = tenant?.phoneNumber || '';

    // Podział Bazy Wiedzy FAQ na 3 poziomy: Czasowa, Stała i Poufna
    const allFaqs = tenant?.faqEntries || [];
    const currentFaqs = allFaqs.filter(f => f.category === 'current');
    const confidentialFaqs = allFaqs.filter(f => f.isConfidential);
    const permanentFaqs = allFaqs.filter(f => f.category !== 'current' && !f.isConfidential);

    // Pobierz historię klienta (CallLog, Appointment i kartotekę Customer)
    const normPhone = options.customerPhone.replace(/[\s\-\+]/g, '');
    const last9 = normPhone.length >= 9 ? normPhone.slice(-9) : normPhone;

    let recentCalls: any[] = [];
    let recentAppts: any[] = [];
    let customerRecord: any = null;

    try {
      [recentCalls, recentAppts, customerRecord] = await Promise.all([
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
        }),
        prisma.customer.findFirst({
          where: {
            tenantId: options.tenantId,
            phone: { contains: last9 }
          }
        })
      ]);
    } catch (dbErr: any) {
      console.warn('[CopilotEngine] Ostrzeżenie przy pobieraniu historii klienta:', dbErr.message);
    }

    const lastCallSummary = recentCalls[0]?.summary || '';
    const cleanLastSummary = lastCallSummary.replace(/^\[[^\]]+\]\s*/, '').trim();
    const scenario = options.scenario || (lastCallSummary ? 'callback' : 'sales');

    // Dynamiczna checklista bazująca na wybranym scenariuszu i historii kontaktu
    const checklist: CopilotChecklistItem[] = [];
    if (scenario === 'callback' && cleanLastSummary) {
      checklist.push(
        { id: '1', text: `Nawiąż do ostatniej rozmowy (${cleanLastSummary.slice(0, 38)}...)`, checked: false },
        { id: '2', text: 'Przedstaw skorygowaną kalkulację i warunki cenowe', checked: false },
        { id: '3', text: 'Potwierdź akceptację i wyślij podsumowanie SMS', checked: false }
      );
    } else if (scenario === 'sales') {
      checklist.push(
        { id: '1', text: tenant?.leadQuestion1 || 'Zbadaj aktualne potrzeby i parametry inwestycji', checked: false },
        { id: '2', text: tenant?.leadQuestion2 || 'Wskaż warianty i aktualny rabat z Bazy Czasowej', checked: false },
        { id: '3', text: tenant?.leadQuestion3 || 'Ustal termin przesłania koncepcji / kalkulacji', checked: false }
      );
    } else if (scenario === 'complaint') {
      checklist.push(
        { id: '1', text: 'Wysłuchaj bez przerywania (aktywna deeskalacja)', checked: false },
        { id: '2', text: 'Potwierdź zrozumienie problemu i przeproś za niedogodność', checked: false },
        { id: '3', text: 'Zaproponuj konkretne rozwiązanie z procedury gwarancyjnej', checked: false }
      );
    } else {
      checklist.push(
        { id: '1', text: 'Zbadaj bieżące potrzeby i parametry techniczne', checked: false },
        { id: '2', text: 'Odpowiedz na pytania w oparciu o Bazę FAQ', checked: false },
        { id: '3', text: 'Zaproponuj termin spotkania lub wysyłkę materiałów', checked: false }
      );
    }

    // Dynamiczna karta startowa (Pre-Call Briefing Card) zasilana historią klienta
    let initialBattlecard: BattlecardPayload;
    if (cleanLastSummary) {
      initialBattlecard = {
        category: 'BUYING_SIGNAL',
        heading: `Odprawa: ${options.customerName || 'Klient'}`,
        bullets: [
          cleanLastSummary,
          recentCalls[0]?.actionItems ? `Zadanie: ${recentCalls[0].actionItems}` : 'Cel: potwierdzić nowe parametry i cenę',
          'Baza FAQ: zweryfikuj specyfikację i rabat czasowy'
        ],
        faqSource: 'permanent',
        urgency: 'high'
      };
    } else if (scenario === 'sales') {
      initialBattlecard = {
        category: 'BUYING_SIGNAL',
        heading: 'Otwarcie rozmowy handlowej',
        bullets: [
          'Zbadaj wielkość i planowany termin inwestycji',
          'Podkreśl szybkość montażu i izolacyjność konstrukcji',
          'Wskaż aktualną promocję z Bazy Czasowej'
        ],
        faqSource: 'current',
        urgency: 'medium'
      };
    } else if (scenario === 'complaint') {
      initialBattlecard = {
        category: 'DEESCALATION',
        heading: 'Obsługa zgłoszenia / Deeskalacja',
        bullets: [
          'Wysłuchaj klienta bez wchodzenia w słowo',
          'Spisz dokładne punkty uwag do protokołu',
          'Zaproponuj termin wizyty serwisu lub rozwiązanie'
        ],
        faqSource: 'permanent',
        urgency: 'high'
      };
    } else {
      initialBattlecard = {
        category: 'FACT_QUERY',
        heading: 'Konsultacja ogólna',
        bullets: [
          'Zbadaj stan działki i warunków zabudowy',
          'Wyjaśnij etapy realizacji: projekt, stan surowy, wykończenie',
          'Zaproponuj przesłanie katalogu lub spotkanie'
        ],
        faqSource: 'permanent',
        urgency: 'low'
      };
    }

    const session: CopilotSession = {
      sessionId,
      tenantId: options.tenantId,
      ownerPhone,
      customerPhone: options.customerPhone,
      customerName: options.customerName || customerRecord?.name || 'Klient',
      scenario,
      mode: options.mode || 'bridge',
      createdAt: new Date(),
      uiSockets: new Set(),
      isRepSpeaking: false,
      lastRepSpeechTime: 0,
      checklist,
      services: tenant?.services || [],
      faqs: {
        current: currentFaqs,
        permanent: permanentFaqs,
        confidential: confidentialFaqs
      },
      customerHistory: {
        recentCallSummaries: recentCalls.map(c => c.summary ? `[${new Date(c.createdAt).toLocaleDateString('pl-PL')}]: ${c.summary}` : '').filter(Boolean),
        recentAppointments: recentAppts.map(a => `${a.service?.name || a.contactLevel || 'Zadanie'}: ${a.notes || ''} (${new Date(a.startTime).toLocaleDateString('pl-PL')})`)
      },
      inboundAudioBuffer: [],
      lastInboundAudioTime: 0,
      evaluatingInbound: false,
      activeBattlecard: initialBattlecard
    };

    this.sessions.set(sessionId, session);

    // Jeśli tryb to konferencja - zarejestruj oczekiwanie na połączenie od handlowca (ownerPhone)
    if (options.mode === 'conference') {
      const normalizedOwner = ownerPhone.replace(/[\s\-\+]/g, '');
      if (normalizedOwner) {
        this.pendingConferenceByCaller.set(normalizedOwner, session);
        this.pendingConferenceByCaller.set(`+${normalizedOwner}`, session);
        console.log(`🎧 [CopilotEngine] Zarejestrowano oczekiwanie na konferencję od handlowca: ${normalizedOwner} (sesja ${sessionId})`);
        setTimeout(() => {
          if (this.pendingConferenceByCaller.get(normalizedOwner)?.sessionId === sessionId) {
            this.pendingConferenceByCaller.delete(normalizedOwner);
            this.pendingConferenceByCaller.delete(`+${normalizedOwner}`);
          }
        }, 30 * 60 * 1000);
      }
    }

    console.log(`🎧 [CopilotEngine] Utworzono sesję Copilota (${options.mode || 'bridge'}): ${sessionId} dla klienta: ${options.customerPhone} (scenariusz: ${scenario})`);
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

    // Precyzyjna detekcja energii głosu na zdekodowanych próbkach 16-bit linear PCM (G.711 mulaw decode)
    const pcmInt16 = mulaw.decode(audioChunk);
    let sumSquares = 0;
    for (let i = 0; i < pcmInt16.length; i++) {
      sumSquares += pcmInt16[i] * pcmInt16[i];
    }
    const rms = Math.sqrt(sumSquares / pcmInt16.length);
    const hasVoiceEnergy = rms > 650; // próg mowy w 16-bit PCM (cisza: 0-200, mowa: 1000-8000)

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
      // Konwersja bufora mulaw 8kHz do WAV 8kHz w pamięci RAM
      let wavBase64 = '';
      try {
        const pcmInt16 = mulaw.decode(audioBuffer);
        const wav = new WaveFile();
        wav.fromScratch(1, 8000, '16', pcmInt16);
        const wavBytes = wav.toBuffer();
        wavBase64 = Buffer.from(wavBytes).toString('base64');
      } catch (audioErr: any) {
        console.warn('[CopilotEngine] Błąd konwersji audio WAV:', audioErr.message);
      }

      // Skrót Bazy Wiedzy i Cennika do promptu decyzyjnego Flash
      const currentPromos = session.faqs.current.map(f => `[PROMO] ${f.question}: ${f.answer}`).join('\n');
      const permanentKnowledge = session.faqs.permanent.map(f => `[FAQ] ${f.question}: ${f.answer}`).join('\n');
      const confidentialLimits = session.faqs.confidential.map(f => `[POUFNE] ${f.question}: ${f.answer}`).join('\n');
      const serviceCatalog = (session.services || []).map(s => `- ${s.name}: ${s.price ? `${s.price} zł` : 'Wycena indywidualna'} (${s.durationMinutes ? `${s.durationMinutes} min` : ''}) ${s.description || ''}`).join('\n');

      const callSummaries = session.customerHistory.recentCallSummaries.join('\n');
      const apptSummaries = session.customerHistory.recentAppointments.join('\n');
      const historyContext = (callSummaries || apptSummaries)
        ? `HISTORIA POPRZEDNICH ROZMÓW I ZDARZEŃ Z KLIENTEM:\n${callSummaries ? `Rozmowy:\n${callSummaries}\n` : ''}${apptSummaries ? `Zadania i terminy:\n${apptSummaries}` : ''}`
        : 'Pierwsza rozmowa z klientem.';

      const systemPrompt = `
Jesteś ultranowoczesnym asystentem czasu rzeczywistego (Live Call Copilot) wspomagającym handlowca podczas rozmowy telefonicznej.
Twoim celem jest wygenerowanie TELEGRAFICZNEJ KARTY BOJOWEJ (Glanceable Battlecard) do odczytania w ułamku sekundy (<400ms scan time).

ROZMÓWCA: ${session.customerName} (${session.customerPhone})
SCENARIUSZ ROZMOWY: ${session.scenario}
${historyContext}

CENNIK PRODUKTÓW I USŁUG FIRMY:
${serviceCatalog || 'Standardowy cennik usług.'}

BAZA WIEDZY CZASOWA (Aktualne promocje, rabaty, akcje marketingowe):
${currentPromos || 'Brak aktywnych promocji czasowych.'}

BAZA WIEDZY STAŁA (Parametry techniczne, procedury, realizacje, cenniki):
${permanentKnowledge || 'Standardowe warunki handlowe.'}

BAZA WIEDZY POUFNA (Maksymalny rabat, koszty, próg negocjacyjny):
${confidentialLimits || 'Brak poufnych progów.'}

WYMOGI FORMATOWANIA:
- Odpowiedz WYŁĄCZNIE poprawnym obiektem JSON:
{
  "category": "OBJECTION" | "FACT_QUERY" | "BUYING_SIGNAL" | "DEESCALATION",
  "heading": "Zwięzły tytuł sytuacji (maks. 5 słów)",
  "bullets": [
    "Pierwszy konkretny argument (3-5 słów)",
    "Drugi argument (3-5 słów z konkretną liczbą/ceną/terminem)",
    "Trzeci argument (3-5 słów z propozycją kolejnego kroku)"
  ],
  "faqSource": "current" | "permanent" | "confidential" | null,
  "urgency": "high" | "medium" | "low"
}
BEZWZGLĘDNY ZAKAZ ścian tekstu i pełnych zdań. Wyłącznie telegraficzne hasła z twardymi liczbami.
`;

      const userParts: any[] = [{ text: systemPrompt }];
      if (wavBase64) {
        userParts.push({
          inlineData: {
            mimeType: 'audio/wav',
            data: wavBase64
          }
        });
      }
      userParts.push({
        text: 'Odsłuchaj powyższe nagranie wypowiedzi klienta. Zidentyfikuj intencję, pytanie lub obiekcję i dopasuj telegraficzną odpowiedź opartą o bazę wiedzy i kontekst klienta:'
      });

      const response = await this.ai.models.generateContent({
        model: AI_MODELS.TEXT_FLASH,
        contents: [
          {
            role: 'user',
            parts: userParts
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
   * Zakończenie sesji Copilota, rozłączenie centrali Twilio i czyszczenie pamięci
   */
  public async endSession(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    if (session.callSid) {
      await VoiceOutboundService.terminateCall(session.callSid);
    }

    this.broadcastToUi(session, { type: 'CALL_ENDED' });
    for (const ws of session.uiSockets) {
      try { ws.close(); } catch (e) {}
    }
    for (const [key, sess] of this.pendingConferenceByCaller.entries()) {
      if (sess.sessionId === sessionId) {
        this.pendingConferenceByCaller.delete(key);
      }
    }
    this.sessions.delete(sessionId);
    console.log(`🛑 [CopilotEngine] Zamknięto sesję Copilota i rozłączono połączenie: ${sessionId}`);
  }
}

export const copilotEngineService = CopilotEngineService.getInstance();
