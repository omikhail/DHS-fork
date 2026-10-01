/**
 * Plugin configuration. Secrets are credential refs only.
 */
import Schema from '@deepseek-ai/schemastery';

export const DEFAULT_DEVICE_ID_REF = 'MAX_USERBOT_DEVICE_ID';
export const DEFAULT_LOGIN_TOKEN_REF = 'MAX_USERBOT_LOGIN_TOKEN';

export const Config = Schema.object({
    enabled: Schema.boolean()
        .default(true)
        .description('Whether the MAX userbot connection starts with the harness.'),
    deviceIdRef: Schema.string()
        .default(DEFAULT_DEVICE_ID_REF)
        .description('Credential reference for the MAX device id after QR login.'),
    loginTokenRef: Schema.string()
        .default(DEFAULT_LOGIN_TOKEN_REF)
        .description('Credential reference for the MAX login token.'),
    appVersion: Schema.string()
        .default('26.32.1')
        .description('MAX client app version (must match vendored max-account-api fork).'),
    allowPhones: Schema.array(Schema.string())
        .default([])
        .description('Whitelist of phone numbers (E.164 or digits). Empty with empty allowFrom denies everyone.'),
    allowFrom: Schema.array(Schema.number())
        .default([])
        .description('Optional MAX user ids allowed without a phone match.'),
    agentPreset: Schema.string()
        .default('')
        .description('Agent preset for new MAX conversations; empty uses the deployment default.'),
    cwd: Schema.string()
        .default('')
        .description('Default working directory when a chat has no /cd override.'),
    reply: Schema.object({
        maxChars: Schema.natural()
            .default(4000)
            .description('Maximum characters per outbound MAX message; longer replies are chunked.'),
    }),
});
