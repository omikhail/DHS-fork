import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { Opcode } from './opcodes.js';
import { Transport } from './transport.js';
import {
  DEFAULT_USER_AGENT,
  commitPasswordChange,
  completeQrPasswordLogin,
  getPasswordInfo,
  hello,
  loginViaQr,
  loginWithToken,
  logout as logoutOp,
  sendEmailCode,
  setPasswordHint,
  startAuthTrack,
  validatePassword,
  verifyEmailCode,
  verifyPassword,
} from './auth.js';
import { RawTransport } from './raw-transport.js';
import { qrBindWebSession } from './qr-bind.js';
import { sendPhoneAuthCode, verifyPhoneAuthCode } from './auth.js';
import { FileSessionStore, MemorySessionStore, type SessionStore, type StoredSession } from './storage.js';
import type {
  AuthEmailSendCodeResponse,
  AuthPasswordInfoResponse,
  CallHistoryEntry,
  CallHistoryRequest,
  CallHistoryResponse,
  ChatClearRequest,
  ChatResolveLinkRequest,
  ChatResolveLinkResponse,
  ChatsSyncRequest,
  ChatsSyncResponse,
  LinkPreviewRequest,
  LinkPreviewResponse,
  MemberLeavePush,
  PasswordChallenge,
  PresencePush,
  ProfileUpdatePush,
  VideoUploadInfo,
  VideoUploadUrlRequest,
  VideoUploadUrlResponse,
  WebTokenResponse,
  ActiveSession,
  AttachFilterType,
  BotMiniAppOpenRequest,
  BotMiniAppOpenResponse,
  CallCallerParams,
  CallStartRequest,
  CallStartResponse,
  ChatFolder,
  ChatLeaveRequest,
  ChatLeaveResponse,
  ChatReactionsSettings,
  ChatReactionsSettingsGetRequest,
  ChatReactionsSettingsGetResponse,
  ChatReactionsSettingsRequest,
  ChatReactionsSettingsResponse,
  ChatSettingsOptions,
  ChatSettingsRequest,
  ChatSettingsResponse,
  ChatUpdateNotify,
  ClientEvents,
  CommonChatsRequest,
  CommonChatsResponse,
  ComplainsSyncResponse,
  ContactActionRequest,
  ContactActionResponse,
  ContactActionType,
  ContactAddByPhoneRequest,
  ContactAddByPhoneResponse,
  ContactInfo,
  ContactLookupByPhoneRequest,
  ContactLookupByPhoneResponse,
  ContactsListByStatusRequest,
  ContactsListByStatusResponse,
  CreateGroupAttach,
  DeleteMessagesRequest,
  DeleteMessagesResponse,
  EditMessageRequest,
  EditMessageResponse,
  EventLogItem,
  EventLogRequest,
  ExternalVideoResolveRequest,
  ExternalVideoResolveResponse,
  FileDownloadUrlRequest,
  FileDownloadUrlResponse,
  FileUploadDonePush,
  FileUploadInfo,
  FileUploadUrlRequest,
  FileUploadUrlResponse,
  FolderUpsertRequest,
  FolderUpsertResponse,
  FoldersGetRequest,
  FoldersGetResponse,
  FoldersOrderRequest,
  FoldersOrderResponse,
  GlobalSearchHit,
  GlobalSearchRequest,
  GlobalSearchResponse,
  GlobalSearchSection,
  GroupParticipantsRequest,
  GroupParticipantsResponse,
  HistoryByAttachRequest,
  HistoryByAttachResponse,
  HistoryRequest,
  HistoryResponse,
  IncomingMessage,
  IncomingMessageNotify,
  LoginResponse,
  MaxChat,
  MaxMessage,
  MemberEntry,
  MembersListRequest,
  MembersListResponse,
  MessageAttach,
  MessageElement,
  MessageSearchHit,
  MessageSearchRequest,
  MessageSearchResponse,
  MessageStatsRequest,
  MessageStatsResponse,
  OutgoingMessage,
  PhotoUploadUrlRequest,
  PhotoUploadUrlResponse,
  PollGetRequest,
  PollGetResponse,
  PollInfo,
  PollState,
  PollVoteRequest,
  PollVoteResponse,
  ProfileUpdateRequest,
  ProfileUpdateResponse,
  ReactionInfo,
  ReactionRemoveRequest,
  ReactionSetRequest,
  ReactionSetResponse,
  ReactionsGetRequest,
  ReactionsGetResponse,
  ReactionsListRequest,
  ReadMarkNotify,
  ReadMessageRequest,
  SendMessageRequest,
  SendMessageResponse,
  SessionsListResponse,
  SettingsRequest,
  SettingsResponse,
  StickerPackActionRequest,
  StickerPackActionResponse,
  StickerRecentsPush,
  SubscribeRequest,
  TypingRequest,
  UserAgent,
  UserSettings,
  WireFrame,
} from './types.js';

export interface ClientOptions {
  /** WebSocket endpoint. Defaults to wss://ws-api.oneme.ru/websocket */
  url?: string;
  /**
   * Session store for persisting deviceId + tokens.
   * Default: FileSessionStore('./.max-session.json').
   * Override to support multiple instances or custom secret stores.
   */
  session?: SessionStore;
  /**
   * Inline credentials. If set, overrides the session store and uses an
   * in-memory store seeded with these values. Use this to run several
   * MaxClient instances in one process or to load creds from env / a vault.
   *
   * If only deviceId is provided → first run will perform QR login.
   * If both are provided → silent login with the stored token.
   */
  deviceId?: string;
  loginToken?: string;
  /**
   * Path of the default file store. Ignored when `session` or `loginToken`
   * is provided. Useful if you want a separate file per instance.
   */
  sessionFile?: string;
  /** UA spoof. Override only if you need to mimic a different device. */
  userAgent?: UserAgent;
  /** Print QR to stdout via qrcode-terminal. Default true. */
  printQr?: boolean;
  /**
   * Print the deviceId + loginToken to stdout right after a fresh QR login,
   * so the user can copy them into env / config for later reuse. Default true.
   */
  printCredentialsAfterLogin?: boolean;
  /** Auto-mark incoming messages as read. Default false. */
  autoRead?: boolean;
  /** Number of chats to preload on login. Default 40. */
  chatsCount?: number;
  /** Heartbeat interval in ms. Default 30_000. */
  pingIntervalMs?: number;
  /** Per-request timeout in ms. Default 20_000. */
  requestTimeoutMs?: number;
  /**
   * Called during QR login when the account has a 2FA cloud password.
   * Return the password to finish op 115 → token. Return `null` to abort.
   * Without this callback, accounts with 2FA throw at login time.
   */
  resolvePassword?: (challenge: PasswordChallenge) => Promise<string | null>;
}

/**
 * Options for {@link MaxClient.loginWithPhone}. Inherits everything from
 * {@link ClientOptions} plus phone-specific fields.
 */
export interface PhoneLoginOptions {
  /**
   * Phone number in E.164 format, e.g. `+79991234567`. Pass a callback
   * (`() => Promise<string>`) to defer the prompt — it'll only be called on
   * a fresh login, never on silent reconnect.
   */
  phone: string | (() => Promise<string>);
  /**
   * Called when an SMS code is needed. Return the digits the user received.
   * Throw / return empty string to abort the login.
   */
  getSmsCode: () => Promise<string>;
  /**
   * Called when the account has a 2FA cloud password. Receives the masked
   * email + hint from the challenge. Return the password, or `null` to abort.
   * If absent and the account has 2FA → `loginWithPhone()` throws.
   *
   * The callback is invoked at most once per `loginWithPhone()` call — both
   * the mobile-side op 115 and the web-side op 115 (if any) reuse the same
   * cached value.
   */
  getPassword?: (challenge: PasswordChallenge) => Promise<string | null>;
  /**
   * Hex-dump the mobile binary TX/RX to stderr (helpful for debugging
   * region-gated server errors). Default false.
   */
  debug?: boolean;
}

export declare interface MaxClient {
  on<E extends keyof ClientEvents>(event: E, listener: ClientEvents[E]): this;
  once<E extends keyof ClientEvents>(event: E, listener: ClientEvents[E]): this;
  off<E extends keyof ClientEvents>(event: E, listener: ClientEvents[E]): this;
  emit<E extends keyof ClientEvents>(event: E, ...args: Parameters<ClientEvents[E]>): boolean;
}

/**
 * High-level MAX account client.
 *
 * ```ts
 * const client = new MaxClient();
 * client.on('message', (m) => console.log(m.fromId, m.text));
 * await client.start();
 * await client.sendMessage(0, 'hello, saved messages!');
 * ```
 */
export class MaxClient extends EventEmitter {
  private readonly url: string;
  private readonly session: SessionStore;
  private readonly userAgent: UserAgent;
  private readonly printQr: boolean;
  private readonly printCredentialsAfterLogin: boolean;
  private readonly autoRead: boolean;
  private readonly chatsCount: number;
  private readonly resolvePassword?: (
    challenge: PasswordChallenge,
  ) => Promise<string | null>;
  private transport: Transport;

  private state: LoginResponse | null = null;
  private me: ContactInfo | null = null;
  private chats = new Map<number, MaxChat>();

  constructor(opts: ClientOptions = {}) {
    super();
    this.url = opts.url ?? 'wss://ws-api.oneme.ru/websocket';
    this.session = MaxClient.resolveSession(opts);
    this.userAgent = opts.userAgent ?? DEFAULT_USER_AGENT;
    this.printQr = opts.printQr ?? true;
    this.printCredentialsAfterLogin = opts.printCredentialsAfterLogin ?? true;
    this.autoRead = opts.autoRead ?? false;
    this.chatsCount = opts.chatsCount ?? 40;
    if (opts.resolvePassword) this.resolvePassword = opts.resolvePassword;
    this.transport = new Transport({
      url: this.url,
      headers: {
        'User-Agent': this.userAgent.headerUserAgent,
        ...(this.userAgent.deviceType === 'WEB' ? { Origin: 'https://web.max.ru' } : {}),
      },
      ...(opts.pingIntervalMs !== undefined ? { pingIntervalMs: opts.pingIntervalMs } : {}),
      ...(opts.requestTimeoutMs !== undefined ? { requestTimeoutMs: opts.requestTimeoutMs } : {}),
    });

    this.transport.on('error', (err) => this.emit('error', err));
    this.transport.on('close', (code, reason) => this.emit('close', code, reason));
    this.transport.on('reconnect', (n) => {
      this.emit('reconnect', n);
      // After reconnect, re-handshake silently using stored token.
      void this.rehandshake().catch((err) => this.emit('error', err));
    });
    this.transport.on('raw', (f: WireFrame) => this.emit('raw', f));
    this.transport.on('push', (f: WireFrame) => this.handlePush(f));
  }

