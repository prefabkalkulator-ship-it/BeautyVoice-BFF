export class SMSService {
  private static accountSid = process.env.TWILIO_ACCOUNT_SID;
  private static authToken = process.env.TWILIO_AUTH_TOKEN;
  private static twilioPhone = process.env.TWILIO_PHONE_NUMBER;

  static async sendSMS(to: string, body: string): Promise<boolean> {
    if (!this.accountSid || !this.authToken || !this.twilioPhone) {
      console.log(`\n======================================`);
      console.log(`📱 [Mock SMS] Wiadomość przygotowana do wysyłki!`);
      console.log(`Do: ${to}`);
      console.log(`Treść:\n${body}`);
      console.log(`======================================\n`);
      return true; // Symulacja udanej wysyłki
    }

    try {
      const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');
      const params = new URLSearchParams();
      params.append('To', to);
      params.append('From', this.twilioPhone);
      params.append('Body', body);

      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('❌ [Twilio SMS] Błąd wysyłki SMS:', errorData);
        return false;
      }

      console.log(`✅ [Twilio SMS] Wysłano SMS do ${to}`);
      return true;
    } catch (err) {
      console.error('❌ [Twilio SMS] Wyjątek podczas wysyłki:', err);
      return false;
    }
  }
}
