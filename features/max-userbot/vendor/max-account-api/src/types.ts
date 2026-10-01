/**
 * Wire-level types — direct mirrors of MAX WebSocket payloads.
 * Version 11 of protocol observed at wss://ws-api.oneme.ru/websocket.
 */

export interface WireFrame<P = unknown> {
  ver: number;
  cmd: 0 | 1 | 3;
  seq: number;
  opcode: number;
  payload?: P;
}

export interface UserAgent {
  deviceType: 'WEB' | 'ANDROID' | 'IOS' | 'DESKTOP';
  locale: string;
  deviceLocale: string;
  osVersion: string;
  deviceName: string;
  headerUserAgent: string;
  appVersion: string;
  screen: string;
  timezone: string;
  /** Mobile-only. CPU arch — observed `x86_64` / `arm64-v8a`. */
  arch?: string;
  /** Mobile-only. Numeric build of the native app (e.g. 6690 for v26.15.1). */
  buildNumber?: number;
  /** Mobile-only. Set when FCM push channel is provisioned (e.g. `GCM`). */
  pushDeviceType?: string;
}

export interface HelloRequest {
  userAgent: UserAgent;
  deviceId: string;
}

// --------------------------------------------------------------------------
// Phone auth (ops 17, 18) — captured from Android mobile client
// --------------------------------------------------------------------------

export type PhoneAuthStartType = 'START_AUTH' | 'RESEND';

export interface PhoneAuthStartRequest {
  type: PhoneAuthStartType;
  phone: string;
}

/** Server returns a short-lived token used in PhoneAuthVerifyRequest. */
export interface PhoneAuthStartResponse {
  token: string;
  /** Seconds until the SMS code expires. */
  ttl?: number;
  /** Length of the expected SMS code (usually 5). */
  codeLength?: number;
}

export interface PhoneAuthVerifyRequest {
  verifyCode: string;
  token: string;
  /** Observed constant `'CHECK_CODE'` on mobile op 18. */
  authTokenType?: 'CHECK_CODE';
}

/** Success: LOGIN token; failure: server throws `{error:'verify.code.wrong'}`. */
export interface PhoneAuthVerifyResponse {
  tokenAttrs: { LOGIN?: { token: string } };
  profile?: { profileOptions: unknown[]; contact: ContactInfo };
  passwordChallenge?: PasswordChallenge;
}

export interface HelloResponse {
  'phone-auth-enabled': boolean;
  location: string;
  lang: boolean;
  'reg-country-code': string[];
}

export interface QrStartResponse {
  pollingInterval: number;
  qrLink: string;
  ttl: number;
  trackId: string;
  expiresAt: number;
}

export interface QrPollResponse {
  /** Server omits `loginAvailable` until the QR is confirmed; it then becomes `true`. */
  status: { loginAvailable?: boolean; expiresAt: number };
}

/**
 * Op 290 — sent by the **mobile** binary transport to confirm a web-side QR
 * login. The `qrLink` is the value from the web-side {@link QrStartResponse}.
 *
 * MAX's camera-scan path eventually calls into the same op with the decoded
 * URL. Doing it programmatically (no camera) is the basis of
 * {@link import('./qr-bind.js').qrBindWebSession}.
 *
 * Wire prefix: `f0 34` (op-hint), `flags=1`. Response is an empty ACK.
 */
export interface QrConfirmRequest {
  qrLink: string;
}

export interface QrLoginResponse {
  /** Empty `{}` when 2FA cloud password is enabled and `passwordChallenge` is set instead. */
  tokenAttrs: { LOGIN?: { token: string } };
  profile?: { profileOptions: unknown[]; contact: ContactInfo };
  /** Present when account has 2FA cloud password — caller must finish via op 115. */
  passwordChallenge?: PasswordChallenge;
}

export interface PasswordChallenge {
  config: { passMaxLen: number; passMinLen: number; hintMaxLen: number };
  trackId: string;
  /** Masked email (e.g. `m****@g****.com`). */
  email: string;
  /** User-set hint string (shown to the user as a reminder for their password). */
  hint?: string;
}

// --------------------------------------------------------------------------
// Auth: cloud password / email-track / 2FA management (ops 104, 107–115)
// --------------------------------------------------------------------------

export interface AuthTrackStartRequest {
  /** Observed value: 0 (start cloud-password track). */
  type: number;
}
export interface AuthTrackStartResponse {
  trackId: string;
}

export interface AuthPasswordInfoRequest {
  trackId: string;
}
export interface AuthPasswordInfoResponse {
  password: { enabled: boolean; email?: string };
}

export interface AuthPasswordValidateRequest {
  trackId: string;
  password: string;
}

