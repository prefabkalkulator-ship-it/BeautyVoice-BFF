import { GoogleGenAI } from '@google/genai';
import { prisma } from '../../prisma';
import { bookingService } from '../BookingService';
import { getSystemPrompt } from '../../prompts/systemPrompt';
import { AI_MODELS } from '../../config/aiModels';

const GRAPH_API_BASE = 'https://graph.instagram.com/v21.0';

const KEYWORD_TRIGGERS = ['SPOKÓJ', 'SPOKOJ', 'TEST', 'DEMO', 'AUDYT', 'EWA', 'CENA', 'OFERTA'];
const OWN_USERNAMES = new Set(['asystent.ewa', 'asystent_ewa', 'automatyzuj_biznes']);

export interface InstagramComment {
  id: string;
  text: string;
  username?: string;
  timestamp?: string;
  from?: { id?: string; username?: string };
  replies?: {
    data: Array<{
      id: string;
      text: string;
      username?: string;
      timestamp?: string;
      from?: { id?: string; username?: string };
    }>;
  };
}

export interface InstagramMediaItem {
  id: string;
  caption?: string;
  media_type?: string;
  permalink?: string;
  timestamp?: string;
  like_count?: number;
  comments_count?: number;
  comments?: {
    data: InstagramComment[];
  };
}

export class InstagramService {
  private processedCommentIds = new Set<string>();
  private processedMessageIds = new Set<string>();

  private get accessToken(): string {
    return (process.env.INSTAGRAM_ACCESS_TOKEN || '').trim();
  }

  private get accountId(): string {
    return (process.env.INSTAGRAM_ACCOUNT_ID || '17841415748267058').trim();
  }

  public get verifyToken(): string {
    return (process.env.INSTAGRAM_VERIFY_TOKEN || 'ewa_ig_verify_2026').trim();
  }

  private isOwnUser(username?: string, senderId?: string): boolean {
    if (senderId && (senderId === this.accountId || senderId === '28837910892483888')) return true;
    if (!username) return false;
    return OWN_USERNAMES.has(username.toLowerCase().trim());
  }

  /**
   * Pomocnicze wywołanie Instagram Graph API
   */
  private async graphRequest<T = any>(
    endpoint: string,
    options: { method?: 'GET' | 'POST'; params?: Record<string, string>; body?: any } = {}
  ): Promise<T> {
    if (!this.accessToken) {
      throw new Error('Brak skonfigurowanego INSTAGRAM_ACCESS_TOKEN w zmiennych środowiskowych.');
    }

    const method = options.method || 'GET';
    const url = new URL(`${GRAPH_API_BASE}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`);
    url.searchParams.set('access_token', this.accessToken);

    if (options.params) {
      for (const [k, v] of Object.entries(options.params)) {
        url.searchParams.set(k, v);
      }
    }

    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (options.body && method === 'POST') {
      fetchOptions.body = JSON.stringify(options.body);
    }

    const res = await fetch(url.toString(), fetchOptions);
    const data = await res.json();

    if (!res.ok || (data as any)?.error) {
      const errMsg = (data as any)?.error?.message || `HTTP ${res.status}`;
      throw new Error(`Instagram Graph API Error (${endpoint}): ${errMsg}`);
    }

    return data as T;
  }

  /**
   * Znajduje tenanta DEMO w bazie danych, aby podpiąć dynamiczną bazę FAQ (getFAQ)
   */
  private async getDemoTenantId(): Promise<string | null> {
    try {
      const demo = await prisma.tenant.findFirst({
        where: {
          OR: [
            { name: 'DEMO' },
            { name: { contains: 'DEMO', mode: 'insensitive' } },
            { businessProfile: 'demo' },
          ],
        },
        select: { id: true },
      });
      return demo?.id || null;
    } catch (err) {
      console.error('[InstagramService] Błąd pobierania tenanta DEMO:', err);
      return null;
    }
  }

