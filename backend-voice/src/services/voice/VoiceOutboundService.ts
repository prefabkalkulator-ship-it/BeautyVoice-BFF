import { Client } from 'zadarma-api';
import { prisma } from '../../prisma';

export class VoiceOutboundService {
  private static zadarmaKey = process.env.ZADARMA_KEY;
  private static zadarmaSecret = process.env.ZADARMA_SECRET;
  private static zadarmaFrom = process.env.ZADARMA_PBX_EXTENSION || process.env.ZADARMA_PHONE_NUMBER || '100';

  // Globalny cache dla śledzenia aktywnych dzwonień (numer klienta -> taskId)
  public static activeOutboundCalls = new Map<string, string>();

  static async initiateCall(taskId: string, targetPhone: string): Promise<boolean> {
    if (!this.zadarmaKey || !this.zadarmaSecret) {
      console.log(`[VoiceOutbound] Brak kluczy Zadarma. Symulacja dzwonienia do ${targetPhone}`);
      // Symulacja rejestracji calla
      this.activeOutboundCalls.set(targetPhone.replace('+', ''), taskId);
      
      // Tutaj w dev środowisku można wywołać bezpośrednio nasz webhook dla testów
      return true;
    }

    try {
      // Rejestrujemy intencję dzwonienia. Twilio najpewniej przyśle numer z lub bez plusa.
      const normalizedPhone = targetPhone.replace('+', '');
      this.activeOutboundCalls.set(normalizedPhone, taskId);
      this.activeOutboundCalls.set(`+${normalizedPhone}`, taskId); // Zabezpieczenie na obie wersje

      const api = new Client(this.zadarmaKey, this.zadarmaSecret);

      console.log(`[VoiceOutbound] Inicjowanie callbacku Zadarma: ${this.zadarmaFrom} -> ${targetPhone}`);
      const response = await api.call('/v1/request/callback/', {
        from: this.zadarmaFrom,
        to: targetPhone
      }, 'POST');

      if (response && response.status === 'success') {
        console.log(`[VoiceOutbound] Zadarma zaakceptowała Callback. Oczekujemy na połączenie w Twilio!`);
        return true;
      } else {
        console.error('[VoiceOutbound] Zadarma Callback błąd:', response);
        this.activeOutboundCalls.delete(normalizedPhone);
        this.activeOutboundCalls.delete(`+${normalizedPhone}`);
        return false;
      }
    } catch (err) {
      console.error('[VoiceOutbound] Wyjątek podczas inicjacji:', err);
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