export interface AuthPasswordHintRequest {
  trackId: string;
  hint: string;
}

export interface AuthEmailSendCodeRequest {
  trackId: string;
  email: string;
}
export interface AuthEmailSendCodeResponse {
  trackId: string;
  blockingDuration: number;
  codeLength: number;
}

export interface AuthEmailVerifyCodeRequest {
  trackId: string;
  verifyCode: string;
}
export interface AuthEmailVerifyCodeResponse {
  trackId: string;
  /** Masked email confirming which account got verified. */
  email: string;
}

export interface AuthPasswordCommitRequest {
  trackId: string;
  /** Server-side capability list. Observed `[0,3,4]` for set, `[5]` for remove. */
  expectedCapabilities: number[];
  password?: string;
  hint?: string;
  /** Pass `true` (with `expectedCapabilities:[5]`) to disable 2FA. */
  remove2fa?: boolean;
}

export interface AuthPasswordVerifyRequest {
  trackId: string;
  password: string;
}
export interface AuthPasswordVerifyResponse {
  trackId: string;
}

/** Op 115: complete QR login when account has 2FA cloud password. */
export interface AuthQrPasswordLoginRequest {
  trackId: string;
  password: string;
}
export interface AuthQrPasswordLoginResponse {
  tokenAttrs: { LOGIN: { token: string } };
  profile?: { profileOptions: unknown[]; contact: ContactInfo };
}

// --------------------------------------------------------------------------
// Misc new ops (52, 53, 57, 70, 79, 82, 158)
// --------------------------------------------------------------------------

export interface ChatClearRequest {
  chatId: number;
  /** Wipe everything up to this server-time ms. */
  lastEventTime: number;
  /** `true` clears for all participants (admin only); `false` clears for self. */
  forAll: boolean;
}

export interface ChatsSyncRequest {
  /** Last `modified` timestamp seen by the client; server returns chats updated after. */
  marker: number;
}
export interface ChatsSyncResponse {
  chats: MaxChat[];
}

export interface ChatResolveLinkRequest {
  /** Full max.ru URL (`https://max.ru/<slug>` or `https://max.ru/:invite/<token>`). */
  link: string;
}
export interface ChatResolveLinkResponse {
  chat: MaxChat;
}

export interface LinkPreviewRequest {
  text: string;
}
export interface LinkPreviewResponse {
  attachments: MessageAttach[];
}

export interface VideoUploadInfo {
  url: string;
  videoId: number;
  token: string;
  uploaderType?: number;
}
/**
 * Op 82 request. The same opcode serves **video** and **audio** uploads —
 * the `(uploaderType, type)` pair selects the back-end CDN:
 *  - `uploaderType: 0, type: 1` → regular video (returns OK-CDN URL)
 *  - `uploaderType: 1, type: 2` → audio / voice note (returns `au.oneme.ru/uploadAudio` URL)
 *
 * Values from on-the-wire capture of `ru.oneme.app` v26.15.1.
 */
export interface VideoUploadUrlRequest {
  count: number;
  uploaderType?: number;
  type?: number;
}
export interface VideoUploadUrlResponse {
  info: VideoUploadInfo[];
}

export interface CallHistoryRequest {
  /** `false` paginates backward through past calls. */
  forward: boolean;
  count: number;
  /** Optional cursor; pass `forwardMarker` from previous response. */
  marker?: number;
}
export interface CallHistoryEntry {
  chatId: number;
  chatType: string;
  message: MaxMessage;
}
export interface CallHistoryResponse {
  forwardMarker?: number;
  history: CallHistoryEntry[];
}

export interface WebTokenResponse {
  token: string;
  /** Absolute ms when the token must be refreshed. */
  token_refresh_ts: number;
  /** Absolute ms when the token finally expires. */
  token_lifetime_ts: number;
}

// --------------------------------------------------------------------------
// New push payloads (op 129, 132, 159)
// --------------------------------------------------------------------------

export interface MemberLeavePush {
  chatId: number;
  userId: number;
}

export interface PresencePush {
  userId: number;
  presence: { seen: number; status: number };
}

export interface ProfileUpdatePush {
  profile: { profileOptions: unknown[]; contact: ContactInfo };
}

export interface ContactName {
  name: string;
  firstName?: string;
  lastName?: string;
  type: 'ONEME' | 'CUSTOM';
}

export interface ContactInfo {
  id: number;
  registrationTime: number;
  accountStatus: number;
  country?: string;
  names: ContactName[];
  phone?: number;
  options?: string[];
  photoId?: number;
  description?: string;
  baseUrl?: string;
  baseRawUrl?: string;
  updateTime: number;
}

