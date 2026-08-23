import { WebSocket } from 'ws';
import { AudioPipeline } from './AudioPipeline';
import { VADService } from './VADService';
import { GeminiClient } from './GeminiClient';
import { prisma } from '../../prisma';
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

  private isReady: boolean = false;
  private twilioMessageBuffer: string[] = [];

  constructor(twilioConnection: WebSocket) {
    this.twilioWs = twilioConnection;
    
    this.twilioWs.on('message', async (message: string) => {
      const msgStr = message.toString();
      if (!this.isReady) {
        this.twilioMessageBuffer.push(msgStr);
      } else {
        await this.handleTwilioMessage(msgStr);
      }
    });

    this.twilioWs.on('close', () => {
      if (this.geminiClient) this.geminiClient.close();
    });

    this.initAsync().catch(console.error);
  }

  private async initAsync() {
    try {
      const tenant = await prisma.tenant.findFirst();
      if (tenant) {
        this.voiceName = tenant.aiVoice || "Aoede";
        this.businessProfile = tenant.businessProfile || "solo";
        this.bookingMode = (tenant as any).bookingMode || "hourly";
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
      bookingMode: this.bookingMode
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
          const callerPhone = data.start.customParameters?.callerPhone || 'unknown';
          
          setTimeout(async () => {
            let contextText = '';
            if (callerPhone !== 'unknown' && this.geminiClient) {
              try {
                const lastAppt = await prisma.appointment.findFirst({
                  where: { customerPhone: callerPhone },
                  orderBy: { startTime: 'desc' },
                  include: { service: true }
                });
                
                if (lastAppt) {
                  contextText = `Dzwoni stała klientka ${lastAppt.customerName} z numeru ${callerPhone}. Jej ostatnia wizyta to ${lastAppt.service.name}.`;
                } else {
                  contextText = `Dzwoni nowy numer: ${callerPhone}.`;
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
    console.log('🗣️ [Barge-in] Wykryto przerwanie! Zatrzymywanie mowy.');
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
        console.log('🛑 [Filler] Człowiek wtrącił się podczas sprawdzania danych.');
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
      const tenant = await prisma.tenant.findFirst();
      if (!tenant) return { error: "Brak salonu w bazie danych." };
      const tenantId = tenant.id;

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
      
      // Wysyłamy całą paczkę bezpośrednio do Twilio, pozwalając mu na naturalne buforowanie bez jąkania
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
