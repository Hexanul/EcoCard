// Transcribes a dictation piece by piece: at each pause, the audio recorded
// since the previous piece is transcribed while the doctor is paused, so after
// "Oprește" only the rest is left. Pieces are cut at sample offsets of the
// decoded recording (a paused recording's chunks so far decode to the same
// samples as the start of the full recording), so nothing is lost or repeated.
// Without a pause the whole recording is transcribed once, exactly as before.
// Pure (no DOM): the decoder and whisper are passed in.
// A piece shorter than 0.1 s (at 16 kHz) is not worth a whisper run.
export const MIN_SEGMENT_SAMPLES = 1600;
export function createSegmentedTranscription(deps) {
    const texts = [];
    let doneSamples = 0;
    let failed = false;
    let finished = false;
    let cancelled = false;
    let queue = Promise.resolve();
    const joined = () => texts.map((text) => text.trim()).filter(Boolean).join('\n');
    // One whisper run at a time, in dictation order.
    const enqueue = (job) => {
        const run = queue.then(job);
        queue = run.catch(() => undefined);
        return run;
    };
    const transcribeRest = async (audio) => {
        const samples = await deps.decode(audio);
        const rest = samples.subarray(doneSamples);
        // A too short rest stays for the next piece; at the end it holds no word.
        if (cancelled || rest.length < MIN_SEGMENT_SAMPLES)
            return;
        const text = await deps.transcribe(rest);
        if (cancelled)
            return;
        texts.push(text);
        doneSamples = samples.length;
    };
    return {
        transcribeUpTo(recordingSoFar) {
            // A pause arriving after stop (e.g. "Oprește" pressed while the pause
            // was still flushing) adds nothing; pauses queued before it still run.
            if (finished)
                return enqueue(async () => joined());
            return enqueue(async () => {
                if (failed || cancelled)
                    return joined();
                try {
                    await transcribeRest(recordingSoFar);
                }
                catch {
                    failed = true;
                }
                return joined();
            });
        },
        finish(fullRecording) {
            finished = true;
            return enqueue(async () => {
                if (cancelled)
                    return '';
                if (failed) {
                    texts.length = 0;
                    doneSamples = 0;
                }
                await transcribeRest(fullRecording);
                return cancelled ? '' : joined();
            });
        },
        cancel() {
            cancelled = true;
        },
    };
}
