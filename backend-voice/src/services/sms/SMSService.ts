import { Client } from 'zadarma-api';

export interface PhoneClassification {
  isValid: boolean;
  isMobile: boolean;
  isLandline: boolean;
  isPolish: boolean;
  formattedNumber: string;
  reason?: string;
}

export class SMSService {
  private static zadarmaKey = process.env.ZADARMA_KEY;
  private static zadarmaSecret = process.env.ZADARMA_SECRET;
  private static zadarmaPhone = process.env.ZADARMA_PHONE_NUMBER;

  /**
   * Klasyfikuje numer telefonu (komórkowy vs stacjonarny vs specjalny).
   * Obsługuje numery polskie oraz międzynarodowe w standardzie E.164.
   */
  static classifyPhoneNumber(phone: string): PhoneClassification {
    if (!phone) {
      return {
        isValid: false,
        isMobile: false,
        isLandline: false,
        isPolish: false,
        formattedNumber: '',
        reason: 'Brak numeru telefonu'
      };
    }

    // Oczyszczenie ze spacji, myślników, nawiasów i kropek
    let clean = phone.trim().replace(/[\s\-\(\)\.]/g, '');

    // Standaryzacja prefiksu międzynarodowego
    if (clean.startsWith('0048')) {
      clean = '+48' + clean.slice(4);
    } else if (clean.startsWith('48') && clean.length === 11) {
      clean = '+' + clean;
    }

    const isPolish = clean.startsWith('+48') || (!clean.startsWith('+') && clean.length === 9);

    if (isPolish) {
      const nationalNumber = clean.startsWith('+48') ? clean.slice(3) : clean;

      if (!/^\d{9}$/.test(nationalNumber)) {
        return {
          isValid: false,
          isMobile: false,
          isLandline: false,
          isPolish: true,
          formattedNumber: clean,
          reason: 'Niepoprawna długość polskiego numeru (wymagane 9 cyfr)'
        };
      }

      // Oficjalne 2-cyfrowe prefiksy sieci komórkowych w Polsce (UKE):
      // 45x, 50x, 51x, 53x, 57x, 60x, 66x, 69x, 72x, 73x, 78x, 79x, 88x
      const POLISH_MOBILE_PREFIXES = /^(45|50|51|53|57|60|66|69|72|73|78|79|88)/;

      // Polskie wskaźniki stref numeracyjnych (WSN) telefonii stacjonarnej:
      // 12-18, 22-25, 29, 32-34, 41-44, 46, 48, 52, 54-56, 58-59, 61-63, 65, 67-68, 71, 74-77, 81-87, 89, 91, 94-95
      const POLISH_LANDLINE_PREFIXES = /^(1[2-8]|2[2-59]|3[2-49]|4[1-46-8]|5[24-689]|6[1-3578]|7[14-7]|8[1-79]|9[145])/;

      const formatted = `+48${nationalNumber}`;

      if (POLISH_MOBILE_PREFIXES.test(nationalNumber)) {
        return {
          isValid: true,
          isMobile: true,
          isLandline: false,
          isPolish: true,
          formattedNumber: formatted
        };
      } else if (POLISH_LANDLINE_PREFIXES.test(nationalNumber)) {
        const area = nationalNumber.slice(0, 2);
        return {
          isValid: true,
          isMobile: false,
          isLandline: true,
          isPolish: true,
          formattedNumber: formatted,
          reason: `Wykryto polski telefon stacjonarny (strefa kierunkowa: ${area})`
        };
      } else {
        return {
          isValid: false,
          isMobile: false,
          isLandline: false,
          isPolish: true,
          formattedNumber: formatted,
          reason: `Wykryto numer specjalny / infolinię (${nationalNumber.slice(0, 2)}x)`
        };
      }
    }

    // Walidacja dla numerów międzynarodowych (format E.164: np. +49..., +380..., +1...)
    const isValidE164 = /^\+[1-9]\d{6,14}$/.test(clean);
    return {
      isValid: isValidE164,
      isMobile: isValidE164,
      isLandline: false,
      isPolish: false,
      formattedNumber: clean,
      reason: isValidE164 ? undefined : 'Niepoprawny format międzynarodowy E.164'
    };
  }

  /**
   * Sprawdza, czy na dany numer można bezpiecznie wysłać wiadomość SMS.
   */
  static isSendableMobile(phone: string): boolean {
    const classification = this.classifyPhoneNumber(phone);
    return classification.isValid && classification.isMobile;
  }

  static async sendSMS(to: string, body: string): Promise<boolean> {
    const classification = this.classifyPhoneNumber(to);

    // Zabezpieczenie przed wysyłką na telefony stacjonarne
    if (classification.isLandline) {
      console.warn(`⚠️ [SMSService] Pominięto wysyłkę SMS do ${to}: ${classification.reason}. Wiadomości SMS nie są obsługiwane przez telefony stacjonarne.`);
      return false;
    }

    // Zabezpieczenie przed nieprawidłowymi numerami
    if (!classification.isValid || !classification.isMobile) {
      console.warn(`⚠️ [SMSService] Pominięto wysyłkę SMS do ${to}: Nieprawidłowy numer komórkowy (${classification.reason || 'brak uprawnień'}).`);
      return false;
    }

    const targetNumber = classification.formattedNumber;

    if (!this.zadarmaKey || !this.zadarmaSecret || !this.zadarmaPhone) {
      console.log(`\n======================================`);
      console.log(`💬 [Mock SMS] Wiadomość przygotowana do wysyłki! (Brak kluczy Zadarma)`);
      console.log(`Do: ${targetNumber} (Oryginalnie: ${to})`);
      console.log(`Treść:\n${body}`);
      console.log(`======================================\n`);
      return true; // Symulacja udanej wysyłki
    }

    try {
      const api = new Client(this.zadarmaKey, this.zadarmaSecret);

      // API Zadarmy wymaga parametrów w postaci obiektu
      const response = await api.call('/v1/sms/send/', {
        number: targetNumber,
        message: body,
        caller_id: this.zadarmaPhone
      }, 'POST');

      // Odpowiedź zawiera status
      if (response && response.status === 'success') {
        console.log(`📨 [Zadarma SMS] Wysłano SMS do ${targetNumber}`);
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