export interface MessageElement {
  type: 'STRONG' | 'EMPHASIZED' | 'UNDERLINE' | 'STRIKETHROUGH' | 'MONOSPACED' | 'LINK' | 'MENTION' | 'HEADING';
  length: number;
  from?: number;
  attributes?: Record<string, unknown>;
}

export interface MessageAttach {
  _type: string;
  [key: string]: unknown;
}

export interface MessageLink {
  type: 'REPLY' | 'FORWARD';
  messageId?: string;
  chatId?: number;
  message?: MaxMessage;
}

export interface ReactionCounter {
  count: number;
  reaction: string;
}

export interface ReactionInfo {
  counters?: ReactionCounter[];
  yourReaction?: string;
  totalCount?: number;
}

/**
 * Статус жизненного цикла, который сервер проставляет в конверт сообщения,
 * когда **повторно рассылает уже доставленное** сообщение, а не присылает
 * новое. У обычного, впервые доставленного сообщения `status` **отсутствует**.
 *
 * Подтверждённые значения (из реальных дампов трафика):
 *  - `'EDITED'`  — изменён текст / вложения (приходит в ответе op 67 `MSG_EDIT`
 *    и ре-броадкастом через op 128 `NOTIF_MESSAGE`).
 *  - `'REMOVED'` — сообщение удалено для всех; сервер ре-броадкастит тот же
 *    конверт через op 128 `NOTIF_MESSAGE`, поэтому оно прилетает в событие
 *    `message` как «надгробие» (ср. {@link MaxChat.status}).
 *
 * Набор значений **не** исчерпывающий — бэкенд может присылать и другие токены,
 * которые мы пока не наблюдали. Ветка `(string & {})` сохраняет автокомплит в
 * редакторе для известных литералов, но при этом принимает любую будущую
 * строку без ошибки типа — потребителям не нужно делать каст.
 */
export type MessageStatus = 'EDITED' | 'REMOVED' | (string & {});

export interface MaxMessage {
  id: string;
  cid?: number;
  sender: number;
  time: number;
  text?: string;
  type: 'USER' | 'SYSTEM' | 'CONTROL';
  elements?: MessageElement[];
  attaches?: MessageAttach[];
  options?: number;
  link?: MessageLink;
  reactionInfo?: ReactionInfo;
  /**
   * Присутствует только когда это ре-броадкаст уже существующего сообщения
   * (правка / удаление); у только что отправленного сообщения его нет.
   * См. {@link MessageStatus}.
   *
   * Удаление сообщения «для всех» ре-броадкастится тем же опкодом 128, поэтому
   * прилетает в `client.on('message', …)` со `status: 'REMOVED'`. Чтобы
   * пропускать правки и «надгробия», поставь в обработчике `if (m.raw.status) return;`.
   */
  status?: MessageStatus;
  /** Серверный ms-таймстемп последней правки / смены статуса. Идёт вместе со `status`. */
  updateTime?: number;
}

export interface OutgoingMessage {
  text: string;
  cid: number;
  elements?: MessageElement[];
  attaches?: MessageAttach[];
  link?: MessageLink;
}

export interface SendMessageRequest {
  chatId: number;
  message: OutgoingMessage;
  notify: boolean;
}

export interface SendMessageResponse {
  chatId: number;
  message: MaxMessage;
  unread: number;
  mark: number;
}

export interface IncomingMessageNotify {
  chatId: number;
  unread: number;
  message: MaxMessage;
  ttl: boolean;
  mark: number;
  prevMessageId?: string;
}

export interface ChatParticipants {
  [userId: string]: number;
}

export interface MaxChat {
  id: number;
  cid?: number;
  type: 'DIALOG' | 'CHAT' | 'CHANNEL';
  status?: 'ACTIVE' | 'REMOVED';
  owner?: number;
  joinTime?: number;
  created?: number;
  modified?: number;
  lastEventTime?: number;
  lastMessage?: MaxMessage;
  participants?: ChatParticipants;
  participantsCount?: number;
  newMessages?: number;
  prevMessageId?: string;
  hasBots?: boolean;
  options?: Record<string, boolean>;
  restrictions?: number;
  /** Group-only fields (present on op 55 / 77 responses). */
  title?: string;
  description?: string;
  link?: string;
  access?: 'PRIVATE' | 'PUBLIC';
  pinnedMessage?: MaxMessage;
  adminParticipants?: Record<string, { permissions: number; inviterId?: number; promotedAt?: number }>;
}

export interface LoginRequest {
  token: string;
  chatsCount: number;
  interactive: boolean;
  chatsSync: number;
  contactsSync: number;
  presenceSync: number;
  draftsSync: number;
}

