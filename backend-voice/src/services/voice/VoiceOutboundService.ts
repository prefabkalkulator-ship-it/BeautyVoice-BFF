import { Client as ZadarmaClient } from 'zadarma-api';
import twilio from 'twilio';
import { prisma } from '../../prisma';

export class VoiceOutboundService {
  private static zadarmaKey = process.env.ZADARMA_KEY;
  private static zadarmaSecret = process.env.ZADARMA_SECRET;
  private static twilioSid = process.env.TWILIO_ACCOUNT_SID;
  private static twilioToken = process.env.TWILIO_AUTH_TOKEN;
  private static callerId = process.env.ZADARMA_PHONE_NUMBER || process.env.TWILIO_CALLER_ID || '+48343433088';

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
      // Dla połączeń wychodzących bota do klienta (np. potwierdzenie rezerwacji w pakiecie Premium):
      // Zawsze używamy zweryfikowanego stacjonarnego numeru centrali Twilio (TWILIO_CALLER_ID),
      // ponieważ polskie sieci komórkowe (Play/Orange/T-Mobile) blokują tranzyt VoIP prezentujący polski numer komórkowy (błąd 486 Busy / CLI Spoofing).
      let from = process.env.TWILIO_CALLER_ID || '+48343433088';

      // KRYTYCZNE ZABEZPIECZENIE: Nigdy nie wolno dzwonić z numeru na ten sam numer (from === to)
      // Operatorzy telekomunikacyjni odrzucają takie połączenia z błędem pętli (Failed)
      if (from === to) {
        console.warn(`[VoiceOutbound] Wykryto from === to (${from}). Zmiana na zweryfikowany numer zastępczy centrali.`);
        from = process.env.TWILIO_CALLER_ID || '+48343433088';
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
        const centrala = process.env.TWILIO_CALLER_ID || '+48343433088';
        const candidateFallbacks = [centrala, '+48343433088'];
        const fallbacks = Array.from(new Set(candidateFallbacks)).filter(f => f !== from && f !== to);

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
      const to = repPhone.startsWith('+') ? repPhone : '+' + repPhone;
      const custTo = customerPhone.startsWith('+') ? customerPhone : '+' + customerPhone;

      // 1. Numer Centrali Twilio (oficjalna zweryfikowana linia Twilio do połączenia z Handlowcem)
      const centralaCallerId = process.env.TWILIO_CALLER_ID || '+48343433088';

      // 2. Caller ID prezentowany KLIENTOWI na Leg 2:
      // Musi być zarejestrowanym numerem stacjonarnym firmy (tenant.companyLandlinePhone).
      // Zgodnie z wytycznymi: jeśli brak numeru stacjonarnego firmy, ścieżka jest bezwzględnie zablokowana i NIE MA awaryjnego przełączania na DEMO (+48343433088).
      const landlineRaw = (tenant.companyLandlinePhone || '').trim();
      const cleanLandline = landlineRaw.replace(/[\s\-\+]/g, '');
      if (!cleanLandline || cleanLandline === '48343433088' || cleanLandline.includes('343433088')) {
        return { 
          success: false, 
          error: 'Brak zweryfikowanego numeru stacjonarnego firmy. Połączenie przez centralę automatyczną jest zablokowane.' 
        };
      }
      const customerLegCallerId = landlineRaw.startsWith('+') ? landlineRaw : '+' + landlineRaw;

      const client = twilio(this.twilioSid, this.twilioToken);

      // KROK 1 (Leg 1): Centrala dzwoni do HANDLOWCA (to: repPhone).
      // Leg 1 MUSI być zestawiany z numeru Centrali Twilio (centralaCallerId), aby polscy operatorzy
      // komórkowi nie odrzucali połączenia ze stacji VoIP na numer komórkowy.
      const leg1FromCandidates = Array.from(new Set([
        centralaCallerId,
        '+48343433088',
        tenant.assignedPhoneNumber
      ].filter((n): n is string => Boolean(n) && (n.startsWith('+') ? n : '+' + n) !== to)));

      console.log(`[VoiceOutbound] Inicjowanie 2-Leg Copilot Bridge: Leg 1 do Handlowca (${to}) z CallerID centrali, Leg 2 do Klienta (${custTo}) z oficjalnym CallerID stacjonarnym: ${customerLegCallerId}`);

      const twiml = `
        <Response>
          <Start>
            <Stream url="wss://${host}/api/copilot-voice" track="both_tracks">
              <Parameter name="copilotSessionId" value="${sessionId}" />
              <Parameter name="tenantId" value="${tenantId}" />
              <Parameter name="customerPhone" value="${custTo}" />
            </Stream>
          </Start>
          <Say language="pl-PL">Łączę z klientem. Copilot na żywo jest aktywny.</Say>
          <Dial callerId="${customerLegCallerId}" timeout="35">
            <Number>${custTo}</Number>
          </Dial>
          <Say language="pl-PL">Nie udało się połączyć z klientem. Linia jest zajęta lub nie odpowiada.</Say>
        </Response>
      `;

      let call;
      let lastError = '';

      for (const candidateFrom of leg1FromCandidates) {
        try {
          call = await client.calls.create({
            twiml,
            to,
            from: candidateFrom
          });

          console.log(`[VoiceOutbound] Copilot Call Bridge utworzony pomyślnie. Leg 1 From: ${candidateFrom} -> To: ${to}, Leg 2 CallerID: ${customerLegCallerId}. SID: ${call.sid}`);
          return { success: true, callSid: call.sid };
        } catch (err: any) {
          lastError = err.message;
          console.warn(`[VoiceOutbound] Próba 2-Leg Bridge z CallerID ${candidateFrom} nie powiodła się: ${err.message}. Próbuję kolejnego numeru...`);
        }
      }

      console.error(`[VoiceOutbound] Wszystkie próby 2-Leg Copilot Bridge nie powiodły się. Ostatni błąd: ${lastError}`);
      return { success: false, error: lastError };
    } catch (err: any) {
      console.error('[VoiceOutbound] Błąd 2-Leg Copilot Bridge:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Schemat odwróconego mostka (Inverted Conference Call)
   * Krok 1: Centrala dzwoni do Handlowca z oficjalnego numeru (+48343433088).
   * Krok 2: Handlowiec odbiera telefon (w słuchawce cisza - asystent nasłuchujący).
   * Krok 3: Handlowiec klika na telefonie 'Dodaj połączenie' (+) i dzwoni do klienta (klient widzi numer komórkowy handlowca!).
   * Krok 4: Handlowiec scala połączenia w konferencję GSM (3-way merge).
   */
  static async initiateCopilotConferenceCall(options: {
    sessionId: string;
    tenantId: string;
    customerPhone: string;
    customerName?: string;
  }): Promise<{ success: boolean; callSid?: string; error?: string }> {
    const { sessionId, tenantId, customerPhone } = options;

    if (!this.twilioSid || !this.twilioToken) {
      console.warn('[VoiceOutbound] Brak kluczy Twilio SID/Token do konferencji. Działa w trybie symulacyjnym.');
      return { success: true };
    }

    try {
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      if (!tenant || !tenant.phoneNumber) {
        return { success: false, error: 'Brak numeru telefonu handlowca w profilu tenanta.' };
      }

      const repPhone = tenant.phoneNumber;
      const host = process.env.HOST || 'beautyvoice-bff-739272851032.europe-central2.run.app';
      const to = repPhone.startsWith('+') ? repPhone : '+' + repPhone;
      const custTo = customerPhone.startsWith('+') ? customerPhone : '+' + customerPhone;
      const centralaCallerId = process.env.TWILIO_CALLER_ID || '+48343433088';

      const client = twilio(this.twilioSid, this.twilioToken);

      console.log(`[VoiceOutbound] Inicjowanie połączenia konferencyjnego Copilota do Handlowca: ${to} z numeru centrali: ${centralaCallerId}`);

      const twiml = `
        <Response>
          <Start>
            <Stream url="wss://${host}/api/copilot-voice" track="both_tracks">
              <Parameter name="copilotSessionId" value="${sessionId}" />
              <Parameter name="tenantId" value="${tenantId}" />
              <Parameter name="customerPhone" value="${custTo}" />
              <Parameter name="isConference" value="true" />
            </Stream>
          </Start>
          <Pause length="3600" />
        </Response>
      `;

      const call = await client.calls.create({
        twiml,
        to,
        from: centralaCallerId
      });

      console.log(`[VoiceOutbound] Połączenie do Handlowca utworzone pomyślnie. SID: ${call.sid}`);
      return { success: true, callSid: call.sid };
    } catch (err: any) {
      console.error(`[VoiceOutbound] Błąd inicjowania połączenia konferencyjnego do Handlowca:`, err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Zdalne zakończenie aktywnego połączenia w Twilio (Hangup)
   */
  static async terminateCall(callSid: string): Promise<boolean> {
    if (!this.twilioSid || !this.twilioToken || !callSid) return false;
    try {
      const client = twilio(this.twilioSid, this.twilioToken);
      await client.calls(callSid).update({ status: 'completed' });
      console.log(`🛑 [VoiceOutbound] Połączenie Twilio ${callSid} zostało rozłączone przez centralę.`);
      return true;
    } catch (err: any) {
      console.warn(`[VoiceOutbound] Błąd rozłączania Twilio ${callSid}:`, err.message);
      return false;
    }
  }
}
