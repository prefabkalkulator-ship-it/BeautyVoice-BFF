export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
  reason?: string;
}

export class RateLimiterService {
  // Limity dla wysyłki wiadomości SMS (np. OTP / reset PIN / wniosek)
  private static readonly SMS_COOLDOWN_MS = 60 * 1000; // 60 sekund między kolejnymi SMS na ten sam numer
  private static readonly SMS_WINDOW_MS = 15 * 60 * 1000; // 15 minut
  private static readonly SMS_MAX_PER_PHONE = 3; // Max 3 SMS na numer w oknie 15 minut
  private static readonly SMS_MAX_PER_IP = 10; // Max 10 żądań SMS z jednego IP w oknie 15 minut

  // Przechowywanie timestampów w pamięci
  private static phoneTimestamps = new Map<string, number[]>();
  private static ipTimestamps = new Map<string, number[]>();

  /**
   * Sprawdza czy żądanie wysyłki SMS może zostać zrealizowane.
   */
  static checkSmsLimit(phone: string, ip?: string): RateLimitResult {
    const now = Date.now();
    this.cleanupOldEntries(now);

    const cleanPhone = phone.trim().replace(/[\s\-\(\)]/g, '');

    // 1. Sprawdzenie cooldownu per telefon (minimum 60s)
    const phoneHistory = this.phoneTimestamps.get(cleanPhone) || [];
    if (phoneHistory.length > 0) {
      const lastSent = phoneHistory[phoneHistory.length - 1];
      const elapsed = now - lastSent;
      if (elapsed < this.SMS_COOLDOWN_MS) {
        const waitSec = Math.ceil((this.SMS_COOLDOWN_MS - elapsed) / 1000);
        return {
          allowed: false,
          retryAfterSeconds: waitSec,
          reason: `Zbyt częste próby. Odczekaj ${waitSec} s przed wysłaniem kolejnego kodu SMS.`
        };
      }
    }

    // 2. Sprawdzenie limitu ilościowego per telefon w oknie 15 min (max 3)
    const recentPhoneAttempts = phoneHistory.filter(ts => now - ts < this.SMS_WINDOW_MS);
    if (recentPhoneAttempts.length >= this.SMS_MAX_PER_PHONE) {
      const oldestInWindow = recentPhoneAttempts[0];
      const waitSec = Math.ceil((this.SMS_WINDOW_MS - (now - oldestInWindow)) / 1000);
      return {
        allowed: false,
        retryAfterSeconds: waitSec,
        reason: `Wykorzystano limit kodów SMS (maks. ${this.SMS_MAX_PER_PHONE} na 15 min). Spróbuj ponownie za ${Math.ceil(waitSec / 60)} min.`
      };
    }

    // 3. Sprawdzenie limitu per IP w oknie 15 min (max 10)
    if (ip) {
      const cleanIp = ip.trim();
      const ipHistory = this.ipTimestamps.get(cleanIp) || [];
      const recentIpAttempts = ipHistory.filter(ts => now - ts < this.SMS_WINDOW_MS);
      if (recentIpAttempts.length >= this.SMS_MAX_PER_IP) {
        const oldestInWindow = recentIpAttempts[0];
        const waitSec = Math.ceil((this.SMS_WINDOW_MS - (now - oldestInWindow)) / 1000);
        return {
          allowed: false,
          retryAfterSeconds: waitSec,
          reason: `Zbyt wiele żądań z Twojego adresu IP. Spróbuj ponownie za ${Math.ceil(waitSec / 60)} min.`
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Zapisuje fakt wysłania wiadomości SMS do historii rate limitera.
   */
  static recordSmsSent(phone: string, ip?: string): void {
    const now = Date.now();
    const cleanPhone = phone.trim().replace(/[\s\-\(\)]/g, '');

    const phoneHistory = this.phoneTimestamps.get(cleanPhone) || [];
    phoneHistory.push(now);
    this.phoneTimestamps.set(cleanPhone, phoneHistory);

    if (ip) {
      const cleanIp = ip.trim();
      const ipHistory = this.ipTimestamps.get(cleanIp) || [];
      ipHistory.push(now);
      this.ipTimestamps.set(cleanIp, ipHistory);
    }
  }

  /**
   * Usuwa wpisy starsze niż okno czasowe (15 minut).
   */
  private static cleanupOldEntries(now: number): void {
    for (const [phone, history] of this.phoneTimestamps.entries()) {
      const fresh = history.filter(ts => now - ts < this.SMS_WINDOW_MS);
      if (fresh.length === 0) {
        this.phoneTimestamps.delete(phone);
      } else {
        this.phoneTimestamps.set(phone, fresh);
      }
    }

    for (const [ip, history] of this.ipTimestamps.entries()) {
      const fresh = history.filter(ts => now - ts < this.SMS_WINDOW_MS);
      if (fresh.length === 0) {
        this.ipTimestamps.delete(ip);
      } else {
        this.ipTimestamps.set(ip, fresh);
      }
    }
  }

  /**
   * Czyści całą pamięć (na potrzeby testów jednostkowych).
   */
  static resetForTesting(): void {
    this.phoneTimestamps.clear();
    this.ipTimestamps.clear();
  }
}