export interface LoginResponse {
  profile: { profileOptions: unknown[]; contact: ContactInfo };
  chats: MaxChat[];
  contacts: ContactInfo[];
  token: string;
  config: { server: Record<string, unknown>; user: Record<string, unknown> };
  hash: string;
  experiments: Record<string, string | boolean | number>;
  presence: Record<string, unknown>;
  messages: Record<string, unknown>;
  time: number;
}

export interface ReadMessageRequest {
  type: 'READ_MESSAGE';
  chatId: number;
  messageId: string;
  mark: number;
}

export interface HistoryRequest {
  chatId: number;
  from: number;
  forward: number;
  backward: number;
  getMessages: boolean;
}

export interface HistoryResponse {
  messages: MaxMessage[];
}

export interface TypingRequest {
  chatId: number;
  type: 'TEXT' | 'AUDIO' | 'PHOTO' | 'FILE';
}

export interface SubscribeRequest {
  chatId: number;
  subscribe: boolean;
}

export interface ReactionSetRequest {
  chatId: number;
  messageId: string;
  reaction: { reactionType: 'EMOJI'; id: string };
}

export interface ReactionSetResponse {
  reactionInfo: ReactionInfo;
}

export interface ReactionsGetRequest {
  chatId: number;
  messageIds: string[];
}

export interface ReactionsGetResponse {
  messagesReactions: Record<string, ReactionInfo>;
}

export interface GroupParticipantsRequest {
  chatId: number;
  userIds: number[];
  operation: 'add' | 'remove';
  /** Present when adjusting admin role. Omit for plain member ops. */
  type?: 'ADMIN';
  /** Bitmask of admin permissions. 255 = all. Required when operation=add+type=ADMIN. */
  permissions?: number;
  /** Show last messages to newly added member. */
  showHistory?: boolean;
  /** Seconds of recent history to wipe when kicking. 0 = keep. */
  cleanMsgPeriod?: number;
}

export interface GroupParticipantsResponse {
  chat: MaxChat;
}

export interface CommonChatsRequest {
  userIds: number[];
}

export interface CommonChatsResponse {
  hasMore: boolean;
  commonChats: MaxChat[];
}

export interface MessageSearchRequest {
  chatId: number;
  query: string;
  count: number;
}

export interface MessageSearchHit {
  message: MaxMessage;
  highlights: string[];
}

export interface MessageSearchResponse {
  result: MessageSearchHit[];
  ucpQId: string;
  total?: number;
}

export interface ChatUpdateNotify {
  chat: MaxChat;
}

export interface ReadMarkNotify {
  setAsUnread: boolean;
  chatId: number;
  userId: number;
  mark: number;
}

export interface CreateGroupAttach extends MessageAttach {
  _type: 'CONTROL';
  event: 'new';
  chatType: 'CHAT' | 'CHANNEL';
  title: string;
  userIds: number[];
}

export interface DeleteMessagesRequest {
  chatId: number;
  messageIds: string[];
  /** true = delete only on this device; false = delete for all participants. */
  forMe: boolean;
}

export interface DeleteMessagesResponse {
  chatId: number;
  messageIds: string[];
}

export interface EditMessageRequest {
  chatId: number;
  messageId: string;
  text: string;
  elements?: MessageElement[];
  /** Server expects key `attachments`, NOT `attaches`. Keep wire field as-is. */
  attachments?: MessageAttach[];
}

export interface EditMessageResponse {
  /** Эхо изменённого сообщения — со `status: 'EDITED'` и свежим `updateTime`. */
  message: MaxMessage;
}

export interface ReactionRemoveRequest {
  chatId: number;
  messageId: string;
}

export interface ReactionsListRequest {
  chatId: number;
  messageId: string;
  count: number;
}

/**
 * Group settings (op 55). One call per "field group". Use shape variants:
 *   { options: { ALL_CAN_PIN_MESSAGE: false } }
 *   { theme, description }                              // rename / set bio
 *   { pinMessageId, notifyPin }                         // pin a message
 *
 * `theme` is the displayed group title — server kept the legacy field name.
 */
export interface ChatSettingsOptions {
  OFFICIAL?: boolean;
  ONLY_OWNER_CAN_CHANGE_ICON_TITLE?: boolean;
  ONLY_ADMIN_CAN_CALL?: boolean;
  COMMENTS?: boolean;
  SENT_BY_PHONE?: boolean;
  CONFIRM_BEFORE_SEND?: boolean;
  A_PLUS_CHANNEL?: boolean;
  ALL_CAN_PIN_MESSAGE?: boolean;
  SIGN_ADMIN?: boolean;
  MESSAGE_COPY_NOT_ALLOWED?: boolean;
  ONLY_ADMIN_CAN_ADD_MEMBER?: boolean;
  MEMBERS_CAN_SEE_PRIVATE_LINK?: boolean;
  /** Channel join requires admin approval. */
  JOIN_REQUEST?: boolean;
}

