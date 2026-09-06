import { WebSocket } from 'ws';
import { AudioPipeline } from './AudioPipeline';
import { VADService } from './VADService';
import { GeminiClient } from './GeminiClient';
import { prisma } from '../../prisma';
import { PushService } from '../PushService';

import { BookingService } from '../BookingService';

const bookingService = new BookingService();

export class CallOrchestrator {
  private twilioWs: WebSocket;
  private streamSid: string = '';
  
  private vadService!: VADService;
  private geminiClient!: GeminiClient;
  
  private egressMulawBuffer: number[] = [];

  private agentSpeaking: boolean = false;
  private activeAudioController: AbortController | null = null;
  
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

  private isReady: boolean = false;
  private twilioMessageBuffer: string[] = [];

  constructor(twilioConnection: WebSocket) {
    this.twilioWs = twilioConnection;
    
    this.twilioWs.on('message', async (message: string) => {
      const msgStr = message.toString();
      if (!this.isReady) {
        this.twilioMessageBuffer.push(msgStr);
        try {
          const data = JSON.parse(msgStr);
          if (data.event === 'start') {
            const dialedNumber = data.start.customParameters?.dialedNumber || 'unknown';
            const outboundTaskId = data.start.customParameters?.outboundTaskId;
            this.callerPhone = data.start.customParameters?.callerPhone || "";

            // --- SZYBKA ŚCIEŻKA: tylko tenant lookup (1-2 zapytania), potem natychmiast initAsync ---
            let tenant = null;
            if (outboundTaskId) {
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

            // --- LAZY INJECTION: kontekst Caller ID wstrzykujemy ASYNCHRONICZNIE po starcie ---
            if (tenant && this.callerPhone) {
              this.injectCallerContext(tenant.id).catch(e => console.error('[CallerID] Błąd lazy injection:', e));
            }
          }
        } catch(e) {}
      } else {
        await this.handleTwilioMessage(msgStr);
      }
    });

    this.twilioWs.on('close', async () => {
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
      }
    });
  }

  /**
   * Lazy Injection: wstrzykuje kontekst Caller ID i historię SMS do sesji Gemini
   * BEZ blokowania inicjalizacji połączenia. Uruchamiane asynchronicznie po initAsync.
   */
  private async injectCallerContext(tenantId: string) {
    const [recentQueue, knownCustomer] = await Promise.all([
      prisma.outboundQueue.findMany({
        where: { targetPhone: this.callerPhone, status: 'done', scheduledFor: { gt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) } },
        orderBy: { scheduledFor: 'desc' }, take: 3
      }),
      prisma.customer.findFirst({ where: { phone: this.callerPhone, tenantId } })
    ]);

    let contextText = '';
    if (recentQueue.length > 0) {
      contextText += '[HISTORIA KONTAKTU]\n' + recentQueue.map((q: any) => `[${q.scheduledFor.toISOString()}] Wysłano ${q.channel.toUpperCase()}: "${(q.payload as any).text}"`).join('\n') + '\n';
    }

    if (knownCustomer) {
      contextText += `\n[SYSTEM INFO] To jest połączenie od TWOJEGO STAŁEGO KLIENTA. Został rozpoznany po numerze telefonu (Caller ID). Jego imię to: ${knownCustomer.name}, a numer to: ${knownCustomer.phone}.\n1) Powitaj go serdecznie po imieniu w pierwszym zdaniu.\n2) ZAKAZ pytania o imię i numer telefonu w trakcie całej rozmowy (masz już te dane). (ZIGNORUJ PUNKT 6 Z INSTRUKCJI)\n3) ZAKAZ pytania skąd klient dowiedział się o salonie. (ZIGNORUJ PUNKT 0 Z INSTRUKCJI)`;
    } else {
      contextText += `\n[SYSTEM INFO] Klient dzwoni z numeru: ${this.callerPhone}. Kiedy przejdziesz do punktu 6 (Dane klienta), ZANIM zapytasz o numer telefonu, ZAPYTAJ NAJPIERW CZY PODAJE INNY NUMER CZY MAMY UŻYĆ TEGO Z KTÓREGO DZWONI (podaj mu ten numer). Jeśli się zgodzi na ten z którego dzwoni, użyj go.`;
    }

