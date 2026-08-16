export function parseWavInfo(buffer) {
  if (buffer.length < 44) {
    throw new Error('Invalid WAV file: header too short.');
  }

  const riff = buffer.toString('ascii', 0, 4);
  const wave = buffer.toString('ascii', 8, 12);

  if (riff !== 'RIFF' || wave !== 'WAVE') {
    throw new Error('Invalid WAV file: missing RIFF/WAVE header.');
  }

  const channels = buffer.readUInt16LE(22);
  const sampleRate = buffer.readUInt32LE(24);
  const bitDepth = buffer.readUInt16LE(34);

  return {
    format: 'WAV',
    codec: 'PCM',
    channels,
    sampleRate,
    bitDepth,
    sizeBytes: buffer.length,
  };
}
