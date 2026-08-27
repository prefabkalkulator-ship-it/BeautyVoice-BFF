const fs = require('fs');
let code = fs.readFileSync('src/services/GeminiService.ts', 'utf8');

const searchChatArgs = `public async handleChat(message: string, history: any[] = [], tenantId: string, tenantName: string, businessProfile: string, onToolCall?: () => void, onChunk?: (text: string) => void): Promise<string> {`;
const replaceChatArgs = `public async handleChat(message: string, history: any[] = [], tenantId: string, tenantName: string, businessProfile: string, reviewLink: string | null = null, onToolCall?: () => void, onChunk?: (text: string) => void): Promise<string> {`;

code = code.replace(searchChatArgs, replaceChatArgs);
code = code.replace(
  'systemInstruction: getSystemPrompt(tenantName, businessProfile, (tenant as any).reviewLink),',
  'systemInstruction: getSystemPrompt(tenantName, businessProfile, reviewLink),'
);

fs.writeFileSync('src/services/GeminiService.ts', code, 'utf8');
