import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { mulaw } = require('alawmulaw');
const { WaveFile } = require('wavefile');

export class AudioPipeline {
  // Docelowy poziom RMS dla wyraźnej mowy telefonicznej (~ -20 dBFS)
  private static readonly TARGET_RMS = 0.10;
  // Próg bramki szumów (poniżej tego poziomu to szum kwantyzacji μ-law / cisza w linii GSM)
  private static readonly NOISE_GATE_RMS = 0.004;
  // Maksymalne wzmocnienie dla bardzo cichych rozmówców (~ +11.6 dB)
  private static readonly MAX_AGC_GAIN = 3.8;

  static decodeTwilioMulawTo16kHz(payloadBase64: string): Float32Array {
    const mulawBuffer = Buffer.from(payloadBase64, 'base64');
    const pcmInt16 = mulaw.decode(mulawBuffer);
    
    const wavIn = new WaveFile();
    wavIn.fromScratch(1, 8000, '16', pcmInt16);
    wavIn.toSampleRate(16000);
    const pcm16kHzFloat = wavIn.getSamples(false) as Float64Array;
    
    const len = pcm16kHzFloat.length;
    const float32Array = new Float32Array(len);
    if (len === 0) return float32Array;

    let sumSquares = 0;
    for (let i = 0; i < len; i++) {
      const normalized = pcm16kHzFloat[i] / 32768.0;
      float32Array[i] = normalized;
      sumSquares += normalized * normalized;
    }

    // Adaptive Software AGC + Noise Gate dla cicho mówiących rozmówców
    const rms = Math.sqrt(sumSquares / len);
    if (rms > AudioPipeline.NOISE_GATE_RMS && rms < AudioPipeline.TARGET_RMS) {
      const rawGain = Math.min(AudioPipeline.MAX_AGC_GAIN, AudioPipeline.TARGET_RMS / rms);
      // Płynne otwarcie bramki (soft knee) w przedziale RMS 0.004 - 0.009, aby uniknąć pompowania szumu tła
      const gateRamp = Math.min(1.0, (rms - AudioPipeline.NOISE_GATE_RMS) / 0.005);
      const effectiveGain = 1.0 + (rawGain - 1.0) * gateRamp;

      if (effectiveGain > 1.05) {
        for (let i = 0; i < len; i++) {
          // Miękki limiter (tanh) chroniący przed przesterowaniem (clippingiem) głośniejszych spółgłosek
          float32Array[i] = Math.tanh(float32Array[i] * effectiveGain);
        }
      }
    }

    return float32Array;
  }

  static float32ToPcm16Base64(float32Array: Float32Array): string {
    const pcm16kHz = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      pcm16kHz[i] = float32Array[i] * 32768.0;
    }
    return Buffer.from(pcm16kHz.buffer).toString('base64');
  }

  static encodeGemini24kHzToTwilioMulaw(audioBase64: string): Uint8Array {
    const pcm24Buffer = Buffer.from(audioBase64, 'base64');
    const pcm24Int16 = new Int16Array(pcm24Buffer.buffer, pcm24Buffer.byteOffset, pcm24Buffer.byteLength / 2);

    const wavOut = new WaveFile();
    wavOut.fromScratch(1, 24000, '16', pcm24Int16);
    wavOut.toSampleRate(8000);
    
    const pcm8kHzFloat = wavOut.getSamples(false) as Float64Array;
    const pcm8kHz = Int16Array.from(pcm8kHzFloat);

    return mulaw.encode(pcm8kHz);
  }
}
