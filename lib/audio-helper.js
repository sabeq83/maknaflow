/**
 * Menambahkan header RIFF WAV ke buffer PCM 16-bit linear mono
 * @param {Buffer} pcmBuffer - Data PCM mentah dari Gemini
 * @param {number} sampleRate - Frekuensi sampling (Default Gemini: 24000)
 * @returns {Buffer} Buffer WAV utuh siap simpan/putar
 */
export function convertPcmToWav(pcmBuffer, sampleRate = 24000) {
  const wavHeader = Buffer.alloc(44);
  const numChannels = 1; // Mono
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmBuffer.length;
  const chunkSize = 36 + dataSize;

  // RIFF Header
  wavHeader.write('RIFF', 0);
  wavHeader.writeUInt32LE(chunkSize, 4);
  wavHeader.write('WAVE', 8);

  // FMT Sub-chunk
  wavHeader.write('fmt ', 12);
  wavHeader.writeUInt32LE(16, 16); // Sub-chunk size
  wavHeader.writeUInt16LE(1, 20);  // Audio format (1 = PCM)
  wavHeader.writeUInt16LE(numChannels, 22);
  wavHeader.writeUInt32LE(sampleRate, 24);
  wavHeader.writeUInt32LE(byteRate, 28);
  wavHeader.writeUInt16LE(blockAlign, 32);
  wavHeader.writeUInt16LE(bitsPerSample, 34);

  // Data Sub-chunk
  wavHeader.write('data', 36);
  wavHeader.writeUInt32LE(dataSize, 40);

  return Buffer.concat([wavHeader, pcmBuffer]);
}