export interface ChatSettingsRequest {
  chatId: number;
  options?: ChatSettingsOptions;
  theme?: string;
  description?: string;
  pinMessageId?: string;
  notifyPin?: boolean;
  /** Avatar token (from PHOTO upload). Setting on group/channel updates icon. */
  photoToken?: string;
  /** Rotate / regenerate the private invite link. */
  revokePrivateLink?: boolean;
}

export interface ChatSettingsResponse {
  chat: MaxChat;
}

export interface ChatReactionsSettingsRequest {
  chatId: number;
  /** false = reactions disabled in chat; true = enabled. */
  value: boolean;
  /** Reactions per message limit (server default 2). */
  count?: number;
  /** Allowed emojis when `included=true`; ignored when reactions disabled. */
  reactionIds?: string[];
  /** true = only `reactionIds` allowed; false = all reactions allowed. */
  included?: boolean;
}

export interface ChatReactionsSettings {
  chatId: number;
  count: number;
  updateTime: number;
  isActive: boolean;
  included: boolean;
  reactionIds: string[];
}

export interface ChatReactionsSettingsResponse {
  chatReactionsSettings: ChatReactionsSettings;
}

export interface WebTokenResponse {
  token: string;
  token_lifetime_ts: number;
  token_refresh_ts: number;
}

/**
 * Public domain types used in events emitted by the high-level Client.
 */
export interface IncomingMessage {
  chatId: number;
  messageId: string;
  text: string;
  fromId: number;
  time: number;
  raw: MaxMessage;
}

export interface ClientEvents {
  ready: () => void;
  message: (msg: IncomingMessage) => void;
  raw: (frame: WireFrame) => void;
  error: (err: Error) => void;
  close: (code: number, reason: string) => void;
  reconnect: (attempt: number) => void;
  qr: (info: { link: string; expiresAt: number }) => void;
  login: (profile: ContactInfo) => void;
  /** Server pushed an updated chat snapshot (op 135). */
  chatUpdate: (chat: MaxChat) => void;
  /** Other participant read up to a mark in a chat (op 130). */
  readByOther: (info: ReadMarkNotify) => void;
  /** Server bumped the user-config hash (op 134) — re-fetch settings if cared. */
  configChanged: (hash: string) => void;
  /** Background HTTP file upload finished server-side (op 136). */
  fileUploadDone: (info: { fileId: number | string }) => void;
  /** Sticker pack / recents updated (op 150). */
  stickerRecentsUpdate: (info: StickerRecentsPush) => void;
  /** A user left a group / left chat (op 129). */
  memberLeave: (info: MemberLeavePush) => void;
  /** Presence (online / last-seen) update for a subscribed contact (op 132). */
  presence: (info: PresencePush) => void;
  /** Profile fields of a known contact changed (op 159). */
  contactUpdate: (contact: ContactInfo) => void;
}

// --------------------------------------------------------------------------
// Profile (op 16)
// --------------------------------------------------------------------------

export interface ProfileUpdateRequest {
  firstName?: string;
  lastName?: string;
  description?: string;
  /** Token from PHOTO upload (op 80 + HTTP) when setting avatar. */
  photoToken?: string;
  /** Required when sending photoToken. */
  avatarType?: 'USER_AVATAR';
}

export interface ProfileUpdateResponse {
  profile: { profileOptions: unknown[]; contact: ContactInfo };
}

// --------------------------------------------------------------------------
// Settings (op 22)
// --------------------------------------------------------------------------

/** Per-chat settings: mute, sound, etc. */
export interface ChatNotificationSettings {
  /** -1 = mute forever, 0 = unmuted, future ts = muted until. */
  dontDisturbUntil?: number;
  led?: boolean;
  vibr?: boolean;
  sound?: string;
  favIndex?: number;
}

