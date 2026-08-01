// JPEG comment codec — embeds/reads a small text payload in a JPEG's COM
// segment, spliced immediately after the start-of-image (SOI) marker.
//
// Segment layout: 0xFF 0xFE <len hi> <len lo> <payload bytes>
// `len` counts itself (2 bytes) plus the payload bytes — it does NOT count
// the 0xFF 0xFE marker pair. It is a byte count, not a character count,
// which matters the moment the payload contains multi-byte UTF-8.

const MARKER_SOI = 0xd8;
const MARKER_EOI = 0xd9;
const MARKER_SOS = 0xda;
const MARKER_COM = 0xfe;
const MARKER_TEM = 0x01;

const MAX_SEGMENT_LENGTH = 0xffff; // segment length field is a 2-byte uint
const MAX_COMMENT_PAYLOAD_BYTES = MAX_SEGMENT_LENGTH - 2;

function isLengthlessMarker(marker) {
  return marker === MARKER_TEM || (marker >= 0xd0 && marker <= 0xd7);
}

async function embedJpegComment(blob, text) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const payloadBytes = new TextEncoder().encode(text);
  const segmentLength = payloadBytes.length + 2;
  if (segmentLength > MAX_SEGMENT_LENGTH) return null;

  const segment = new Uint8Array(2 + segmentLength);
  segment[0] = 0xff;
  segment[1] = MARKER_COM;
  segment[2] = (segmentLength >> 8) & 0xff;
  segment[3] = segmentLength & 0xff;
  segment.set(payloadBytes, 4);

  return new Blob([bytes.subarray(0, 2), segment, bytes.subarray(2)], { type: 'image/jpeg' });
}

async function readJpegComment(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (bytes.length < 2 || bytes[0] !== 0xff || bytes[1] !== MARKER_SOI) return null;

  let offset = 2;
  while (offset + 1 < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1];

    if (marker === MARKER_EOI || marker === MARKER_SOS) return null;
    if (isLengthlessMarker(marker)) {
      offset += 2;
      continue;
    }

    if (offset + 3 >= bytes.length) return null; // truncated before length field
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (length < 2) return null; // malformed: length field must count itself

    const segmentEnd = offset + 2 + length;
    if (segmentEnd > bytes.length) return null; // truncated segment body

    if (marker === MARKER_COM) {
      const payloadBytes = bytes.subarray(offset + 4, segmentEnd);
      return new TextDecoder('utf-8').decode(payloadBytes);
    }
    offset = segmentEnd;
  }
  return null;
}

async function readCreatorInfo(blob) {
  const raw = await readJpegComment(blob);
  if (raw == null) return null;

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  if (typeof parsed.n !== 'string' || typeof parsed.id !== 'string') return null;

  return { creatorName: parsed.n, creatorId: parsed.id };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    embedJpegComment,
    readJpegComment,
    readCreatorInfo,
    MAX_COMMENT_PAYLOAD_BYTES
  };
}
