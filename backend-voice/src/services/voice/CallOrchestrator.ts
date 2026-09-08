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
  
  // Adaptive Jitter Buffer (200ms) & Barge-In State
  private agentSpeaking: boolean = false;
  private isTurnCanceled: boolean = false;
  private isTurnStreaming: boolean = false;
  private turnAudioQueue: Uint8Array[] = [];
  private turnBufferedDurationMs: number = 0;
  private readonly PREBUFFER_THRESHOLD_MS: number = 200; // 200ms poduszka rozbiegowa (1600 bajtów 8kHz mulaw)
  
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
          }
        } catch(e) {
          console.error('❌ [CallOrchestrator] Błąd obsługi zdarzenia start:', e);
        }
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
      onInterrupted: () => this.handleGeminiInterrupted(),
      onTurnComplete: () => this.handleGeminiTurnComplete(),
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
            } else if (callerPhone !== 'unknown' && this.geminiClient && this.tenantId) {
              // INBOUND CALL LOGIC: jedno spójne sprawdzenie stałego klienta i ostatniej wizyty
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
                  const visitInfo = lastAppt ? ` Jej ostatnia wizyta to ${lastAppt.service.name}.` : '';
                  contextText = `To jest połączenie od TWOJEJ STAŁEJ KLIENTKI: ${knownCustomer.name} z numeru ${callerPhone}.${visitInfo} Powitaj ją ciepło po imieniu w pierwszym zdaniu. ZAKAZ pytania o imię i numer (masz już te dane). ZAKAZ pytania skąd wie o salonie.`;
                } else {
                  contextText = `Klient dzwoni z numeru: ${callerPhone}.`;
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
    // Jeśli tura była krótsza niż 200ms (np. pojedyncze "Tak"), uwalniamy bufor
    if (!this.isTurnStreaming && this.turnAudioQueue.length > 0 && !this.isTurnCanceled) {
      this.flushTurnBufferToTwilio();
    }
    this.isTurnStreaming = false;
    this.agentSpeaking = false;
  }

  private executeBargeInMechanism() {
    if (this.isTurnCanceled) return;
    console.log('🛑 [Barge-in] Wykryto przerwanie! Natychmiastowe zatrzymanie mowy asystenta.');
    
    this.isTurnCanceled = true;
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
    
    // 1. Sprawdzamy lokalny Silero VAD pod kątem wtrącenia użytkownika (Barge-in)
    await this.vadService.processAudio(float32Array, (speechProb) => {
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