  private static resolveSession(opts: ClientOptions): SessionStore {
    if (opts.session) return opts.session;
    if (opts.deviceId || opts.loginToken) {
      const seed: { deviceId?: string; loginToken?: string } = {};
      if (opts.deviceId) seed.deviceId = opts.deviceId;
      if (opts.loginToken) seed.loginToken = opts.loginToken;
      return new MemorySessionStore(seed);
    }
    return new FileSessionStore(opts.sessionFile);
  }

  /** Connect, handshake, login (via QR if no token stored), and emit `ready`. */
  async start(): Promise<void> {
    await this.transport.connect();
    const sess = await this.session.load();
    await hello(this.transport, sess.deviceId, this.userAgent);

    let token = sess.loginToken;
    if (!token) {
      const qrRes = await loginViaQr(this.transport, {
        emitQr: (info) => this.emit('qr', info),
        printToTerminal: this.printQr,
        ...(this.resolvePassword ? { resolvePassword: this.resolvePassword } : {}),
      });
      const loginToken = qrRes.tokenAttrs.LOGIN?.token;
      if (!loginToken) {
        throw new Error('QR login finished without a LOGIN token (2FA flow incomplete).');
      }
      token = loginToken;
      if (qrRes.profile) this.emit('login', qrRes.profile.contact);
      const seed = { ...sess, loginToken: token };
      if (qrRes.profile) (seed as { ownerId?: number }).ownerId = qrRes.profile.contact.id;
      await this.session.save(seed);
      if (this.printCredentialsAfterLogin) {
        // eslint-disable-next-line no-console
        console.log(
          '\n[max-account-api] Сохраните эти данные, чтобы переиспользовать сессию:\n' +
            `  deviceId:   ${sess.deviceId}\n` +
            `  loginToken: ${token}\n` +
            'Передайте их в new MaxClient({ deviceId, loginToken }) при следующем запуске.\n',
        );
      }
    }

    const login = await loginWithToken(this.transport, token, { chatsCount: this.chatsCount });
    this.state = login;
    this.me = login.profile.contact;
    for (const c of login.chats) this.chats.set(c.id, c);

    // Persist refreshed token (server may rotate it).
    if (login.token && login.token !== token) {
      await this.session.save({ ...sess, loginToken: login.token, ownerId: this.me.id });
    }

    this.emit('ready');
  }

  /** Disconnect and stop reconnects. */
  async stop(): Promise<void> {
    this.transport.close();
  }

  /** Logged-in account info. Available after `ready`. */
  getMe(): ContactInfo | null {
    return this.me;
  }

  /** Chats snapshot (last seen by the server during login). */
  getChats(): MaxChat[] {
    return Array.from(this.chats.values());
  }

  /**
   * Send a text message to a chat. Use `chatId = 0` for Saved Messages.
   */
  async sendMessage(chatId: number, text: string, opts: Partial<OutgoingMessage> = {}): Promise<MaxMessage> {
    const cid = -Date.now();
    const req: SendMessageRequest = {
      chatId,
      message: { text, cid, elements: [], attaches: [], ...opts },
      notify: true,
    };
    const res = await this.transport.request<SendMessageResponse>(Opcode.SEND_MESSAGE, req);
    return res.message;
  }

  /** Reply helper — sends to the same chat the incoming message came from. */
  async reply(incoming: IncomingMessage, text: string): Promise<MaxMessage> {
    return this.sendMessage(incoming.chatId, text);
  }

  /**
   * Send a quoted reply to a specific message. Server attaches the original
   * message envelope automatically based on `messageId`.
   */
  async sendReply(chatId: number, replyToMessageId: string, text: string): Promise<MaxMessage> {
    return this.sendMessage(chatId, text, {
      link: { type: 'REPLY', messageId: replyToMessageId },
    });
  }

  /**
   * Set (or replace) your reaction on a message. Re-calling with a different
   * emoji upserts — there is no separate "change" call.
   */
  async setReaction(chatId: number, messageId: string, emoji: string): Promise<ReactionInfo> {
    const req: ReactionSetRequest = {
      chatId,
      messageId,
      reaction: { reactionType: 'EMOJI', id: emoji },
    };
    const res = await this.transport.request<ReactionSetResponse>(Opcode.REACTION_SET, req);
    return res.reactionInfo;
  }

  /** Fetch reactions for a batch of messages in one chat. */
  async getReactions(chatId: number, messageIds: string[]): Promise<Record<string, ReactionInfo>> {
    const req: ReactionsGetRequest = { chatId, messageIds };
    const res = await this.transport.request<ReactionsGetResponse>(Opcode.REACTIONS_GET, req);
    return res.messagesReactions;
  }

  /**
   * Detailed reaction listing for a single message. `count` is the number of
   * reactor entries to fetch (default 100 in the web client).
   */
  async listReactions(chatId: number, messageId: string, count = 100): Promise<ReactionInfo> {
    const req: ReactionsListRequest = { chatId, messageId, count };
    const res = await this.transport.request<{ reactionInfo: ReactionInfo }>(Opcode.REACTIONS_LIST, req);
    return res.reactionInfo;
  }

  /** Remove your reaction from a message. */
  async removeReaction(chatId: number, messageId: string): Promise<ReactionInfo> {
    const req: ReactionRemoveRequest = { chatId, messageId };
    const res = await this.transport.request<{ reactionInfo: ReactionInfo }>(Opcode.REACTION_REMOVE, req);
    return res.reactionInfo;
  }

  /**
   * Delete one or more messages.
   * - `forMe=true`  → delete only on this device (own messages, any time).
   * - `forMe=false` → delete for all participants. Requires admin rights for
   *   foreign messages in groups, or being the author within edit window.
   */
  async deleteMessages(chatId: number, messageIds: string[], forMe = false): Promise<DeleteMessagesResponse> {
    const req: DeleteMessagesRequest = { chatId, messageIds, forMe };
    return this.transport.request<DeleteMessagesResponse>(Opcode.DELETE_MESSAGES, req);
  }

  /** Edit your own message. 7-day window per server config (`edit-timeout`). */
  async editMessage(
    chatId: number,
    messageId: string,
    text: string,
    opts: { elements?: MessageElement[]; attachments?: MessageAttach[] } = {},
  ): Promise<MaxMessage> {
    const req: EditMessageRequest = {
      chatId,
      messageId,
      text,
      elements: opts.elements ?? [],
      attachments: opts.attachments ?? [],
    };
    const res = await this.transport.request<EditMessageResponse>(Opcode.EDIT_MESSAGE, req);
    return res.message;
  }

  /**
   * Forward a message into another chat. Pass `toChatId=0` for Saved Messages.
   * Optional `comment` adds a leading text message before the forward.
   */
  async forwardMessage(
    toChatId: number,
    sourceChatId: number,
    messageId: string,
    comment?: string,
  ): Promise<MaxMessage> {
    if (comment !== undefined) {
      await this.sendMessage(toChatId, comment);
    }
    const cid = -Date.now();
    const req: SendMessageRequest = {
      chatId: toChatId,
      message: {
        cid,
        text: '',
        attaches: [],
        elements: [],
        link: { type: 'FORWARD', messageId, chatId: sourceChatId },
      },
      notify: true,
    };
    const res = await this.transport.request<SendMessageResponse>(Opcode.SEND_MESSAGE, req);
    return res.message;
  }

  /**
   * Create a new group chat with given participants. Returns the SendMessage
   * response: `chatId` is the new group's id, `chat` carries the freshly
   * created group snapshot.
   */
  async createGroup(
    title: string,
    userIds: number[],
    opts: { chatType?: 'CHAT' | 'CHANNEL' } = {},
  ): Promise<SendMessageResponse & { chat?: MaxChat }> {
    const cid = Date.now();
    const attach: CreateGroupAttach = {
      _type: 'CONTROL',
      event: 'new',
      chatType: opts.chatType ?? 'CHAT',
      title,
      userIds,
    };
    const req = {
      message: { cid, attaches: [attach] },
      notify: true,
    } as unknown as SendMessageRequest;
    const res = await this.transport.request<SendMessageResponse & { chat?: MaxChat }>(
      Opcode.SEND_MESSAGE,
      req,
    );
    if (res.chat) this.chats.set(res.chat.id, res.chat);
    return res;
  }

  /** Add members to a group. */
  async addGroupParticipants(chatId: number, userIds: number[], showHistory = true): Promise<MaxChat> {
    const req: GroupParticipantsRequest = { chatId, userIds, operation: 'add', showHistory };
    const res = await this.transport.request<GroupParticipantsResponse>(Opcode.GROUP_PARTICIPANTS, req);
    this.chats.set(res.chat.id, res.chat);
    return res.chat;
  }

  /**
   * Remove a member from the group. `cleanMsgPeriod` (seconds) wipes that much
   * of the user's recent history, 0 keeps everything.
   */
  async removeGroupParticipant(chatId: number, userId: number, cleanMsgPeriod = 0): Promise<MaxChat> {
    const req: GroupParticipantsRequest = {
      chatId,
      userIds: [userId],
      operation: 'remove',
      cleanMsgPeriod,
    };
    const res = await this.transport.request<GroupParticipantsResponse>(Opcode.GROUP_PARTICIPANTS, req);
    this.chats.set(res.chat.id, res.chat);
    return res.chat;
  }

  /** Promote a user to admin. `permissions` is a bitmask, 255 = full admin. */
  async setGroupAdmin(chatId: number, userId: number, permissions = 255): Promise<MaxChat> {
    const req: GroupParticipantsRequest = {
      chatId,
      userIds: [userId],
      type: 'ADMIN',
      operation: 'add',
      permissions,
    };
    const res = await this.transport.request<GroupParticipantsResponse>(Opcode.GROUP_PARTICIPANTS, req);
    this.chats.set(res.chat.id, res.chat);
    return res.chat;
  }

