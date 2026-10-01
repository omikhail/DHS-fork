import Schema from '@deepseek-ai/schemastery';

export const Config = Schema.object({
  baseURL: Schema.string()
    .default('http://localhost:9000')
    .description('Whisper ASR service URL (e.g. http://localhost:9000)'),
  language: Schema.string()
    .default('ru')
    .description('Language code for transcription (e.g. "ru", "en"). Empty for auto-detect.'),
  timeoutMs: Schema.natural()
    .default(30000)
    .description('Timeout for Whisper transcription request in milliseconds.'),
});