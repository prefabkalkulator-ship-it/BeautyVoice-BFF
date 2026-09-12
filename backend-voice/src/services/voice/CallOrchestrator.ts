import { WebSocket } from 'ws';
import twilio from 'twilio';
import { AudioPipeline } from './AudioPipeline';
import { VADService } from './VADService';
import { GeminiClient } from './GeminiClient';
import { prisma } from '../../prisma';
import { PushService } from '../PushService';

import { BookingService } from '../BookingService';
import { getPolishGenitive } from '../../prompts/systemPrompt';

const bookingService = new BookingService();

export class CallOrchestrator {
  private twilioWs: WebSocket;
  private streamSid: string = '';
  private callSid: string = '';
  private ownerPhone: string = '';
  private dialedNumber: string = '';
  private transferAttempted: boolean = false;
  private isPostTransferFallback: boolean = false;
  
  private vadService!: VADService;
  private geminiClient!: GeminiClient;
  
  // Adaptive Jitter Buffer (200ms) & Barge-In State
  private agentSpeaking: boolean = false;
  private isTurnCanceled: boolean = false;
  private isTurnStreaming: boolean = false;
  private turnAudioQueue: Uint8Array[] = [];
  private turnBufferedDurationMs: number = 0;
  private readonly PREBUFFER_THRESHOLD_MS: number = 200; // 200ms poduszka rozbiegowa (1600 bajtów 8kHz mulaw)

  // Inactivity / Silence Watchdog (30s) & EndCall state
  private lastActivityTime: number = Date.now();
  private silenceWatchdogInterval: NodeJS.Timeout | null = null;
  private readonly SILENCE_TIMEOUT_MS: number = 30000; // 30 sekund ciszy / szumu w tle
  private shouldHangupAfterTurn: boolean = false;
  private hangupTimeout: NodeJS.Timeout | null = null;
  
  private voiceName: string = "Aoede";
  private businessProfile: string = "solo";
  private bookingMode: string = "hourly";
  private tenantName: string = "BeautyVoice";
  private botName: string = "Ewa";
  private toneOfVoice: string = "profesjonalny";
  private tenantId: string = "";
  private callStartTime: number = 0;
  private hasSentGreeting: boolean = false;
  private callerPhone: string = "";
  private contextHistory: string = "";

  // Właściwości Asystenta Osobistego i Tożsamości
  private callerRole: 'OWNER' | 'VIP' | 'GUEST' | 'SPAM' = 'GUEST';
  private vipContact: any = null;
  private profession: string = '';
  private bioSummary: string = '';
  private bufferMinutes: number = 15;
  private ownerName: string = '';
  private ownerGender: string = 'MALE';
  private companyName: string = '';
  private businessCategory: string = '';
  private assistantRole: string = 'executive_gatekeeper';
  private defaultFormalityLevel: string = 'formal_pan_pani';
  private callSummaryFromAi: string | null = null;
  private callerNameFromAi: string | null = null;
  private isReturningCaller: boolean = false;
  private returningCallerName: string = '';
  private returningCallerGender: 'MALE' | 'FEMALE' | 'UNKNOWN' = 'UNKNOWN';

  // PIN & Confidential Knowledge State
  private ownerRequirePin: boolean = false;
  private isOwnerPinVerified: boolean = false;
  private ownerPinAttempts: number = 0;
  private confidentialTopics: string[] = [];
  private isConfidentialUnlocked: boolean = false;
  private confidentialPinAttempts: number = 0;

  private isReady: boolean = false;
  private twilioMessageBuffer: string[] = [];

