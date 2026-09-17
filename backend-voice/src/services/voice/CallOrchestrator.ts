import { WebSocket } from 'ws';
import twilio from 'twilio';
import { AudioPipeline } from './AudioPipeline';
import { VADService } from './VADService';
import { GeminiClient } from './GeminiClient';
import { prisma } from '../../prisma';
import { PushService } from '../PushService';

import { BookingService } from '../BookingService';
import { getPolishGenitive, detectPolishGender, normalizePolishNameToNominative } from '../../prompts/systemPrompt';
import { PersonalAssistantWorker } from '../../jobs/PersonalAssistantWorker';

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
  private isTerminating: boolean = false;
  private isTerminatedAudio: boolean = false;
  
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
  private bookedAppointments: string[] = [];
  private callActionJournal: string[] = [];
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
  private outboundTaskId: string | null = null;
  private outboundAppointmentId: string | null = null;
  private confirmedCallLogId: string | null = null;
  private isConfirmedOutbound: boolean = false;
  private isCancelledOutbound: boolean = false;
  private isFirstOutboundTurnComplete: boolean = false;

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
            this.outboundTaskId = outboundTaskId || null;
            this.callerPhone = data.start.customParameters?.callerPhone || "";
            const tenantIdParam = data.start.customParameters?.tenantId;

            // --- SZYBKA ŚCIEŻKA: tylko tenant lookup (1-2 zapytania), potem natychmiast initAsync ---
            let tenant = null;
            if (tenantIdParam) {
              tenant = await prisma.tenant.findUnique({ where: { id: tenantIdParam }, include: { subscription: true } });
            }
            if (outboundTaskId) {
              try {
                const task = await prisma.outboundQueue.findUnique({ where: { id: outboundTaskId }, include: { tenant: true } });
                if (task) {
                  if (task.tenant && !tenant) tenant = task.tenant;
                  const payload = (typeof task.payload === 'object' && task.payload !== null) ? task.payload as any : {};
                  if (payload.appointmentId) {
                    this.outboundAppointmentId = payload.appointmentId;
                  }
                }
              } catch (err) {}
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
                where: { name: 'DEMO' },
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

          let resolvedSummary = this.callSummaryFromAi || undefined;
          let resolvedCallerName = this.vipContact 
            ? this.vipContact.contactName 
            : (this.callerRole === 'OWNER' 
                ? (this.ownerName || this.tenantName) 
                : (this.callerNameFromAi || undefined));

          // Jeśli AI nie przekazało podsumowania przez endCall, wygeneruj z faktów zarejestrowanych w rozmowie
          if (!resolvedSummary) {
            if (this.callActionJournal.length > 0) {
              resolvedSummary = this.callActionJournal.join('\n');
            } else {
              // Sprawdzamy czy w trakcie tej rozmowy utworzono appointment dla tego dzwoniącego
              const recentAppt = await prisma.appointment.findFirst({
                where: {
                  tenantId: this.tenantId,
                  customerPhone: this.callerPhone,
                  createdAt: { gte: fiveMinutesAgo }
                },
                orderBy: { createdAt: 'desc' },
                include: { service: true }
              });

              if (recentAppt) {
                const dateStr = new Date(recentAppt.startTime).toLocaleString('pl-PL', { 
                  timeZone: 'Europe/Warsaw', 
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  hour: '2-digit', 
                  minute: '2-digit' 
                });
                resolvedSummary = `[📅 Rezerwacja] ${recentAppt.customerName} zarezerwował termin na: ${dateStr} (${recentAppt.service?.name || 'Wizyta / Konsultacja'}).`;
                if (!resolvedCallerName && recentAppt.customerName && !recentAppt.customerName.includes('Połączenie')) {
                  resolvedCallerName = recentAppt.customerName;
                }
              } else if (durationSeconds >= 15) {
                const min = Math.ceil(durationSeconds / 60);
                resolvedSummary = `[ℹ️ Rozmowa informacyjna] Połączenie z dzwoniącym (${min} min). Asystent udzielił informacji o ofercie i zasadach współpracy.`;
              }
            }
          }

          if (this.confirmedCallLogId) {
            callLog = await prisma.callLog.update({
              where: { id: this.confirmedCallLogId },
              data: { 
                durationSeconds,
                summary: resolvedSummary || undefined,
                callerName: resolvedCallerName || undefined,
                isProcessed: true
              }
            });
            console.log(`📝 [CallOrchestrator] Zaktualizowano confirmed CallLog (${callLog.id}) czasem: ${durationSeconds}s`);
          } else if (callLog) {
            const isOutboundResult = Boolean(this.isConfirmedOutbound || this.isCancelledOutbound || callLog.status === 'CONFIRMED_PHONE' || callLog.status === 'CANCELLED_PHONE');
            const logStatus = this.isConfirmedOutbound 
              ? 'CONFIRMED_PHONE' 
              : (this.isCancelledOutbound ? 'CANCELLED_PHONE' : callLog.status);
            const isProcessed = isOutboundResult || callLog.isProcessed;

            callLog = await prisma.callLog.update({
              where: { id: callLog.id },
              data: { 
                durationSeconds,
                summary: resolvedSummary || callLog.summary,
                callerName: resolvedCallerName || callLog.callerName,
                status: logStatus,
                isProcessed: isProcessed
              }
            });
            console.log(`📝 [CallOrchestrator] Zaktualizowano istniejący CallLog (${callLog.id}) czasem: ${durationSeconds}s, status=${logStatus}, isProcessed=${isProcessed}`);
          } else {
            const logStatus = this.isConfirmedOutbound 
              ? 'CONFIRMED_PHONE' 
              : (this.isCancelledOutbound ? 'CANCELLED_PHONE' : 'completed');
            const isProcessed = Boolean(this.isConfirmedOutbound || this.isCancelledOutbound);

            callLog = await prisma.callLog.create({
              data: {
                tenantId: this.tenantId,
                callerPhone: this.callerPhone || 'nieznany',
                callerName: resolvedCallerName || null,
                callerRole: this.callerRole,
                durationSeconds,
                status: logStatus,
                summary: resolvedSummary || null,
                isProcessed: isProcessed
              }
            });
            console.log(`📝 [CallOrchestrator] Zapisano nowy CallLog: role=${this.callerRole}, duration=${durationSeconds}s, status=${logStatus}, isProcessed=${isProcessed}, summary="${resolvedSummary || ''}"`);
          }

          // Powiąż od razu utworzone w trakcie rozmowy wydarzenia w kalendarzu z tym CallLog (tylko dla połączeń przychodzących, nie nadpisuj przy outbound)
          if (callLog && !this.isConfirmedOutbound && !this.isCancelledOutbound) {
            await prisma.appointment.updateMany({
              where: {
                tenantId: this.tenantId,
                customerPhone: this.callerPhone,
                createdAt: { gte: fiveMinutesAgo },
                callLogId: null
              },
              data: {
                callLogId: callLog.id,
                callSummary: resolvedSummary || undefined
              }
            }).catch(e => console.error('[CallOrchestrator] Błąd wiązania Appointment z CallLog:', e));
          }

          // Aktualizacja profilu Customer w CRM jeśli rozpoznano poprawne imię rozmówcy
          if (resolvedCallerName && this.callerRole !== 'OWNER' && this.callerPhone && this.callerPhone !== 'nieznany') {
            try {
              const existingCust = await prisma.customer.findFirst({
                where: { tenantId: this.tenantId, phone: this.callerPhone }
              });
              if (existingCust) {
                if (!existingCust.name || existingCust.name.includes('Połączenie') || existingCust.name !== resolvedCallerName) {
                  await prisma.customer.update({
                    where: { id: existingCust.id },
                    data: { name: resolvedCallerName }
                  });
                  console.log(`👤 [CallOrchestrator] Zaktualizowano imię klienta w CRM: "${resolvedCallerName}"`);
                }
              }
            } catch (custErr) {
              console.warn('[CallOrchestrator] Błąd aktualizacji profilu Customer:', custErr);
            }
          }

          // Wywołanie Post-call workera dla asystenta osobistego (natychmiastowy Push FCM)
          if (this.businessProfile === 'personal' && callLog) {
            try {
              await PersonalAssistantWorker.processPostCall(callLog.id);
            } catch (workerErr) {
              console.error('[CallOrchestrator] Błąd post-call worker:', workerErr);
            }
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

              // Priorytet 1: Zweryfikowany profil klienta w CRM (Customer)
              // Priorytet 2: Poprzedni log połączenia (CallLog)
              const rawName = (cust?.name || prevLog?.callerName || '').trim();
              const normalizedName = normalizePolishNameToNominative(rawName);
              const cleanName = (normalizedName || rawName).replace(/[\(\)\[\]\{\}\<\>]/g, '').trim();
              const lowerName = cleanName.toLowerCase();
              const isGenericPlaceholder = 
                !cleanName ||
                cleanName.length < 3 ||
                lowerName.includes('nieznan') ||
                lowerName.includes('brak') ||
                lowerName.includes('unknown') ||
                lowerName.includes('anonim') ||
                lowerName.includes('klient') ||
                lowerName.includes('gość') ||
                lowerName.includes('gosc') ||
                lowerName.includes('połączenie') ||
                lowerName.includes('polaczenie') ||
                /^[\d\s\+\-\.]+$/.test(cleanName);

              if (!isGenericPlaceholder) {
                this.isReturningCaller = true;
                this.returningCallerName = cleanName;
                this.returningCallerGender = detectPolishGender(cleanName);
                console.log(`🔁 [CallOrchestrator] Rozpoznano powracającego rozmówcę: ${this.returningCallerName} (Płeć: ${this.returningCallerGender})`);
              } else {
                this.isReturningCaller = false;
                this.returningCallerName = '';
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
      confidentialTopics: this.confidentialTopics,
      bookingExternalUrl: tenant?.bookingExternalUrl || undefined,
      serviceAreaDescription: tenant?.serviceAreaDescription || undefined,
      qualificationPrompt: tenant?.qualificationPrompt || undefined,
      leadQuestion1: tenant?.leadQuestion1 || undefined,
      leadQuestion2: tenant?.leadQuestion2 || undefined,
      leadQuestion3: tenant?.leadQuestion3 || undefined
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
          const outboundTaskId = data.start.customParameters?.outboundTaskId || this.outboundTaskId;
          if (outboundTaskId) this.outboundTaskId = outboundTaskId;
          const isPostTransferFallback = data.start.customParameters?.isPostTransferFallback === 'true';
          const fallbackVipName = data.start.customParameters?.vipName || '';
          if (isPostTransferFallback) {
            this.isPostTransferFallback = true;
            this.transferAttempted = true;
          }
          
          setTimeout(async () => {
            let contextText = '';
            const warsawHour = parseInt(new Date().toLocaleTimeString('pl-PL', { timeZone: 'Europe/Warsaw', hour: '2-digit', hour12: false }), 10);
            const timeGreeting = (warsawHour >= 6 && warsawHour < 18) ? 'Dzień dobry' : 'Witam';

            if (isPostTransferFallback && this.geminiClient) {
              contextText = `UWAGA: Próba bezpośredniego połączenia z właścicielem nie powiodła się (właściciel nie odebrał w ciągu 30 sekund lub odrzucił połączenie). Rozmówca (${fallbackVipName || 'kontakt VIP'}) powrócił na linię. NATYCHMIAST przemów jako pierwsza i powiedz dosłownie: "Właściciel nie mógł teraz odebrać. Zostaw wiadomość, a przekażę ją natychmiast." Następnie wysłuchaj i zapisz jego wiadomość narzędziem save_call_message. Pod żadnym pozorem NIE próbuj łączyć ponownie!`;
            } else if (outboundTaskId && this.tenantId) {
                // OUTBOUND CALL LOGIC
                const task = await prisma.outboundQueue.findUnique({ where: { id: outboundTaskId } });
                if (task) {
                   const payload = typeof task.payload === 'object' && task.payload !== null ? task.payload as any : {};
                   if (payload.appointmentId) {
                     this.outboundAppointmentId = payload.appointmentId;
                   }
                   if (payload.type === 'live_callback_30s') {
                     contextText = `UWAGA: To jest natychmiastowe połączenie zwrotne (Live Callback w 30 sekund) zamówione przez klienta (${payload.name || task.targetPhone}) na stronie internetowej! Klient właśnie odebrał telefon. Numer klienta: ${task.targetPhone}. MUSISZ NATYCHMIAST PRZEMÓWIĆ JAKO PIERWSZA, zanim rozmówca cokolwiek powie! Powiedz przyjaźnie i naturalnie: "${timeGreeting}! Dziękuję za zamówienie szybkiego kontaktu na naszej stronie. Z tej strony cyfrowa asystentka ${this.companyName || this.tenantName || 'naszej firmy'}. W czym mogę Ci dzisiaj pomóc?". Prowadź płynną rozmowę.`;
                     await prisma.outboundQueue.update({ where: { id: task.id }, data: { status: 'done', processedAt: new Date() } });
                   } else {
                     const isMaleVoice = ['Puck', 'Charon'].includes(this.voiceName);
                     const assistantTitleInstrumental = isMaleVoice ? 'wirtualnym asystentem' : 'wirtualną asystentką';
                     const assistantTitleNominative = isMaleVoice ? 'wirtualny asystent' : 'wirtualna asystentka';
                     const ownerDisplayName = this.ownerName || this.tenantName || 'właściciela';
                     const ownerPrefix = this.ownerGender === 'FEMALE' ? 'Pani' : 'Pana';
                     const ownerFirst = ownerDisplayName.split(' ')[0];
                     const ownerFirstGenitive = getPolishGenitive(ownerFirst, this.ownerGender);

                     const rawCustomerName = (payload.customerName || '').trim();
                     let clientGreeting = `${timeGreeting}`;
                     let clientAddress = 'Pan/Pani';
                     if (rawCustomerName) {
                       const firstName = rawCustomerName.split(' ')[0];
                       const isFemaleClient = firstName.endsWith('a') && !['Kuba', 'Barnaba', 'Kosma'].includes(firstName);
                       if (isFemaleClient) {
                         clientGreeting = `Witam Panią ${firstName}`;
                         clientAddress = 'Pani';
                       } else {
                         let accusativeName = firstName;
                         if (firstName.endsWith('usz')) accusativeName = firstName.slice(0, -3) + 'usza';
                         else if (firstName.endsWith('ek')) accusativeName = firstName.slice(0, -2) + 'ka';
                         else if (firstName.endsWith('an')) accusativeName = firstName + 'a';
                         else if (firstName.endsWith('r')) accusativeName = firstName + 'a';
                         else if (firstName.endsWith('ł')) accusativeName = firstName + 'a';
                         else if (!firstName.endsWith('a')) accusativeName = firstName + 'a';
                         clientGreeting = `Witam Pana ${accusativeName}`;
                         clientAddress = 'Pan';
                       }
                     }

                     const isVisit = payload.eventType === 'visit';
                     const eventWordAccusative = isVisit ? 'zaplanowaną wizytę' : 'zaplanowane spotkanie';
                     const dateText = payload.dateStr || 'jutro';
                     const timeText = payload.timeStr ? `o godzinie ${payload.timeStr}` : '';
                     const additionalNoteText = payload.additionalNote ? ` Dodatkowo przekazuję ważną prośbę od ${ownerPrefix} ${ownerFirstGenitive}: ${payload.additionalNote}.` : '';

                     const openingSentence = `${clientGreeting}. Jestem ${assistantTitleInstrumental} ${ownerPrefix} ${ownerFirstGenitive}. Dzwonię, aby potwierdzić ${eventWordAccusative} w dniu ${dateText} ${timeText}.${additionalNoteText} Czy ten termin jest dla ${clientAddress === 'Pan/Pani' ? 'Pana lub Pani' : (clientAddress === 'Pani' ? 'Pani' : 'Pana')} aktualny i potwierdza ${clientAddress} obecność?`;

                     contextText = `TO JEST POŁĄCZENIE WYCHODZĄCE do klienta: ${rawCustomerName || task.targetPhone} w celu potwierdzenia ${eventWordAccusative} w dniu ${dateText} ${timeText}.
NAJPIERW wypowiedz dokładnie pierwsze zdanie otwierające: "${openingSentence}".

ŻELAZNE ZASADY DALSZEGO PROWADZENIA ROZMOWY:
1. WARIANT A (Klient POTWIERDZA obecność: "tak", "będę", "potwierdzam", "pasuje", "do zobaczenia"):
   - Wywołaj narzędzie 'confirmAppointment'.
   - Podziękuj serdecznie dokładnie jednym zwięzłym zdaniem: "Dziękuję bardzo za potwierdzenie. Jesteśmy umówieni na ${dateText} ${timeText}. Do zobaczenia!" i wywołaj narzędzie 'endCall'. Po tym zdaniu natychmiast zamilknij.
2. WARIANT B (Klient CHCE PRZEŁOŻYĆ TERMIN / ZMIENIĆ GODZINĘ: "nie zdążę", "czy mogę przenieść o godzinę", "czy możemy na 14:00 / na jutro?"):
   - ⛔ KATEGORYCZNY, BEZWZGLĘDNY ZAKAZ wywoływania narzędzia 'confirmAppointment'! Klient NIE potwierdził obecnego terminu!
   - Ustal preferowaną nową godzinę lub dzień (np. jeśli spotkanie było o 13:00, a klient prosi o godzinę później -> chodzi o 14:00).
   - NATYCHMIAST wywołaj narzędzie 'checkAvailability' na ten dzień, aby sprawdzić czy slot jest wolny!
   - Jeśli slot jest wolny: zapytaj klienta: "O godzinie 14:00 termin jest wolny. Czy przepisać spotkanie na 14:00?"
   - Gdy klient potwierdzi ("tak", "proszę zapisać"): NATYCHMIAST wywołaj narzędzie 'rescheduleAppointment' z nową datą i godziną newStartTime!
   - Potwierdź zmianę dokładnie jednym zwięzłym zdaniem: "Termin został pomyślnie zmieniony. Dziękuję bardzo i do zobaczenia!" i wywołaj narzędzie 'endCall'. Po tym zdaniu natychmiast zamilknij.
   - Jeśli slot jest zajęty: zaproponuj najbliższy wolny termin z 'checkAvailability'.
3. WARIANT C (Klient ODWOŁUJE spotkanie / rezygnuje: "muszę odwołać", "nie dam rady", "rezygnuję"):
   - ⛔ KATEGORYCZNY, BEZWZGLĘDNY ZAKAZ wywoływania narzędzia 'confirmAppointment'!
   - Wywołaj narzędzie 'cancelAppointment'.
   - Powiedz uprzejmie dokładnie jedno zwięzłe zdanie: "Rozumiem, odwołałam spotkanie i zwolniłam termin. Dziękuję za informację i do usłyszenia." i wywołaj narzędzie 'endCall'. Po tym zdaniu natychmiast zamilknij.
4. WARIANT D (Klient prosi o kontakt z ${ownerDisplayName} lub pyta o szczegóły):
   - Odpowiedz na pytania merytoryczne narzędziem 'getFAQ'.
   - Jeśli klient prosi o oddzwonienie lub przekazanie wiadomości, zapisz to narzędziem 'save_call_message'.`;
                   }
               }
            } else if ((this.tenantName === 'DEMO' || this.businessProfile === 'demo') && this.geminiClient) {
              // LINIA TESTOWA DEMO (EVA Brand Ambassador)
              contextText = `Połączenie na linię testową EVA. Rozpocznij powitanie słowami: "${timeGreeting}! Dodzwoniłeś się na linię testową platformy EasyVoiceAssistant, EVA. Twój przyszły asystent głosowy. W czym mogę pomóc?".`;
            } else if (this.businessProfile === 'personal' && this.geminiClient && this.tenantId) {
              // INBOUND DLA ASYSTENTA OSOBISTEGO
              const isMale = ['Puck', 'Charon'].includes(this.voiceName);
              const assistantTitleInstrumental = isMale ? 'wirtualnym asystentem' : 'wirtualną asystentką';
              const assistantTitleNominative = isMale ? 'wirtualny asystent' : 'wirtualna asystentka';
              const ownerDisplayName = this.ownerName || this.tenantName;
              const ownerGenitivePrefix = this.ownerGender === 'FEMALE' ? 'pani' : 'pana';
              const ownerGenitiveName = getPolishGenitive(ownerDisplayName, this.ownerGender);
              const ownerFirst = ownerDisplayName.split(' ')[0];
              const ownerFirstGenitive = getPolishGenitive(ownerFirst, this.ownerGender);
              const ownerTitle = this.ownerGender === 'FEMALE' ? 'Pani' : 'Pan';

              if (this.callerRole === 'OWNER') {
                if (this.ownerRequirePin && !this.isOwnerPinVerified) {
                  contextText = `Rozmawiasz ze swoim szefem: ${ownerDisplayName}. Wymagana autoryzacja PIN. Poproś o podanie kodu PIN w pierwszym zdaniu: "${timeGreeting} ${ownerFirst}! Ze względów bezpieczeństwa proszę podaj swój kod PIN, aby odblokować funkcje asystenta."`;
                } else {
                  contextText = `Rozmawiasz ze swoim szefem: ${ownerDisplayName}. Przywitaj się krótko po imieniu: "Cześć ${ownerDisplayName}! W czym mogę pomóc?".`;
                }
              } else if (this.callerRole === 'VIP' && this.vipContact) {
                const vipFormality = (this.vipContact.formalityLevel && this.vipContact.formalityLevel !== 'default')
                  ? this.vipContact.formalityLevel
                  : this.defaultFormalityLevel;

                if (vipFormality === 'direct_ty') {
                  contextText = `Rozmawiasz z bliskim kontaktem z bazy VIP/Rodzina: ${this.vipContact.contactName} (${this.vipContact.category}). Zwracaj się na "Ty". Przywitaj się ciepło po imieniu: "Cześć ${this.vipContact.contactName}! ${ownerTitle} ${ownerFirst} nie może w tej chwili odebrać. Czy chciałbyś/chciałabyś zostawić wiadomość, czy umówić termin rozmowy?".`;
                } else {
                  contextText = `Rozmawiasz z kontaktem VIP: ${this.vipContact.contactName} (${this.vipContact.category}). Przywitaj się serdecznie: "${timeGreeting}, z tej strony ${assistantTitleNominative} ${ownerGenitivePrefix} ${ownerFirstGenitive}. ${ownerTitle} ${ownerFirst} nie może w tej chwili odebrać. Czy chciałby Pan / chciałaby Pani zostawić wiadomość, czy umówić termin rozmowy?".`;
                }
              } else if (this.isReturningCaller && this.returningCallerName && !this.returningCallerName.toLowerCase().includes('nieznan')) {
                // POWRACAJĄCY ROZMÓWCA ZE ZNANĄ TOŻSAMOŚCIĄ (Krótkie powitanie po imieniu)
                const firstName = this.returningCallerName.split(' ')[0];
                let vocative = '';
                if (this.returningCallerGender === 'FEMALE') {
                  vocative = `Pani ${firstName}`;
                } else {
                  if (firstName.endsWith('ek')) vocative = `Panie ${firstName.slice(0, -2)}ku`;
                  else if (firstName.endsWith('j')) vocative = `Panie ${firstName}u`;
                  else if (firstName.endsWith('sz')) vocative = `Panie ${firstName}u`;
                  else if (firstName.endsWith('ch')) vocative = `Panie ${firstName}u`;
                  else if (firstName.endsWith('tr')) vocative = `Panie ${firstName.slice(0, -2)}trze`;
                  else if (firstName.endsWith('ał') || firstName.endsWith('eł')) vocative = `Panie ${firstName.slice(0, -1)}e`;
                  else if (firstName.endsWith('n')) vocative = `Panie ${firstName}ie`;
                  else if (firstName.endsWith('k')) vocative = `Panie ${firstName}u`;
                  else if (firstName.endsWith('b')) vocative = `Panie ${firstName}ie`;
                  else if (firstName.endsWith('r')) vocative = `Panie ${firstName}ze`;
                  else if (firstName.endsWith('ł')) vocative = `Panie ${firstName.slice(0, -1)}u`;
                  else vocative = `Panie ${firstName}`;
                }

                contextText = `Rozmawiasz z powracającym rozmówcą: ${this.returningCallerName} (${vocative}). Wypowiedz dokładnie powitanie: "${timeGreeting} ${vocative}, z tej strony ${assistantTitleNominative} ${ownerGenitivePrefix} ${ownerFirstGenitive}. W czym mogę dzisiaj pomóc?".`;
              } else {
                // Tura 1 Onboardingu dla nowego rozmówcy z zewnątrz (GUEST)
                contextText = `Dzwoni rozmówca z zewnątrz z numeru ${callerPhone}. Wypowiedz dokładnie pierwsze zdanie Tury 1: "Witam, jestem ${assistantTitleInstrumental} ${ownerGenitivePrefix} ${ownerFirstGenitive}, z kim mam przyjemność?".`;
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
                    contextText = `Stały klient: ${knownCustomer.name} z numeru ${callerPhone}.${visitInfo} Powitaj po imieniu: "Cześć ${knownCustomer.name}! Miło Cię słyszeć. Z tej strony ${botDisplayName} z firmy ${compName}. W czym mogę dzisiaj pomóc?".`;
                  } else {
                    contextText = `Stały klient: ${knownCustomer.name} z numeru ${callerPhone}.${visitInfo} Powitaj z szacunkiem po imieniu: "${timeGreeting}, z tej strony ${botDisplayName} z firmy ${compName}. W czym mogę dzisiaj pomóc?".`;
                  }
                } else {
                  contextText = `Nowy klient z numeru: ${callerPhone}. Powitaj słowami: "${timeGreeting}, witamy w firmie ${compName}. Z tej strony ${botDisplayName}. W czym mogę dzisiaj pomóc?".`;
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
    if (this.isTerminating) {
      console.log('🛡️ [CallOrchestrator] Zignorowano sygnał interrupted po zainicjowaniu endCall (isTerminating=true).');
      return;
    }
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
    if (this.outboundTaskId) {
      this.isFirstOutboundTurnComplete = true;
    }

    if (this.shouldHangupAfterTurn) {
      console.log('📞 [EndCall] Zakończenie rozmowy po pożegnaniu. Natychmiastowe zablokowanie dalszej mowy Gemini.');
      if (this.hangupTimeout) {
        clearTimeout(this.hangupTimeout);
        this.hangupTimeout = null;
      }
      this.isTurnCanceled = true;
      this.isTerminatedAudio = true;
      try {
        this.geminiClient.close();
      } catch (e) {
        console.warn('[EndCall] Błąd zamykania GeminiClient:', e);
      }
      this.hangupTimeout = setTimeout(() => {
        if (this.silenceWatchdogInterval) {
          clearInterval(this.silenceWatchdogInterval);
          this.silenceWatchdogInterval = null;
        }
        this.twilioWs.close();
      }, 1000);
    }
  }

  private executeBargeInMechanism() {
    if (this.isTurnCanceled) return;
    if (this.outboundTaskId && !this.isFirstOutboundTurnComplete) {
      console.log('🛡️ [Barge-in] Zignorowano wczesne przerwanie podczas pierwszego zdania powitalnego w połączeniu wychodzącym (Outbound opening protection).');
      return;
    }
    if (this.isTerminating) {
      console.log('🛡️ [Barge-in] Rozmowa w trakcie kończenia (isTerminating=true) – uciszam audio i finalizuję rozłączenie.');
      this.twilioWs.send(JSON.stringify({
        event: 'clear',
        streamSid: this.streamSid
      }));
      if (!this.hangupTimeout) {
        this.hangupTimeout = setTimeout(() => {
          if (this.silenceWatchdogInterval) {
            clearInterval(this.silenceWatchdogInterval);
            this.silenceWatchdogInterval = null;
          }
          this.twilioWs.close();
        }, 500);
      }
      return;
    }
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
              authorized: true
            };
          } else {
            this.ownerPinAttempts = (this.ownerPinAttempts || 0) + 1;
            console.warn(`❌ [CallOrchestrator] Błędny PIN Właściciela (${this.ownerPinAttempts}/3)`);
            if (this.ownerPinAttempts >= 3) {
              this.callerRole = 'GUEST';
              return {
                success: false,
                authorized: false,
                locked: true,
                attemptsRemaining: 0
              };
            }
            return {
              success: false,
              authorized: false,
              attemptsRemaining: 3 - this.ownerPinAttempts
            };
          }
        }
        case 'verify_confidential_pin': {
          const result = await bookingService.verifyConfidentialPin(tenantId, args.pin, args.topic);
          if (result.success) {
            this.isConfidentialUnlocked = true;
            this.confidentialPinAttempts = 0;
            const topicDesc = args.topic ? ` (temat: ${args.topic})` : '';
            this.callActionJournal.push(`[🔒 Poufne] Rozmówca odblokował wiedzę poufną poprawnym kodem PIN${topicDesc}`);
            console.log(`🔓 [CallOrchestrator] Wiedza poufna odblokowana kodem PIN!`);
            return {
              success: true,
              answer: result.answer
            };
          } else {
            this.confidentialPinAttempts = (this.confidentialPinAttempts || 0) + 1;
            console.warn(`❌ [CallOrchestrator] Błędny PIN wiedzy poufnej (${this.confidentialPinAttempts}/3)`);
            if (this.confidentialPinAttempts >= 3) {
              return {
                success: false,
                locked: true,
                attemptsRemaining: 0
              };
            }
            return {
              success: false,
              attemptsRemaining: 3 - this.confidentialPinAttempts
            };
          }
        }
        case 'checkAvailability': {
          const duration = args.durationMinutes ? Number(args.durationMinutes) : 30;
          const slots = await bookingService.checkAvailability(
            tenantId, 
            args.date, 
            args.serviceName, 
            duration, 
            args.preferredStaffName, 
            this.bookingMode, 
            args.numberOfNights, 
            this.callerRole, 
            this.vipContact?.category, 
            this.vipContact?.allowPrioritySlots
          );

          if (slots.length > 0) {
            return { availableSlots: slots };
          }

          // Jeśli na podany dzień brak slotów (np. weekend/dzień wolny), sprawdź kolejne dni robocze (do 5 dni w przód)
          const plDays = ['niedzielę', 'poniedziałek', 'wtorek', 'środę', 'czwartek', 'piątek', 'sobotę'];
          let nextAvailableDate: string | null = null;
          let nextAvailableSlots: string[] = [];
          let nextDayName = '';

          const baseReqDate = new Date(`${args.date}T12:00:00Z`);
          for (let offset = 1; offset <= 5; offset++) {
            const nextD = new Date(baseReqDate.getTime() + offset * 24 * 60 * 60 * 1000);
            const nextDateStr = nextD.toISOString().split('T')[0];
            const candidateSlots = await bookingService.checkAvailability(
              tenantId,
              nextDateStr,
              args.serviceName,
              duration,
              args.preferredStaffName,
              this.bookingMode,
              args.numberOfNights,
              this.callerRole,
              this.vipContact?.category,
              this.vipContact?.allowPrioritySlots
            );
            if (candidateSlots.length > 0) {
              nextAvailableDate = nextDateStr;
              nextAvailableSlots = candidateSlots;
              nextDayName = plDays[nextD.getUTCDay()];
              break;
            }
          }

          if (nextAvailableDate && nextAvailableSlots.length > 0) {
            return {
              availableSlots: [],
              suggestedDate: nextAvailableDate,
              suggestedDayName: nextDayName,
              suggestedSlots: nextAvailableSlots.slice(0, 4),
              info: `Brak wolnych terminów na dzień ${args.date}. Najbliższy dzień z terminami: ${nextAvailableDate} (${nextDayName}), godziny: ${nextAvailableSlots.slice(0, 4).join(', ')}.`
            };
          }

          return { 
            availableSlots: [], 
            info: `Brak wolnych terminów na dzień ${args.date} oraz w kolejnych kilku dniach roboczych.` 
          };
        }
        case 'bookAppointment': {
          if (args?.customerName) {
            this.callerNameFromAi = args.customerName;
          }
          // Zabezpieczenie przed podwójną rezerwacją: jeśli klient w trakcie rozmowy zmienił termin,
          // usuwamy wcześniejszą rezerwację z tej samej rozmowy, zachowując ostatecznie wybrany termin
          let isReschedule = false;
          if (this.bookedAppointments.length > 0) {
            isReschedule = true;
            for (const prevId of this.bookedAppointments) {
              try {
                await prisma.appointment.delete({ where: { id: prevId } });
                console.log(`[CallOrchestrator] Usunięto wcześniejszą rezerwację (${prevId}) po wyborze nowego terminu.`);
              } catch (delErr) {
                console.warn('[CallOrchestrator] Nie udało się usunąć wcześniejszej rezerwacji:', delErr);
              }
            }
            this.bookedAppointments = [];
          }
          const rawCustomerName = args.customerName || '';
          const normalizedCustName = normalizePolishNameToNominative(rawCustomerName) || rawCustomerName;
          if (normalizedCustName) {
            this.callerNameFromAi = normalizedCustName;
          }
          const bookRes: any = await bookingService.bookAppointment(
            tenantId, 
            normalizedCustName, 
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
            this.vipContact?.allowPrioritySlots,
            isReschedule
          );
          if (bookRes && (bookRes.success || bookRes.appointment || !bookRes.error)) {
            const formattedDate = new Date(args.startTime).toLocaleString('pl-PL', { 
              timeZone: 'Europe/Warsaw', 
              weekday: 'long', 
              day: 'numeric', 
              month: 'long', 
              hour: '2-digit', 
              minute: '2-digit' 
            });
            const summaryText = `[📅 Rezerwacja] ${normalizedCustName || 'Klient'} zarezerwował termin na: ${formattedDate} (usługa: ${args.serviceName || 'Wizyta / Konsultacja'}).`;
            this.callActionJournal.push(summaryText);
            this.callSummaryFromAi = summaryText;
            if (bookRes.appointment?.id) {
              this.bookedAppointments.push(bookRes.appointment.id);
            }
          }
          return bookRes;
        }
        case 'confirmAppointment': {
          const targetPhone = args.customerPhone || this.callerPhone;
          const targetId = this.outboundAppointmentId || args.appointmentId || undefined;
          const res = await bookingService.confirmAppointment(tenantId, targetPhone, targetId);
          if (res && (res.success || !res.error)) {
            this.isConfirmedOutbound = true;
            if (res.callLogId) this.confirmedCallLogId = res.callLogId;
            const summary = `[Potwierdzenie Telefon] Klient potwierdził spotkanie/wizytę w rozmowie telefonicznej.`;
            this.callSummaryFromAi = summary;
            this.callActionJournal.push(summary);
            if (this.outboundTaskId) {
              await prisma.outboundQueue.update({
                where: { id: this.outboundTaskId },
                data: { status: 'done', processedAt: new Date() }
              }).catch(console.error);
            }
          }
          return res;
        }
        case 'cancelAppointment': {
          const targetPhone = args.customerPhone || this.callerPhone;
          const targetId = this.outboundAppointmentId || args.appointmentId || undefined;
          const res = await bookingService.cancelAppointment(tenantId, targetPhone, targetId);
          if (res && (res.success || !res.error)) {
            this.isCancelledOutbound = true;
            if (res.callLogId) this.confirmedCallLogId = res.callLogId;
            const summary = `[Odwołanie Telefon] Klient odwołał spotkanie/wizytę w rozmowie telefonicznej. Termin został zwolniony.`;
            this.callSummaryFromAi = summary;
            this.callActionJournal.push(summary);
            if (this.outboundTaskId) {
              await prisma.outboundQueue.update({
                where: { id: this.outboundTaskId },
                data: { status: 'done', processedAt: new Date() }
              }).catch(console.error);
            }
          }
          return res;
        }
        case 'rescheduleAppointment': {
          const targetPhone = args.customerPhone || this.callerPhone;
          const targetId = this.outboundAppointmentId || args.appointmentId || undefined;
          const res = await bookingService.rescheduleAppointment(tenantId, targetPhone, args.newStartTime, targetId, args.reason);
          if (res && (res.success || !res.error)) {
            this.isConfirmedOutbound = true;
            if (res.callLogId) this.confirmedCallLogId = res.callLogId;
            const summary = `[Przełożenie Telefon] Klient przeniósł spotkanie na nowy termin: ${res.newStartTime || args.newStartTime}.${args.reason ? ` Powód: ${args.reason}` : ''}`;
            this.callSummaryFromAi = summary;
            this.callActionJournal.push(summary);
            if (this.outboundTaskId) {
              await prisma.outboundQueue.update({
                where: { id: this.outboundTaskId },
                data: { status: 'done', processedAt: new Date() }
              }).catch(console.error);
            }
          }
          return res;
        }
        case 'requestHumanContact': {
          const contactSummary = `[📞 Prośba o kontakt] ${args.reason || 'Prośba o oddzwonienie'}`;
          this.callSummaryFromAi = contactSummary;
          this.callActionJournal.push(contactSummary);
          return await bookingService.requestHumanContact(tenantId, args.customerPhone, args.reason);
        }
        case 'send_booking_sms_link':
          return await bookingService.sendBookingSmsLink(tenantId, this.callerPhone);
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
        case 'save_call_message': {
          if (args?.callerName) this.callerNameFromAi = args.callerName;
          const msgSummary = `[📝 Wiadomość] ${args.callerName || 'Rozmówca'}: ${args.rawMessage}`;
          this.callSummaryFromAi = msgSummary;
          this.callActionJournal.push(msgSummary);
          return await bookingService.saveCallMessage(tenantId, this.callerPhone, args.callerName, args.rawMessage, args.urgency, args.callbackRequested);
        }
        case 'block_calendar_time':
          if (this.callerRole === 'OWNER' && this.ownerRequirePin && !this.isOwnerPinVerified) {
            return { error: "Wymagana autoryzacja kodem PIN Właściciela. Poproś rozmówcę o podanie kodu PIN i użyj verify_owner_pin." };
          }
          return await bookingService.blockCalendarTime(tenantId, args.startTime, args.durationMinutes, args.title);
        case 'transferCallToOwner': {
          if (this.businessProfile !== 'personal' || this.callerRole !== 'VIP' || !['VIP', 'Rodzina'].includes(this.vipContact?.category || '')) {
            return {
              status: "transfer_rejected",
              reason: "vip_only"
            };
          }
          if (this.transferAttempted) {
            return {
              status: "transfer_already_attempted"
            };
          }
          const twilioSid = process.env.TWILIO_ACCOUNT_SID;
          const twilioToken = process.env.TWILIO_AUTH_TOKEN;
          if (!this.callSid || !this.ownerPhone || !twilioSid || !twilioToken) {
            console.warn(`[Transfer] Brak danych do transferu: callSid=${this.callSid}, ownerPhone=${this.ownerPhone}`);
            return {
              status: "technical_unavailable"
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
              status: "transferring"
            };
          } catch (err: any) {
            console.error(`[Transfer] Błąd wywołania Twilio call update:`, err);
            return {
              status: "transfer_error"
            };
          }
        }
        case 'endCall':
          this.isTerminating = true;
          this.shouldHangupAfterTurn = true;
          if (args?.callSummary) {
            this.callSummaryFromAi = args.callSummary;
            console.log(`📝 [CallOrchestrator] Odebrano podsumowanie od AI: "${this.callSummaryFromAi}"`);
          }
          if (args?.callerName) {
            this.callerNameFromAi = normalizePolishNameToNominative(args.callerName) || args.callerName;
          }
          // Awaryjny watchdog na wypadek, gdyby Gemini nie przysłało turnComplete po pożegnaniu
          if (!this.hangupTimeout) {
            this.hangupTimeout = setTimeout(() => {
              console.log('⏱️ [EndCall] Awaryjne zamknięcie połączenia (timeout po wywołaniu endCall).');
              this.isTurnCanceled = true;
              this.isTerminatedAudio = true;
              try {
                this.geminiClient.close();
              } catch (e) {
                console.warn('[EndCall] Błąd zamykania GeminiClient:', e);
              }
              if (this.silenceWatchdogInterval) {
                clearInterval(this.silenceWatchdogInterval);
                this.silenceWatchdogInterval = null;
              }
              this.twilioWs.close();
            }, 6000);
          }
          return {
            status: "ok",
            success: true,
            message: "Rozmowa zakończona. Jeśli wypowiedziałeś już pożegnanie, zamilknij natychmiast."
          };
        default:
          return { error: `Narzędzie ${functionCall.name} nie istnieje.` };
      }
    } catch (err: any) {
      console.error(`[Backend] Błąd w ${functionCall.name}:`, err);
      return { error: err.message || "Błąd wewnętrzny serwera." };
    }
  }

  private async processIncomingAudio(payloadBase64: string) {
    if (this.isTerminating) {
      return;
    }

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
      // Jeśli bieżąca tura została przerwana (barge-in) lub rozmowa została zakończona, odrzucamy spóźnione pakiety z Gemini
      if (this.isTurnCanceled || this.isTerminatedAudio) {
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