  /** Demote an admin back to a regular member. */
  async removeGroupAdmin(chatId: number, userId: number): Promise<MaxChat> {
    const req: GroupParticipantsRequest = {
      chatId,
      userIds: [userId],
      type: 'ADMIN',
      operation: 'remove',
    };
    const res = await this.transport.request<GroupParticipantsResponse>(Opcode.GROUP_PARTICIPANTS, req);
    this.chats.set(res.chat.id, res.chat);
    return res.chat;
  }

  /**
   * Update group settings (op 55). Pass any subset:
   *   `options` — boolean flags (ALL_CAN_PIN_MESSAGE, ONLY_ADMIN_CAN_CALL, …).
   *   `theme` / `description` — rename / set bio.
   *   `pinMessageId` / `notifyPin` — pin a message.
   */
  async updateChatSettings(
    chatId: number,
    patch: Omit<ChatSettingsRequest, 'chatId'>,
  ): Promise<MaxChat> {
    const req: ChatSettingsRequest = { chatId, ...patch };
    const res = await this.transport.request<ChatSettingsResponse>(Opcode.CHAT_SETTINGS, req);
    this.chats.set(res.chat.id, res.chat);
    return res.chat;
  }

  /** Convenience: rename group + optionally update description. */
  async renameGroup(chatId: number, title: string, description?: string): Promise<MaxChat> {
    const patch: Omit<ChatSettingsRequest, 'chatId'> = { theme: title };
    if (description !== undefined) patch.description = description;
    return this.updateChatSettings(chatId, patch);
  }

  /** Set group permission flags. Merges with existing options server-side. */
  async setGroupOptions(chatId: number, options: ChatSettingsOptions): Promise<MaxChat> {
    return this.updateChatSettings(chatId, { options });
  }

  /** Pin a message in chat. `notify=true` posts a service message. */
  async pinMessage(chatId: number, messageId: string, notify = false): Promise<MaxChat> {
    return this.updateChatSettings(chatId, { pinMessageId: messageId, notifyPin: notify });
  }

  /**
   * Configure per-chat reaction policy.
   *   - disable:  `setChatReactionsPolicy(id, { value: false })`
   *   - allow N:  `setChatReactionsPolicy(id, { value: true, included: true, reactionIds: ['👍','❤️'], count: 2 })`
   *   - allow all:`setChatReactionsPolicy(id, { value: true, included: false, count: 2 })`
   */
  async setChatReactionsPolicy(
    chatId: number,
    cfg: Omit<ChatReactionsSettingsRequest, 'chatId'>,
  ): Promise<ChatReactionsSettings> {
    const req: ChatReactionsSettingsRequest = { chatId, ...cfg };
    const res = await this.transport.request<ChatReactionsSettingsResponse>(
      Opcode.CHAT_REACTIONS_SETTINGS,
      req,
    );
    return res.chatReactionsSettings;
  }

  /** Chats you share with the given user. */
  async getCommonChats(userId: number): Promise<CommonChatsResponse> {
    const req: CommonChatsRequest = { userIds: [userId] };
    return this.transport.request<CommonChatsResponse>(Opcode.COMMON_CHATS, req);
  }

  /** Search messages inside a chat by text. */
  async searchMessages(chatId: number, query: string, count = 30): Promise<MessageSearchHit[]> {
    const req: MessageSearchRequest = { chatId, query, count };
    const res = await this.transport.request<MessageSearchResponse>(Opcode.MESSAGE_SEARCH, req);
    return res.result;
  }

  /**
   * Mark a chat as "opened" / focused. Web client sends this around search
   * sessions and chat focus changes; server replies with empty payload.
   */
  async openChat(chatId: number): Promise<void> {
    await this.transport.request(Opcode.CHAT_OPEN, { chatId });
  }

  /** Mark a message as read. */
  async readMessage(chatId: number, messageId: string, mark: number = Date.now()): Promise<void> {
    const req: ReadMessageRequest = { type: 'READ_MESSAGE', chatId, messageId, mark };
    await this.transport.request(Opcode.CHAT_EVENT, req);
  }

  /** Send "typing…" presence to a chat. Repeats are needed to keep it active. */
  async sendTyping(chatId: number, type: TypingRequest['type'] = 'TEXT'): Promise<void> {
    await this.transport.request(Opcode.TYPING, { chatId, type } satisfies TypingRequest);
  }

  /** Fetch message history from a chat. */
  async getHistory(chatId: number, opts: { from?: number; backward?: number; forward?: number } = {}): Promise<MaxMessage[]> {
    const req: HistoryRequest = {
      chatId,
      from: opts.from ?? Date.now(),
      forward: opts.forward ?? 0,
      backward: opts.backward ?? 30,
      getMessages: true,
    };
    const res = await this.transport.request<HistoryResponse>(Opcode.HISTORY_GET, req);
    return res.messages;
  }

  /** Fetch chats by ids. */
  async getChatsByIds(chatIds: number[]): Promise<MaxChat[]> {
    const res = await this.transport.request<{ chats: MaxChat[] }>(Opcode.CHATS_GET, { chatIds });
    for (const c of res.chats) this.chats.set(c.id, c);
    return res.chats;
  }

  /** Subscribe / unsubscribe to push events inside a chat. */
  async subscribeChat(chatId: number, subscribe: boolean): Promise<void> {
    const req: SubscribeRequest = { chatId, subscribe };
    await this.transport.request(Opcode.CHAT_SUBSCRIBE, req);
  }

  /** Escape hatch: send any opcode and get its response. */
  raw<T = unknown>(opcode: number, payload?: unknown): Promise<T> {
    return this.transport.request<T>(opcode, payload);
  }

  // ====================================================================
  // Profile (op 16)
  // ====================================================================

  /** Update own profile fields. Pass any subset. */
  async updateProfile(patch: ProfileUpdateRequest): Promise<ContactInfo> {
    const res = await this.transport.request<ProfileUpdateResponse>(Opcode.PROFILE_UPDATE, patch);
    this.me = res.profile.contact;
    return this.me;
  }

  /** Convenience: rename own account. */
  async setProfileName(firstName: string, lastName = ''): Promise<ContactInfo> {
    return this.updateProfile({ firstName, lastName });
  }

  /** Set profile bio. */
  async setProfileDescription(description: string): Promise<ContactInfo> {
    return this.updateProfile({ description });
  }

  /**
   * Set own avatar from a previously uploaded photo. Get `photoToken` from
   * `uploadPhotoBytes()` (high-level) or `requestPhotoUploadUrl()` + HTTP POST.
   */
  async setProfileAvatar(photoToken: string, firstName = '', lastName = ''): Promise<ContactInfo> {
    return this.updateProfile({ firstName, lastName, photoToken, avatarType: 'USER_AVATAR' });
  }

  // ====================================================================
  // Settings (op 22)
  // ====================================================================

  /** Raw settings setter — pass any subset of `settings.user` / `settings.chats`. */
  async updateSettings(patch: SettingsRequest['settings']): Promise<SettingsResponse> {
    return this.transport.request<SettingsResponse>(Opcode.SETTINGS, { settings: patch });
  }

  /**
   * Mute / unmute a chat.
   *  - `muteUntilMs` omitted or `-1` → mute forever
   *  - `0` → unmute
   *  - timestamp (ms) → mute until that moment
   */
  async muteChat(chatId: number, muteUntilMs: number = -1): Promise<SettingsResponse> {
    return this.updateSettings({ chats: { [String(chatId)]: { dontDisturbUntil: muteUntilMs } } });
  }

  /** Convenience: unmute chat. */
  async unmuteChat(chatId: number): Promise<SettingsResponse> {
    return this.muteChat(chatId, 0);
  }

  /** Update privacy / push / safety toggles on the user level. */
  async setUserSettings(user: UserSettings): Promise<SettingsResponse> {
    return this.updateSettings({ user });
  }

  // ====================================================================
  // Sessions (op 96)
  // ====================================================================

  /** List active login sessions across devices. */
  async listSessions(): Promise<ActiveSession[]> {
    const res = await this.transport.request<SessionsListResponse>(Opcode.SESSIONS_LIST, {});
    return res.sessions;
  }

  // ====================================================================
  // Contacts (op 34, 36, 41, 46)
  // ====================================================================

  /** Low-level contact action. Use the named helpers below for clarity. */
  async contactAction(req: ContactActionRequest): Promise<ContactActionResponse> {
    return this.transport.request<ContactActionResponse>(Opcode.CONTACT_ACTION, req);
  }

  /** Remove a saved contact. */
  async removeContact(contactId: number): Promise<void> {
    await this.contactAction({ contactId, action: 'REMOVE' });
  }

  /** Rename a contact in your address book (does not affect their profile). */
  async renameContact(contactId: number, firstName: string, lastName = ''): Promise<ContactInfo | undefined> {
    const res = await this.contactAction({ contactId, action: 'UPDATE', firstName, lastName });
    return res.contact;
  }

  async blockContact(contactId: number): Promise<void> {
    await this.contactAction({ contactId, action: 'BLOCK' });
  }

  async unblockContact(contactId: number): Promise<void> {
    await this.contactAction({ contactId, action: 'UNBLOCK' });
  }

  /**
   * List your contacts filtered by status. `status:'BLOCKED'` is the block list.
   * Paginate with `from` (offset).
   */
  async listContactsByStatus(
    status: ContactsListByStatusRequest['status'],
    opts: { count?: number; from?: number } = {},
  ): Promise<ContactInfo[]> {
    const req: ContactsListByStatusRequest = { status, count: opts.count ?? 100, from: opts.from ?? 0 };
    const res = await this.transport.request<ContactsListByStatusResponse>(
      Opcode.CONTACTS_LIST_BY_STATUS,
      req,
    );
    return res.contacts;
  }

  /** Get the list of users you've blocked. */
  async listBlockedContacts(opts: { count?: number; from?: number } = {}): Promise<ContactInfo[]> {
    return this.listContactsByStatus('BLOCKED', opts);
  }