  constructor(twilioConnection: WebSocket) {
    this.twilioWs = twilioConnection;
    this.lastActivityTime = Date.now();
    this.silenceWatchdogInterval = setInterval(() => this.checkSilenceTimeout(), 2000);
    
    this.twilioWs.on('message', async (message: string) => {
      const msgStr = message.toString();
      if (!this.isReady) {
        this.twilioMessageBuffer.push(msgStr);
        try {
          const data = JSON.parse(msgStr);
          if (data.event === 'start') {
            this.callSid = data.start.callSid || data.start.customParameters?.callSid || '';
            const dialedNumber = data.start.customParameters?.dialedNumber || 'unknown';
            this.dialedNumber = dialedNumber;
            const outboundTaskId = data.start.customParameters?.outboundTaskId;
            this.callerPhone = data.start.customParameters?.callerPhone || "";
            const tenantIdParam = data.start.customParameters?.tenantId;

            // --- SZYBKA ŚCIEŻKA: tylko tenant lookup (1-2 zapytania), potem natychmiast initAsync ---
            let tenant = null;
            if (tenantIdParam) {
              tenant = await prisma.tenant.findUnique({ where: { id: tenantIdParam }, include: { subscription: true } });
            }
            if (!tenant && outboundTaskId) {
              const task = await prisma.outboundQueue.findUnique({ where: { id: outboundTaskId }, include: { tenant: true } });
              if (task && task.tenant) {
                tenant = task.tenant;
              }
            }
            
            if (!tenant) {
              let normalizedDialed = dialedNumber;
              if (normalizedDialed !== 'unknown' && !normalizedDialed.startsWith('+')) {
                normalizedDialed = '+' + normalizedDialed;
              }
              tenant = await prisma.tenant.findFirst({
                where: { OR: [{ assignedPhoneNumber: normalizedDialed }, { phoneNumber: normalizedDialed }] },
                include: { subscription: true }
              });
            }
            
            if (!tenant) {
              tenant = await prisma.tenant.findFirst({
                where: { name: { not: 'DEMO' } },
                include: { subscription: true }
              });
            }

            if (tenant && (tenant.isSuspended || (tenant.subscription && (tenant.subscription.status === 'paused' || tenant.subscription.status === 'canceled')))) {
              console.log(`🚫 [CallOrchestrator] Połączenie odrzucone dla tenanta ${tenant.name} - konto zablokowane (isSuspended: ${tenant.isSuspended}, sub: ${tenant.subscription?.status})`);
              this.twilioWs.close();
              return;
            }

            // Uruchom Gemini NATYCHMIAST — asystent może się przywitać
            await this.initAsync(tenant);
          }
        } catch(e) {
          console.error('❌ [CallOrchestrator] Błąd obsługi zdarzenia start:', e);
        }
      } else {
        await this.handleTwilioMessage(msgStr);
      }
    });

    this.twilioWs.on('close', async () => {
      if (this.silenceWatchdogInterval) {
        clearInterval(this.silenceWatchdogInterval);
        this.silenceWatchdogInterval = null;
      }
      if (this.hangupTimeout) {
        clearTimeout(this.hangupTimeout);
        this.hangupTimeout = null;
      }
      if (this.geminiClient) this.geminiClient.close();
      if (this.callStartTime && this.tenantId) {
        const durationMs = Date.now() - this.callStartTime;
        const minutes = Math.ceil(durationMs / 60000);
        try {
          
          const updatedSub = await prisma.subscription.update({
            where: { tenantId: this.tenantId },
            data: { minutesUsed: { increment: minutes } },
            include: { tenant: true }
          });
          console.log(`[Billing] Dodano ${minutes} min. dla ${this.tenantId}`);
          
          if (updatedSub.minutesUsed > updatedSub.minutesIncluded && (updatedSub.minutesUsed - minutes) <= updatedSub.minutesIncluded) {
            // Właśnie przekroczono pakiet
            if (updatedSub.tenant.fcmTokens && updatedSub.tenant.fcmTokens.length > 0) {
              await PushService.sendNotification(
                updatedSub.tenant.fcmTokens,
                'Wykorzystano darmowe minuty! 🕒',
                `Przekroczyłeś swój pakiet ${updatedSub.minutesIncluded} minut. Od teraz naliczana jest opłata groszowa zgodnie z Twoim planem (${updatedSub.planName}).`
              );
            }
          }

        } catch(e) { console.error('[Billing error]', e); }

        // Zapis do rejestru połączeń (CallLog)
        try {
          const durationSeconds = Math.round(durationMs / 1000);

          // Sprawdzamy czy w trakcie tej rozmowy zapisano już CallLog (np. przez save_call_message)
          const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
          let callLog = await prisma.callLog.findFirst({
            where: {
              tenantId: this.tenantId,
              callerPhone: this.callerPhone || 'nieznany',
              durationSeconds: 0,
              createdAt: { gte: fiveMinutesAgo }
            },
            orderBy: { createdAt: 'desc' }
          });

          const resolvedSummary = this.callSummaryFromAi || undefined;
          const resolvedCallerName = this.vipContact 
            ? this.vipContact.contactName 
            : (this.callerRole === 'OWNER' 
                ? (this.ownerName || this.tenantName) 
                : (this.callerNameFromAi || undefined));

          if (callLog) {
            callLog = await prisma.callLog.update({
              where: { id: callLog.id },
              data: { 
                durationSeconds,
                summary: resolvedSummary || callLog.summary,
                callerName: resolvedCallerName || callLog.callerName
              }
            });
            console.log(`📝 [CallOrchestrator] Zaktualizowano istniejący CallLog (${callLog.id}) czasem: ${durationSeconds}s`);
          } else {
            callLog = await prisma.callLog.create({
              data: {
                tenantId: this.tenantId,
                callerPhone: this.callerPhone || 'nieznany',
                callerName: resolvedCallerName || null,
                callerRole: this.callerRole,
                durationSeconds,
                status: 'completed',
                summary: resolvedSummary || null,
                isProcessed: false
              }
            });
            console.log(`📝 [CallOrchestrator] Zapisano nowy CallLog: role=${this.callerRole}, duration=${durationSeconds}s, summary="${resolvedSummary || ''}"`);
          }

          // Asynchroniczny Post-call worker dla asystenta osobistego
          if (this.businessProfile === 'personal' && callLog) {
            import('../../jobs/PersonalAssistantWorker').then(({ PersonalAssistantWorker }) => {
              PersonalAssistantWorker.processPostCall(callLog.id).catch(workerErr => {
                console.error('[CallOrchestrator] Błąd post-call worker:', workerErr);
              });
            }).catch(e => console.error('[CallOrchestrator] Błąd importu PersonalAssistantWorker:', e));
          }
        } catch(logErr) {
          console.error('[CallOrchestrator] Błąd zapisu CallLog:', logErr);
        }
      }
    });
  }

  private checkSilenceTimeout() {
    const silentDuration = Date.now() - this.lastActivityTime;
    if (silentDuration >= this.SILENCE_TIMEOUT_MS) {
      console.log(`⏱️ [Silence Watchdog] Wykryto ${Math.round(silentDuration / 1000)}s ciszy/szumu w tle. Automatyczne odłożenie słuchawki.`);
      if (this.silenceWatchdogInterval) {
        clearInterval(this.silenceWatchdogInterval);
        this.silenceWatchdogInterval = null;
      }
      this.twilioWs.close();
    }
  }

