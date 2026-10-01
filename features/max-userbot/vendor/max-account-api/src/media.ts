import type { PhotoUploadHttpResponse } from './types.js';

/**
 * HTTP layer for media uploads / downloads.
 *
 * MAX uses out-of-band HTTPS endpoints for binary transfer:
 *  - photos:    POST  iu.oneme.ru/uploadImage  (multipart)
 *  - files:     POST  fu.oneme.ru/api/upload.do (raw body, content-range)
 *  - downloads: GET   fd.oneme.ru/getfile      (signed URL from op 88)
 *
 * The signed URLs are allocated via WebSocket opcodes 80 / 87 / 88. These
 * helpers do the actual HTTPS upload once you have those URLs.
 */

const DEFAULT_HEADERS = {
  Origin: 'https://web.max.ru',
  Referer: 'https://web.max.ru/',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
};

/**
 * Build a `Content-Disposition: attachment` value that survives Node's
 * fetch header encoding even when the filename contains non-ASCII.
 *
 * Node `fetch` rejects raw Unicode in headers (`Cannot convert argument
 * to a ByteString`) — every byte must be ≤ 0xFF. We exploit the universally-
 * accepted trick of encoding the UTF-8 bytes of the filename as a Latin-1
 * string: every UTF-8 byte is ≤ 0xFF, so the ByteString check passes; the
 * server reads the raw byte sequence and decodes it back as UTF-8.
 *
 * `fu.oneme.ru` confirmed to expect this exact shape — RFC 5987
 * `filename*=UTF-8''...` is not parsed and ends up displayed verbatim.
 */
function contentDisposition(filename: string, paramName: 'filename' | 'fileName' = 'filename'): string {
  // Pass non-ASCII safely. We tried two other shapes that the
  // `fu.oneme.ru` server mishandled:
  //  - RFC 5987 (`filename*=UTF-8''…`) → server stitched both `filename=`
  //    and `filename*=` parts into the displayed name (mojibake).
  //  - Raw UTF-8 bytes as a Latin-1 string → server interpreted bytes as
  //    Latin-1 and stored mojibake.
  // Percent-encoded UTF-8 in plain `filename=` works: the backend
  // auto-decodes `%XX` sequences back into the original UTF-8 string.
  const isAscii = /^[\x20-\x7e]*$/.test(filename);
  const value = isAscii ? filename : encodeURIComponent(filename);
  return `attachment; ${paramName}=${value}`;
}

/**
 * POST a photo to the URL returned by op 80 (`PHOTO_UPLOAD_URL`).
 * Returns the photo token to embed in profile / chat / message attaches.
 */
export async function uploadPhoto(
  uploadUrl: string,
  file: { data: Uint8Array | ArrayBuffer | Blob; filename: string; contentType?: string },
): Promise<PhotoUploadHttpResponse> {
  const form = new FormData();
  const blob =
    file.data instanceof Blob
      ? file.data
      : new Blob([file.data as unknown as ArrayBuffer], {
          type: file.contentType ?? 'application/octet-stream',
        });
  form.append('file', blob, file.filename);

  const res = await fetch(uploadUrl, { method: 'POST', body: form, headers: DEFAULT_HEADERS });
  if (!res.ok) throw new Error(`Photo upload failed: HTTP ${res.status} ${res.statusText}`);
  return (await res.json()) as PhotoUploadHttpResponse;
}

/**
 * Helper: pluck the single token out of a photo upload response. Throws if
 * there is no photo (e.g. server rejected the file).
 */
export function firstPhotoToken(res: PhotoUploadHttpResponse): string {
  const photoIds = Object.keys(res.photos ?? {});
  if (photoIds.length === 0) throw new Error('No photo in upload response');
  return res.photos[photoIds[0]!]!.token;
}

/**
 * POST a file (or chunk) to the URL returned by op 87 (`FILE_UPLOAD_URL`).
 *
 * If `total` is omitted it defaults to the chunk size (single-shot upload).
 * For chunked uploads, call this repeatedly with sliced data and matching
 * `start`/`total`. After the final chunk, the server pushes op 136
 * (`FILE_UPLOAD_DONE_PUSH`) over the WS confirming the file is ready.
 */
