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
            // normalize dialedNumber by adding + if it starts with 48
              let normalizedDialed = dialedNumber;
              if (normalizedDialed !== 'unknown' && !normalizedDialed.startsWith('+')) {
                normalizedDialed = '+' + normalizedDialed;
              }
              let tenant = await prisma.tenant.findFirst({ where: { assignedPhoneNumber: normalizedDialed } });
            if (!tenant) tenant = await prisma.tenant.findFirst();
            await this.initAsync(tenant);
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
      toneOfVoice: this.toneOfVoice,
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
                  contextText = `UWAGA: To jest połączenie wychodzące, które TY (asystentka) wykonujesz! Klient (${payload.customerName || task.targetPhone}) właśnie odebrał. CEL ROZMOWY: ${payload.text}. MUSISZ NATYCHMIAST PRZEMÓWIĆ JAKO PIERWSZA, zanim klient coś powie!`;
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
          return await bookingService.bookAppointment(tenantId, args.customerName, args.customerPhone, args.serviceName, args.startTime, args.durationMinutes, args.preferredStaffName, this.bookingMode, args.numberOfNights);
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