  private async initAsync(tenant: any) {
    try {
      if (tenant) {
        this.voiceName = tenant.aiVoice || "Aoede";
        this.businessProfile = tenant.businessProfile || "solo";
        this.bookingMode = tenant.bookingMode || "hourly";
        this.tenantName = tenant.name || "BeautyVoice";
        this.botName = (tenant.botName !== undefined && tenant.botName !== null) ? tenant.botName : "Ewa";
        this.toneOfVoice = tenant.toneOfVoice || "profesjonalny";
        this.tenantId = tenant.id;
        this.profession = tenant.profession || "";
        this.bioSummary = tenant.bioSummary || "";
        this.bufferMinutes = tenant.bufferMinutes || 15;
        this.ownerPhone = tenant.phoneNumber || "";
        this.ownerName = tenant.ownerName || tenant.name || "";
        this.ownerGender = tenant.ownerGender || "MALE";
        this.companyName = tenant.companyName || "";
        this.businessCategory = tenant.businessCategory || "";
        this.assistantRole = tenant.assistantRole || "executive_gatekeeper";
        this.ownerRequirePin = Boolean(tenant.ownerRequirePin);

        // Pobieramy tematy wiedzy poufnej dla tego salonu
        try {
          this.confidentialTopics = await bookingService.getConfidentialTopics(tenant.id);
          if (this.confidentialTopics.length > 0) {
            console.log(`🔒 [CallOrchestrator] Załadowano ${this.confidentialTopics.length} tematów wiedzy poufnej`);
          }
        } catch (confErr) {
          console.error('[CallOrchestrator] Błąd pobierania tematów poufnych:', confErr);
        }

        // Router identyfikacji dzwoniącego (Owner vs VIP vs Guest)
        const normCaller = this.callerPhone.replace(/[\s\-\+]/g, '');
        const normOwner = (tenant.phoneNumber || '').replace(/[\s\-\+]/g, '');

        if (normCaller && normOwner && (normCaller === normOwner || normCaller.endsWith(normOwner) || normOwner.endsWith(normCaller))) {
          this.callerRole = 'OWNER';
          if (this.ownerRequirePin && tenant.pinCode) {
            this.isOwnerPinVerified = false;
            console.log(`🔒 [CallOrchestrator] Rozpoznano WŁAŚCICIELA, ale WYMAGANA AUTORYZACJA KODEM PIN (${this.callerPhone})`);
          } else {
            this.isOwnerPinVerified = true;
            console.log(`👑 [CallOrchestrator] Rozpoznano połączenie od WŁAŚCICIELA: ${tenant.name} (${this.callerPhone})`);
          }
        } else if (this.callerPhone) {
          this.vipContact = await prisma.vipContact.findFirst({
            where: {
              tenantId: tenant.id,
              OR: [
                { phoneNumber: this.callerPhone },
                { phoneNumber: this.callerPhone.startsWith('+') ? this.callerPhone.substring(1) : '+' + this.callerPhone }
              ]
            }
          });
          if (this.vipContact) {
            this.callerRole = 'VIP';
            console.log(`⭐ [CallOrchestrator] Rozpoznano kontakt VIP: ${this.vipContact.contactName} (${this.vipContact.category})`);
          } else {
            this.callerRole = 'GUEST';

            // Sprawdzamy czy dzwoniący jest powracającym rozmówcą (Returning Caller z CallLog lub Customer)
            const normCallerDigits = normCaller.length >= 9 ? normCaller.slice(-9) : normCaller;
            try {
              const [prevLog, cust] = await Promise.all([
                prisma.callLog.findFirst({
                  where: {
                    tenantId: tenant.id,
                    callerPhone: { contains: normCallerDigits },
                    callerName: { not: null }
                  },
                  orderBy: { createdAt: 'desc' }
                }),
                prisma.customer.findFirst({
                  where: {
                    tenantId: tenant.id,
                    phone: { contains: normCallerDigits },
                    name: { not: '' }
                  }
                })
              ]);

              const foundName = prevLog?.callerName || cust?.name;
              if (foundName && foundName.trim() && !['nieznany', 'brak', 'unknown', 'nieznany rozmówca'].includes(foundName.toLowerCase().trim())) {
                this.isReturningCaller = true;
                this.returningCallerName = foundName.trim();
                const firstWord = this.returningCallerName.split(' ')[0].toLowerCase().replace(/[^a-ząćęłńóśźż]/g, '');
                if (['kuba', 'bonawentura', 'kosma', 'jarema', 'barnaba'].includes(firstWord)) {
                  this.returningCallerGender = 'MALE';
                } else if (firstWord.endsWith('a')) {
                  this.returningCallerGender = 'FEMALE';
                } else {
                  this.returningCallerGender = 'MALE';
                }
                console.log(`🔁 [CallOrchestrator] Rozpoznano powracającego rozmówcę: ${this.returningCallerName} (Płeć: ${this.returningCallerGender})`);
              }
            } catch (retErr) {
              console.error('[CallOrchestrator] Błąd szukania powracającego rozmówcy:', retErr);
            }
          }
        }
      }
    } catch (err) {
      console.error("[Orchestrator] Błąd pobierania tenanta:", err);
    }

    this.vadService = new VADService();
    await VADService.init();

    const isDemoLine = this.tenantName === 'DEMO' || this.businessProfile === 'demo';
    const effectiveFormality = (this.vipContact?.formalityLevel && this.vipContact.formalityLevel !== 'default')
      ? this.vipContact.formalityLevel
      : this.defaultFormalityLevel;

    this.geminiClient = new GeminiClient({
      onAudioReceived: (audioBase64) => this.streamGeminiAudioToCaller(audioBase64),
      onToolCall: (toolCall) => this.orchestrateToolCallWithFiller(toolCall),
      onInterrupted: () => this.handleGeminiInterrupted(),
      onTurnComplete: () => this.handleGeminiTurnComplete(),
      voiceName: this.voiceName,
      businessProfile: this.businessProfile,
      bookingMode: this.bookingMode,
      tenantName: this.tenantName,
      botName: this.botName,
      toneOfVoice: this.toneOfVoice,
      contextHistory: this.contextHistory,
      tenantId: this.tenantId,
      callerRole: this.callerRole,
      vipName: this.vipContact?.contactName,
      vipCategory: this.vipContact?.category,
      vipNotes: this.vipContact?.customNotes,
      profession: this.profession,
      bioSummary: this.bioSummary,
      bufferMinutes: this.bufferMinutes,
      ownerName: this.ownerName,
      ownerGender: this.ownerGender,
      companyName: this.companyName,
      businessCategory: this.businessCategory,
      assistantRole: this.assistantRole,
      formalityLevel: effectiveFormality,
      personalSchedule: tenant?.personalSchedule,
      callerPhone: this.callerPhone,
      proactiveMode: tenant?.proactiveMode ?? isDemoLine,
      isReturningCaller: this.isReturningCaller,
      returningCallerName: this.returningCallerName,
      returningCallerGender: this.returningCallerGender,
      ownerRequirePin: this.ownerRequirePin,
      isOwnerPinVerified: this.isOwnerPinVerified,
      confidentialTopics: this.confidentialTopics
    });

    this.geminiClient.connect();

    this.isReady = true;
    for (const msg of this.twilioMessageBuffer) {
      await this.handleTwilioMessage(msg);
    }
    this.twilioMessageBuffer = [];
  }