  /**
   * Generuje odpowiedź Asystenta Ewa na podstawie pełnej bazy wiedzy EVA DEMO (systemPrompt.ts + getFAQ z PostgreSQL)
   */
  public async generateEvaReply(
    userMessage: string,
    options: {
      mode: 'dm' | 'comment';
      postCaption?: string;
      authorUsername?: string;
      history?: Array<{ role: 'user' | 'assistant'; content: string }>;
    }
  ): Promise<string> {
    const demoTenantId = await this.getDemoTenantId();

    const formattedHistory = (options.history || []).map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));

    const faqToolDeclaration = {
      name: 'getFAQ',
      description:
        'Pobiera dynamiczną bazę wiedzy i najczęściej zadawane pytania (FAQ) dla asystenta EVA DEMO z bazy danych.',
      parameters: { type: 'OBJECT', properties: {} },
    };

    const systemInstruction = getSystemPrompt({
      tenantName: 'DEMO',
      businessProfile: 'demo',
      isTextChat: true,
      instagramMode: options.mode,
    });

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || 'dummy-key' });
    const chat = ai.chats.create({
      model: AI_MODELS.TEXT_FLASH,
      history: formattedHistory,
      config: {
        systemInstruction,
        temperature: 0.25,
        tools: demoTenantId ? [{ functionDeclarations: [faqToolDeclaration as any] }] : undefined,
      },
    });

    let contextualPrompt = '';
    if (options.mode === 'comment') {
      contextualPrompt = `[KONTEKST PUBLIKACJI NA INSTAGRAMIE @asystent.ewa]
Treść posta/rolki, pod którą pojawił się komentarz:
"""
${(options.postCaption || 'Post o asystencie głosowym AI Ewa (EVA)').slice(0, 1000)}
"""
Autor komentarza: ${options.authorUsername ? '@' + options.authorUsername : 'Użytkownik Instagrama'}
Treść komentarza: "${userMessage}"

Napisz zwięzłą, konkretną i naturalną odpowiedź publiczną pod tym komentarzem (2-4 zdania), odpowiadając wprost na pytanie/obiekcję na podstawie Bazy Wiedzy EVA DEMO i zachęcając na końcu do zadzwonienia na linię testową +48 34 343 30 88 lub sprawdzenia linku w bio (asystent-ewa.web.app).`;
    } else {
      contextualPrompt = `[WIADOMOŚĆ PRYWATNA DM NA INSTAGRAMIE @asystent.ewa]
Nadawca: ${options.authorUsername ? '@' + options.authorUsername : 'Użytkownik Instagrama'}
Wiadomość: "${userMessage}"

Napisz konkretną, naturalną odpowiedź na podstawie Bazy Wiedzy EVA DEMO (maksymalnie 600-800 znaków, ponieważ pojedyncza wiadomość DM na Instagramie ma twardy limit 1000 znaków; nie używaj gwiazdek Markdown **).`;
    }

    let messagePayload: any = { message: contextualPrompt };
    let fullText = '';

    for (let iteration = 0; iteration < 3; iteration++) {
      const response = await chat.sendMessage(messagePayload);
      const functionCalls = (response as any).functionCalls;

      if (functionCalls && functionCalls.length > 0 && demoTenantId) {
        const call = functionCalls[0];
        if (call.name === 'getFAQ') {
          const faqData = await bookingService.getFAQ(demoTenantId);
          messagePayload = {
            message: [
              {
                functionResponse: {
                  name: 'getFAQ',
                  response: { result: faqData },
                },
              },
            ],
          };
          continue;
        }
      }

      if (response.text) {
        fullText += response.text;
      }
      break;
    }

    let cleanReply = fullText
      .replace(/^(?:(?:Hmm|Hmmm|Hm|Mhm|Momencik|Sekundka|Chwileczkę)[,.\!?\s]*)+/gi, '')
      .replace(/\*\*/g, '')
      .trim();

    return cleanReply || 'Dzięki za wiadomość! Chętnie opowiem jak działa Ewa – możesz też od razu przetestować ją głosowo pod numerem +48 34 343 30 88 lub na https://asystent-ewa.web.app 🤖';
  }

  /**
   * Pobiera informacje o podpiętym profilu Instagram (@asystent.ewa)
   */
  public async getProfile() {
    return this.graphRequest('/me', {
      params: {
        fields: 'id,username,name,account_type,media_count,followers_count,follows_count,biography,website',
      },
    });
  }

  /**
   * Pobiera komentarze i ich odpowiedzi dla konkretnego posta/rolki
   */
  public async getMediaComments(mediaId: string): Promise<InstagramComment[]> {
    const res = await this.graphRequest<{ data: InstagramComment[] }>(`/${mediaId}/comments`, {
      params: {
        limit: '30',
        fields: 'id,text,username,timestamp,from,replies{id,text,username,timestamp,from}',
      },
    });
    return res.data || [];
  }

  /**
   * Pobiera ostatnie posty i rolki wraz z komentarzami i ich odpowiedziami
   */
  public async getRecentMedia(limit = 15): Promise<InstagramMediaItem[]> {
    const res = await this.graphRequest<{ data: InstagramMediaItem[] }>('/me/media', {
      params: {
        limit: String(limit),
        fields: 'id,caption,media_type,permalink,timestamp,like_count,comments_count',
      },
    });
    const mediaList = res.data || [];

    for (const media of mediaList) {
      if ((media.comments_count || 0) > 0 && !media.comments?.data) {
        try {
          const comments = await this.getMediaComments(media.id);
          media.comments = { data: comments };
        } catch (err: any) {
          console.warn(`[InstagramService] Nie udało się pobrać komentarzy dla ${media.id}:`, err.message);
        }
      }
    }

    return mediaList;
  }

  /**
   * Publikuje odpowiedź publiczną pod komentarzem na Instagramie
   */
  public async replyToComment(commentId: string, message: string) {
    return this.graphRequest(`/${commentId}/replies`, {
      method: 'POST',
      body: { message },
    });
  }

  /**
   * Wysyła wiadomość prywatną (Private Reply DM) do autora komentarza (w ciągu 7 dni od komentarza)
   */
  public async sendPrivateReplyToComment(commentId: string, text: string) {
    return this.graphRequest('/me/messages', {
      method: 'POST',
      body: {
        recipient: { comment_id: commentId },
        message: { text },
      },
    });
  }

  /**
   * Wysyła wiadomość prywatną DM do użytkownika po jego IGSID
   */
  public async sendDirectMessage(recipientIgsid: string, text: string) {
    return this.graphRequest('/me/messages', {
      method: 'POST',
      body: {
        recipient: { id: recipientIgsid },
        message: { text },
      },
    });
  }

  /**
   * Pobiera aktywne wątki wiadomości prywatnych (DM)
   */
  public async getConversations(limit = 10) {
    const res = await this.graphRequest<{ data: any[] }>('/me/conversations', {
      params: {
        platform: 'instagram',
        limit: String(limit),
        fields: 'id,updated_time,participants,messages.limit(10){id,message,from,to,created_time}',
      },
    });
    return res.data || [];
  }

  /**
   * Sprawdza, czy komentarz zawiera słowo-klucz wyzwalające wysyłkę DM (np. SPOKÓJ, TEST, AUDYT)
   */
  private detectTriggerKeyword(text: string): string | null {
    const upper = (text || '').toUpperCase();
    for (const kw of KEYWORD_TRIGGERS) {
      if (upper.includes(kw)) return kw;
    }
    return null;
  }

  /**
   * Skanuje posty pod kątem nieodpowiedzianych komentarzy (oraz opcjonalnie wiadomości DM)
   * i odpowiada na nie automatycznie przy użyciu Bazy Wiedzy EVA DEMO.
   */
  public async syncAndRespond(options: {
    dryRun?: boolean;
    maxCommentReplies?: number;
    processDms?: boolean;
  } = {}) {
    const dryRun = Boolean(options.dryRun);
    const maxCommentReplies = options.maxCommentReplies ?? 5;
    const processDms = options.processDms ?? true;

    const mediaList = await this.getRecentMedia(15);
    const actions: Array<{
      type: 'comment_reply' | 'private_reply_dm' | 'dm_reply';
      mediaId?: string;
      permalink?: string;
      commentId?: string;
      author?: string;
      originalText: string;
      generatedReply: string;
      sent: boolean;
      replyId?: string;
      error?: string;
    }> = [];

    let repliesCount = 0;

    for (const media of mediaList) {
      const comments = media.comments?.data || [];
      for (const comment of comments) {
        if (repliesCount >= maxCommentReplies) break;
        if (this.processedCommentIds.has(comment.id)) continue;

        const authorUsername = comment.username || comment.from?.username || '';
        const authorId = comment.from?.id || '';

        // Ignoruj własne komentarze (@asystent.ewa)
        if (this.isOwnUser(authorUsername, authorId) && authorUsername.toLowerCase() !== 'bystranabudowie') {
          continue;
        }

        // Sprawdź, czy pod komentarzem jest już odpowiedź od @asystent.ewa lub @automatyzuj_biznes
        const existingReplies = comment.replies?.data || [];
        const alreadyAnswered = existingReplies.some((r) =>
          this.isOwnUser(r.username || r.from?.username, r.from?.id)
        );

        if (alreadyAnswered) {
          this.processedCommentIds.add(comment.id);
          continue;
        }

        // Generujemy odpowiedź na podstawie EVA DEMO + kontekstu danego posta
        const generatedReply = await this.generateEvaReply(comment.text, {
          mode: 'comment',
          postCaption: media.caption,
          authorUsername,
        });

        if (!dryRun) {
          try {
            const replyRes = await this.replyToComment(comment.id, generatedReply);
            this.processedCommentIds.add(comment.id);
            repliesCount++;

            actions.push({
              type: 'comment_reply',
              mediaId: media.id,
              permalink: media.permalink,
              commentId: comment.id,
              author: authorUsername,
              originalText: comment.text,
              generatedReply,
              sent: true,
              replyId: replyRes?.id,
            });

            // Jeśli komentarz zawierał słowo-klucz (np. SPOKÓJ, TEST, AUDYT), wyślij również Private Reply DM
            const triggerKw = this.detectTriggerKeyword(comment.text);
            if (triggerKw && authorUsername.toLowerCase() !== 'bystranabudowie') {
              const dmText = await this.generateEvaReply(
                `Skomentowałem/am słowo "${triggerKw}" pod postem: "${(media.caption || '').slice(0, 200)}". Poproszę o szczegóły i link do przetestowania Ewy.`,
                {
                  mode: 'dm',
                  authorUsername,
                }
              );
              try {
                const dmRes = await this.sendPrivateReplyToComment(comment.id, dmText);
                actions.push({
                  type: 'private_reply_dm',
                  mediaId: media.id,
                  commentId: comment.id,
                  author: authorUsername,
                  originalText: comment.text,
                  generatedReply: dmText,
                  sent: true,
                  replyId: dmRes?.message_id,
                });
              } catch (dmErr: any) {
                actions.push({
                  type: 'private_reply_dm',
                  mediaId: media.id,
                  commentId: comment.id,
                  author: authorUsername,
                  originalText: comment.text,
                  generatedReply: dmText,
                  sent: false,
                  error: dmErr.message,
                });
              }
            }
          } catch (err: any) {
            actions.push({
              type: 'comment_reply',
              mediaId: media.id,
              permalink: media.permalink,
              commentId: comment.id,
              author: authorUsername,
              originalText: comment.text,
              generatedReply,
              sent: false,
              error: err.message,
            });
          }
        } else {
          repliesCount++;
          actions.push({
            type: 'comment_reply',
            mediaId: media.id,
            permalink: media.permalink,
            commentId: comment.id,
            author: authorUsername,
            originalText: comment.text,
            generatedReply,
            sent: false,
          });
        }
      }
    }

    // Opcjonalna synchronizacja wiadomości DM
    if (processDms) {
      try {
        const conversations = await this.getConversations(10);
        for (const conv of conversations) {
          const messages = conv.messages?.data || [];
          if (messages.length === 0) continue;

          const latestMsg = messages[0]; // Najnowsza wiadomość jest pierwsza
          if (!latestMsg?.id || !latestMsg?.message) continue;
          if (this.processedMessageIds.has(latestMsg.id)) continue;

          const senderUsername = latestMsg.from?.username || '';
          const senderId = latestMsg.from?.id || '';

          // Jeśli ostatnia wiadomość w wątku należy do nas (@asystent.ewa), nic nie robimy
          if (this.isOwnUser(senderUsername, senderId)) {
            this.processedMessageIds.add(latestMsg.id);
            continue;
          }

          // Budujemy krótką historię z ostatnich wiadomości w wątku (w kolejności chronologicznej)
          const chronological = [...messages].reverse().slice(0, -1);
          const history: Array<{ role: 'user' | 'assistant'; content: string }> = chronological
            .filter((m) => m.message)
            .map((m) => ({
              role: this.isOwnUser(m.from?.username, m.from?.id) ? 'assistant' : 'user',
              content: m.message,
            }));

          const dmReply = await this.generateEvaReply(latestMsg.message, {
            mode: 'dm',
            authorUsername: senderUsername,
            history,
          });

          if (!dryRun && senderId) {
            const sentDm = await this.sendDirectMessage(senderId, dmReply);
            this.processedMessageIds.add(latestMsg.id);
            actions.push({
              type: 'dm_reply',
              author: senderUsername || senderId,
              originalText: latestMsg.message,
              generatedReply: dmReply,
              sent: true,
              replyId: sentDm?.message_id,
            });
          } else {
            actions.push({
              type: 'dm_reply',
              author: senderUsername || senderId,
              originalText: latestMsg.message,
              generatedReply: dmReply,
              sent: false,
            });
          }
        }
      } catch (dmSyncErr: any) {
        console.warn('[InstagramService] Pominięto synchronizację wątków DM:', dmSyncErr.message);
      }
    }

    return {
      dryRun,
      checkedMediaCount: mediaList.length,
      actionsCount: actions.length,
      actions,
    };
  }

  /**
   * Obsługuje zdarzenia przychodzące w czasie rzeczywistym z Webhooka Mety (POST /api/instagram/webhook)
   */
  public async handleWebhookPayload(body: any) {
    if (!body || body.object !== 'instagram' || !Array.isArray(body.entry)) {
      return { handled: false };
    }

    const results: any[] = [];

    for (const entry of body.entry) {
      // 1. Obsługa wiadomości prywatnych (messaging)
      if (Array.isArray(entry.messaging)) {
        for (const event of entry.messaging) {
          const senderId = event.sender?.id;
          const messageId = event.message?.mid;
          const messageText = event.message?.text;
          const isEcho = Boolean(event.message?.is_echo);

          if (!senderId || !messageText || isEcho || senderId === this.accountId) {
            continue;
          }
          if (messageId && this.processedMessageIds.has(messageId)) {
            continue;
          }
          if (messageId) {
            this.processedMessageIds.add(messageId);
          }

          const replyText = await this.generateEvaReply(messageText, {
            mode: 'dm',
          });
          const sent = await this.sendDirectMessage(senderId, replyText);
          results.push({ type: 'webhook_dm', senderId, replyText, messageId: sent?.message_id });
        }
      }

      // 2. Obsługa komentarzy pod postami/rolkami (changes -> field === 'comments')
      if (Array.isArray(entry.changes)) {
        for (const change of entry.changes) {
          if (change.field === 'comments' && change.value) {
            const commentId = change.value.id;
            const text = change.value.text;
            const fromUser = change.value.from?.username || '';
            const fromId = change.value.from?.id || '';
            const parentId = change.value.parent_id;

            // Nie odpowiadaj na własne komentarze ani gdy już przetworzono
            if (!commentId || !text || this.isOwnUser(fromUser, fromId)) {
              continue;
            }
            // Jeśli to nasza własna odpowiedź w wątku komentarza
            if (parentId && this.processedCommentIds.has(parentId)) {
              continue;
            }
            if (this.processedCommentIds.has(commentId)) {
              continue;
            }
            this.processedCommentIds.add(commentId);

            const replyText = await this.generateEvaReply(text, {
              mode: 'comment',
              authorUsername: fromUser,
            });
            const replyRes = await this.replyToComment(commentId, replyText);
            results.push({ type: 'webhook_comment_reply', commentId, replyText, replyId: replyRes?.id });

            const triggerKw = this.detectTriggerKeyword(text);
            if (triggerKw && fromUser.toLowerCase() !== 'bystranabudowie') {
              const dmText = await this.generateEvaReply(
                `Skomentowałem/am słowo "${triggerKw}" pod postem na Instagramie. Poproszę o szczegóły i link do przetestowania Ewy.`,
                { mode: 'dm', authorUsername: fromUser }
              );
              try {
                await this.sendPrivateReplyToComment(commentId, dmText);
              } catch (e: any) {
                console.warn('[InstagramService] Błąd wysyłki Private Reply DM z webhooka:', e.message);
              }
            }
          }
        }
      }
    }

    return { handled: true, results };
  }
}

export const instagramService = new InstagramService();
