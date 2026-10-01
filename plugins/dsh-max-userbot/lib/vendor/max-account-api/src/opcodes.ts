/**
 * MAX protocol opcode catalogue.
 *
 * Source: extracted from decompiled `ru.oneme.app` (v26.15.1, build 6690) —
 * specifically the `exc` enum class. Numbers + canonical names match the
 * Android client's source-of-truth; the wire protocol uses the same numbers
 * over WS (`ws-api.oneme.ru/websocket`, JSON frames) and TLS
 * (`api.oneme.ru:443`, msgpack-+-LZ4 binary frames).
 *
 * **Transport overlap:**
 *  - **shared** ops (work on both transports): everything except auth/QR
 *    specifics. E.g. op 64 (MSG_SEND), op 49 (CHAT_HISTORY), op 128
 *    (NOTIF_MESSAGE), …
 *  - **mobile-only** (binary): 17 (AUTH_REQUEST), 18 (AUTH), 115
 *    (AUTH_LOGIN_CHECK_PASSWORD), 290 (AUTH_QR_APPROVE) — phone-auth +
 *    headless QR confirm.
 *  - **web-only** (WS): 288, 289, 291 — QR-code generation/poll/claim for a
 *    web device (the mobile enum doesn't include them; web client owns the
 *    QR side).
 *
 * **Backward compatibility:** every name that used to exist in this file is
 * kept as an alias to the same number — no breaking changes. New canonical
 * names from the decompilation are added alongside.
 */