  private async handleTwilioMessage(message: string) {
    try {
      const data = JSON.parse(message);

      switch (data.event) {
        case 'connected':
          break;
        case 'start':
          this.streamSid = data.start.streamSid;
          this.callSid = data.start.callSid || data.start.customParameters?.callSid || this.callSid || '';
          this.dialedNumber = data.start.customParameters?.dialedNumber || this.dialedNumber || '';
          this.callStartTime = Date.now();
          const callerPhone = data.start.customParameters?.callerPhone || 'unknown';
          const outboundTaskId = data.start.customParameters?.outboundTaskId;
          const isPostTransferFallback = data.start.customParameters?.isPostTransferFallback === 'true';
          const fallbackVipName = data.start.customParameters?.vipName || '';
          if (isPostTransferFallback) {
            this.isPostTransferFallback = true;
            this.transferAttempted = true;
          }
          
          setTimeout(async () => {
            let contextText = '';
            if (isPostTransferFallback && this.geminiClient) {
              contextText = `UWAGA: Próba bezpośredniego połączenia z właścicielem nie powiodła się (właściciel nie odebrał w ciągu 30 sekund lub odrzucił połączenie). Rozmówca (${fallbackVipName || 'kontakt VIP'}) powrócił na linię. NATYCHMIAST przemów jako pierwsza i powiedz dosłownie: "Właściciel nie mógł teraz odebrać. Zostaw wiadomość, a przekażę ją natychmiast." Następnie wysłuchaj i zapisz jego wiadomość narzędziem save_call_message. Pod żadnym pozorem NIE próbuj łączyć ponownie!`;
            } else if (outboundTaskId && this.tenantId) {
               // OUTBOUND CALL LOGIC
               const task = await prisma.outboundQueue.findUnique({ where: { id: outboundTaskId } });
               if (task) {
                  const payload = typeof task.payload === 'object' && task.payload !== null ? task.payload as any : {};
                  contextText = `UWAGA: To jest połączenie wychodzące, które TY (asystentka) wykonujesz! Klient (${payload.customerName || task.targetPhone}) właśnie odebrał. Numer telefonu klienta to: ${task.targetPhone}. CEL ROZMOWY: ${payload.text}. MUSISZ NATYCHMIAST PRZEMÓWIĆ JAKO PIERWSZA, zanim klient coś powie!`;
                  // Oznacz task jako zakończony
                  await prisma.outboundQueue.update({ where: { id: task.id }, data: { status: 'done', processedAt: new Date() } });
               }
            } else if ((this.tenantName === 'DEMO' || this.businessProfile === 'demo') && this.geminiClient) {
              // LINIA TESTOWA DEMO (EVA Brand Ambassador)
              contextText = `To jest połączenie na linię testową platformy EasyVoiceAssistant, EVA. Numer dzwoniącego: ${callerPhone}. Twoim PIERWSZYM ZDANIEM musi być dokładnie: "Dzień dobry! Dodzwoniłeś się na linię testową platformy EasyVoiceAssistant, EVA. Twój przyszły asystent głosowy. Czy chcesz dowiedzieć się, jak działam, czy wolisz poznać, co obejmują nasze plany cenowe?". ZAKAZ mówienia, że ktoś nie może odebrać!`;
            } else if (this.businessProfile === 'personal' && this.geminiClient && this.tenantId) {
              // INBOUND DLA ASYSTENTA OSOBISTEGO
              const isMale = ['Puck', 'Charon'].includes(this.voiceName);
              const assistantTitle = isMale ? 'asystentem wirtualnym' : 'wirtualną asystentką';
              const ownerDisplayName = this.ownerName || this.tenantName;
              const ownerGenitivePrefix = this.ownerGender === 'FEMALE' ? 'pani' : 'pana';
              const ownerGenitiveName = getPolishGenitive(ownerDisplayName, this.ownerGender);
              const ownerFirst = ownerDisplayName.split(' ')[0];
              const ownerFirstGenitive = getPolishGenitive(ownerFirst, this.ownerGender);
              const ownerTitle = this.ownerGender === 'FEMALE' ? 'Pani' : 'Pan';

              if (this.callerRole === 'OWNER') {
                if (this.ownerRequirePin && !this.isOwnerPinVerified) {
                  contextText = `Rozmawiasz ze swoim WŁAŚCICIELEM / SZEFEM: ${ownerDisplayName}. Ze względów bezpieczeństwa włączona jest autoryzacja kodem PIN. Twoim PIERWSZYM ZDANIEM musi być: "Dzień dobry ${ownerFirst}! Ze względów bezpieczeństwa, proszę podaj swój kod PIN, aby odblokować funkcje asystenta." KATEGORYCZNY ZAKAZ podawania jakichkolwiek informacji o kalendarzu, wiadomościach czy połączeniach, dopóki rozmówca nie poda PIN-u i nie zweryfikujesz go pomyślnie narzędziem verify_owner_pin.`;
                } else {
                  contextText = `Rozmawiasz ze swoim WŁAŚCICIELEM / SZEFEM: ${ownerDisplayName}. Przywitaj się krótko po imieniu ("Cześć ${ownerDisplayName}!"). Zapytaj co słychać lub czy przedstawić raport.`;
                }
              } else if (this.callerRole === 'VIP' && this.vipContact) {
                const vipFormality = (this.vipContact.formalityLevel && this.vipContact.formalityLevel !== 'default')
                  ? this.vipContact.formalityLevel
                  : this.defaultFormalityLevel;

                if (vipFormality === 'direct_ty') {
                  contextText = `Rozmawiasz z bliskim kontaktem z bazy VIP/Rodzina: ${this.vipContact.contactName} (${this.vipContact.category}). Zwracaj się bezpośrednio na "Ty". Przywitaj się wyjątkowo ciepło i po imieniu: "Cześć ${this.vipContact.contactName}! ${ownerTitle} ${ownerFirst} nie może w tej chwili odebrać. Czy chciałbyś/chciałabyś zostawić wiadomość, czy umówić dogodny termin rozmowy?".`;
                } else {
                  contextText = `Rozmawiasz z kontaktem VIP: ${this.vipContact.contactName} (${this.vipContact.category}). Zwracaj się z pełnym szacunkiem per Pan/Pani. Przywitaj się serdecznie: "Dzień dobry, jestem ${assistantTitle} ${ownerGenitivePrefix} ${ownerFirstGenitive}. ${ownerTitle} ${ownerFirst} nie może w tej chwili odebrać. Czy chciałby Pan / chciałaby Pani zostawić wiadomość, czy zarezerwować dogodny termin rozmowy?".
DYSKRECJA NAZWISKA: W powitaniu i trakcie rozmowy mów wyłącznie '${ownerTitle} ${ownerFirst}'. ZAKAZ podawania nazwiska z własnej inicjatywy.`;
                }
              } else if (this.isReturningCaller && this.returningCallerName) {
                // POWRACAJĄCY ROZMÓWCA ZE ZNANĄ TOŻSAMOŚCIĄ (Krótkie, zgodne z prawem powitanie)
                const firstName = this.returningCallerName.split(' ')[0];
                let vocative = '';
                if (this.returningCallerGender === 'FEMALE') {
                  vocative = `Pani ${firstName}`;
                } else {
                  if (firstName.endsWith('ek')) vocative = `Panie ${firstName.slice(0, -2)}ku`;
                  else if (firstName.endsWith('r')) vocative = `Panie ${firstName}ze`;
                  else if (firstName.endsWith('ł')) vocative = `Panie ${firstName.slice(0, -1)}le`;
                  else if (firstName.endsWith('n')) vocative = `Panie ${firstName}ie`;
                  else vocative = `Panie ${firstName}`;
                }

                contextText = `Rozmawiasz ze ZNANYM POWRACAJĄCYM ROZMÓWCĄ: ${this.returningCallerName} (${vocative}). Numer: ${callerPhone}. Dzwonił już wcześniej i zna Twoje możliwości.
ABSOLUTNY ZAKAZ pytania "z kim mam przyjemność?" i ZAKAZ długiego dwuetapowego onboardingu!
Twoim PIERWSZYM ZDANIEM musi być krótkie, profesjonalne powitanie z imieniem w wołaczu:
"Dzień dobry ${vocative}, z tej strony ${assistantTitle} ${ownerGenitivePrefix} ${ownerFirstGenitive}. W czym mogę dzisiaj pomóc?".
JEŚLI ROZMÓWCA OD RAZU PODAJE DYSPOZYCJĘ LUB WIADOMOŚĆ (np. "Przekaż żeby podszedł do biura", "Niech oddzwoni"): NATYCHMIAST potwierdź przyjęcie ("Oczywiście, przekazuję panu ${ownerFirst} wiadomość: ...") i wywołaj narzędzie save_call_message! ZAKAZ formułek odmownych!
DYSKRECJA NAZWISKA: Mów wyłącznie '${ownerTitle} ${ownerFirst}'. ZAKAZ podawania nazwiska z własnej inicjatywy.`;
              } else {
                // Tura 1 Onboardingu dla nowego rozmówcy z zewnątrz (GUEST): 100% neutralność i prośba o przedstawienie się
                contextText = `Dzwoni rozmówca z zewnątrz z numeru ${callerPhone}. Reprezentujesz: ${ownerDisplayName}. Twoim PIERWSZYM ZDANIEM (Tura 1) musi być DOKŁADNIE: "Witam, jestem ${assistantTitle} ${ownerGenitivePrefix} ${ownerFirstGenitive}, z kim mam przyjemność?".
JEŚLI ROZMÓWCA OD RAZU PODAJE DYSPOZYCJĘ LUB WIADOMOŚĆ (np. "Przekaż żeby podszedł do biura", "Niech oddzwoni", "Niech zadzwoni do..."): NATYCHMIAST potwierdź przyjęcie ("Oczywiście, przekazuję panu ${ownerFirst} wiadomość: żeby podszedł do biura") i wywołaj narzędzie save_call_message! ZAKAZ formułek odmownych!
DYSKRECJA NAZWISKA: W powitaniu i trakcie rozmowy mów wyłącznie '${ownerTitle} ${ownerFirst}' (np. 'pan ${ownerFirst}'). KATEGORYCZNY ZAKAZ podawania nazwiska właściciela, chyba że rozmówca wprost o to zapyta ("A o jakiego pana ${ownerFirst} chodzi?"). Wtedy i tylko wtedy potwierdź pełne nazwisko.
W przeciwnym razie, gdy rozmówca tylko się przedstawi, przejdź do Tury 2 według instrukcji systemowych.`;
              }
            } else if (callerPhone !== 'unknown' && this.geminiClient && this.tenantId) {
              // PAKIET BIZNESOWY (Standard / Premium)
              const compName = this.companyName || this.tenantName;
              const isMale = ['Puck', 'Charon'].includes(this.voiceName);
              const botRole = isMale ? "Wirtualny Asystent" : "Wirtualna Asystentka";
              const botDisplayName = this.botName || botRole;

              try {
                const [knownCustomer, lastAppt] = await Promise.all([
                  prisma.customer.findFirst({ where: { phone: callerPhone, tenantId: this.tenantId } }),
                  prisma.appointment.findFirst({
                    where: { customerPhone: callerPhone, tenantId: this.tenantId },
                    orderBy: { startTime: 'desc' },
                    include: { service: true }
                  })
                ]);

                if (knownCustomer) {
                  const visitInfo = lastAppt ? ` Ostatnia wizyta: ${lastAppt.service.name}.` : '';
                  const custFormality = (knownCustomer.formalityLevel && knownCustomer.formalityLevel !== 'default')
                    ? knownCustomer.formalityLevel
                    : this.defaultFormalityLevel;

                  if (custFormality === 'direct_ty') {
                    contextText = `To jest połączenie od stałego klienta: ${knownCustomer.name} z numeru ${callerPhone}.${visitInfo} Zwracaj się bezpośrednio na "Ty". Powitaj ciepło po imieniu: "Cześć ${knownCustomer.name}! Miło Cię słyszeć. Z tej strony ${botDisplayName} z firmy ${compName}. W czym mogę dzisiaj pomóc?". ZAKAZ pytania o imię i numer.`;
                  } else {
                    contextText = `To jest połączenie od stałego klienta: ${knownCustomer.name} z numeru ${callerPhone}.${visitInfo} Powitaj ciepło i z szacunkiem po imieniu w pierwszym zdaniu. ZAKAZ pytania o imię i numer (masz już te dane).`;
                  }
                } else {
                  contextText = `Nowy klient dzwoni z numeru: ${callerPhone}. Twoim PIERWSZYM ZDANIEM musi być: "Dzień dobry, dodzwoniłeś się do firmy ${compName}. Z tej strony ${botDisplayName}. W czym mogę dzisiaj pomóc?".`;
                }
              } catch (err) {
                console.error('[Orchestrator] Błąd sprawdzania historii klienta:', err);
              }
            }
            if (this.geminiClient) this.geminiClient.sendInitialGreeting(contextText);
          }, 800);
          break;
        case 'media':
          const payloadBase64 = data.media.payload;
          await this.processIncomingAudio(payloadBase64);
          break;
        case 'stop':
          this.geminiClient.close();
          break;
      }
    } catch (err) {
      console.error('[Twilio] Błąd parsowania wiadomości WS:', err);
    }
  }

