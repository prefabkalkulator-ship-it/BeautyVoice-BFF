import { Client as ZadarmaClient } from 'zadarma-api';
import twilio from 'twilio';

export class VoiceOutboundService {
  private static zadarmaKey = process.env.ZADARMA_KEY;
  private static zadarmaSecret = process.env.ZADARMA_SECRET;
  private static twilioSid = process.env.TWILIO_ACCOUNT_SID;
  private static twilioToken = process.env.TWILIO_AUTH_TOKEN;
  private static callerId = process.env.ZADARMA_PHONE_NUMBER || '+48533989987';

  public static activeOutboundCalls = new Map<string, string>();

  static async initiateCall(taskId: string, targetPhone: string): Promise<boolean> {
    const normalizedPhone = targetPhone.replace('+', '');
    this.activeOutboundCalls.set(normalizedPhone, taskId);
    this.activeOutboundCalls.set(`+${normalizedPhone}`, taskId);

    // Jeli mamy skonfigurowane Twilio, uywamy bezporednio Twilio REST API (BYOC/Verified Caller)
    if (this.twilioSid && this.twilioToken) {
      console.log(`[VoiceOutbound] Inicjowanie poczenia przez Twilio REST API do: ${targetPhone}`);
      try {
        const client = twilio(this.twilioSid, this.twilioToken);
        const twiml = `
          <Response>
            <Connect>
              <Stream url="wss://${process.env.HOST || 'beautyvoice-bff-739272851032.europe-central2.run.app'}/connection">
                <Parameter name="outboundTaskId" value="${taskId}" />
              </Stream>
            </Connect>
          </Response>
        `;
        
        // Zapewniamy plus dla twilio do formatu E.164
        const to = targetPhone.startsWith('+') ? targetPhone : '+' + targetPhone;
        const from = process.env.TWILIO_CALLER_ID || '+48533989987';

        const call = await client.calls.create({
          twiml: twiml,
          to: to,
          from: from
        });
        
        console.log(`[VoiceOutbound] Twilio call created. SID: ${call.sid}`);
        return true;
      } catch (err: any) {
        console.error('[VoiceOutbound] Bd inicjacji przez Twilio:', err.message);
        this.clearCall(targetPhone);
        return false;
      }
    }

    // Fallback na stary mechanizm Zadarmy jeli brak kluczy Twilio
    if (!this.zadarmaKey || !this.zadarmaSecret) {
      console.log(`[VoiceOutbound] Brak kluczy. Symulacja dzwonienia do ${targetPhone}`);
      return true;
    }

    try {
      const api = new ZadarmaClient(this.zadarmaKey, this.zadarmaSecret);
      const zFrom = process.env.ZADARMA_PBX_EXTENSION || this.callerId;
      console.log(`[VoiceOutbound] Inicjowanie callbacku Zadarma: ${zFrom} -> ${targetPhone}`);
      
      const response = await api.call('/v1/request/callback/', {
        from: zFrom.startsWith('+') ? zFrom : '+' + zFrom,
        to: targetPhone
      }, 'GET');

      if (response && response.status === 'success') {
        console.log(`[VoiceOutbound] Zadarma zaakceptowaa Callback.`);
        return true;
      } else {
        console.error('[VoiceOutbound] Zadarma Callback bd:', response);
        this.clearCall(targetPhone);
        return false;
      }
    } catch (err: any) {
      console.error('[VoiceOutbound] Wyjtek Zadarma Callback:', err.message);
      this.clearCall(targetPhone);
      return false;
    }
  }

  static getTaskIdByPhone(phone: string): string | null {
    const normalized = phone.replace('+', '');
    const taskId = this.activeOutboundCalls.get(normalized) || this.activeOutboundCalls.get(`+${normalized}`);
    return taskId || null;
  }

  static clearCall(phone: string) {
    const normalized = phone.replace('+', '');
    this.activeOutboundCalls.delete(normalized);
    this.activeOutboundCalls.delete(`+${normalized}`);
  }
}
