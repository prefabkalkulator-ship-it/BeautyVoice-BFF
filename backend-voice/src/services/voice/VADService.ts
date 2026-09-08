import * as ort from 'onnxruntime-node';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class VADService {
  private static vadSession: ort.InferenceSession | null = null;
  private vadState: ort.Tensor;
  private pcmBuffer: number[] = [];
  private consecutiveSpeechFrames: number = 0;

  constructor() {
    this.vadState = new ort.Tensor('float32', new Float32Array(2 * 1 * 128), [2, 1, 128]);
  }

  static async init() {
    if (!VADService.vadSession) {
      const candidates = [
        path.join(__dirname, 'silero_vad.onnx'),
        path.join(__dirname, '..', '..', '..', 'src', 'services', 'voice', 'silero_vad.onnx'),
        path.join(process.cwd(), 'src', 'services', 'voice', 'silero_vad.onnx'),
        path.join(process.cwd(), 'backend-voice', 'src', 'services', 'voice', 'silero_vad.onnx'),
      ];
      const modelPath = candidates.find(p => fs.existsSync(p));
      if (!modelPath) {
        throw new Error(`Silero VAD ONNX model not found in candidate paths: ${candidates.join(', ')}`);
      }
      VADService.vadSession = await ort.InferenceSession.create(modelPath);
      console.log(`✅ [VAD] Silero VAD ONNX model loaded successfully from: ${modelPath}`);
    }
  }

  async processAudio(float32Data: Float32Array, onSpeechDetected: (prob: number) => void) {
    for (let i = 0; i < float32Data.length; i++) {
      this.pcmBuffer.push(float32Data[i]); 
    }

    while (this.pcmBuffer.length >= 512 && VADService.vadSession) {
      const chunk = this.pcmBuffer.splice(0, 512);
      const inputTensor = new ort.Tensor('float32', new Float32Array(chunk), [1, 512]);
      const srTensor = new ort.Tensor('int64', new BigInt64Array([16000n]), [1]);
      
      try {
        const results = await VADService.vadSession.run({ input: inputTensor, state: this.vadState, sr: srTensor });
        this.vadState = results.stateN; 
        const speechProb = results.output.data[0] as number;

        if (speechProb > 0.80) {
          this.consecutiveSpeechFrames++;
          // Wymagamy co najmniej 2 kolejnych klatek mowy (~64ms), aby odfiltrować pojedyncze trzaski GSM
          if (this.consecutiveSpeechFrames >= 2) {
            onSpeechDetected(speechProb);
          }
        } else if (speechProb < 0.35) {
          this.consecutiveSpeechFrames = 0;
        }
      } catch (err) {}
    }
  }
}