  private handleGeminiInterrupted() {
    console.log('⚡ [CallOrchestrator] Sygnał interrupted z Gemini Live API (Google wykrył mowę użytkownika).');
    this.executeBargeInMechanism();
  }

  private handleGeminiTurnComplete() {
    this.lastActivityTime = Date.now();
    // Jeśli tura była krótsza niż 200ms (np. pojedyncze "Tak"), uwalniamy bufor
    if (!this.isTurnStreaming && this.turnAudioQueue.length > 0 && !this.isTurnCanceled) {
      this.flushTurnBufferToTwilio();
    }
    this.isTurnStreaming = false;
    this.agentSpeaking = false;

    if (this.shouldHangupAfterTurn) {
      console.log('📞 [EndCall] Zakończenie rozmowy po pożegnaniu. Odłożenie słuchawki za 1.5s.');
      this.hangupTimeout = setTimeout(() => {
        if (this.silenceWatchdogInterval) {
          clearInterval(this.silenceWatchdogInterval);
          this.silenceWatchdogInterval = null;
        }
        this.twilioWs.close();
      }, 1500);
    }
  }

  private executeBargeInMechanism() {
    if (this.isTurnCanceled) return;
    console.log('🛑 [Barge-in] Wykryto przerwanie! Natychmiastowe zatrzymanie mowy asystenta.');
    
    this.isTurnCanceled = true;
    this.shouldHangupAfterTurn = false;
    if (this.hangupTimeout) {
      clearTimeout(this.hangupTimeout);
      this.hangupTimeout = null;
    }
    this.agentSpeaking = false;
    this.isTurnStreaming = false;
    this.turnAudioQueue = [];
    this.turnBufferedDurationMs = 0;
    
    // Błyskawiczne wyczyszczenie bufora odtwarzacza w Twilio
    this.twilioWs.send(JSON.stringify({
      event: 'clear',
      streamSid: this.streamSid
    }));
  }

