import * as ort from 'onnxruntime-node';
import path from 'path';

export class VADService {
  private static vadSession: ort.InferenceSession | null = null;
  private vadState: ort.Tensor;
  private pcmBuffer: number[] = [];

  constructor() {
    this.vadState = new ort.Tensor('float32', new Float32Array(2 * 1 * 128), [2, 1, 128]);
  }

  static async init() {
    if (!VADService.vadSession) {
      const modelPath = path.join(process.cwd(), 'src', 'services', 'voice', 'silero_vad.onnx');
      VADService.vadSession = await ort.InferenceSession.create(modelPath);
      console.log('✅ [VAD] Silero VAD ONNX model loaded successfully.');
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

        if (speechProb > 0.85) {
          onSpeechDetected(speechProb);
        }
      } catch (err) {}
    }
  }
}