  /**
   * Add a contact by phone number (E.164). Throws if the phone is not registered.
   * `new=false` in response means the contact already existed.
   */
  async addContactByPhone(
    phone: string,
    firstName?: string,
    lastName?: string,
  ): Promise<ContactAddByPhoneResponse> {
    const req: ContactAddByPhoneRequest = { phone };
    if (firstName !== undefined) req.firstName = firstName;
    if (lastName !== undefined) req.lastName = lastName;
    return this.transport.request<ContactAddByPhoneResponse>(Opcode.CONTACT_ADD_BY_PHONE, req);
  }

  /** Batch-fetch contact info by ids (op 32). */
  async getContactsInfo(contactIds: number[]): Promise<ContactInfo[]> {
    const res = await this.transport.request<{ contacts: ContactInfo[] }>(
      Opcode.CONTACT_INFO,
      { contactIds },
    );
    return res.contacts;
  }

  /** Convenience: fetch a single contact by id. */
  async getContactInfo(contactId: number): Promise<ContactInfo | undefined> {
    const [c] = await this.getContactsInfo([contactId]);
    return c;
  }

  /** Get last-seen / online status for one or more contacts (op 35). */
  async getPresence(
    contactIds: number[],
  ): Promise<{ presence: Record<string, { seen: number; status: number }>; time: number }> {
    return this.transport.request(Opcode.PRESENCE_GET, { contactIds });
  }

  /**
   * Subscribe to presence push updates for a user (op 177). Server then sends
   * op 132 frames whenever their `seen`/`status` change. Pass `time:0` for
   * "from now"; positive timestamp resumes from a previous cursor.
   */
  async subscribePresence(userId: number, time = 0): Promise<void> {
    // FIXME(decompilation): the pre-decompile alias `PRESENCE_SUBSCRIBE: 177`
    // is wrong — op 177 is canonically `DRAFT_DISCARD` in the Android enum.
    // The correct subscribe opcode hasn't been re-identified from source yet;
    // keeping the call as-is so existing behaviour is unchanged until we
    // pinpoint the real op.
    await this.transport.request(Opcode.PRESENCE_SUBSCRIBE, { userId, time });
  }

  /** Resolve a phone number to a contact without saving. */
  async lookupContactByPhone(phone: string): Promise<ContactInfo> {
    const req: ContactLookupByPhoneRequest = { phone };
    const res = await this.transport.request<ContactLookupByPhoneResponse>(
      Opcode.CONTACT_LOOKUP_BY_PHONE,
      req,
    );
    return res.contact;
  }

  // ====================================================================
  // History / chat browsing (op 51, 54, 58, 59, 74)
  // ====================================================================

  /**
   * Fetch surrounding messages filtered by attach type. Used by photo/file
   * viewers to walk media in the chat.
   */
  async getHistoryByAttach(
    chatId: number,
    messageId: string,
    attachTypes: AttachFilterType[],
    opts: { forward?: number; backward?: number } = {},
  ): Promise<MaxMessage[]> {
    const req: HistoryByAttachRequest = {
      chatId,
      messageId,
      attachTypes,
      forward: opts.forward ?? 25,
      backward: opts.backward ?? 25,
    };
    const res = await this.transport.request<HistoryByAttachResponse>(Opcode.HISTORY_BY_ATTACH, req);
    return res.messages;
  }

  /**
   * Delete (or wipe) a chat. `forAll=true` removes for every participant.
   * `lastEventTimeMs` defaults to "now" (deletes everything up to current).
   */
  async deleteChat(chatId: number, forAll = false, lastEventTimeMs: number = Date.now()): Promise<void> {
    await this.transport.request(Opcode.CHAT_DELETE, {
      chatId,
      forAll,
      lastEventTime: lastEventTimeMs,
    });
    this.chats.delete(chatId);
  }

  /** Leave a group / channel. Server posts a CONTROL `leave` message. */
  async leaveChat(chatId: number): Promise<MaxMessage> {
    const req: ChatLeaveRequest = { chatId };
    const res = await this.transport.request<ChatLeaveResponse>(Opcode.CHAT_LEAVE, req);
    return res.message;
  }

  /** Paginated participants list. Use `type:'ADMIN'` to list admins only. */
  async listMembers(
    chatId: number,
    opts: { type?: 'MEMBER' | 'ADMIN'; marker?: number; count?: number } = {},
  ): Promise<MemberEntry[]> {
    const req: MembersListRequest = {
      chatId,
      type: opts.type ?? 'MEMBER',
      marker: opts.marker ?? 0,
      count: opts.count ?? 50,
    };
    const res = await this.transport.request<MembersListResponse>(Opcode.MEMBERS_LIST, req);
    return res.members;
  }

  /** View counts for channel posts. */
  async getMessageStats(chatId: number, messageIds: string[]): Promise<Record<string, { views: number }>> {
    const req: MessageStatsRequest = { chatId, messageIds };
    const res = await this.transport.request<MessageStatsResponse>(Opcode.MESSAGE_STATS, req);
    return res.stats;
  }

  // ====================================================================
  // Global search (op 60, 68)
  // ====================================================================

  /** Cross-section global search. Paginate via `marker`. */
  async globalSearch(
    query: string,
    opts: { count?: number; marker?: string } = {},
  ): Promise<GlobalSearchResponse> {
    const req: GlobalSearchRequest = { query, count: opts.count ?? 30 };
    if (opts.marker !== undefined) req.marker = opts.marker;
    return this.transport.request<GlobalSearchResponse>(Opcode.GLOBAL_SEARCH, req);
  }

  /** Single-section search (returns full chat objects in a flat array). */
  async globalSearchByType(
    query: string,
    type: GlobalSearchSection,
    count = 30,
  ): Promise<GlobalSearchHit[]> {
    const req: GlobalSearchRequest = { query, count, type };
    const res = await this.transport.request<GlobalSearchResponse>(Opcode.GLOBAL_SEARCH_BY_TYPE, req);
    return res.result;
  }

  // ====================================================================
  // Calls (op 78)
  // ====================================================================

  /**
   * Initiate a 1:1 audio or video call to a single user. Returns the WebRTC
   * endpoint info (`internalCallerParams` parsed from JSON) — connect to
   * that WebSocket separately to actually carry media.
   *
   * NOTE: this opens the call signalling slot only; full call media goes over
   * `wss://videowebrtc.okcdn.ru/ws2` and is out of scope of this library.
   */
  async startCall(
    calleeId: number,
    opts: { isVideo?: boolean; deviceId?: string; conversationId?: string } = {},
  ): Promise<{ conversationId: string; caller: CallCallerParams; raw: CallStartResponse }> {
    const conversationId = opts.conversationId ?? randomUUID();
    const sess = await this.session.load();
    const internal = {
      deviceId: opts.deviceId ?? sess.deviceId,
      sdkVersion: '1.1',
      clientAppKey: 'CNHIJPLGDIHBABABA',
      platform: 'WEB' as const,
      protocolVersion: 5,
      domainId: '',
      capabilities: '2A03F',
    };
    const req: CallStartRequest = {
      conversationId,
      calleeIds: [calleeId],
      internalParams: JSON.stringify(internal),
      isVideo: opts.isVideo ?? false,
    };
    const res = await this.transport.request<CallStartResponse>(Opcode.CALL_START, req);
    let caller: CallCallerParams;
    try {
      caller = JSON.parse(res.internalCallerParams) as CallCallerParams;
    } catch {
      caller = { id: { internal: '', external: '' }, endpoint: '', clientType: '' };
    }
    return { conversationId: res.conversationId, caller, raw: res };
  }

  // ====================================================================
  // File / photo / sticker (op 29, 80, 83, 87, 88)
  // ====================================================================

  /** Allocate one or more photo upload slots. Returns the HTTPS upload URL. */
  async requestPhotoUploadUrl(count = 1): Promise<string> {
    const req: PhotoUploadUrlRequest = { count };
    const res = await this.transport.request<PhotoUploadUrlResponse>(Opcode.PHOTO_UPLOAD_URL, req);
    return res.url;
  }

  /** Allocate file upload slot(s). Returns `{url, fileId, token}` per slot. */
  async requestFileUploadUrl(count = 1): Promise<FileUploadInfo[]> {
    const req: FileUploadUrlRequest = { count };
    const res = await this.transport.request<FileUploadUrlResponse>(Opcode.FILE_UPLOAD_URL, req);
    return res.info;
  }

  /** Resolve a CDN download URL for a file attach. */
  async getFileDownloadUrl(
    fileId: number,
    chatId: number,
    messageId: string,
  ): Promise<FileDownloadUrlResponse> {
    const req: FileDownloadUrlRequest = { fileId, chatId, messageId };
    return this.transport.request<FileDownloadUrlResponse>(Opcode.FILE_DOWNLOAD_URL, req);
  }

  /** Resolve playable URLs for an external (e.g. OK / VK) video attachment. */
  async resolveExternalVideo(
    videoId: string,
    token: string,
    chatId: number,
    messageId: string,
  ): Promise<ExternalVideoResolveResponse> {
    const req: ExternalVideoResolveRequest = { videoId, token, chatId, messageId };
    return this.transport.request<ExternalVideoResolveResponse>(
      Opcode.EXTERNAL_VIDEO_RESOLVE,
      req,
    );
  }

  /**
   * Upload a photo end-to-end and return its photoToken. Combines op 80 with
   * the HTTPS multipart POST. Uses global `fetch` (Node 18+).
   */
  async uploadPhotoBytes(
    file: { data: Uint8Array | ArrayBuffer | Blob; filename: string; contentType?: string },
  ): Promise<string> {
    const url = await this.requestPhotoUploadUrl(1);
    const { uploadPhoto, firstPhotoToken } = await import('./media.js');
    const res = await uploadPhoto(url, file);
    return firstPhotoToken(res);
  }

  /**
   * Upload a file end-to-end and return `{fileId, token}` ready to be used as
   * a `_type:'FILE'` attach. Awaits the op 136 push so caller knows the file
   * is fully ingested before sending the message.
   */
  async uploadFileBytes(
    file: { data: Uint8Array | ArrayBuffer | Blob; filename: string },
  ): Promise<FileUploadInfo> {
    const [info] = await this.requestFileUploadUrl(1);
    if (!info) throw new Error('No upload slot returned');
    const { uploadFile } = await import('./media.js');

    const done = new Promise<void>((resolve) => {
      const onDone = (p: FileUploadDonePush) => {
        if (String(p.fileId) === String(info.fileId)) {
          this.off('fileUploadDone', onDone);
          resolve();
        }
      };
      this.on('fileUploadDone', onDone);
    });

    await uploadFile(info.url, { data: file.data, filename: file.filename });
    await done;
    return info;
  }

