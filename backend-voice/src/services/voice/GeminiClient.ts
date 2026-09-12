import { WebSocket } from 'ws';
import { getSystemPrompt } from '../../prompts/systemPrompt';
import { BookingService } from '../BookingService';
import { prisma } from '../../prisma';

export interface GeminiClientCallbacks {
  onAudioReceived: (audioBase64: string) => void;
  onToolCall: (toolCall: any) => void;
  onInterrupted?: () => void;
  onTurnComplete?: () => void;
  voiceName: string;
  businessProfile: string;
  bookingMode: string;
  tenantId?: string;
  botName?: string;
  tenantName?: string;
  toneOfVoice?: string;
  contextHistory?: string;
  // Właściwości Asystenta Osobistego
  callerRole?: 'OWNER' | 'VIP' | 'GUEST' | 'SPAM';
  vipName?: string;
  vipCategory?: string;
  vipNotes?: string;
  profession?: string;
  bioSummary?: string;
  bufferMinutes?: number;
  ownerName?: string;
  ownerGender?: string;
  companyName?: string;
  businessCategory?: string;
  assistantRole?: string;
  formalityLevel?: string;
  personalSchedule?: any;
  callerPhone?: string;
  proactiveMode?: boolean;
  isReturningCaller?: boolean;
  returningCallerName?: string;
  returningCallerGender?: 'MALE' | 'FEMALE' | 'UNKNOWN';
  ownerRequirePin?: boolean;
  isOwnerPinVerified?: boolean;
  confidentialTopics?: string[];
}

export class GeminiClient {
  private ws: WebSocket | null = null;
  private callbacks: GeminiClientCallbacks;

  constructor(callbacks: GeminiClientCallbacks) {
    this.callbacks = callbacks;
  }

  connect() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('[Gemini] Brak klucza GEMINI_API_KEY.');
      return;
    }

    const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;
    this.ws = new WebSocket(url);

    this.ws.on('open', () => {
      console.log('🔗 [Gemini] Nawiązano połączenie WebSocket');
      this.sendSetup();
    });

    this.ws.on('message', (data: Buffer | string) => this.handleMessage(data));
    this.ws.on('close', (code, reason) => {
      console.log(`🔌 [Gemini] Zamknięto połączenie. Kod: ${code}, Powód: ${reason.toString()}`);
    });
    this.ws.on('error', (err) => console.error('[Gemini] Błąd WS:', err));
  }

  private sendSetup() {
    const aiVoice = this.callbacks.voiceName;
    const businessProfile = this.callbacks.businessProfile;
    const bookingMode = this.callbacks.bookingMode;
    const callerRole = this.callbacks.callerRole || 'GUEST';

    const setupMessage = {
      setup: {
        model: "models/gemini-3.1-flash-live-preview",
        systemInstruction: {
          parts: [{ text: getSystemPrompt({
              tenantName: this.callbacks.tenantName || "BeautyVoice",
              businessProfile: businessProfile,
              voiceName: aiVoice,
              bookingMode: bookingMode,
              botNameArg: (this.callbacks.botName !== undefined && this.callbacks.botName !== null) ? this.callbacks.botName : "Ewa",
              toneOfVoiceArg: this.callbacks.toneOfVoice || "profesjonalny",
              contextHistory: this.callbacks.contextHistory || "",
              isTextChat: false,
              callerRole: callerRole,
              vipName: this.callbacks.vipName,
              vipCategory: this.callbacks.vipCategory,
              vipNotes: this.callbacks.vipNotes,
              profession: this.callbacks.profession,
              bioSummary: this.callbacks.bioSummary,
              bufferMinutes: this.callbacks.bufferMinutes,
              ownerName: this.callbacks.ownerName,
              ownerGender: this.callbacks.ownerGender,
              companyName: this.callbacks.companyName,
              businessCategory: this.callbacks.businessCategory,
              assistantRole: this.callbacks.assistantRole,
              formalityLevel: this.callbacks.formalityLevel,
              personalSchedule: this.callbacks.personalSchedule,
              callerPhone: this.callbacks.callerPhone,
              proactiveMode: this.callbacks.proactiveMode,
              isReturningCaller: this.callbacks.isReturningCaller,
              returningCallerName: this.callbacks.returningCallerName,
              returningCallerGender: this.callbacks.returningCallerGender,
              ownerRequirePin: this.callbacks.ownerRequirePin,
              isOwnerPinVerified: this.callbacks.isOwnerPinVerified,
              confidentialTopics: this.callbacks.confidentialTopics
            }) }]
        },
        tools: [{
          functionDeclarations: BookingService.getToolDefinitions(bookingMode, true, callerRole, businessProfile)
        }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: { 
              prebuiltVoiceConfig: { 
                voiceName: aiVoice 
              } 
            }
          }
        }
      }
    };

    console.log("[Gemini] Wysyłanie setupMessage dla:", aiVoice);
    this.ws?.send(JSON.stringify(setupMessage));
  }

  private handleMessage(rawData: Buffer | string) {
    try {
      const dataStr = rawData.toString();
      const response = JSON.parse(dataStr);
      
      if (!response.serverContent?.modelTurn?.parts?.[0]?.inlineData) {
         console.log('[Gemini] Otrzymano zdarzenie:', Object.keys(response));
      }

      if (response.error || dataStr.includes('"error"')) {
        console.error('⚠️ [Gemini] Błąd zwrócony przez API:', dataStr);
      }

      if (response.serverContent?.interrupted) {
        console.log('⚡ [Gemini] Model zgłasza interrupted: true (Barge-in)!');
        this.callbacks.onInterrupted?.();
      }

      if (response.serverContent?.turnComplete) {
        this.callbacks.onTurnComplete?.();
      }

      if (response.serverContent?.modelTurn) {
        const parts = response.serverContent.modelTurn.parts;
        for (const part of parts) {
          if (part.inlineData?.data) {
            this.callbacks.onAudioReceived(part.inlineData.data);
          }
        }
      }

      if (response.toolCall) {
        this.callbacks.onToolCall(response.toolCall);
      }
    } catch (err) {
      console.error('[Gemini] Błąd parsowania:', err);
    }
  }

  sendRealtimeAudio(pcmBase64: string) {
    this.send({
      realtimeInput: { audio: { mimeType: "audio/pcm;rate=16000", data: pcmBase64 } }
    });
  }

  sendTurnComplete() {
    this.send({ clientContent: { turnComplete: true } });
  }
  
  sendInitialGreeting(contextText?: string) {
    const text = contextText 
      ? `Odebrałem telefon. ${contextText} Przywitaj się po polsku.` 
      : 'Odebrałem telefon. Przywitaj się po polsku.';
      
    this.send({
      clientContent: {
        turns: [{ role: 'user', parts: [{ text }] }],
        turnComplete: true
      }
    });
  }

  sendToolResponse(functionResponses: any[]) {
    this.send({
      toolResponse: { functionResponses }
    });
  }

  sendInputText(text: string) {
    this.send({
      clientContent: {
        turns: [{ role: 'user', parts: [{ text: `[SYSTEM CONTEXT UPDATE] ${text}` }] }],
        turnComplete: false
      }
    });
  }

  private send(obj: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  }

  close() {
    this.ws?.close();
  }
}