export async function uploadFile(
  uploadUrl: string,
  file: {
    data: Uint8Array | ArrayBuffer | Blob;
    filename: string;
    /** First byte index of this chunk in the full file. Default 0. */
    start?: number;
    /** Total file size. Default = chunk size. */
    total?: number;
  },
): Promise<void> {
  const bytes =
    file.data instanceof Blob
      ? new Uint8Array(await file.data.arrayBuffer())
      : file.data instanceof ArrayBuffer
        ? new Uint8Array(file.data)
        : file.data;
  const start = file.start ?? 0;
  const end = start + bytes.byteLength - 1;
  const total = file.total ?? bytes.byteLength;

  const res = await fetch(uploadUrl, {
    method: 'POST',
    body: bytes as unknown as ArrayBuffer,
    headers: {
      ...DEFAULT_HEADERS,
      'content-disposition': contentDisposition(file.filename),
      'content-range': `${start}-${end}/${total}`,
    },
  });
  if (!res.ok) throw new Error(`File upload failed: HTTP ${res.status} ${res.statusText}`);
}

/**
 * POST raw bytes to an `au.oneme.ru/uploadAudio` / OK-CDN upload URL —
 * the shape MAX mobile uses for audio + video uploads (different from the
 * multipart `uploadFile` path used by op 87).
 *
 * Captured from `ru.oneme.app` v26.15.1:
 *   POST <url-from-op82> HTTP/1.1
 *   Content-Type: application/octet-stream
 *   Content-Disposition: attachment; filename=<random-digits>
 *   <body = raw bytes of audio/video>
 *
 * The `filename` value is opaque on this endpoint (server ignores it for
 * dedup / mime sniffing — the signed `signatureToken` in the URL binds the
 * upload to a specific slot). We just send something digit-looking so the
 * server doesn't reject the header.
 */
export type OctetUploadVariant = 'audio' | 'video';

export async function uploadOctetStream(
  uploadUrl: string,
  data: Uint8Array | ArrayBuffer | Blob,
  filename: string,
  variant: OctetUploadVariant = 'audio',
): Promise<void> {
  const bytes =
    data instanceof Blob
      ? new Uint8Array(await data.arrayBuffer())
      : data instanceof ArrayBuffer
        ? new Uint8Array(data)
        : data;
  // The au.oneme.ru / OK-CDN upload endpoints validate against a
  // mobile-client header shape — sending web-client headers
  // (`Origin`, `Referer`, Mozilla UA) makes them return HTTP 412.
  // OK-CDN additionally **requires Content-Range** even for single-shot
  // uploads (without it: HTTP 412 + `x-reason: error.range_precondition`).
  // We mirror what `ru.oneme.app` v26.15.1 puts on the wire.
  //
  // Audio (au.oneme.ru/uploadAudio) and video (vu.okcdn.ru/upload.do)
  // expect slightly different headers — see `variant` branches below.
  const total = bytes.byteLength;
  const headers: Record<string, string> =
    variant === 'video'
      ? {
          // From captured `ru.oneme.app` v26.15.1 POST to vu.okcdn.ru:
          'Content-Type': 'application/x-binary; charset=x-user-defined',
          // NOTE: camelCase `fileName=` (not `filename=`) and quoted —
          // the server is strict about this exact form.
          'Content-Disposition': `attachment; fileName="${filename}"`,
          'Content-Range': `bytes 0-${total - 1}/${total}`,
          'X-Uploading-Mode': 'parallel',
          Connection: 'keep-alive',
        }
      : {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': contentDisposition(filename),
          'Content-Range': `bytes 0-${total - 1}/${total}`,
          'User-Agent':
            'OKMessages/26.15.1 (Android 14; Google sdk_gphone64_x86_64; 440dpi 440dpi 1080x2138)',
          'Accept-Encoding': 'gzip',
          Connection: 'keep-alive',
        };
  const res = await fetch(uploadUrl, {
    method: 'POST',
    body: bytes as unknown as ArrayBuffer,
    headers,
  });
  const respBody = await res.text().catch(() => '');
  if (!res.ok) {
    const respHeaders: Record<string, string> = {};
    res.headers.forEach((v, k) => {
      respHeaders[k] = v;
    });
    throw new Error(
      `Octet-stream upload failed: HTTP ${res.status} ${res.statusText}\n` +
        `  url=${uploadUrl}\n` +
        `  resp_headers=${JSON.stringify(respHeaders)}\n` +
        `  resp_body=${respBody.slice(0, 400)}`,
    );
  }
  // Sanity-check the body — captured mobile traffic shows `{}` on success.
  // Anything else (e.g. an error JSON) means the server accepted the
  // HTTP request but rejected the payload; surface it so callers can
  // diagnose `not.ready` / `not.supported` follow-ups.
  if (respBody && respBody.trim() && respBody.trim() !== '{}') {
    // Don't throw — server may return informative metadata; just log.
    // eslint-disable-next-line no-console
    console.error(`[uploadOctetStream] non-empty 200 body: ${respBody.slice(0, 300)}`);
  }
}