  /** Send a photo message. `photoToken` from `uploadPhotoBytes()`. */
  async sendPhoto(chatId: number, photoToken: string, caption = ''): Promise<MaxMessage> {
    return this.sendMessage(chatId, caption, {
      attaches: [{ _type: 'PHOTO', photoToken }],
    });
  }

  /** Send a file message. `fileId` from `uploadFileBytes()`. */
  async sendFile(chatId: number, fileId: number | string, caption = ''): Promise<MaxMessage> {
    return this.sendMessage(chatId, caption, {
      attaches: [{ _type: 'FILE', fileId }],
    });
  }

  /** Send a sticker. `stickerId` from sticker pack listings (op 26). */
  async sendSticker(chatId: number, stickerId: number | string): Promise<MaxMessage> {
    return this.sendMessage(chatId, '', {
      attaches: [{ _type: 'STICKER', stickerId }],
    });
  }

  /** Share a contact. */
  async sendContact(chatId: number, contactId: number, caption = ''): Promise<MaxMessage> {
    return this.sendMessage(chatId, caption, {
      attaches: [{ _type: 'CONTACT', contactId }],
    });
  }

  /** Add a sticker pack to favourites. */
  async favoriteStickerPack(packId: number | string): Promise<StickerPackActionResponse> {
    const req: StickerPackActionRequest = { type: 'FAVORITE_STICKER_SET', id: packId };
    return this.transport.request<StickerPackActionResponse>(Opcode.STICKER_PACK_ACTION, req);
  }

  /** Remove a sticker pack from favourites. */
  async unfavoriteStickerPack(packId: number | string): Promise<StickerPackActionResponse> {
    const req: StickerPackActionRequest = { type: 'UNFAVORITE_STICKER_SET', id: packId };
    return this.transport.request<StickerPackActionResponse>(Opcode.STICKER_PACK_ACTION, req);
  }

  // ====================================================================
  // Polls (op 304, 306) + send-poll attach
  // ====================================================================

  /**
   * Create a poll in a chat.
   *  - `settings` bitmask: 4 = anonymous, 12 = anon + visible voters list.
   *  - default = anonymous.
   */
  async sendPoll(
    chatId: number,
    title: string,
    answers: string[],
    settings = 4,
  ): Promise<MaxMessage> {
    return this.sendMessage(chatId, '', {
      attaches: [
        {
          _type: 'POLL',
          title,
          answers: answers.map((text) => ({ text })),
          settings,
        },
      ],
    });
  }

  /** Cast or change a vote. Pass multiple `answerIds` for multi-choice polls. */
  async votePoll(
    chatId: number,
    messageId: string,
    pollId: number | string,
    answerIds: number[],
  ): Promise<PollState> {
    const req: PollVoteRequest = { chatId, messageId, pollId, answersIds: answerIds };
    const res = await this.transport.request<PollVoteResponse>(Opcode.POLL_VOTE, req);
    return res.state;
  }

  /** Fetch current state of one or more polls. */
  async getPolls(
    chatId: number,
    polls: Array<{ messageId: string; pollId: number | string }>,
  ): Promise<PollInfo[]> {
    const req: PollGetRequest = { chatId, polls };
    const res = await this.transport.request<PollGetResponse>(Opcode.POLL_GET, req);
    return res.polls;
  }

  // ====================================================================
  // Bot mini-apps + complaints (op 160, 162)
  // ====================================================================

  /** Open a bot mini-app and obtain its launch URL with signed WebAppData. */
  async openBotMiniApp(botId: number, chatId: number): Promise<BotMiniAppOpenResponse> {
    const req: BotMiniAppOpenRequest = { botId, chatId };
    return this.transport.request<BotMiniAppOpenResponse>(Opcode.BOT_MINI_APP_OPEN, req);
  }

  /** Fetch the localised report-reason catalogue (used to build report dialogs). */
  async getComplainReasons(complainSync = 0): Promise<ComplainsSyncResponse> {
    return this.transport.request<ComplainsSyncResponse>(Opcode.COMPLAINS_SYNC, { complainSync });
  }

  // ====================================================================
  // Folders (op 273, 274, 276)
  // ====================================================================

  /** Fetch specific folders by id. */
  async getFolders(folderIds: string[]): Promise<ChatFolder[]> {
    const req: FoldersGetRequest = { folderIds };
    const res = await this.transport.request<FoldersGetResponse>(Opcode.FOLDERS_GET, req);
    return res.folders;
  }

  /** Create or update a folder. Pass id from a previous folder for update. */
  async upsertFolder(folder: FolderUpsertRequest): Promise<FolderUpsertResponse> {
    return this.transport.request<FolderUpsertResponse>(Opcode.FOLDER_UPSERT, folder);
  }

  /**
   * Reorder folders by sending the new id sequence.
   *
   * Op 275 (FOLDERS_REORDER) — earlier versions of this file used op 276,
   * which is actually FOLDERS_DELETE. The fix follows the canonical opcode
   * names extracted from the Android client.
   */
  async reorderFolders(folderIds: string[]): Promise<FoldersOrderResponse> {
    const req: FoldersOrderRequest = { folderIds };
    return this.transport.request<FoldersOrderResponse>(Opcode.FOLDERS_REORDER, req);
  }

  // ====================================================================
  // Reactions config — batch get (op 258)
  // ====================================================================

  /** Read reactions policy for many chats at once. */
  async getChatReactionsPolicies(chatIds: number[]): Promise<ChatReactionsSettings[]> {
    const req: ChatReactionsSettingsGetRequest = { chatIds };
    const res = await this.transport.request<ChatReactionsSettingsGetResponse>(
      Opcode.CHAT_REACTIONS_SETTINGS_GET,
      req,
    );
    return res.chatReactionsSettings;
  }

  // ====================================================================
  // Channel-only sugar (op 55 with channel-specific fields)
  // ====================================================================

  /** Set / replace a chat (group or channel) avatar from an uploaded photo token. */
  async setChatAvatar(chatId: number, photoToken: string): Promise<MaxChat> {
    return this.updateChatSettings(chatId, { photoToken });
  }

  /** Rotate the private invite link of a group / channel. */
  async revokeChatInviteLink(chatId: number): Promise<MaxChat> {
    return this.updateChatSettings(chatId, { revokePrivateLink: true });
  }

  /** Toggle "join requires admin approval" on a channel. */
  async setChannelJoinRequest(chatId: number, enabled: boolean): Promise<MaxChat> {
    return this.updateChatSettings(chatId, { options: { JOIN_REQUEST: enabled } });
  }

  /** Unpin pinned message (sample observation: empty string clears it). */
  async unpinMessage(chatId: number): Promise<MaxChat> {
    return this.updateChatSettings(chatId, { pinMessageId: '' });
  }

  // ====================================================================
  // Misc (op 5, 200)
  // ====================================================================

  /** Send analytics events to the server. Fire-and-forget. */
  logEvents(events: EventLogItem[]): void {
    const req: EventLogRequest = { events };
    this.transport.request(Opcode.EVENT_LOG, req).catch(() => {
      /* analytics: ignore */
    });
  }

  /**
   * Round-trip ping (op 1). Earlier versions used op 200 which is actually
   * PROFILE_DELETE_TIME; the canonical keep-alive op in the Android client
   * is the standard PING.
   */
  async keepalive(): Promise<{ timestamp: number }> {
    return this.transport.request<{ timestamp: number }>(Opcode.PING, { interactive: true });
  }

  // ====================================================================
  // Account / auth lifecycle (op 20, 158, 104–115)
  // ====================================================================

  /**
   * Log out server-side (op 20) and wipe local session (deviceId is kept,
   * loginToken cleared so next `start()` triggers a fresh QR login).
   * Closes the websocket on the way out.
   */
  async logout(): Promise<void> {
    try {
      await logoutOp(this.transport);
    } finally {
      const sess = await this.session.load();
      const next = { ...sess };
      delete (next as { loginToken?: string }).loginToken;
      delete (next as { ownerId?: number }).ownerId;
      await this.session.save(next);
      this.transport.close();
      this.state = null;
      this.me = null;
      this.chats.clear();
    }
  }

  /**
   * Refresh the short-lived web token (op 158). MAX rotates this every
   * ~14 minutes — call before the `token_refresh_ts` timestamp.
   */
  async refreshWebToken(): Promise<WebTokenResponse> {
    return this.transport.request<WebTokenResponse>(Opcode.WEB_TOKEN, {});
  }

  /** Open a new auth track (op 112) used by all 2FA / email-recovery ops. */
  async startAuthTrack(type = 0): Promise<string> {
    const r = await startAuthTrack(this.transport, type);
    return r.trackId;
  }

  /** Op 104: report whether a 2FA password is set, and the recovery email. */
  async getPasswordInfo(trackId: string): Promise<AuthPasswordInfoResponse['password']> {
    const r = await getPasswordInfo(this.transport, trackId);
    return r.password;
  }

  /**
   * Enable 2FA (cloud password). Requires email ownership confirmation:
   *  1. server emails a code to `recoveryEmail` (op 109)
   *  2. caller resolves it via `getCode(blockingDuration, codeLength)`
   *  3. code verified (op 110), password committed (op 111)
   */
  async enable2faPassword(opts: {
    password: string;
    hint: string;
    recoveryEmail: string;
    getCode: (info: { blockingDuration: number; codeLength: number }) => Promise<string>;
  }): Promise<void> {
    const { trackId } = await startAuthTrack(this.transport);
    await validatePassword(this.transport, trackId, opts.password);
    await setPasswordHint(this.transport, trackId, opts.hint);
    const sent = await sendEmailCode(this.transport, trackId, opts.recoveryEmail);
    const code = await opts.getCode({
      blockingDuration: sent.blockingDuration,
      codeLength: sent.codeLength,
    });
    await verifyEmailCode(this.transport, trackId, code);
    await commitPasswordChange(this.transport, {
      trackId,
      expectedCapabilities: [0, 3, 4],
      password: opts.password,
      hint: opts.hint,
    });
  }