/** Subset of user-level setting keys (server has many more). */
export interface UserSettings {
  SEARCH_BY_PHONE?: 'ALL' | 'CONTACTS' | 'NOBODY';
  INCOMING_CALL?: 'ALL' | 'CONTACTS' | 'NOBODY';
  CHATS_INVITE?: 'ALL' | 'CONTACTS' | 'NOBODY';
  CONTENT_LEVEL_ACCESS?: boolean;
  HIDDEN?: boolean;
  PHONE_NUMBER_PRIVACY?: 'ALL' | 'CONTACTS' | 'NOBODY';
  PUSH_SOUND?: string;
  INACTIVE_TTL?: number;
  SHOW_READ_MARK?: boolean;
  DOUBLE_TAP_REACTION_DISABLED?: boolean;
  SAFE_MODE_NO_PIN?: boolean;
  FAMILY_PROTECTION?: boolean;
  PUSH_DETAILS?: boolean;
  PUSH_NEW_CONTACTS?: boolean;
  UNSAFE_FILES?: boolean;
  CHATS_PUSH_NOTIFICATION?: boolean;
  CHATS_PUSH_SOUND?: string;
  M_CALL_PUSH_NOTIFICATION?: boolean;
  DONT_DISTURB_UNTIL?: number;
  [key: string]: unknown;
}

export interface SettingsRequest {
  settings: {
    chats?: Record<string, ChatNotificationSettings>;
    user?: UserSettings;
  };
}

export interface SettingsResponse {
  chats?: Record<string, ChatNotificationSettings>;
  user?: UserSettings;
  hash?: string;
}

// --------------------------------------------------------------------------
// Sessions (op 96)
// --------------------------------------------------------------------------

export interface ActiveSession {
  client: string;
  location?: string;
  current?: boolean;
  time: number;
  info?: string;
}

export interface SessionsListResponse {
  sessions: ActiveSession[];
}

// --------------------------------------------------------------------------
// Contacts (op 34, 36, 41, 46)
// --------------------------------------------------------------------------

export type ContactActionType = 'REMOVE' | 'UPDATE' | 'BLOCK' | 'UNBLOCK';

export interface ContactActionRequest {
  contactId: number;
  action: ContactActionType;
  firstName?: string;
  lastName?: string;
}

export interface ContactActionResponse {
  contact?: ContactInfo;
}

export interface ContactsListByStatusRequest {
  status: 'BLOCKED' | 'ACTIVE' | string;
  count: number;
  from: number;
}

export interface ContactsListByStatusResponse {
  contacts: ContactInfo[];
}

export interface ContactAddByPhoneRequest {
  phone: string;
  firstName?: string;
  lastName?: string;
}

export interface ContactAddByPhoneResponse {
  new: boolean;
  contact: ContactInfo;
}

export interface ContactLookupByPhoneRequest {
  phone: string;
}

export interface ContactLookupByPhoneResponse {
  contact: ContactInfo;
}

// --------------------------------------------------------------------------
// History by attach (op 51)
// --------------------------------------------------------------------------

export type AttachFilterType = 'PHOTO' | 'VIDEO' | 'FILE' | 'AUDIO' | 'SHARE';

export interface HistoryByAttachRequest {
  chatId: number;
  messageId: string;
  attachTypes: AttachFilterType[];
  forward: number;
  backward: number;
}

export interface HistoryByAttachResponse {
  messages: MaxMessage[];
  total?: number;
}

// --------------------------------------------------------------------------
// Chat delete / leave / members (op 54, 58, 59)
// --------------------------------------------------------------------------

export interface ChatDeleteRequest {
  chatId: number;
  forAll: boolean;
  lastEventTime: number;
}

export interface ChatLeaveRequest {
  chatId: number;
}

export interface ChatLeaveResponse {
  message: MaxMessage;
}

export interface MembersListRequest {
  chatId: number;
  type: 'MEMBER' | 'ADMIN';
  marker: number;
  count: number;
}

export interface MemberEntry {
  presence?: { seen?: number; status?: string };
  contact: ContactInfo;
}

export interface MembersListResponse {
  members: MemberEntry[];
}

// --------------------------------------------------------------------------
// Global search (op 60, 68)
// --------------------------------------------------------------------------

export type GlobalSearchSection =
  | 'PUBLIC_CHATS'
  | 'USERS'
  | 'PRIVATE_CHATS'
  | 'CHANNELS'
  | 'GROUPS'
  | 'BOTS'
  | 'ALL';

export interface GlobalSearchRequest {
  query: string;
  count: number;
  marker?: string;
  type?: GlobalSearchSection;
}

export interface GlobalSearchHit {
  section?: GlobalSearchSection;
  highlights?: string[];
  chatId?: number;
  chat?: MaxChat;
  contact?: ContactInfo;
}

export interface GlobalSearchResponse {
  result: GlobalSearchHit[];
  counters?: Record<string, number>;
  total?: number;
  ucpQId?: string;
  marker?: string;
}

// --------------------------------------------------------------------------
// Message stats (op 74)
// --------------------------------------------------------------------------

export interface MessageStatsRequest {
  chatId: number;
  messageIds: string[];
}

export interface MessageStatsResponse {
  stats: Record<string, { views: number }>;
}