export const Opcode = {
  // ───────── infra ─────────
  PING: 1,
  DEBUG: 2,
  RECONNECT: 3,
  LOG: 5,
  /** Alias of {@link Opcode.LOG}. */
  EVENT_LOG: 5,

  // ───────── session / auth ─────────
  SESSION_INIT: 6,
  /** Alias of {@link Opcode.SESSION_INIT}. */
  HELLO: 6,
  PROFILE: 16,
  /** Alias of {@link Opcode.PROFILE}. */
  PROFILE_UPDATE: 16,
  /**
   * Mobile phone-auth START (op 17). Body prefix: `f0 15` (START_AUTH) or
   * `f0 11` (RESEND). Returns short-lived `{token}` for op 18.
   */
  AUTH_REQUEST: 17,
  /** Alias of {@link Opcode.AUTH_REQUEST}. */
  PHONE_AUTH_START: 17,
  /**
   * Mobile phone-auth verify (op 18). Body prefix: `f0 ad`. Returns LOGIN
   * token or `passwordChallenge` for 2FA.
   */
  AUTH: 18,
  /** Alias of {@link Opcode.AUTH}. */
  PHONE_AUTH_VERIFY: 18,
  LOGIN: 19,
  LOGOUT: 20,
  SYNC: 21,
  CONFIG: 22,
  /** Alias of {@link Opcode.CONFIG}. */
  SETTINGS: 22,
  AUTH_CONFIRM: 23,
  AUTH_LOGIN_RESTORE_PASSWORD: 101,
  AUTH_2FA_DETAILS: 104,
  /** Alias of {@link Opcode.AUTH_2FA_DETAILS}. */
  AUTH_PASSWORD_INFO: 104,
  AUTH_VALIDATE_PASSWORD: 107,
  /** Alias of {@link Opcode.AUTH_VALIDATE_PASSWORD}. */
  AUTH_PASSWORD_VALIDATE: 107,
  AUTH_VALIDATE_HINT: 108,
  /** Alias of {@link Opcode.AUTH_VALIDATE_HINT}. */
  AUTH_PASSWORD_HINT: 108,
  AUTH_VERIFY_EMAIL: 109,
  /** Alias of {@link Opcode.AUTH_VERIFY_EMAIL}. */
  AUTH_EMAIL_SEND_CODE: 109,
  AUTH_CHECK_EMAIL: 110,
  /** Alias of {@link Opcode.AUTH_CHECK_EMAIL}. */
  AUTH_EMAIL_VERIFY_CODE: 110,
  AUTH_SET_2FA: 111,
  /** Alias of {@link Opcode.AUTH_SET_2FA}. */
  AUTH_PASSWORD_COMMIT: 111,
  AUTH_CREATE_TRACK: 112,
  /** Alias of {@link Opcode.AUTH_CREATE_TRACK}. */
  AUTH_TRACK_START: 112,
  AUTH_CHECK_PASSWORD: 113,
  /** Alias of {@link Opcode.AUTH_CHECK_PASSWORD}. */
  AUTH_PASSWORD_VERIFY: 113,
  /**
   * Op 115: submit a 2FA cloud password (mobile binary uses prefix `f0 33`,
   * flags=1). On mobile: completes phone-auth verifyCode → LOGIN token.
   * On web: completes QR-claim → LOGIN token. Same op, both paths.
   */
  AUTH_LOGIN_CHECK_PASSWORD: 115,
  /** Alias of {@link Opcode.AUTH_LOGIN_CHECK_PASSWORD}. */
  AUTH_QR_PASSWORD_LOGIN: 115,
  AUTH_LOGIN_PROFILE_DELETE: 116,
  /**
   * Op 290: **mobile** confirms a web-side QR-login (body `{qrLink}`, prefix
   * `f0 34`, flags=1). The web client's op 289 long-poll flips to
   * `loginAvailable:true` after this lands.
   */
  AUTH_QR_APPROVE: 290,
  /** Alias of {@link Opcode.AUTH_QR_APPROVE}. */
  QR_CONFIRM: 290,

  // ───────── assets (stickers / emoji / animoji) ─────────
  PRESET_AVATARS: 25,
  ASSETS_GET: 26,
  /** Alias of {@link Opcode.ASSETS_GET}. */
  STICKER_LIST: 26,
  ASSETS_UPDATE: 27,
  /** Alias of {@link Opcode.ASSETS_UPDATE}. */
  STICKER_SYNC: 27,
  ASSETS_GET_BY_IDS: 28,
  /**
   * @deprecated Mis-named alias of {@link Opcode.ASSETS_GET_BY_IDS} (op 28).
   * The canonical "contact info" op is **32** ({@link Opcode.CONTACT_INFO}).
   * Old name kept only so existing imports continue to compile; do not use
   * for new code.
   */
  CONTACT_INFO_LEGACY_28: 28,
  ASSETS_ADD: 29,
  /** Alias of {@link Opcode.ASSETS_ADD}. */
  STICKER_PACK_ACTION: 29,
  ASSETS_REMOVE: 259,
  ASSETS_MOVE: 260,
  ASSETS_LIST_MODIFY: 261,

  // ───────── contacts ─────────
  CONTACT_INFO: 32,
  /** Alias of {@link Opcode.CONTACT_INFO}. */
  CONTACTS_GET: 32,
  CONTACT_ADD: 33,
  CONTACT_UPDATE: 34,
  /**
   * @deprecated Mis-named alias of {@link Opcode.CONTACT_UPDATE} (op 34).
   * `CONTACT_ACTION` is the historic name used by helpers like
   * `contactAction(...)`; the canonical name is {@link Opcode.CONTACT_UPDATE}.
   */
  CONTACT_ACTION: 34,
  CONTACT_PRESENCE: 35,
  /** Alias of {@link Opcode.CONTACT_PRESENCE}. */
  PRESENCE_GET: 35,
  CONTACT_LIST: 36,
  /** Alias of {@link Opcode.CONTACT_LIST}. */
  CONTACTS_LIST_BY_STATUS: 36,
  CONTACT_SEARCH: 37,
  CONTACT_MUTUAL: 38,
  CONTACT_PHOTOS: 39,
  CONTACT_SORT: 40,
  CONTACT_ADD_BY_PHONE: 41,
  CONTACT_VERIFY: 42,
  REMOVE_CONTACT_PHOTO: 43,
  CONTACT_INFO_BY_PHONE: 46,
  /** Alias of {@link Opcode.CONTACT_INFO_BY_PHONE}. */
  CONTACT_LOOKUP_BY_PHONE: 46,

  // ───────── chats ─────────
  CHAT_INFO: 48,
  /** Alias of {@link Opcode.CHAT_INFO}. */
  CHATS_GET: 48,
  CHAT_HISTORY: 49,
  /** Alias of {@link Opcode.CHAT_HISTORY}. */
  HISTORY_GET: 49,
  CHAT_MARK: 50,
  /** Alias of {@link Opcode.CHAT_MARK}. */
  CHAT_EVENT: 50,
  CHAT_MEDIA: 51,
  /** Alias of {@link Opcode.CHAT_MEDIA}. */
  HISTORY_BY_ATTACH: 51,
  /**
   * Op 52: fully delete the chat (removes it from the list). Use op 54
   * ({@link Opcode.CHAT_CLEAR}) for clear-history-only.
   */
  CHAT_DELETE: 52,
  CHATS_LIST: 53,
  /** Alias of {@link Opcode.CHATS_LIST}. */
  CHATS_SYNC: 53,
  /**
   * Op 54: clear history of a chat without removing it. The pre-decompile
   * version of this file had op 52 and 54 SWAPPED. Use {@link Opcode.CHAT_DELETE}
   * (op 52) for full delete.
   */
  CHAT_CLEAR: 54,
  CHAT_UPDATE: 55,
  /** Alias of {@link Opcode.CHAT_UPDATE}. */
  CHAT_SETTINGS: 55,
  /** Op 56: resolve a public link without joining. */
  CHAT_CHECK_LINK: 56,
  /** Op 57: actually join a chat (after CHECK_LINK). */
  CHAT_JOIN: 57,
  /**
   * @deprecated Misleading alias: the pre-decompile name `CHAT_RESOLVE_LINK`
   * (op 57) actually performs **CHAT_JOIN**. Use {@link Opcode.CHAT_CHECK_LINK}
   * (op 56) if you only want to resolve.
   */
  CHAT_RESOLVE_LINK: 57,
  CHAT_LEAVE: 58,
  CHAT_MEMBERS: 59,
  /** Alias of {@link Opcode.CHAT_MEMBERS}. */
  MEMBERS_LIST: 59,
  PUBLIC_SEARCH: 60,
  /** Alias of {@link Opcode.PUBLIC_SEARCH}. */
  GLOBAL_SEARCH_BY_TYPE: 60,
  CHAT_PERSONAL_CONFIG: 61,
  CHAT_LIVESTREAM_INFO: 62,
  CHAT_CREATE: 63,
  CHAT_SEARCH: 68,
  /** Alias of {@link Opcode.CHAT_SEARCH}. */
  GLOBAL_SEARCH: 68,
  MSG_SEARCH_TOUCH: 72,
  /**
   * @deprecated Misleading alias: op 72 is `MSG_SEARCH_TOUCH` (focus the
   * chat for search), not "open chat". Renamed for accuracy.
   */
  CHAT_OPEN: 72,
  MSG_SEARCH: 73,
  /** Alias of {@link Opcode.MSG_SEARCH}. */
  MESSAGE_SEARCH: 73,
  MSG_GET_STAT: 74,
  /** Alias of {@link Opcode.MSG_GET_STAT}. */
  MESSAGE_STATS: 74,
  CHAT_SUBSCRIBE: 75,
  CHAT_MEMBERS_UPDATE: 77,
  /** Alias of {@link Opcode.CHAT_MEMBERS_UPDATE}. */
  GROUP_PARTICIPANTS: 77,
  CHAT_PIN_SET_VISIBILITY: 86,
  CHAT_COMPLAIN: 117,
  CHAT_HIDE: 196,
  CHAT_SEARCH_COMMON_PARTICIPANTS: 198,
  /** Alias of {@link Opcode.CHAT_SEARCH_COMMON_PARTICIPANTS}. */
  COMMON_CHATS: 198,
  CHAT_SUGGEST: 300,

  // ───────── messages ─────────
  MSG_SEND: 64,
  /** Alias of {@link Opcode.MSG_SEND}. */
  SEND_MESSAGE: 64,
  MSG_TYPING: 65,
  /** Alias of {@link Opcode.MSG_TYPING}. */
  TYPING: 65,
  MSG_DELETE: 66,
  /** Alias of {@link Opcode.MSG_DELETE}. */
  DELETE_MESSAGES: 66,
  MSG_EDIT: 67,
  /** Alias of {@link Opcode.MSG_EDIT}. */
  EDIT_MESSAGE: 67,
  MSG_SHARE_PREVIEW: 70,
  /** Alias of {@link Opcode.MSG_SHARE_PREVIEW}. */
  LINK_PREVIEW: 70,
  MSG_GET: 71,
  MSG_DELETE_RANGE: 92,
  MSG_SEND_CALLBACK: 118,
  MSG_REACTION: 178,
  /** Alias of {@link Opcode.MSG_REACTION}. */
  REACTION_SET: 178,
  MSG_CANCEL_REACTION: 179,
  /** Alias of {@link Opcode.MSG_CANCEL_REACTION}. */
  REACTION_REMOVE: 179,
  MSG_GET_REACTIONS: 180,
  /** Alias of {@link Opcode.MSG_GET_REACTIONS}. */
  REACTIONS_GET: 180,
  MSG_GET_DETAILED_REACTIONS: 181,
  /** Alias of {@link Opcode.MSG_GET_DETAILED_REACTIONS}. */
  REACTIONS_LIST: 181,
  MSG_DELIVERY: 303,

  // ───────── video calls (rtc signalling) ─────────
  VIDEO_CHAT_START: 76,
  VIDEO_CHAT_START_ACTIVE: 78,
  /**
   * @deprecated Op 78 is canonically `VIDEO_CHAT_START_ACTIVE`. The historic
   * `CALL_START` alias points at it for back-compat.
   */
  CALL_START: 78,
  VIDEO_CHAT_HISTORY: 79,
  /** Alias of {@link Opcode.VIDEO_CHAT_HISTORY}. */
  CALL_HISTORY: 79,
  VIDEO_CHAT_CREATE_JOIN_LINK: 84,
  VIDEO_CHAT_JOIN: 166,
  VIDEO_CHAT_MEMBERS: 195,
  GET_INBOUND_CALLS: 103,
  EXTERNAL_CALLBACK: 105,

  // ───────── media uploads ─────────
  PHOTO_UPLOAD: 80,
  /** Alias of {@link Opcode.PHOTO_UPLOAD}. */
  PHOTO_UPLOAD_URL: 80,
  STICKER_UPLOAD: 81,
  VIDEO_UPLOAD: 82,
  /** Alias of {@link Opcode.VIDEO_UPLOAD}. */
  VIDEO_UPLOAD_URL: 82,
  VIDEO_PLAY: 83,
  /** Alias of {@link Opcode.VIDEO_PLAY}. */
  EXTERNAL_VIDEO_RESOLVE: 83,
  FILE_UPLOAD: 87,
  /** Alias of {@link Opcode.FILE_UPLOAD}. */
  FILE_UPLOAD_URL: 87,
  FILE_DOWNLOAD: 88,
  /** Alias of {@link Opcode.FILE_DOWNLOAD}. */
  FILE_DOWNLOAD_URL: 88,
  LINK_INFO: 89,
  STICKER_CREATE: 193,
  STICKER_SUGGEST: 194,

  // ───────── sessions ─────────
  SESSIONS_INFO: 96,
  /** Alias of {@link Opcode.SESSIONS_INFO}. */
  SESSIONS_LIST: 96,
  SESSIONS_CLOSE: 97,
  PHONE_BIND_REQUEST: 98,
  PHONE_BIND_CONFIRM: 99,
  PHONE_WEBAPP_SHARE: 106,

  // ───────── location ─────────
  LOCATION_SEND: 125,
  LOCATION_REQUEST: 126,

  // ───────── mentions / drafts ─────────
  GET_LAST_MENTIONS: 127,
  DRAFT_SAVE: 176,
  /**
   * Op 177: discard a draft. The pre-decompile name
   * `PRESENCE_SUBSCRIBE: 177` was incorrect — that op actually exists, but
   * the WS protocol uses a different number for presence subscribe. Confirm
   * before using {@link Opcode.PRESENCE_SUBSCRIBE} below.
   */
  DRAFT_DISCARD: 177,
  /**
   * @deprecated The pre-decompile binding said this is op 177, but the
   * canonical Android enum slots `DRAFT_DISCARD` at 177. WS-side
   * `presence/subscribe` likely uses a different opcode — not yet verified.
   */
  PRESENCE_SUBSCRIBE: 177,

  // ───────── profile management ─────────
  PROFILE_DELETE: 199,
  PROFILE_DELETE_TIME: 200,
  /**
   * @deprecated The pre-decompile name `KEEPALIVE_TS: 200` was wrong —
   * op 200 is `PROFILE_DELETE_TIME`, not a keep-alive. Use op 1 ({@link
   * Opcode.PING}) for keep-alive. Kept for back-compat only.
   */
  KEEPALIVE_TS: 200,

  // ───────── push events (server → client) ─────────
  NOTIF_MESSAGE: 128,
  /** Alias of {@link Opcode.NOTIF_MESSAGE}. */
  MESSAGE_INCOMING: 128,
  NOTIF_TYPING: 129,
  /**
   * @deprecated Wrong canonical name. Op 129 is `NOTIF_TYPING`, not
   * `MEMBER_LEAVE_PUSH`. Renamed via deprecation; old name kept for compat.
   */
  MEMBER_LEAVE_PUSH: 129,
  NOTIF_MARK: 130,
  /** Alias of {@link Opcode.NOTIF_MARK}. */
  READ_MARK_PUSH: 130,
  NOTIF_CONTACT: 131,
  NOTIF_PRESENCE: 132,
  /** Alias of {@link Opcode.NOTIF_PRESENCE}. */
  PRESENCE_PUSH: 132,
  NOTIF_CONFIG: 134,
  /** Alias of {@link Opcode.NOTIF_CONFIG}. */
  CONFIG_HASH_PUSH: 134,
  NOTIF_CHAT: 135,
  /** Alias of {@link Opcode.NOTIF_CHAT}. */
  CHAT_UPDATE_PUSH: 135,
  NOTIF_ATTACH: 136,
  /** Alias of {@link Opcode.NOTIF_ATTACH}. */
  FILE_UPLOAD_DONE_PUSH: 136,
  NOTIF_CALL_START: 137,
  NOTIF_CONTACT_SORT: 139,
  NOTIF_MSG_DELETE_RANGE: 140,
  NOTIF_MSG_DELETE: 142,
  NOTIF_CALLBACK_ANSWER: 143,
  NOTIF_LOCATION: 147,
  NOTIF_LOCATION_REQUEST: 148,
  NOTIF_ASSETS_UPDATE: 150,
  /** Alias of {@link Opcode.NOTIF_ASSETS_UPDATE}. */
  STICKER_RECENTS_PUSH: 150,
  NOTIF_DRAFT: 152,
  NOTIF_DRAFT_DISCARD: 153,
  NOTIF_MSG_DELAYED: 154,
  NOTIF_MSG_REACTIONS_CHANGED: 155,
  NOTIF_MSG_YOU_REACTED: 156,
  NOTIF_PROFILE: 159,
  /** Alias of {@link Opcode.NOTIF_PROFILE}. */
  PROFILE_UPDATE_PUSH: 159,
  NOTIF_FOLDERS: 277,
  NOTIF_BANNERS: 292,
  /** Alias of {@link Opcode.NOTIF_BANNERS}. */
  BANNERS: 292,
  NOTIF_TRANSCRIPTION: 293,

  // ───────── bots / web apps ─────────
  CHAT_BOT_COMMANDS: 144,
  BOT_INFO: 145,
  WEB_APP_INIT_DATA: 160,
  /** Alias of {@link Opcode.WEB_APP_INIT_DATA}. */
  BOT_MINI_APP_OPEN: 160,

  // ───────── complaints ─────────
  COMPLAIN: 161,
  COMPLAIN_REASONS_GET: 162,
  /** Alias of {@link Opcode.COMPLAIN_REASONS_GET}. */
  COMPLAINS_SYNC: 162,

  // ───────── tokens / 3rd-party ─────────
  /**
   * Op 158: short-lived OK-group access token (~14-min lifetime). Used to
   * authenticate HTTP requests to `i.oneme.ru` / `videowebrtc.okcdn.ru`.
   * Refresh before `token_refresh_ts`.
   */
  OK_TOKEN: 158,
  /** Alias of {@link Opcode.OK_TOKEN}. */
  WEB_TOKEN: 158,

  // ───────── transcribe / audio ─────────
  TRANSCRIBE_MEDIA: 202,
  AUDIO_PLAY: 301,

  // ───────── org / banners ─────────
  ORG_INFO: 256,
  BANNERS_GET: 302,

  // ───────── reactions config ─────────
  CHAT_REACTIONS_SETTINGS_SET: 257,
  /** Alias of {@link Opcode.CHAT_REACTIONS_SETTINGS_SET}. */
  CHAT_REACTIONS_SETTINGS: 257,
  REACTIONS_SETTINGS_GET_BY_CHAT_ID: 258,
  /** Alias of {@link Opcode.REACTIONS_SETTINGS_GET_BY_CHAT_ID}. */
  CHAT_REACTIONS_SETTINGS_GET: 258,

  // ───────── folders ─────────
  FOLDERS_GET: 272,
  /** Alias of {@link Opcode.FOLDERS_GET}. */
  FOLDERS_SYNC: 272,
  FOLDERS_GET_BY_ID: 273,
  FOLDERS_UPDATE: 274,
  /** Alias of {@link Opcode.FOLDERS_UPDATE}. */
  FOLDER_UPSERT: 274,
  FOLDERS_REORDER: 275,
  /**
   * Op 276: **delete** a folder. The pre-decompile name `FOLDERS_ORDER: 276`
   * was wrong — reorder lives at op 275 ({@link Opcode.FOLDERS_REORDER}).
   */
  FOLDERS_DELETE: 276,
  /**
   * @deprecated Pre-decompile alias. Op 276 is **FOLDERS_DELETE**, not
   * "reorder". For reordering use {@link Opcode.FOLDERS_REORDER} (op 275).
   */
  FOLDERS_ORDER: 276,

  // ───────── polls ─────────
  SEND_VOTE: 304,
  /** Alias of {@link Opcode.SEND_VOTE}. */
  POLL_VOTE: 304,
  VOTERS_LIST_BY_ANSWER: 305,
  GET_POLL_UPDATES: 306,
  /** Alias of {@link Opcode.GET_POLL_UPDATES}. */
  POLL_GET: 306,

  // ───────── web-only (not in mobile enum) ─────────
  /** Web WS: request a fresh QR session (returns `{qrLink, trackId, ttl}`). */
  QR_START: 288,
  /** Web WS: long-poll for `loginAvailable:true` flip. */
  QR_POLL: 289,
  /** Web WS: claim LOGIN token after `loginAvailable:true`. */
  QR_LOGIN: 291,
} as const;

export type OpcodeValue = (typeof Opcode)[keyof typeof Opcode];

export const Cmd = {
  REQUEST: 0,
  RESPONSE: 1,
  ERROR: 3,
} as const;

export const PROTOCOL_VERSION = 11;