  /** Disable 2FA cloud password (op 113 verify → op 111 with `remove2fa:true`). */
  async disable2faPassword(currentPassword: string): Promise<void> {
    const { trackId } = await startAuthTrack(this.transport);
    await verifyPassword(this.transport, trackId, currentPassword);
    await commitPasswordChange(this.transport, {
      trackId,
      expectedCapabilities: [5],
      remove2fa: true,
    });
  }

  /**
   * Re-prove ownership of the 2FA password mid-session (op 113). Server may
   * require this before sensitive settings changes.
   */
  async verify2faPassword(password: string): Promise<string> {
    const { trackId } = await startAuthTrack(this.transport);
    const r = await verifyPassword(this.transport, trackId, password);
    return r.trackId;
  }

  /**
   * Manually finish a 2FA-gated QR login (op 115). Use when you bypass the
   * `resolvePassword` callback and prefer to drive the flow yourself.
   */
  async completeQrPasswordLogin(challenge: PasswordChallenge, password: string): Promise<string> {
    const r = await completeQrPasswordLogin(this.transport, challenge.trackId, password);
    if (!r.tokenAttrs.LOGIN) throw new Error('Server did not return LOGIN token after 2FA.');
    return r.tokenAttrs.LOGIN.token;
  }

  // ====================================================================
  // Chat ops added from capture (op 52, 53, 57, 70, 79, 82)
  // ====================================================================

  /**
   * Clear chat history (op 52). Unlike `deleteChat` (op 54), the chat itself
   * stays in the list; only messages up to `lastEventTimeMs` are wiped.
   */
  async clearChatHistory(
    chatId: number,
    forAll = false,
    lastEventTimeMs: number = Date.now(),
  ): Promise<void> {
    const req: ChatClearRequest = { chatId, forAll, lastEventTime: lastEventTimeMs };
    await this.transport.request(Opcode.CHAT_CLEAR, req);
  }

  /**
   * Incremental chat-list sync (op 53). Pass the largest `modified` timestamp
   * you've seen; server returns chats updated after `marker`.
   */
  async syncChats(marker: number): Promise<MaxChat[]> {
    const req: ChatsSyncRequest = { marker };
    const res = await this.transport.request<ChatsSyncResponse>(Opcode.CHATS_SYNC, req);
    for (const c of res.chats) this.chats.set(c.id, c);
    return res.chats;
  }

  /**
   * Resolve a public `https://max.ru/<slug>` or invite link to a `MaxChat`
   * snapshot (op 57 — `CHAT_JOIN`). Canonical op 57 actually performs a join
   * server-side; if you only want to peek without joining, use
   * `raw(Opcode.CHAT_CHECK_LINK, { link })` (op 56) instead.
   */
  async resolveChatLink(link: string): Promise<MaxChat> {
    const req: ChatResolveLinkRequest = { link };
    const res = await this.transport.request<ChatResolveLinkResponse>(
      Opcode.CHAT_RESOLVE_LINK,
      req,
    );
    return res.chat;
  }

  /**
   * Server-side URL preview (op 70). Web client calls this when the user
   * pastes a link into the composer; result is a `SHARE` attach you can
   * pass straight to `sendMessage(..., { attaches })`.
   */
  async previewLink(text: string): Promise<MessageAttach[]> {
    const req: LinkPreviewRequest = { text };
    const res = await this.transport.request<LinkPreviewResponse>(Opcode.LINK_PREVIEW, req);
    return res.attachments;
  }

  /** Recent calls history (op 79). Newest first when `forward:false`. */
  async getCallHistory(
    opts: { count?: number; forward?: boolean; marker?: number } = {},
  ): Promise<CallHistoryEntry[]> {
    const req: CallHistoryRequest = {
      forward: opts.forward ?? false,
      count: opts.count ?? 100,
    };
    if (opts.marker !== undefined) req.marker = opts.marker;
    const res = await this.transport.request<CallHistoryResponse>(Opcode.CALL_HISTORY, req);
    return res.history;
  }

  /**
   * Allocate upload slot(s) (op 82). The same opcode serves video AND audio —
   * pass `{uploaderType, type}` to select the CDN.
   *
   * From on-the-wire capture of `ru.oneme.app` v26.15.1:
   *  - `{uploaderType:0, type:1}` → video (OK-CDN)
   *  - `{uploaderType:1, type:2}` → audio / voice note (`au.oneme.ru/uploadAudio`)
   *
   * **Transport routing**: when `{uploaderType, type}` is provided we route
   * through a short-lived mobile binary connection — the WS transport
   * ignores these fields and always hands back a video URL. Without them,
   * we keep the historical WS path (cheap, no extra TLS handshake).
   */
  async requestVideoUploadUrl(
    count = 1,
    opts: { uploaderType?: number; type?: number } = {},
  ): Promise<VideoUploadInfo[]> {
    const req: VideoUploadUrlRequest = { count };
    if (opts.uploaderType !== undefined) req.uploaderType = opts.uploaderType;
    if (opts.type !== undefined) req.type = opts.type;
    if (opts.uploaderType !== undefined || opts.type !== undefined) {
      return this.runOnMobileTransport((raw) =>
        raw.request<VideoUploadUrlResponse>(Opcode.VIDEO_UPLOAD_URL, req),
      ).then((r) => r.info);
    }
    const res = await this.transport.request<VideoUploadUrlResponse>(Opcode.VIDEO_UPLOAD_URL, req);
    return res.info;
  }

  /**
   * Open a short-lived mobile binary session (HELLO + LOGIN with the saved
   * `mobileLoginToken`), run `fn`, and close. Used for opcodes whose audio
   * / video variant is mobile-only (e.g. op 82 with `{uploaderType:1, type:2}`).
   *
   * Throws if the session has no `mobileLoginToken` — i.e. the user never
   * logged in via phone-auth on this client.
   */
  private async runOnMobileTransport<T>(fn: (raw: RawTransport) => Promise<T>): Promise<T> {
    const sess = await this.session.load();
    if (!sess.mobileLoginToken) {
      throw new Error(
        'Mobile transport unavailable: no mobileLoginToken in session. ' +
          'Audio / video uploads require a phone-auth login (MaxClient.loginWithPhone).',
      );
    }
    if (!sess.mobileDeviceId || !sess.mtInstanceId) {
      throw new Error('Mobile transport unavailable: missing mobileDeviceId / mtInstanceId in session.');
    }
    const raw = new RawTransport();
    try {
      await raw.connect();
      await raw.hello(sess.mobileDeviceId, sess.mtInstanceId);
      await raw.mobileLogin(sess.mobileLoginToken);
      return await fn(raw);
    } finally {
      raw.close();
    }
  }

  /**
   * Send a regular video message (any aspect, any length within MAX limits).
   *
   * Like {@link sendVoice}, the whole upload + MSG_SEND flow runs in a
   * single short-lived mobile-binary session — WS-issued tokens are not
   * valid for the mobile-side VIDEO attach lookup.
   *
   * Wire format (captured from `ru.oneme.app` v26.15.1):
   *   `{_type:'VIDEO', token, thumbhash?}`
   */
  async sendVideo(
    chatId: number,
    video: { data: Uint8Array | ArrayBuffer | Blob; filename?: string },
    caption = '',
    opts: { cid?: number; thumbhash?: Uint8Array } = {},
  ): Promise<MaxMessage> {
    return this.sendVideoInternal(chatId, video, caption, opts, /* note */ false);
  }

  /**
   * Send a circular "video note" — short clip, square aspect, ≤ 60 s, no
   * caption. Same wire-format as {@link sendVideo} but with the
   * `videoType: 1` flag that makes the recipient client render the
   * round-clip UI.
   */
  async sendVideoNote(
    chatId: number,
    video: { data: Uint8Array | ArrayBuffer | Blob; filename?: string },
    opts: { cid?: number; thumbhash?: Uint8Array } = {},
  ): Promise<MaxMessage> {
    return this.sendVideoInternal(chatId, video, '', opts, /* note */ true);
  }

  /**
   * Low-level: upload video bytes via op 82 + OK-CDN POST. Returns
   * `{token}`. The token is bound to the mobile session that issued it —
   * prefer {@link sendVideo} / {@link sendVideoNote} for the full E2E flow.
   */
  async uploadVideoBytes(
    file: { data: Uint8Array | ArrayBuffer | Blob; filename?: string },
  ): Promise<{ token: string }> {
    return this.runOnMobileTransport(async (raw) => {
      const slot = await raw.request<VideoUploadUrlResponse>(Opcode.VIDEO_UPLOAD_URL, {
        uploaderType: 0,
        type: 1,
        count: 1,
      });
      const info = slot.info?.[0];
      if (!info) throw new Error('No video upload slot returned');
      const { uploadOctetStream } = await import('./media.js');
      // Captured POST uses a negative-digit filename string (the mobile
      // client passes a Java `int` that overflowed once). We do the same
      // shape — random signed-int-looking digits — so the server's parser
      // is happy.
      const sniffName = `-${Math.floor(Math.random() * 2147483647)}`;
      await uploadOctetStream(info.url, file.data, sniffName, 'video');
      return { token: info.token };
    });
  }

  private async sendVideoInternal(
    chatId: number,
    video: { data: Uint8Array | ArrayBuffer | Blob; filename?: string },
    caption: string,
    opts: { cid?: number; thumbhash?: Uint8Array },
    note: boolean,
  ): Promise<MaxMessage> {
    const cid = opts.cid ?? -(Math.floor(Math.random() * 1e12));
    const thumbhash = opts.thumbhash ?? new Uint8Array(0);
    return this.runOnMobileTransport(async (raw) => {
      const slot = await raw.request<VideoUploadUrlResponse>(Opcode.VIDEO_UPLOAD_URL, {
        uploaderType: 0,
        type: 1,
        count: 1,
      });
      const info = slot.info?.[0];
      if (!info) throw new Error('No video upload slot returned');

      const { uploadOctetStream } = await import('./media.js');
      const sniffName = `-${Math.floor(Math.random() * 2147483647)}`;
      await uploadOctetStream(info.url, video.data, sniffName, 'video');

      const attach: Record<string, unknown> = {
        _type: 'VIDEO',
        token: info.token,
        thumbhash,
      };
      if (note) attach.videoType = 1;

      const send = await this.retryNotReady(() =>
        raw.request<{ message?: MaxMessage }>(Opcode.SEND_MESSAGE, {
          chatId,
          message: {
            cid,
            text: caption,
            attaches: [attach],
          },
          notify: true,
        }),
      );
      return (send.message ?? (send as unknown as MaxMessage)) as MaxMessage;
    });
  }

