export class VoiceRecorder {
  async start(onLevel) {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: false,
    });
    try {
      this.context = new AudioContext({ sampleRate: 16000 });
      await this.context.resume();
      this.source = this.context.createMediaStreamSource(this.stream);
      this.processor = this.context.createScriptProcessor(4096, 1, 1);
      this.parts = [];
      this.count = 0;
      this.source.connect(this.processor);
      this.processor.connect(this.context.destination);
      this.processor.onaudioprocess = (e) => {
        const data = e.inputBuffer.getChannelData(0);
        if (this.count < 16000 * 61) {
          this.parts.push(new Float32Array(data));
          this.count += data.length;
        }
        onLevel?.(Math.sqrt(data.reduce((s, x) => s + x * x, 0) / data.length));
      };
    } catch (e) {
      this.stream.getTracks().forEach((t) => t.stop());
      throw e;
    }
  }
  async stop() {
    this.processor.disconnect();
    this.source.disconnect();
    this.stream.getTracks().forEach((t) => t.stop());
    const rate = this.context.sampleRate;
    await this.context.close();
    const wav = new ArrayBuffer(44 + this.count * 2);
    const v = new DataView(wav);
    const str = (o, s) =>
      [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    str(0, "RIFF");
    v.setUint32(4, 36 + this.count * 2, true);
    str(8, "WAVE");
    str(12, "fmt ");
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true);
    v.setUint16(22, 1, true);
    v.setUint32(24, rate, true);
    v.setUint32(28, rate * 2, true);
    v.setUint16(32, 2, true);
    v.setUint16(34, 16, true);
    str(36, "data");
    v.setUint32(40, this.count * 2, true);
    let offset = 44;
    for (const part of this.parts)
      for (const value of part) {
        v.setInt16(offset, Math.max(-1, Math.min(1, value)) * 32767, true);
        offset += 2;
      }
    return wav;
  }
}
export function urduVoices() {
  return speechSynthesis
    .getVoices()
    .filter((v) => /^ur(?:[-_]|$)/i.test(v.lang));
}
