import { Request, Response } from 'express';
export declare class WebhookController {
    handleIncomingChat(req: Request, res: Response): Promise<void>;
    /**
     * Endpoint kompatybilny z formatem OpenAI (dla Vapi.ai Custom LLM)
     */
    handleVapiCustomLLM(req: Request, res: Response): Promise<void>;
}
export declare const webhookController: WebhookController;
//# sourceMappingURL=WebhookController.d.ts.map