  // ====================================================================
  // Voice / audio messages — full mobile-binary E2E (op 82 audio variant
  // upload + au.oneme.ru POST + op 64 MSG_SEND, all in one TLS session)
  // ====================================================================

  /**
   * Send a voice / audio message.
   *
   * The whole flow (request audio upload URL → POST raw bytes →
   * MSG_SEND with the AUDIO attach) runs on a short-lived mobile binary
   * connection. WS-side tokens issued by `op 82 {uploaderType:1, type:2}`
   * are **not** valid for WS `op 64` — the back-end keeps separate session
   * scopes, so we have to stay on mobile binary for the whole exchange.
   *
   * Wire format (captured from `ru.oneme.app` v26.15.1):
   *   `{_type:'AUDIO', token, duration, wave?}`
   *
   * @param chatId   target chat. `0` for Saved Messages.
   * @param audio    `{data, filename?}` — bytes of the audio (any opus / ogg /
   *                 mp3 / m4a / aac). WAV PCM is rejected by the server
   *                 (`video.not.supported`).
   * @param opts     `durationMs` (**milliseconds** — the wire field is ms!)
   *                 OR `duration` (seconds — auto-multiplied by 1000); `wave`
   *                 — raw 80-byte waveform buffer (omit for flat waveform);
   *                 `cid` — client-side message id (auto-generated otherwise).
   */
  async sendVoice(
    chatId: number,
    audio: { data: Uint8Array | ArrayBuffer | Blob; filename?: string },
    opts: { duration?: number; durationMs?: number; wave?: Uint8Array; cid?: number } = {},
  ): Promise<MaxMessage> {
    const durationMs =
      opts.durationMs !== undefined
        ? opts.durationMs
        : opts.duration !== undefined
          ? Math.round(opts.duration * 1000)
          : 0;
    const cid = opts.cid ?? -(Math.floor(Math.random() * 1e12));

    // Compute a real 80-byte waveform via ffmpeg if the caller didn't
    // provide one — gives the recipient a proper bar UI instead of a flat
    // line. Falls back to zeros if ffmpeg isn't on PATH.
    let wave = opts.wave;
    if (!wave) {
      const { computeWaveform } = await import('./media.js');
      wave = (await computeWaveform(audio.data)) ?? new Uint8Array(80);
    }

    return this.runOnMobileTransport(async (raw) => {
      // 1. Allocate audio upload slot.
      const slot = await raw.request<VideoUploadUrlResponse>(Opcode.VIDEO_UPLOAD_URL, {
        uploaderType: 1,
        type: 2,
        count: 1,
      });
      const info = slot.info?.[0];
      if (!info) throw new Error('No audio upload slot returned');

      // 2. POST bytes to the signed au.oneme.ru/uploadAudio URL.
      const { uploadOctetStream } = await import('./media.js');
      const sniffName = String(Math.floor(Math.random() * 1e10));
      await uploadOctetStream(info.url, audio.data, sniffName);

      // 3. MSG_SEND with the AUDIO attach (still on the mobile session).
      //
      // Server-side audio ingest is async — straight after the HTTP POST,
      // `op 64` often returns `errors.process.attachment.video.not.ready`.
      // Retry with exponential backoff (≤ 8 s total). The mobile client
      // observably does the same in this race window.
      const send = await this.retryNotReady(() =>
        raw.request<{ message?: MaxMessage }>(Opcode.SEND_MESSAGE, {
          chatId,
          message: {
            cid,
            attaches: [
              {
                _type: 'AUDIO',
                token: info.token,
                duration: durationMs,
                wave,
              },
            ],
          },
          notify: true,
        }),
      );
      return (send.message ?? (send as unknown as MaxMessage)) as MaxMessage;
    });
  }

  /**
   * Retry helper for the `errors.process.attachment.video.not.ready` race
   * that occurs when MSG_SEND lands before the server finishes ingesting
   * the just-uploaded media. Attempts at 500ms, 1s, 2s, 4s (≈ 8s total).
   */
  private async retryNotReady<T>(fn: () => Promise<T>): Promise<T> {
    const delays = [500, 1000, 2000, 4000];
    let lastErr: unknown;
    for (let i = 0; i <= delays.length; i++) {
      try {
        return await fn();
      } catch (e) {
        lastErr = e;
        const msg = e instanceof Error ? e.message : String(e);
        if (!/not\.ready/i.test(msg)) throw e;
        if (i === delays.length) throw e;
        await new Promise((r) => setTimeout(r, delays[i]));
      }
    }
    throw lastErr;
  }

  /**
   * Upload an audio file via op 82 (audio variant) and return `{token}`.
   * **NOTE:** the returned `token` is bound to a mobile session — it is NOT
   * accepted by WS `op 64`. Use {@link sendVoice} for the full E2E send;
   * this method is kept for parity / low-level callers.
   */
  async uploadAudioBytes(
    file: { data: Uint8Array | ArrayBuffer | Blob; filename: string },
  ): Promise<{ token: string }> {
    return this.runOnMobileTransport(async (raw) => {
      const slot = await raw.request<VideoUploadUrlResponse>(Opcode.VIDEO_UPLOAD_URL, {
        uploaderType: 1,
        type: 2,
        count: 1,
      });
      const info = slot.info?.[0];
      if (!info) throw new Error('No audio upload slot returned');
      const { uploadOctetStream } = await import('./media.js');
      const sniffName = String(Math.floor(Math.random() * 1e10));
      await uploadOctetStream(info.url, file.data, sniffName);
      return { token: info.token };
    });
  }

  // ====================================================================
  // Location messages (op 64 with LOCATION attach)
  // ====================================================================

  /**
   * Send a geolocation message. Coordinates are validated server-side —
   * pass valid WGS-84 lat/lng. Optional `name`/`address` show as a labelled
   * preview alongside the map.
   */
  async sendLocation(
    chatId: number,
    latitude: number,
    longitude: number,
    opts: { name?: string; address?: string } = {},
  ): Promise<MaxMessage> {
    const attach: Record<string, unknown> = {
      _type: 'LOCATION',
      latitude,
      longitude,
    };
    if (opts.name !== undefined) attach.name = opts.name;
    if (opts.address !== undefined) attach.address = opts.address;
    return this.sendMessage(chatId, '', { attaches: [attach as MessageAttach] });
  }

  // ====================================================================
  // Miscellaneous helpers (transcribe, contact-search, bot, message-by-id)
  // ====================================================================

  /**
   * Fetch a single message by id from a chat (op 71 — MSG_GET).
   * Returns `undefined` if the message is not found or already deleted.
   */
  async getMessage(chatId: number, messageId: string): Promise<MaxMessage | undefined> {
    const res = await this.transport.request<{ messages?: MaxMessage[] }>(
      Opcode.MSG_GET,
      { chatId, messageIds: [messageId] },
    );
    return res.messages?.[0];
  }

  /**
   * Search your contacts by free-text (name / phone fragment) — op 37.
   * Server returns the best matches sorted by relevance.
   *
   * The server may key the array under different names depending on the
   * route (`contacts` for the contact-book search, `users` for the global
   * directory fallback). We coalesce both into a single array so callers
   * don't have to branch.
   */
  async searchContacts(query: string, count = 30): Promise<ContactInfo[]> {
    const res = await this.transport.request<Record<string, unknown>>(
      Opcode.CONTACT_SEARCH,
      { query, count },
    );
    const arr =
      (res.contacts as ContactInfo[] | undefined) ??
      (res.users as ContactInfo[] | undefined) ??
      (res.result as ContactInfo[] | undefined) ??
      [];
    return arr;
  }

  /**
   * Get the list of contacts you share with another user (op 38).
   * Different from {@link getCommonChats} — this is users you both know,
   * not chats you're both in.
   */
  async getMutualContacts(userId: number): Promise<ContactInfo[]> {
    const res = await this.transport.request<{ contacts: ContactInfo[] }>(
      Opcode.CONTACT_MUTUAL,
      { userId },
    );
    return res.contacts;
  }

  /**
   * Request audio-to-text transcription of a voice / audio message (op 202).
   * The actual transcription is computed asynchronously; the response is the
   * task acknowledgement. The finished transcript arrives via push op 293
   * (`NOTIF_TRANSCRIPTION`) which is forwarded as the `'raw'` event for now.
   */
  async transcribeMedia(chatId: number, messageId: string): Promise<void> {
    await this.transport.request(Opcode.TRANSCRIBE_MEDIA, { chatId, messageId });
  }

  /**
   * Fetch a bot's metadata + description (op 145).
   * `botId` is the user id of the bot account.
   */
  async getBotInfo(botId: number): Promise<unknown> {
    return this.transport.request(Opcode.BOT_INFO, { botId });
  }

  /**
   * List a bot's `/`-commands as configured by its owner via BotFather-like
   * flow (op 144).
   */
  async getBotCommands(botId: number, chatId?: number): Promise<unknown> {
    const req: Record<string, unknown> = { botId };
    if (chatId !== undefined) req.chatId = chatId;
    return this.transport.request(Opcode.CHAT_BOT_COMMANDS, req);
  }

  /**
   * Save a local draft to the server-side so it syncs across your devices
   * (op 176). `text` may be empty to clear; pass `cid` if echoing a message
   * that's being drafted.
   */
  async saveDraft(chatId: number, text: string, opts: { cid?: number } = {}): Promise<void> {
    const req: Record<string, unknown> = { chatId, draft: { text } };
    if (opts.cid !== undefined) (req.draft as Record<string, unknown>).cid = opts.cid;
    await this.transport.request(Opcode.DRAFT_SAVE, req);
  }

  /**
   * Discard the server-side draft for a chat (op 177).
   */
  async discardDraft(chatId: number): Promise<void> {
    await this.transport.request(Opcode.DRAFT_DISCARD, { chatId });
  }

