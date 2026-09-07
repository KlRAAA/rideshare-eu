const { sniffImageType } = require('../imageType');

const pad = (head) => Buffer.concat([Buffer.from(head), Buffer.alloc(16)]);

describe('sniffImageType', () => {
  test('recognises a JPEG by its FF D8 FF header', () => {
    expect(sniffImageType(pad([0xff, 0xd8, 0xff, 0xe0]))).toEqual({ mime: 'image/jpeg', ext: 'jpg' });
  });

  test('recognises a PNG by its 8-byte signature', () => {
    expect(sniffImageType(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toEqual({
      mime: 'image/png',
      ext: 'png',
    });
  });

  test('recognises a WEBP by RIFF....WEBP', () => {
    const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.from([1, 2, 3, 4]), Buffer.from('WEBP'), Buffer.alloc(8)]);
    expect(sniffImageType(webp)).toEqual({ mime: 'image/webp', ext: 'webp' });
  });

  test('rejects a text file even if it would be named .jpg', () => {
    expect(sniffImageType(Buffer.from('this is definitely not an image, just text\n'))).toBeNull();
  });

  test('rejects a PDF', () => {
    expect(sniffImageType(pad([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]))).toBeNull(); // %PDF-1.4
  });

  test('rejects a GIF (not in the allowed set)', () => {
    expect(sniffImageType(pad(Buffer.from('GIF89a')))).toBeNull();
  });

  test('rejects an empty or too-short buffer', () => {
    expect(sniffImageType(Buffer.alloc(0))).toBeNull();
    expect(sniffImageType(Buffer.from([0xff, 0xd8]))).toBeNull();
    expect(sniffImageType(null)).toBeNull();
  });
});
