import { Client as ZadarmaClient } from 'zadarma-api';
import twilio from 'twilio';
import { prisma } from '../../prisma';

export class VoiceOutboundService {
  private static zadarmaKey = process.env.ZADARMA_KEY;
  private static zadarmaSecret = process.env.ZADARMA_SECRET;
  private static twilioSid = process.env.TWILIO_ACCOUNT_SID;
  private static twilioToken = process.env.TWILIO_AUTH_TOKEN;
  private static callerId = process.env.ZADARMA_PHONE_NUMBER || '+48459568507';

  public static activeOutboundCalls = new Map<string, string>();

  static async initiateCall(taskId: string, targetPhone: string, tenantId?: string): Promise<boolean> {
    const normalizedPhone = targetPhone.replace('+', '');
    this.activeOutboundCalls.set(normalizedPhone, taskId);
    this.activeOutboundCalls.set(`+${normalizedPhone}`, taskId);

    // Automatyczne czyszczenie po 10 minutach, aby zapobiec wyciekom
    setTimeout(() => {
      this.clearCall(targetPhone);
    }, 10 * 60 * 1000);

    // Jeśli mamy skonfigurowane Twilio, używamy bezpośrednio Twilio REST API
    if (this.twilioSid && this.twilioToken) {
      console.log(`[VoiceOutbound] Inicjowanie połączenia przez Twilio REST API do: ${targetPhone}`);
      const client = twilio(this.twilioSid, this.twilioToken);
      const twiml = `
        <Response>
          <Connect>
            <Stream url="wss://${process.env.HOST || 'beautyvoice-bff-739272851032.europe-central2.run.app'}/api/twilio-voice">
              <Parameter name="outboundTaskId" value="${taskId}" />
              <Parameter name="callerPhone" value="${targetPhone}" />
              ${tenantId ? `<Parameter name="tenantId" value="${tenantId}" />` : ''}
            </Stream>
          </Connect>
        </Response>
      `;
      
      const to = targetPhone.startsWith('+') ? targetPhone : '+' + targetPhone;
      let from = process.env.TWILIO_CALLER_ID || '+48459568507';

      if (tenantId) {
        try {
          const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
          if (tenant?.assignedPhoneNumber) {
            from = tenant.assignedPhoneNumber;
          } else if (tenant?.phoneNumber) {
            from = tenant.phoneNumber;
          }
        } catch (e) {}
      }

      // KRYTYCZNE ZABEZPIECZENIE: Nigdy nie wolno dzwonić z numeru na ten sam numer (from === to)
      // Operatorzy telekomunikacyjni odrzucają takie połączenia z błędem pętli (Failed)
      if (from === to) {
        console.warn(`[VoiceOutbound] Wykryto from === to (${from}). Zmiana na zweryfikowany numer zastępczy +48343433088.`);
        from = '+48343433088';
      }

      let call;
      try {
        call = await client.calls.create({
          twiml: twiml,
          to: to,
          from: from
        });
        console.log(`[VoiceOutbound] Twilio call created with Caller ID: ${from}. SID: ${call.sid}`);
        return true;
      } catch (err: any) {
        console.warn(`[VoiceOutbound] Próba połączenia z ${from} zwróciła błąd: ${err.message}. Próbuję alternatywnych zweryfikowanych numerów...`);
        // Bezwzględnie wykluczamy zarówno numer bieżący (from), jak i numer docelowy (to)!
        const candidateFallbacks = ['+48459568507', '+48343433088', '+48533989987'];
        const fallbacks = candidateFallbacks.filter(f => f !== from && f !== to);

        for (const fallbackFrom of fallbacks) {
          try {
            call = await client.calls.create({
              twiml: twiml,
              to: to,
              from: fallbackFrom
            });
            console.log(`[VoiceOutbound] Twilio call created z numeru fallback ${fallbackFrom}. SID: ${call.sid}`);
            return true;
          } catch (fbErr: any) {
            console.warn(`[VoiceOutbound] Fallback ${fallbackFrom} nieudany: ${fbErr.message}`);
          }
        }
        console.error('[VoiceOutbound] Wszystkie próby Twilio nie powiodły się.');
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

  /**
   * 2-Leg Call Bridging dla Copilota Rozmów na Żywo (Wariant 2)
   * Krok 1: Dzwoni na telefon Właściciela / Handlowca (Leg 1)
   * Krok 2: Po odebraniu, łączy z Klientem (Leg 2), prezentując numer firmowy
   * Krok 3: Włącza forkowanie strumienia dwukanałowego (<Stream track="both_tracks">) do /api/copilot-voice
   */
  static async initiateCopilotBridge(options: {
    sessionId: string;
    tenantId: string;
    customerPhone: string;
    customerName?: string;
  }): Promise<{ success: boolean; callSid?: string; error?: string }> {
    const { sessionId, tenantId, customerPhone } = options;

    if (!this.twilioSid || !this.twilioToken) {
      console.warn('[VoiceOutbound] Brak kluczy Twilio SID/Token do 2-Leg Call Bridge. Działa w trybie symulacyjnym.');
      return { success: true };
    }

    try {
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      if (!tenant) {
        return { success: false, error: 'Nie znaleziono firmy' };
      }

      const repPhone = tenant.phoneNumber; // Numer komórkowy właściciela / handlowca
      const host = process.env.HOST || 'beautyvoice-bff-739272851032.europe-central2.run.app';
      const callerIdToPresent = tenant.assignedPhoneNumber || process.env.TWILIO_CALLER_ID || '+48459568507';

      const twiml = `
        <Response>
          <Start>
            <Stream url="wss://${host}/api/copilot-voice" track="both_tracks">
              <Parameter name="copilotSessionId" value="${sessionId}" />
              <Parameter name="tenantId" value="${tenantId}" />
              <Parameter name="customerPhone" value="${customerPhone}" />
            </Stream>
          </Start>
          <Say language="pl-PL">Łączę z klientem. Copilot na żywo jest aktywny.</Say>
          <Dial callerId="${callerIdToPresent}" timeout="35">
            <Number>${customerPhone}</Number>
          </Dial>
        </Response>
      `;

      const client = twilio(this.twilioSid, this.twilioToken);
      const to = repPhone.startsWith('+') ? repPhone : '+' + repPhone;
      let from = callerIdToPresent.startsWith('+') ? callerIdToPresent : '+' + callerIdToPresent;

      // Zabezpieczenie przed from === to
      if (from === to) {
        from = '+48343433088';
      }

      console.log(`[VoiceOutbound] Inicjowanie 2-Leg Copilot Bridge: Leg 1 do Rep (${to}), prezentowany CallerID (${from})`);
      const call = await client.calls.create({
        twiml,
        to,
        from
      });

      console.log(`[VoiceOutbound] Copilot Call Bridge utworzony pomyślnie. SID: ${call.sid}`);
      return { success: true, callSid: call.sid };
    } catch (err: any) {
      console.error('[VoiceOutbound] Błąd 2-Leg Copilot Bridge:', err.message);
      return { success: false, error: err.message };
    }
  }
}