  /**
   * Close a specific active session by id (op 97).
   * Use {@link listSessions} to discover ids. The current session can't be
   * closed via this op — use {@link logout} instead.
   */
  async closeSession(sessionId: number | string): Promise<void> {
    await this.transport.request(Opcode.SESSIONS_CLOSE, { sessionId });
  }

  // ====================================================================
  // High-level entry points (static factories)
  // ====================================================================

  /**
   * One-shot phone-number login with automatic web QR-bind.
   *
   * On first call:
   *  1. opens a mobile binary transport (TLS to api.oneme.ru:443)
   *  2. requests an SMS code (op 17) → calls `getSmsCode()`
   *  3. submits the code (op 18) → mobile LOGIN token (or 2FA challenge)
   *  4. if 2FA: calls `getPassword()` → submits via op 115
   *  5. completes the mobile session (op 19)
   *  6. opens a web WS and does QR-bind via op 290 ↔ ops 288/289/291
   *     (mobile transport plays the role of the "scanning device" — no
   *     camera, no other phone needed)
   *  7. saves both tokens to the session store and returns a ready
   *     {@link MaxClient} connected via WS.
   *
   * On subsequent calls: finds the saved web token and silently reconnects;
   * `getSmsCode` / `getPassword` are never invoked.
   *
   * ```ts
   * const client = await MaxClient.loginWithPhone({
   *   phone: '+79991234567',
   *   getSmsCode: async () => readline('SMS code: '),
   *   getPassword: async (challenge) => readline(`2FA (hint: ${challenge.hint}): `),
   *   sessionFile: './.max-session.json',
   * });
   * client.on('message', m => console.log(m.fromId, m.text));
   * await client.sendMessage(0, 'hi from phone-login');
   * ```
   */
  static async loginWithPhone(
    opts: PhoneLoginOptions & Omit<ClientOptions, 'deviceId' | 'loginToken'>,
  ): Promise<MaxClient> {
    const session = MaxClient.resolveSession(opts);
    const sess = await session.load();

    // Fresh login: run phone-auth + qr-bind, persist both tokens.
    if (!sess.loginToken) {
      if (!sess.mobileDeviceId || !sess.mtInstanceId) {
        throw new Error(
          'Session missing mobileDeviceId/mtInstanceId — delete the session file and retry.',
        );
      }

      const raw = new RawTransport(opts.debug ? { debug: true } : {});
      raw.on('error', (e) => {
        // Surface low-level transport errors to stderr — pending requests
        // also reject, but a TLS-level reset can fire before any request is
        // outstanding (e.g. server closes the socket after rate-limiting).
        // eslint-disable-next-line no-console
        console.error('[raw err]', (e as Error).message);
      });
      await raw.connect();
      // Cache the 2FA password so we only ask the user once even though
      // both mobile (op 115) and web (op 115) may need it.
      let cachedPassword: string | null = null;
      const askPassword = async (
        challenge: PasswordChallenge,
      ): Promise<string | null> => {
        if (cachedPassword !== null) return cachedPassword;
        if (!opts.getPassword) return null;
        const pw = await opts.getPassword(challenge);
        if (pw !== null && pw !== undefined && pw !== '') {
          cachedPassword = pw;
        }
        return pw ?? null;
      };
      try {
        await raw.hello(sess.mobileDeviceId, sess.mtInstanceId);

        let mobileToken = sess.mobileLoginToken;

        if (!mobileToken) {
          // ── Phone auth ──────────────────────────────────────────────
          const phone =
            typeof opts.phone === 'function' ? await opts.phone() : opts.phone;
          if (!phone) throw new Error('Phone number not provided — phone login aborted');
          const start = await sendPhoneAuthCode(raw, phone);
          const code = await opts.getSmsCode();
          if (!code) throw new Error('SMS code not provided — phone login aborted');
          const verify = await verifyPhoneAuthCode(raw, code, start.token);

          mobileToken = verify.tokenAttrs?.LOGIN?.token;

          if (!mobileToken && verify.passwordChallenge) {
            const pw = await askPassword(verify.passwordChallenge);
            if (!pw) {
              throw new Error(
                'Account has a 2FA cloud password — provide `getPassword` callback',
              );
            }
            const final = await raw.request<{ tokenAttrs: { LOGIN?: { token: string } } }>(
              Opcode.AUTH_QR_PASSWORD_LOGIN,
              { trackId: verify.passwordChallenge.trackId, password: pw },
              { prependOpHint: 0x33, flags: 1 },
            );
            mobileToken = final.tokenAttrs?.LOGIN?.token;
          }
          if (!mobileToken) {
            throw new Error('Mobile LOGIN token not issued — phone auth failed');
          }

          // ── Persist mobile token immediately ────────────────────────
          // If qr-bind fails below, the phone-auth work isn't wasted — next
          // run skips straight to qr-bind via the saved `mobileLoginToken`.
          await session.save({ ...sess, mobileLoginToken: mobileToken });
        } else if (opts.debug) {
          // eslint-disable-next-line no-console
          console.error('[loginWithPhone] resuming with saved mobileLoginToken, skipping phone-auth');
        }

        // ── Activate mobile session (op 19) so op 290 is allowed ────
        // eslint-disable-next-line no-console
        if (opts.debug) console.error('[loginWithPhone] mobileLogin (op 19)…');
        await raw.mobileLogin(mobileToken);

        // ── Settle the mobile socket: a PING + small delay lets server
        //     finish any deferred push events before we open the parallel
        //     web WS, which otherwise can trigger a server-side reset.
        // eslint-disable-next-line no-console
        if (opts.debug) console.error('[loginWithPhone] settle PING (op 1)…');
        await raw.request(Opcode.PING, { interactive: true }).catch(() => {/* tolerable */});
        await new Promise((r) => setTimeout(r, 800));

        // ── Web QR-bind (mobile op 290 ↔ web ops 288/289/291) ───────
        // eslint-disable-next-line no-console
        if (opts.debug) console.error('[loginWithPhone] qr-bind…');
        let bind;
        try {
          bind = await qrBindWebSession(raw, {
            webDeviceId: sess.deviceId,
            ...(opts.userAgent ? { webUserAgent: opts.userAgent } : {}),
            ...(opts.chatsCount !== undefined ? { chatsCount: opts.chatsCount } : {}),
            resolvePassword: askPassword,
          });
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error('[loginWithPhone] qr-bind FAILED:', (e as Error).message);
          // eslint-disable-next-line no-console
          console.error(
            '[loginWithPhone] Mobile token is saved — retry `MaxClient.loginWithPhone(...)` ' +
              'to resume qr-bind without re-entering SMS/2FA.',
          );
          throw e;
        }

        // ── Persist tokens ──────────────────────────────────────────
        const next: StoredSession = {
          ...sess,
          deviceId: bind.webDeviceId,
          loginToken: bind.webToken,
          mobileLoginToken: mobileToken,
          ownerId: bind.loginResponse.profile.contact.id,
        };
        await session.save(next);
      } finally {
        raw.close();
      }
    }

    // ── Open WS-based MaxClient with the (now persisted) web token ──
    const client = new MaxClient({
      ...opts,
      session,
      // We already have a token — never print QR / never invoke QR flow.
      printQr: false,
      printCredentialsAfterLogin: false,
    });
    await client.start();
    return client;
  }

  // --- internal ---

  private handlePush(frame: WireFrame): void {
    if (frame.opcode === Opcode.CHAT_UPDATE_PUSH) {
      const p = frame.payload as ChatUpdateNotify | undefined;
      if (p?.chat) {
        this.chats.set(p.chat.id, p.chat);
        this.emit('chatUpdate', p.chat);
      }
      return;
    }
    if (frame.opcode === Opcode.READ_MARK_PUSH) {
      const p = frame.payload as ReadMarkNotify | undefined;
      if (p) this.emit('readByOther', p);
      return;
    }
    if (frame.opcode === Opcode.CONFIG_HASH_PUSH) {
      const p = frame.payload as { config?: { hash?: string } } | undefined;
      if (p?.config?.hash) this.emit('configChanged', p.config.hash);
      return;
    }
    if (frame.opcode === Opcode.FILE_UPLOAD_DONE_PUSH) {
      const p = frame.payload as FileUploadDonePush | undefined;
      if (p) this.emit('fileUploadDone', p);
      return;
    }
    if (frame.opcode === Opcode.STICKER_RECENTS_PUSH) {
      const p = frame.payload as StickerRecentsPush | undefined;
      if (p) this.emit('stickerRecentsUpdate', p);
      return;
    }
    if (frame.opcode === Opcode.MEMBER_LEAVE_PUSH) {
      const p = frame.payload as MemberLeavePush | undefined;
      if (p) this.emit('memberLeave', p);
      return;
    }
    if (frame.opcode === Opcode.PRESENCE_PUSH) {
      const p = frame.payload as PresencePush | undefined;
      if (p) this.emit('presence', p);
      return;
    }
    if (frame.opcode === Opcode.PROFILE_UPDATE_PUSH) {
      const p = frame.payload as ProfileUpdatePush | undefined;
      const c = p?.profile?.contact;
      if (c) {
        if (this.me && c.id === this.me.id) this.me = c;
        this.emit('contactUpdate', c);
      }
      return;
    }
    if (frame.opcode === Opcode.MESSAGE_INCOMING) {
      const p = frame.payload as IncomingMessageNotify | undefined;
      if (!p?.message) return;
      // Ack the push so the server stops retrying.
      this.transport.ackPush(frame, { chatId: p.chatId, messageId: p.message.id });

      const evt: IncomingMessage = {
        chatId: p.chatId,
        messageId: p.message.id,
        text: p.message.text ?? '',
        fromId: p.message.sender,
        time: p.message.time,
        raw: p.message,
      };
      this.emit('message', evt);

      if (this.autoRead) {
        this.readMessage(p.chatId, p.message.id, p.message.time).catch((err) =>
          this.emit('error', err),
        );
      }
    }
  }

  private async rehandshake(): Promise<void> {
    const sess = await this.session.load();
    await hello(this.transport, sess.deviceId, this.userAgent);
    if (sess.loginToken) {
      await loginWithToken(this.transport, sess.loginToken, { chatsCount: this.chatsCount });
    }
  }
}