/**
 * Compute an 80-byte waveform (one byte per slice, 0–255 peak amplitude)
 * from arbitrary audio bytes by piping through ffmpeg.
 *
 * Requires `ffmpeg` in PATH. Returns `null` if ffmpeg is missing or fails —
 * callers can fall back to a flat (zero) waveform without losing the
 * voice-note delivery.
 *
 * @param data  any container ffmpeg can decode (opus / ogg / mp3 / m4a / wav).
 * @param bars  number of waveform slices. MAX uses 80.
 */
export async function computeWaveform(
  data: Uint8Array | ArrayBuffer | Blob,
  bars = 80,
): Promise<Uint8Array | null> {
  const bytes =
    data instanceof Blob
      ? new Uint8Array(await data.arrayBuffer())
      : data instanceof ArrayBuffer
        ? new Uint8Array(data)
        : data;
  const { spawn } = await import('node:child_process');
  return new Promise<Uint8Array | null>((resolve) => {
    let proc: ReturnType<typeof spawn>;
    try {
      proc = spawn(
        'ffmpeg',
        ['-i', 'pipe:0', '-ac', '1', '-ar', '8000', '-f', 's16le', 'pipe:1', '-loglevel', 'error'],
        { stdio: ['pipe', 'pipe', 'pipe'] },
      );
    } catch {
      resolve(null);
      return;
    }
    const chunks: Buffer[] = [];
    proc.stdout!.on('data', (c: Buffer) => chunks.push(c));
    proc.stderr!.on('data', () => {});
    proc.on('error', () => resolve(null));
    proc.on('close', (code) => {
      if (code !== 0) {
        resolve(null);
        return;
      }
      const pcm = Buffer.concat(chunks);
      const sampleCount = Math.floor(pcm.length / 2);
      if (sampleCount === 0) {
        resolve(null);
        return;
      }
      const samplesPerBar = Math.max(1, Math.floor(sampleCount / bars));
      const wave = new Uint8Array(bars);
      for (let i = 0; i < bars; i++) {
        const start = i * samplesPerBar;
        const end = Math.min(start + samplesPerBar, sampleCount);
        let peak = 0;
        for (let s = start; s < end; s++) {
          const sample = pcm.readInt16LE(s * 2);
          const abs = sample < 0 ? -sample : sample;
          if (abs > peak) peak = abs;
        }
        wave[i] = Math.min(255, Math.round((peak / 32767) * 255));
      }
      resolve(wave);
    });
    proc.stdin!.write(bytes);
    proc.stdin!.end();
  });
}

/**
 * GET a file from the signed URL returned by op 88 (`FILE_DOWNLOAD_URL`).
 * Returns the raw bytes — wrap with your own writeFile / streaming as needed.
 */
export async function downloadFile(downloadUrl: string): Promise<Uint8Array> {
  const res = await fetch(downloadUrl, { headers: DEFAULT_HEADERS });
  if (!res.ok) throw new Error(`File download failed: HTTP ${res.status} ${res.statusText}`);
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}
