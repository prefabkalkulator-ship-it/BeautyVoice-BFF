export interface ServiceItem {
    name: string;
    price: string;
    durationMinutes: number;
}
export declare class BookingService {
    /**
     * Schematy narzędzi (Function Calling) dla Gemini
     */
    static getToolDefinitions(): ({
        name: string;
        description: string;
        parameters: {
            type: string;
            properties: {
                date?: never;
                customerName?: never;
                customerPhone?: never;
                serviceName?: never;
                startTime?: never;
                durationMinutes?: never;
            };
            required?: never;
        };
    } | {
        name: string;
        description: string;
        parameters: {
            type: string;
            properties: {
                date: {
                    type: string;
                    description: string;
                };
                durationMinutes: {
                    type: string;
                    description: string;
                };
                customerName?: never;
                customerPhone?: never;
                serviceName?: never;
                startTime?: never;
            };
            required: string[];
        };
    } | {
        name: string;
        description: string;
        parameters: {
            type: string;
            properties: {
                date?: never;
                customerName: {
                    type: string;
                    description: string;
                };
                customerPhone: {
                    type: string;
                    description: string;
                };
                serviceName: {
                    type: string;
                    description: string;
                };
                startTime: {
                    type: string;
                    description: string;
                };
                durationMinutes: {
                    type: string;
                    description: string;
                };
            };
            required: string[];
        };
    })[];
    /**
     * 1. Pobiera usługi i ceny z zakładki 'Cennik'
     */
    getServicesAndPrices(): Promise<ServiceItem[]>;
    /**
     * 2. Sprawdza wolne terminy w Kalendarzu Google
     */
    checkAvailability(date: string, durationMinutes: number): Promise<string[]>;
    /**
     * Pobiera sekcję FAQ z Arkusza
     */
    getFAQ(): Promise<{
        question: string;
        answer: string;
    }[]>;
    /**
     * 3. Rezerwuje wizytę: dodaje do Kalendarza i dopisuje do Arkusza (CRM)
     */
    bookAppointment(customerName: string, customerPhone: string, serviceName: string, startTime: string, durationMinutes: number): Promise<boolean>;
}
export declare const bookingService: BookingService;
//# sourceMappingURL=BookingService.d.ts.map