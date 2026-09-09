import nodemailer, { type Transporter } from 'nodemailer';

export class EmailService {
  private static transporter: Transporter | null = null;

  private static getTransporter() {
    if (!this.transporter) {
      const host = process.env.SMTP_HOST;
      const port = parseInt(process.env.SMTP_PORT || '465', 10);
      const user = process.env.SMTP_USER;
      const pass = process.env.SMTP_PASS;
      const secure = process.env.SMTP_SECURE === 'true' || port === 465;

      if (!host || !user || !pass) {
        console.warn('[EmailService] Brak pełnej konfiguracji SMTP w .env - powiadomienia e-mail będą logowane w konsoli.');
        return null;
      }

      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
          user,
          pass
        },
        tls: {
          rejectUnauthorized: false
        }
      });
    }
    return this.transporter;
  }

  static async sendEmail(recipient: string, subject: string, html: string, text?: string): Promise<boolean> {
    const sender = process.env.SMTP_USER || 'support@veritas-app.com';
    const transporter = this.getTransporter();
    if (!transporter) {
      console.log(`\n📧 [Mock Email] Do: ${recipient}\nTemat: ${subject}\nTreść:\n${text || html}\n`);
      return true;
    }

    try {
      const info = await transporter.sendMail({
        from: `"EVA - Twój Asystent Osobisty" <${sender}>`,
        to: recipient,
        subject,
        text: text || html.replace(/<[^>]*>?/gm, ''),
        html
      });
      console.log(`📧 [EmailService] Wysłano e-mail do ${recipient}: ${info.messageId}`);
      return true;
    } catch (err) {
      console.error(`❌ [EmailService] Błąd wysyłki e-maila do ${recipient}:`, err);
      return false;
    }
  }

  static async sendAdminAlert(subject: string, html: string, text?: string): Promise<boolean> {
    const recipient = process.env.ADMIN_NOTIFICATION_EMAIL || process.env.SMTP_USER || 'support@veritas-app.com';
    const sender = process.env.SMTP_USER || 'support@veritas-app.com';

    const transporter = this.getTransporter();
    if (!transporter) {
      console.log(`\n📧 [Mock Email] Do: ${recipient}\nTemat: ${subject}\nTreść:\n${text || html}\n`);
      return true;
    }

    try {
      const info = await transporter.sendMail({
        from: `"BeautyVoice EVA" <${sender}>`,
        to: recipient,
        subject,
        text: text || html.replace(/<[^>]*>?/gm, ''),
        html
      });
      console.log(`📧 [EmailService] Wysłano e-mail do admina: ${info.messageId}`);
      return true;
    } catch (err) {
      console.error('❌ [EmailService] Błąd wysyłki e-maila:', err);
      return false;
    }
  }

  static async sendBetaApplicationAlert(data: {
    tenantName: string;
    contactPerson: string;
    contactEmail: string;
    contactPhone: string;
    notes?: string;
  }): Promise<boolean> {
    const subject = `🚀 Nowy wniosek pilotażowy EVA: ${data.tenantName}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
        <h2 style="color: #4f46e5; margin-top: 0;">🚀 Nowe zgłoszenie do programu pilotażowego Premium!</h2>
        <p>Właściciel firmy przesłał zgłoszenie do bezpłatnego miesięcznego pakietu pilotażowego Premium (300 darmowych minut) asystenta EVA:</p>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr>
            <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee; width: 40%;">Nazwa Firmy:</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${data.tenantName}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Osoba kontaktowa:</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${data.contactPerson || 'Nie podano'}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Telefon kontaktowy:</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><a href="tel:${data.contactPhone}">${data.contactPhone}</a></td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Adres e-mail:</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><a href="mailto:${data.contactEmail}">${data.contactEmail}</a></td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee; vertical-align: top;">Notatki / O salonie:</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${data.notes ? data.notes.replace(/\n/g, '<br/>') : 'Brak'}</td>
          </tr>
        </table>
        <p style="margin-top: 25px;">
          <a href="https://beautyvoice-bff.web.app/superadmin" 
             style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
             Otwórz panel SuperAdmina i aktywuj konto
          </a>
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 25px 0;" />
        <p style="color: #6b7280; font-size: 12px;">Wiadomość wygenerowana automatycznie przez BeautyVoice-BFF.</p>
      </div>
    `;

    return this.sendAdminAlert(subject, html);
  }
}
