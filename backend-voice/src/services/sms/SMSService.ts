import { Client } from 'zadarma-api';

export class SMSService {
  private static zadarmaKey = process.env.ZADARMA_KEY;
  private static zadarmaSecret = process.env.ZADARMA_SECRET;
  private static zadarmaPhone = process.env.ZADARMA_PHONE_NUMBER;

  static async sendSMS(to: string, body: string): Promise<boolean> {
    if (!this.zadarmaKey || !this.zadarmaSecret || !this.zadarmaPhone) {
      console.log(`\n======================================`);
      console.log(`💬 [Mock SMS] Wiadomość przygotowana do wysyłki! (Brak kluczy Zadarma)`);
      console.log(`Do: ${to}`);
      console.log(`Treść:\n${body}`);
      console.log(`======================================\n`);
      return true; // Symulacja udanej wysyłki
    }

    try {
      const api = new Client(this.zadarmaKey, this.zadarmaSecret);

      // API Zadarmy wymaga parametrów w postaci obiektu
      const response = await api.call('/v1/sms/send/', {
        number: to,
        message: body,
        caller_id: this.zadarmaPhone
      }, 'POST');

      // Odpowiedź zawiera status
      if (response && response.status === 'success') {
        console.log(`📨 [Zadarma SMS] Wysłano SMS do ${to}`);
        return true;
      } else {
        console.error('❌ [Zadarma SMS] Błąd wysyłki SMS:', response);
        return false;
      }
    } catch (err) {
      console.error('❌ [Zadarma SMS] Wyjątek podczas wysyłki:', err);
      return false;
    }
  }
}