// --------------------------------------------------------------------------
// Calls (op 78)
// --------------------------------------------------------------------------

/** Inner JSON serialised into `internalParams` string when starting a call. */
export interface CallInternalParams {
  deviceId: string;
  sdkVersion: string;
  clientAppKey: string;
  platform: 'WEB' | 'ANDROID' | 'IOS' | 'DESKTOP';
  protocolVersion: number;
  domainId: string;
  capabilities: string;
}

export interface CallStartRequest {
  conversationId: string;
  calleeIds: number[];
  /** JSON-stringified `CallInternalParams`. */
  internalParams: string;
  isVideo: boolean;
}

export interface CallStartResponse {
  conversationId: string;
  /** JSON-stringified server-side params (WebRTC endpoint, token, TURN). */
  internalCallerParams: string;
}

/** Parsed shape of `internalCallerParams`. */
export interface CallCallerParams {
  id: { internal: string | number; external: string | number };
  isConcurrent?: boolean;
  endpoint: string;
  wtEndpoint?: string;
  clientType: string;
  turn?: Array<{ urls: string | string[]; username?: string; credential?: string }>;
}

// --------------------------------------------------------------------------
// File / photo / video / sticker (op 29, 80, 83, 87, 88, 136, 150)
// --------------------------------------------------------------------------

export interface PhotoUploadUrlRequest {
  count: number;
}

export interface PhotoUploadUrlResponse {
  url: string;
}

/** Server response from HTTP photo upload (POST iu.oneme.ru/uploadImage). */
export interface PhotoUploadHttpResponse {
  photos: Record<string, { token: string }>;
}

export interface FileUploadUrlRequest {
  count: number;
}

export interface FileUploadInfo {
  url: string;
  fileId: number;
  token: string;
}

export interface FileUploadUrlResponse {
  info: FileUploadInfo[];
}

export interface FileDownloadUrlRequest {
  fileId: number;
  chatId: number;
  messageId: string;
}

export interface FileDownloadUrlResponse {
  unsafe: boolean;
  url: string;
}

export interface ExternalVideoResolveRequest {
  videoId: string;
  token: string;
  chatId: number;
  messageId: string;
}

export interface ExternalVideoResolveResponse {
  EXTERNAL?: string;
  cache?: boolean;
  MP4_1080?: string;
  MP4_720?: string;
  MP4_480?: string;
  MP4_240?: string;
  [quality: string]: string | boolean | undefined;
}

export interface FileUploadDonePush {
  fileId: number | string;
}

export type StickerPackActionType = 'FAVORITE_STICKER_SET' | 'UNFAVORITE_STICKER_SET' | string;

export interface StickerPackActionRequest {
  type: StickerPackActionType;
  id: number | string;
}

export interface StickerPackActionResponse {
  success: boolean;
  updateTime: number;
}

export interface StickerRecentsPush {
  recentsList?: Array<{ type: string; id?: number | string; stickerId?: number | string }>;
  type?: string;
  emojiList?: string[];
  recentEmojiList?: string[];
  updateType?: 'ADDED' | 'REMOVED';
  id?: number | string;
  position?: number;
  sync?: number;
}

// --------------------------------------------------------------------------
// Outgoing attaches: photo / file / sticker / contact / poll
// --------------------------------------------------------------------------

export interface PhotoAttach extends MessageAttach {
  _type: 'PHOTO';
  photoToken: string;
}

export interface FileAttach extends MessageAttach {
  _type: 'FILE';
  fileId: number | string;
}

export interface StickerAttach extends MessageAttach {
  _type: 'STICKER';
  stickerId: number | string;
}

export interface ContactAttach extends MessageAttach {
  _type: 'CONTACT';
  contactId: number;
}

export interface PollAttach extends MessageAttach {
  _type: 'POLL';
  title: string;
  answers: Array<{ text: string }>;
  /** Bitmask: 4 = anonymous, 12 = anon+publicly visible voters, etc. */
  settings: number;
}

/**
 * Voice / audio message attach.
 *
 * Wire format (confirmed by on-the-wire capture of `ru.oneme.app` v26.15.1):
 *  - `_type: 'AUDIO'`
 *  - `token`: the **only** identifier — returned by the audio upload (op 82
 *    with `{uploaderType:1, type:2}` → POST to `au.oneme.ru/uploadAudio`).
 *    No `fileId` / `videoId` / `audioId` field is sent on the wire.
 *  - `duration`: in **milliseconds** (not seconds)
 *  - `wave`: raw 80-byte waveform energy buffer (one byte per slice)
 */
export interface AudioAttach extends MessageAttach {
  _type: 'AUDIO';
  token: string;
  duration: number;
  wave?: Uint8Array;
}

