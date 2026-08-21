import alawmulaw from 'alawmulaw';
import wavefile from 'wavefile';

const { mulaw } = alawmulaw;
const { WaveFile } = wavefile;

export class AudioPipeline {
  static decodeTwilioMulawTo16kHz(payloadBase64: string): Float32Array {
    const mulawBuffer = Buffer.from(payloadBase64, 'base64');
    const pcmInt16 = mulaw.decode(mulawBuffer);
    
    const wavIn = new WaveFile();
    wavIn.fromScratch(1, 8000, '16', pcmInt16);
    wavIn.toSampleRate(16000);
    const pcm16kHzFloat = wavIn.getSamples(false) as Float64Array;
    
    const float32Array = new Float32Array(pcm16kHzFloat.length);
    for (let i = 0; i < pcm16kHzFloat.length; i++) {
      float32Array[i] = pcm16kHzFloat[i] / 32768.0; 
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