  private async orchestrateToolCallWithFiller(toolCall: any) {
    try {
      const functionResponses = [];
      for (const functionCall of toolCall.functionCalls) {
        const actionResult = await this.executeBusinessAction(functionCall);
        functionResponses.push({
          id: functionCall.id,
          name: functionCall.name,
          response: { result: actionResult }
        });
      }

      this.geminiClient.sendToolResponse(functionResponses);
    } catch (err: any) {
      console.error('[ToolCall] Błąd wykonania narzędzia:', err);
    }
  }

  private async executeBusinessAction(functionCall: any) {
    console.log(`[Backend] Wykonuję operację biznesową: ${functionCall.name} z argumentami:`, JSON.stringify(functionCall.args));
    
    try {
      if (!this.tenantId) return { error: "Brak salonu w bazie danych." };
      const tenantId = this.tenantId;

      const args = functionCall.args || {};

      switch (functionCall.name) {
        case 'getServicesAndPrices':
          return await bookingService.getServicesAndPrices(tenantId);
        case 'getFAQ':
          return await bookingService.getFAQ(tenantId, this.isConfidentialUnlocked);
        case 'verify_owner_pin': {
          const result = await bookingService.verifyOwnerPin(tenantId, args.pin);
          if (result.success) {
            this.isOwnerPinVerified = true;
            this.ownerPinAttempts = 0;
            console.log(`🔓 [CallOrchestrator] Właściciel autoryzowany kodem PIN!`);
            return {
              success: true,
              message: "Kod PIN poprawny. Dostęp do funkcji zarządczych został autoryzowany. Przywitaj szefa po imieniu i zaoferuj podsumowanie dnia lub zapytaj w czym możesz pomóc."
            };
          } else {
            this.ownerPinAttempts = (this.ownerPinAttempts || 0) + 1;
            console.warn(`❌ [CallOrchestrator] Błędny PIN Właściciela (${this.ownerPinAttempts}/3)`);
            if (this.ownerPinAttempts >= 3) {
              this.callerRole = 'GUEST';
              return {
                success: false,
                message: "Przekroczono maksymalną liczbę prób (3). Odmowa autoryzacji do trybu Właściciela. Przełączono w tryb gościa."
              };
            }
            return {
              success: false,
              message: `Niepoprawny kod PIN. Pozostało prób: ${3 - this.ownerPinAttempts}. Poproś o ponowne podanie PIN.`
            };
          }
        }
        case 'verify_confidential_pin': {
          const result = await bookingService.verifyConfidentialPin(tenantId, args.pin, args.topic);
          if (result.success) {
            this.isConfidentialUnlocked = true;
            this.confidentialPinAttempts = 0;
            console.log(`🔓 [CallOrchestrator] Wiedza poufna odblokowana kodem PIN!`);
            return {
              success: true,
              message: result.message,
              answer: result.answer
            };
          } else {
            this.confidentialPinAttempts = (this.confidentialPinAttempts || 0) + 1;
            console.warn(`❌ [CallOrchestrator] Błędny PIN wiedzy poufnej (${this.confidentialPinAttempts}/3)`);
            if (this.confidentialPinAttempts >= 3) {
              return {
                success: false,
                message: "Przekroczono maksymalną liczbę prób PIN. Dostęp do tej informacji został zablokowany. Zaproponuj kontakt w innej sprawie lub pozostawienie wiadomości dla właściciela."
              };
            }
            return {
              success: false,
              message: `Błędny kod PIN do wiedzy poufnej. Pozostało prób: ${3 - this.confidentialPinAttempts}. Poproś o ponowne podanie PIN.`
            };
          }
        }
        case 'checkAvailability':
          return { availableSlots: await bookingService.checkAvailability(
            tenantId, 
            args.date, 
            args.serviceName, 
            args.durationMinutes, 
            args.preferredStaffName, 
            this.bookingMode, 
            args.numberOfNights, 
            this.callerRole, 
            this.vipContact?.category, 
            this.vipContact?.allowPrioritySlots
          ) };
        case 'bookAppointment':
          return await bookingService.bookAppointment(
            tenantId, 
            args.customerName, 
            args.customerPhone, 
            args.serviceName, 
            args.startTime, 
            args.durationMinutes, 
            args.preferredStaffName, 
            this.bookingMode, 
            args.numberOfNights, 
            args.promoCode, 
            this.callerPhone, 
            args.contactLevel, 
            this.callerRole, 
            this.vipContact?.category, 
            this.vipContact?.allowPrioritySlots
          );
        case 'confirmAppointment':
          return await bookingService.confirmAppointment(tenantId, args.customerPhone);
        case 'cancelAppointment':
          return await bookingService.cancelAppointment(tenantId, args.customerPhone);
        case 'requestHumanContact':
          return await bookingService.requestHumanContact(tenantId, args.customerPhone, args.reason);
        case 'get_owner_activity_summary':
          if (this.callerRole === 'OWNER' && this.ownerRequirePin && !this.isOwnerPinVerified) {
            return { error: "Wymagana autoryzacja kodem PIN Właściciela. Poproś rozmówcę o podanie kodu PIN i użyj verify_owner_pin." };
          }
          return await bookingService.getOwnerActivitySummary(tenantId, args.timeRange);
        case 'send_summary_email':
          if (this.callerRole === 'OWNER' && this.ownerRequirePin && !this.isOwnerPinVerified) {
            return { error: "Wymagana autoryzacja kodem PIN Właściciela. Poproś rozmówcę o podanie kodu PIN i użyj verify_owner_pin." };
          }
          return await bookingService.sendSummaryEmail(tenantId, args.subject, args.contentMarkdown, args.timeRange);
        case 'save_call_message':
          return await bookingService.saveCallMessage(tenantId, this.callerPhone, args.callerName, args.rawMessage, args.urgency, args.callbackRequested);
        case 'block_calendar_time':
          if (this.callerRole === 'OWNER' && this.ownerRequirePin && !this.isOwnerPinVerified) {
            return { error: "Wymagana autoryzacja kodem PIN Właściciela. Poproś rozmówcę o podanie kodu PIN i użyj verify_owner_pin." };
          }
          return await bookingService.blockCalendarTime(tenantId, args.startTime, args.durationMinutes, args.title);
        case 'transferCallToOwner': {
          if (this.businessProfile !== 'personal' || this.callerRole !== 'VIP' || !['VIP', 'Rodzina'].includes(this.vipContact?.category || '')) {
            return {
              status: "transfer_rejected",
              message: "Bezpośrednie przełączanie połączeń jest zarezerwowane wyłącznie dla kontaktów z kategorii VIP oraz Rodzina. Poinformuj rozmówcę uprzejmie, że nie masz możliwości połączenia na żywo, ale chętnie zapiszesz dokładną wiadomość i przekażesz ją natychmiast właścicielowi."
            };
          }
          if (this.transferAttempted) {
            return {
              status: "transfer_already_attempted",
              message: "Próba bezpośredniego połączenia została już wcześniej podjęta w tej rozmowie i właściciel nie odebrał. Poproś rozmówcę o podyktowanie wiadomości, a przekażesz ją natychmiast."
            };
          }
          const twilioSid = process.env.TWILIO_ACCOUNT_SID;
          const twilioToken = process.env.TWILIO_AUTH_TOKEN;
          if (!this.callSid || !this.ownerPhone || !twilioSid || !twilioToken) {
            console.warn(`[Transfer] Brak danych do transferu: callSid=${this.callSid}, ownerPhone=${this.ownerPhone}`);
            return {
              status: "technical_unavailable",
              message: "Przełączenie techniczne jest chwilowo niedostępne. Zaproponuj rozmówcy zapisanie pilnej notatki."
            };
          }

          try {
            this.transferAttempted = true;
            const client = twilio(twilioSid, twilioToken);
            const host = process.env.HOST || 'beautyvoice-bff.web.app';
            const fallbackUrl = `https://${host}/api/voice/transfer-fallback?tenantId=${encodeURIComponent(tenantId)}&callerPhone=${encodeURIComponent(this.callerPhone)}&vipName=${encodeURIComponent(this.vipContact?.contactName || '')}&dialedNumber=${encodeURIComponent(this.dialedNumber || '')}`;

            console.log(`📞 [Transfer] Przełączam połączenie ${this.callSid} do właściciela ${this.ownerPhone}. Fallback: ${fallbackUrl}`);
            
            await client.calls(this.callSid).update({
              twiml: `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="pl-PL">Łączę bezpośrednio z właścicielem. Proszę czekać na linii.</Say>
  <Dial timeout="30" action="${fallbackUrl}">
    ${this.ownerPhone}
  </Dial>
</Response>`
            });

            return {
              status: "transferring",
              message: "Przełączam rozmowę do właściciela. Proszę czekać na linii."
            };
          } catch (err: any) {
            console.error(`[Transfer] Błąd wywołania Twilio call update:`, err);
            return {
              status: "transfer_error",
              message: "Wystąpił problem techniczny podczas próby łączenia. Zaproponuj zapisanie wiadomości."
            };
          }
        }
        case 'endCall':
          this.shouldHangupAfterTurn = true;
          if (args?.callSummary) {
            this.callSummaryFromAi = args.callSummary;
            console.log(`📝 [CallOrchestrator] Odebrano podsumowanie od AI: "${this.callSummaryFromAi}"`);
          }
          if (args?.callerName) {
            this.callerNameFromAi = args.callerName;
          }
          return { status: "call_ending", message: "Pożegnaj się uprzejmie z klientem jednym krótkim zdaniem. Połączenie zostanie automatycznie rozłączone." };
        default:
          return { error: `Narzędzie ${functionCall.name} nie istnieje.` };
      }
    } catch (err: any) {
      console.error(`[Backend] Błąd w ${functionCall.name}:`, err);
      return { error: err.message || "Błąd wewnętrzny serwera." };
    }
  }

