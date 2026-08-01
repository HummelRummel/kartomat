const test = require('node:test');
const assert = require('node:assert/strict');
const {
  embedJpegComment,
  readJpegComment,
  readCreatorInfo,
  MAX_COMMENT_PAYLOAD_BYTES
} = require('../src/jpeg-comment-codec.js');

// Minimal-but-structurally-real JPEG bytes: SOI, an APP0/JFIF segment, SOS,
// a couple of bytes of fake entropy-coded "image data", then EOI. Good
// enough to exercise marker-walking without needing a real image decoder.
function fakeJpegBytes() {
  return new Uint8Array([
    0xff, 0xd8, // SOI
    0xff, 0xe0, 0x00, 0x10, // APP0, length 16
    0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
    0xff, 0xda, 0x00, 0x02, 0x00, // SOS, length 2 (empty scan header)
    0x12, 0x34, 0x56, // fake entropy-coded data
    0xff, 0xd9 // EOI
  ]);
}

function fakeJpegBlob() {
  return new Blob([fakeJpegBytes()], { type: 'image/jpeg' });
}

test('round-trip: embed a payload and read the same string back', async () => {
  const embedded = await embedJpegComment(fakeJpegBlob(), 'hello');
  const readBack = await readJpegComment(embedded);
  assert.equal(readBack, 'hello');
});

test('multi-byte UTF-8 payloads (umlauts, emoji) round-trip intact', async () => {
  const payload = 'Künstlername 🎨 äöüß';
  const embedded = await embedJpegComment(fakeJpegBlob(), payload);
  const readBack = await readJpegComment(embedded);
  assert.equal(readBack, payload);
});

test('output is a structurally valid JPEG: SOI intact, original data follows unchanged', async () => {
  const original = fakeJpegBytes();
  const embedded = await embedJpegComment(fakeJpegBlob(), 'hello');
  const bytes = new Uint8Array(await embedded.arrayBuffer());

  assert.equal(bytes[0], 0xff);
  assert.equal(bytes[1], 0xd8);

  // comment segment: FF FE <len hi> <len lo> <payload> — length is payload
  // bytes + 2, so total spliced bytes = 4 + payload.length
  const payloadLength = new TextEncoder().encode('hello').length;
  const segmentTotal = 4 + payloadLength;
  const tail = bytes.subarray(2 + segmentTotal);
  assert.deepEqual(tail, original.subarray(2));
});

test('reading a JPEG with no comment segment returns null', async () => {
  const result = await readJpegComment(fakeJpegBlob());
  assert.equal(result, null);
});

test('a truncated segment returns null rather than throwing', async () => {
  // SOI followed by a COM marker claiming a length far larger than the
  // bytes actually present.
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xfe, 0x00, 0xff, 0x01, 0x02]);
  const blob = new Blob([bytes], { type: 'image/jpeg' });
  const result = await readJpegComment(blob);
  assert.equal(result, null);
});

test('a malformed segment (bogus marker byte) returns null rather than throwing', async () => {
  const bytes = new Uint8Array([0xff, 0xd8, 0x00, 0x00, 0x00, 0x00]);
  const blob = new Blob([bytes], { type: 'image/jpeg' });
  const result = await readJpegComment(blob);
  assert.equal(result, null);
});

test('a payload that is not valid JSON yields null from the wrapper', async () => {
  const embedded = await embedJpegComment(fakeJpegBlob(), 'not json at all');
  const result = await readCreatorInfo(embedded);
  assert.equal(result, null);
});

test('the wrapper parses a well-formed payload into creator name and id', async () => {
  const payload = JSON.stringify({ n: 'Alex', id: 'abc-123' });
  const embedded = await embedJpegComment(fakeJpegBlob(), payload);
  const result = await readCreatorInfo(embedded);
  assert.deepEqual(result, { creatorName: 'Alex', creatorId: 'abc-123' });
});

test('a payload exceeding the segment size limit is rejected', async () => {
  const oversized = 'x'.repeat(MAX_COMMENT_PAYLOAD_BYTES + 1);
  const result = await embedJpegComment(fakeJpegBlob(), oversized);
  assert.equal(result, null);
});

test('a payload right at the segment size limit still embeds and round-trips', async () => {
  const maxSized = 'x'.repeat(MAX_COMMENT_PAYLOAD_BYTES);
  const embedded = await embedJpegComment(fakeJpegBlob(), maxSized);
  assert.notEqual(embedded, null);
  const readBack = await readJpegComment(embedded);
  assert.equal(readBack, maxSized);
});

test('empty and whitespace-only payloads round-trip predictably', async () => {
  const empty = await embedJpegComment(fakeJpegBlob(), '');
  assert.equal(await readJpegComment(empty), '');

  const whitespace = await embedJpegComment(fakeJpegBlob(), '   ');
  assert.equal(await readJpegComment(whitespace), '   ');
});