/**
 * Video attach.
 *
 * Wire format (confirmed by on-the-wire capture of `ru.oneme.app` v26.15.1):
 *  - `_type: 'VIDEO'`
 *  - `token`: returned by the upload (op 82 with `{uploaderType:0, type:1}`
 *    → POST to OK CDN). No `videoId` / `fileId` is sent in the attach.
 *  - `videoType`: `1` → circular **video note**; absent / `0` → regular clip
 *  - `thumbhash`: raw bytes (may be empty `b''`) — preview hash
 *
 * Use {@link MaxClient.sendVideo} or {@link MaxClient.sendVideoNote}.
 */
export interface VideoAttach extends MessageAttach {
  _type: 'VIDEO';
  token: string;
  videoType?: number;
  thumbhash?: Uint8Array;
  duration?: number;
  width?: number;
  height?: number;
}

/**
 * Geolocation attach (op 64 with `_type:'LOCATION'`). The receiver client
 * shows a map preview centred at the coords.
 */
export interface LocationAttach extends MessageAttach {
  _type: 'LOCATION';
  latitude: number;
  longitude: number;
  /** Optional human-readable label (e.g. "Red Square"). */
  name?: string;
  /** Optional street address. */
  address?: string;
}

// --------------------------------------------------------------------------
// Polls (op 304, 306)
// --------------------------------------------------------------------------

export interface PollAnswerInfo {
  answerId: number;
  text?: string;
  options?: number;
  votes?: Array<{ userId: number; timestamp: number }>;
  voteCount?: number;
  rate?: number;
}

export interface PollState {
  result: PollAnswerInfo[];
  voterPreviewIds?: number[];
  total: number;
}

export interface PollVoteRequest {
  chatId: number;
  messageId: string;
  pollId: number | string;
  answersIds: number[];
}

export interface PollVoteResponse {
  state: PollState;
}

export interface PollGetRequest {
  chatId: number;
  polls: Array<{ messageId: string; pollId: number | string }>;
}

export interface PollInfo {
  pollId: number | string;
  _type: 'POLL';
  title: string;
  settings: number;
  version: number;
  answers: PollAnswerInfo[];
  state: PollState;
}

export interface PollGetResponse {
  polls: PollInfo[];
}

// --------------------------------------------------------------------------
// Bot mini-app + complaints (op 160, 162)
// --------------------------------------------------------------------------

export interface BotMiniAppOpenRequest {
  botId: number;
  chatId: number;
}

export interface BotMiniAppOpenResponse {
  query_id?: string;
  url: string;
}

export interface ComplainReason {
  reasonTitle: string;
  reasonId: number | string;
}

export interface ComplainCategory {
  typeId: number;
  reasons: ComplainReason[];
}

export interface ComplainsSyncResponse {
  complains: ComplainCategory[];
  complainSync: number;
}

// --------------------------------------------------------------------------
// Folders (op 273, 274, 276)
// --------------------------------------------------------------------------

export interface ChatFolder {
  id: string;
  sourceId?: string;
  options: number[];
  filters: number[];
  updateTime: number;
  title: string;
  include?: number[];
  favorites?: number[];
}

export interface FoldersGetRequest {
  folderIds: string[];
}

export interface FoldersGetResponse {
  folders: ChatFolder[];
}

export interface FolderUpsertRequest {
  id: string;
  title: string;
  include: number[];
  filters: number[];
  options: number[];
  favorites: number[];
}

export interface FolderUpsertResponse {
  folderSync?: number;
  folder: ChatFolder;
  foldersOrder?: string[];
}

export interface FoldersOrderRequest {
  folderIds: string[];
}

export interface FoldersOrderResponse {
  foldersOrder: string[];
  folderSync?: number;
}

// --------------------------------------------------------------------------
// Reactions settings batch get (op 258)
// --------------------------------------------------------------------------

export interface ChatReactionsSettingsGetRequest {
  chatIds: number[];
}

export interface ChatReactionsSettingsGetResponse {
  chatReactionsSettings: ChatReactionsSettings[];
}

// --------------------------------------------------------------------------
// Event log (op 5) — fire-and-forget analytics
// --------------------------------------------------------------------------

export interface EventLogItem {
  type: string;
  userId?: number;
  time?: number;
  sessionId?: string;
  event: string;
  params?: Record<string, unknown>;
}

export interface EventLogRequest {
  events: EventLogItem[];
}

// --------------------------------------------------------------------------
// Chat settings — extra fields observed on op 55 for channels.
// (kept in addition to the original ChatSettingsRequest above)
// --------------------------------------------------------------------------
