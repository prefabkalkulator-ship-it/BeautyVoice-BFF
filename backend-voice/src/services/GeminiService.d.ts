export declare class GeminiService {
    /**
     * Funkcja pomocnicza do wysyłania wiadomości z mechanizmem retry dla błędów 503 (High Demand)
     */
    private sendMessageWithRetry;
    /**
     * Obsługuje pojedynczą turę konwersacji w webhooku
     * Przekazujemy historię konwersacji (z bazy danych / frontendu) i bieżącą wiadomość.
     */
    handleChat(message: string, history?: any[]): Promise<string>;
}
export declare const geminiService: GeminiService;
//# sourceMappingURL=GeminiService.d.ts.map