  private async processIncomingAudio(payloadBase64: string) {
    const float32Array = AudioPipeline.decodeTwilioMulawTo16kHz(payloadBase64);
    
    // 1. Sprawdzamy lokalny Silero VAD pod kątem wtrącenia użytkownika (Barge-in)
    await this.vadService.processAudio(float32Array, (speechProb) => {
      this.lastActivityTime = Date.now(); // Wykryto ludzką mowę (nie szum w tle!)
      if (this.agentSpeaking || this.isTurnStreaming || this.turnAudioQueue.length > 0) {
        console.log(`🗣️ [VAD Barge-in] Wykryto mowę użytkownika (prob: ${speechProb.toFixed(2)}) w trakcie wypowiedzi asystenta!`);
        this.executeBargeInMechanism();
      }
    });

    // Jeśli poprzednia tura została anulowana, a użytkownik mówi (i bot milczy), resetujemy flagę
    if (this.isTurnCanceled && !this.agentSpeaking && !this.isTurnStreaming) {
      this.isTurnCanceled = false;
    }

    // 2. FULL-DUPLEX: Zawsze przesyłamy dźwięk dzwoniącego do Gemini Live API!
    const pcmBase64 = AudioPipeline.float32ToPcm16Base64(float32Array);
    this.geminiClient.sendRealtimeAudio(pcmBase64);
  }