    // Wstrzyknij do sesji Gemini jako inputText (bez przerywania audio)
    if (contextText && this.geminiClient) {
      this.geminiClient.sendInputText(contextText);
      console.log('[CallerID] Kontekst wstrzyknięty do sesji Gemini');
    }
  }

  private async initAsync(tenant: any) {
    try {
      if (tenant) {
        this.voiceName = tenant.aiVoice || "Aoede";
        this.businessProfile = tenant.businessProfile || "solo";
        this.bookingMode = tenant.bookingMode || "hourly";
        this.tenantName = tenant.name || "BeautyVoice";
        this.botName = tenant.botName || "Ewa";
        this.toneOfVoice = tenant.toneOfVoice || "profesjonalny";
        this.tenantId = tenant.id;
      }
    } catch (err) {
      console.error("[Orchestrator] Błąd pobierania tenanta:", err);
    }

    this.vadService = new VADService();
    await VADService.init();

    this.geminiClient = new GeminiClient({
      onAudioReceived: (audioBase64) => this.streamGeminiAudioToCaller(audioBase64),
      onToolCall: (toolCall) => this.orchestrateToolCallWithFiller(toolCall),
      voiceName: this.voiceName,
      businessProfile: this.businessProfile,
      bookingMode: this.bookingMode,
      tenantName: this.tenantName,
      botName: this.botName,
      toneOfVoice: this.toneOfVoice, contextHistory: this.contextHistory,
      tenantId: this.tenantId
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
          this.callStartTime = Date.now();
          const callerPhone = data.start.customParameters?.callerPhone || 'unknown';
          const outboundTaskId = data.start.customParameters?.outboundTaskId;
          
          setTimeout(async () => {
            let contextText = '';
            if (outboundTaskId && this.tenantId) {
               // OUTBOUND CALL LOGIC
               const task = await prisma.outboundQueue.findUnique({ where: { id: outboundTaskId } });
               if (task) {
                  const payload = typeof task.payload === 'object' && task.payload !== null ? task.payload as any : {};
                  contextText = `UWAGA: To jest połączenie wychodzące, które TY (asystentka) wykonujesz! Klient (${payload.customerName || task.targetPhone}) właśnie odebrał. Numer telefonu klienta to: ${task.targetPhone}. CEL ROZMOWY: ${payload.text}. MUSISZ NATYCHMIAST PRZEMÓWIĆ JAKO PIERWSZA, zanim klient coś powie!`;
                  // Oznacz task jako zakończony
                  await prisma.outboundQueue.update({ where: { id: task.id }, data: { status: 'done', processedAt: new Date() } });
               }
            } else if (callerPhone !== 'unknown' && this.geminiClient) {
              // INBOUND CALL LOGIC
              try {
                if (this.tenantId) {
                  const lastAppt = await prisma.appointment.findFirst({
                    where: { customerPhone: callerPhone, tenantId: this.tenantId },
                    orderBy: { startTime: 'desc' },
                    include: { service: true }
                  });
                  
                  if (lastAppt) {
                    contextText = `Dzwoni stała klientka ${lastAppt.customerName} z numeru ${callerPhone}. Jej ostatnia wizyta to ${lastAppt.service.name}.`;
                  } else {
                    contextText = `Dzwoni nowy numer: ${callerPhone}.`;
                  }
                }
              } catch (err) {
                console.error('[Orchestrator] Błąd sprawdzania historii klienta:', err);
              }
            }
            if (this.geminiClient) this.geminiClient.sendInitialGreeting(contextText);
          }, 1000);
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

  private executeBargeInMechanism() {
    console.log('--- [Barge-in] Wykryto przerwanie! Zatrzymywanie mowy.');
    this.agentSpeaking = false;
    
    this.audioPlayheadTimeMs = Date.now();
    if (this.turnOffSpeakingTimeout) {
      clearTimeout(this.turnOffSpeakingTimeout);
      this.turnOffSpeakingTimeout = null;
    }
    
    this.twilioWs.send(JSON.stringify({
      event: 'clear',
      streamSid: this.streamSid
    }));

    if (this.activeAudioController) {
      this.activeAudioController.abort();
      this.activeAudioController = null;
    }

    this.geminiClient.sendTurnComplete();
  }

  private async orchestrateToolCallWithFiller(toolCall: any) {
    this.activeAudioController = new AbortController();
    
    try {
      const fillerPromise = this.streamFillerAudio(this.activeAudioController.signal);

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
      
      await fillerPromise;

    } catch (err: any) {
      if (err.message === 'Aborted') {
        console.log('>>> [Filler] Człowiek wtrącił się podczas sprawdzania danych.');
      }
    } finally {
      this.activeAudioController = null;
    }
  }

  private async streamFillerAudio(signal: AbortSignal) {
    this.agentSpeaking = true;
    for (let i = 0; i < 100; i++) {
      if (signal.aborted) throw new Error('Aborted');
      
      const chunk = Buffer.alloc(160, 255); 
      this.sendMediaMessage(chunk.toString('base64'));
      
      await new Promise(r => setTimeout(r, 20));
    }
    this.agentSpeaking = false;
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
          return await bookingService.getFAQ(tenantId);
        case 'checkAvailability':
          return { availableSlots: await bookingService.checkAvailability(tenantId, args.date, args.serviceName, args.durationMinutes, args.preferredStaffName, this.bookingMode, args.numberOfNights) };
        case 'bookAppointment':
          return await bookingService.bookAppointment(tenantId, args.customerName, args.customerPhone, args.serviceName, args.startTime, args.durationMinutes, args.preferredStaffName, this.bookingMode, args.numberOfNights, args.promoCode, this.callerPhone);
        case 'confirmAppointment':
          return await bookingService.confirmAppointment(tenantId, args.customerPhone);
        case 'cancelAppointment':
          return await bookingService.cancelAppointment(tenantId, args.customerPhone);
        case 'requestHumanContact':
          return await bookingService.requestHumanContact(tenantId, args.customerPhone, args.reason);
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
    
    await this.vadService.processAudio(float32Array, (speechProb) => {
      if (this.agentSpeaking) {
        this.executeBargeInMechanism();
      }
    });

    if (!this.agentSpeaking) {
      const pcmBase64 = AudioPipeline.float32ToPcm16Base64(float32Array);
      this.geminiClient.sendRealtimeAudio(pcmBase64);
    }
  }

  private audioPlayheadTimeMs: number = Date.now();
  private turnOffSpeakingTimeout: NodeJS.Timeout | null = null;

  private streamGeminiAudioToCaller(audioBase64: string) {
    try {
      this.agentSpeaking = true;
      const outMulawBuffer = AudioPipeline.encodeGemini24kHzToTwilioMulaw(audioBase64);
      
      const durationMs = outMulawBuffer.length / 8; // 8 bajtów na ms (8000Hz mulaw)
      
      this.sendMediaMessage(Buffer.from(outMulawBuffer).toString('base64'));

      const now = Date.now();
      if (this.audioPlayheadTimeMs < now) {
         this.audioPlayheadTimeMs = now + durationMs;
      } else {
         this.audioPlayheadTimeMs += durationMs;
      }

      const timeUntilFinished = this.audioPlayheadTimeMs - now;
      if (this.turnOffSpeakingTimeout) clearTimeout(this.turnOffSpeakingTimeout);
      this.turnOffSpeakingTimeout = setTimeout(() => {
          this.agentSpeaking = false;
      }, timeUntilFinished);

    } catch (err) {
      console.error('[Egress] Błąd transformacji audio:', err);
    }
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