  private streamGeminiAudioToCaller(audioBase64: string) {
    try {
      // Jeśli bieżąca tura została przerwana (barge-in), odrzucamy spóźnione pakiety z Gemini
      if (this.isTurnCanceled) {
        return;
      }

      this.lastActivityTime = Date.now(); // Asystentka mówi
      this.agentSpeaking = true;
      const outMulawBuffer = AudioPipeline.encodeGemini24kHzToTwilioMulaw(audioBase64);
      const durationMs = outMulawBuffer.length / 8; // 8 bajtów na ms (8000Hz mulaw)

      if (this.isTurnStreaming) {
        // Faza ciągłego strumieniowania: Twilio ma już poduszkę rozbiegową, wysyłamy od razu!
        this.sendMediaMessage(Buffer.from(outMulawBuffer).toString('base64'));
      } else {
        // Faza bufora rozbiegowego (Adaptive Jitter Buffer): gromadzimy pierwsze 200ms
        this.turnAudioQueue.push(outMulawBuffer);
        this.turnBufferedDurationMs += durationMs;

        if (this.turnBufferedDurationMs >= this.PREBUFFER_THRESHOLD_MS) {
          this.flushTurnBufferToTwilio();
        }
      }
    } catch (err) {
      console.error('[Egress] Błąd transformacji audio:', err);
    }
  }

  private flushTurnBufferToTwilio() {
    if (this.turnAudioQueue.length === 0 || this.isTurnCanceled) return;

    // Łączymy wszystkie zbuforowane klatki w jedną spójną poduszkę dźwiękową (200ms)
    const totalBytes = this.turnAudioQueue.reduce((acc, buf) => acc + buf.length, 0);
    const combinedBuffer = new Uint8Array(totalBytes);
    let offset = 0;
    for (const buf of this.turnAudioQueue) {
      combinedBuffer.set(buf, offset);
      offset += buf.length;
    }

    this.sendMediaMessage(Buffer.from(combinedBuffer).toString('base64'));
    this.isTurnStreaming = true;
    this.turnAudioQueue = [];
    this.turnBufferedDurationMs = 0;
  }

  private sendMediaMessage(payloadBase64: string) {
    if (!this.streamSid || this.twilioWs.readyState !== WebSocket.OPEN) return;
    this.twilioWs.send(JSON.stringify({
      event: 'media',
      streamSid: this.streamSid,
      media: { payload: payloadBase64 }
    }));
  }
}
