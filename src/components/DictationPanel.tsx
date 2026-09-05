import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  TranscriptionError,
  transcribeAudio,
} from '../services/transcriptionService';
import { parseEchoTranscript, type ParsedEchoData } from '../services/medicalParser';
import { isElectronAvailable, getEchoReportApi } from '../services/electronBridge';
import {
  getPreferredRecordingMimeType,
} from '../utils/audioInfo';

type DictationState =
  | 'idle'
  | 'recording'
  | 'paused'
  | 'processing'
  | 'transcribed'
  | 'error';

const TRANSCRIPTION_READY =
  'Înregistrarea este pregătită pentru transcriere.';
const TRANSCRIPTION_PROCESSING =
  'Se procesează local...';

// Recorded audio is kept in memory only (React state + Blob).
// It will later be passed to local whisper.cpp for offline transcription.
// No network requests, no persistent storage, no cloud services.

function formatElapsed(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function supportsPauseResume(): boolean {
  return (
    typeof MediaRecorder !== 'undefined' &&
    typeof MediaRecorder.prototype.pause === 'function' &&
    typeof MediaRecorder.prototype.resume === 'function'
  );
}

function getMicrophoneErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    switch (error.name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        return 'Accesul la microfon a fost refuzat. Verifică permisiunile Windows și ale aplicației.';
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return 'Nu s-a găsit niciun microfon disponibil. Conectează un microfon și încearcă din nou.';
      case 'NotReadableError':
      case 'TrackStartError':
        return 'Microfonul nu poate fi accesat. Este posibil să fie folosit de o altă aplicație.';
      case 'OverconstrainedError':
        return 'Microfonul disponibil nu îndeplinește cerințele necesare.';
      case 'SecurityError':
        return 'Accesul la microfon este blocat din motive de securitate.';
      default:
        break;
    }
  }
  return 'A apărut o eroare la înregistrare. Încearcă din nou.';
}

function getUnsupportedMessage(): string | null {
  if (!navigator.mediaDevices?.getUserMedia) {
    return 'Browserul nu suportă accesul la microfon.';
  }
  if (typeof MediaRecorder === 'undefined') {
    return 'Browserul nu suportă înregistrarea audio.';
  }
  return null;
}

function MicrophoneIcon() {
  return (
    <svg
      className="dictation-panel__mic-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  );
}

function StopIcon() {
  return (
    <span className="dictation-panel__stop-icon" aria-hidden="true">
      ⏹
    </span>
  );
}

type DictationPanelProps = {
  onMeasurementsParsed?: (data: ParsedEchoData) => void;
};

export function DictationPanel({ onMeasurementsParsed }: DictationPanelProps) {
  const [state, setState] = useState<DictationState>('idle');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [playbackDuration, setPlaybackDuration] = useState(0);
  const [playbackSeconds, setPlaybackSeconds] = useState(0);
  const [isPlaybackPlaying, setIsPlaybackPlaying] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [pipelineHint, setPipelineHint] = useState<string | null>(() =>
    !isElectronAvailable() && import.meta.env.DEV
      ? 'Pentru transcriere locală, rulați aplicația cu Electron: npm run dev'
      : null,
  );

  // The transcript is re-parsed on every edit so the review panel always
  // reflects what the doctor sees in the textarea.
  const parsedData = useMemo(() => parseEchoTranscript(transcription), [transcription]);

  useEffect(() => {
    onMeasurementsParsed?.(parsedData);
  }, [onMeasurementsParsed, parsedData]);

  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const audioBlobRef = useRef<Blob | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const shouldFinalizeRef = useRef(false);
  const elapsedMsRef = useRef(0);
  const segmentStartRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);

  const stopStreamTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const getElapsedMs = useCallback(() => {
    let total = elapsedMsRef.current;
    if (segmentStartRef.current !== null) {
      total += Date.now() - segmentStartRef.current;
    }
    return total;
  }, []);

  const syncElapsedDisplay = useCallback(() => {
    setElapsedSeconds(Math.floor(getElapsedMs() / 1000));
  }, [getElapsedMs]);

  const resetElapsed = useCallback(() => {
    elapsedMsRef.current = 0;
    segmentStartRef.current = null;
    setElapsedSeconds(0);
  }, []);

  const accumulateElapsed = useCallback(() => {
    if (segmentStartRef.current !== null) {
      elapsedMsRef.current += Date.now() - segmentStartRef.current;
      segmentStartRef.current = null;
    }
  }, []);

  const startElapsedSegment = useCallback(() => {
    segmentStartRef.current = Date.now();
    clearTimer();
    timerRef.current = setInterval(syncElapsedDisplay, 250);
  }, [clearTimer, syncElapsedDisplay]);

  const pauseElapsedSegment = useCallback(() => {
    accumulateElapsed();
    clearTimer();
    syncElapsedDisplay();
  }, [accumulateElapsed, clearTimer, syncElapsedDisplay]);

  const revokeAudioUrl = useCallback(() => {
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setAudioUrl(null);
    setPlaybackDuration(0);
    setPlaybackSeconds(0);
    setIsPlaybackPlaying(false);
  }, []);

  useEffect(() => {
    const audio = audioElementRef.current;
    if (!audio || !audioUrl) return;

    const syncDuration = () => setPlaybackDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const syncCurrentTime = () => setPlaybackSeconds(audio.currentTime);
    const handlePlay = () => setIsPlaybackPlaying(true);
    const handlePause = () => setIsPlaybackPlaying(false);
    const handleEnded = () => {
      setIsPlaybackPlaying(false);
      setPlaybackSeconds(audio.duration);
    };

    audio.addEventListener('loadedmetadata', syncDuration);
    audio.addEventListener('durationchange', syncDuration);
    audio.addEventListener('timeupdate', syncCurrentTime);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.load();

    return () => {
      audio.removeEventListener('loadedmetadata', syncDuration);
      audio.removeEventListener('durationchange', syncDuration);
      audio.removeEventListener('timeupdate', syncCurrentTime);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioUrl]);

  const runTranscription = useCallback(async (blob: Blob) => {
    setState('processing');
    setTranscription(TRANSCRIPTION_PROCESSING);
    setErrorMessage(null);

    try {
      const result = await transcribeAudio(blob);
      if (!isMountedRef.current) {
        return;
      }
      setTranscription(result.text);
      setState('transcribed');
    } catch (error) {
      if (!isMountedRef.current) {
        return;
      }
      const message =
        error instanceof TranscriptionError
          ? error.message
          : 'Transcrierea a eșuat. Încearcă din nou.';
      setErrorMessage(message);
      setTranscription(TRANSCRIPTION_READY);
      setState('error');
    }
  }, []);

  const discardRecording = useCallback(() => {
    shouldFinalizeRef.current = false;
    clearTimer();

    const recorder = mediaRecorderRef.current;
    if (recorder?.state === 'recording' || recorder?.state === 'paused') {
      recorder.stop();
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    audioBlobRef.current = null;
    stopStreamTracks();
    revokeAudioUrl();
    resetElapsed();
    setTranscription('');
    setErrorMessage(null);
  }, [clearTimer, resetElapsed, revokeAudioUrl, stopStreamTracks]);

  const startRecording = useCallback(async () => {
    setErrorMessage(null);

    const unsupported = getUnsupportedMessage();
    if (unsupported) {
      setErrorMessage(unsupported);
      return;
    }

    discardRecording();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = getPreferredRecordingMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        setErrorMessage('A apărut o eroare la înregistrare. Încearcă din nou.');
        clearTimer();
        stopStreamTracks();
        mediaRecorderRef.current = null;
        resetElapsed();
        setState('idle');
      };

      recorder.onstop = () => {
        clearTimer();
        stopStreamTracks();
        mediaRecorderRef.current = null;

        if (!shouldFinalizeRef.current) {
          chunksRef.current = [];
          return;
        }
        shouldFinalizeRef.current = false;

        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        chunksRef.current = [];
        audioBlobRef.current = blob;

        const url = URL.createObjectURL(blob);
        audioUrlRef.current = url;
        setAudioUrl(url);
        syncElapsedDisplay();
        void runTranscription(blob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250);
      resetElapsed();
      startElapsedSegment();
      setState('recording');
    } catch (error) {
      stopStreamTracks();
      setErrorMessage(getMicrophoneErrorMessage(error));
      setState('idle');
    }
  }, [
    clearTimer,
    discardRecording,
    resetElapsed,
    runTranscription,
    startElapsedSegment,
    stopStreamTracks,
    syncElapsedDisplay,
  ]);

  const pauseRecording = useCallback(() => {
    setErrorMessage(null);
    const recorder = mediaRecorderRef.current;

    if (!recorder || recorder.state !== 'recording') {
      return;
    }

    if (!supportsPauseResume()) {
      setErrorMessage('Pauza nu este suportată în acest browser.');
      return;
    }

    try {
      recorder.pause();
      pauseElapsedSegment();
      setState('paused');
    } catch {
      setErrorMessage('Nu s-a putut întrerupe înregistrarea. Încearcă din nou.');
    }
  }, [pauseElapsedSegment]);

  const resumeRecording = useCallback(() => {
    setErrorMessage(null);
    const recorder = mediaRecorderRef.current;

    if (!recorder || recorder.state !== 'paused') {
      return;
    }

    if (!supportsPauseResume()) {
      setErrorMessage('Reluarea nu este suportată în acest browser.');
      return;
    }

    try {
      recorder.resume();
      startElapsedSegment();
      setState('recording');
    } catch {
      setErrorMessage('Nu s-a putut relua înregistrarea. Încearcă din nou.');
    }
  }, [startElapsedSegment]);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder?.state === 'recording' || recorder?.state === 'paused') {
      if (recorder.state === 'recording') {
        accumulateElapsed();
      }
      clearTimer();
      syncElapsedDisplay();
      shouldFinalizeRef.current = true;
      recorder.stop();
    }
  }, [accumulateElapsed, clearTimer, syncElapsedDisplay]);

  const handleRecordAgain = useCallback(() => {
    discardRecording();
    setState('idle');
    void startRecording();
  }, [discardRecording, startRecording]);

  useEffect(() => {
    isMountedRef.current = true;

    if (isElectronAvailable()) {
      void getEchoReportApi()
        ?.getPipelineStatus()
        .then((status) => {
          if (!status.modelFound) {
            setPipelineHint(
              'Modelul Whisper large-v3-turbo nu este instalat local. Plasați ggml-large-v3-turbo.bin în folderul configurat.',
            );
          }
        })
        .catch(() => undefined);
    }

    return () => {
      isMountedRef.current = false;
      shouldFinalizeRef.current = false;
      const recorder = mediaRecorderRef.current;
      if (recorder?.state === 'recording' || recorder?.state === 'paused') {
        recorder.stop();
      }
      clearTimer();
      stopStreamTracks();
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }
    };
  }, [clearTimer, stopStreamTracks]);

  const statusText =
    state === 'recording'
      ? 'Înregistrare...'
      : state === 'paused'
        ? 'Pauză...'
          : state === 'processing'
          ? 'Se procesează local...'
          : state === 'transcribed'
            ? 'Transcriere finalizată'
            : state === 'error'
              ? 'Transcrierea locală a eșuat.'
              : 'Microfon pregătit';

  const showTimer = state === 'recording' || state === 'paused';
  const showPlayback =
    audioUrl !== null &&
    (state === 'processing' || state === 'transcribed' || state === 'error');
  const isTranscriptEditable = state === 'transcribed' || state === 'error';
  const timelineDuration = Math.max(playbackDuration, elapsedSeconds, 1);
  const timelineProgress = Math.min(
    100,
    (state === 'recording' || state === 'paused'
      ? elapsedSeconds
      : playbackSeconds) / timelineDuration * 100,
  );

  const togglePlayback = () => {
    const audio = audioElementRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play();
    } else {
      audio.pause();
    }
  };

  const seekPlayback = (value: number) => {
    const audio = audioElementRef.current;
    if (!audio) return;
    audio.currentTime = value;
    setPlaybackSeconds(value);
  };

  return (
    <section
      className={`panel dictation-panel ${state === 'recording' ? 'dictation-panel--recording' : ''} ${state === 'paused' ? 'dictation-panel--paused' : ''} ${state === 'processing' ? 'dictation-panel--processing' : ''} ${state === 'transcribed' ? 'dictation-panel--transcribed' : ''} ${state === 'error' ? 'dictation-panel--error' : ''}`}
    >
      <div className="dictation-panel__header">
        <h2 className="panel__title">Dictare</h2>
        <span className="local-badge">LOCAL</span>
      </div>

      {pipelineHint && !errorMessage && (
        <div className="dictation-panel__hint" role="status">
          {pipelineHint}
        </div>
      )}

      {errorMessage && (
        <div className="dictation-panel__error" role="alert">
          {errorMessage}
        </div>
      )}

      <div className="dictation-panel__controls">
        {state === 'idle' && (
          <button
            type="button"
            className="dictation-panel__record-btn"
            onClick={() => void startRecording()}
            aria-label="Începe dictarea"
          >
            <MicrophoneIcon />
            Începe dictarea
          </button>
        )}

        {state === 'recording' && (
          <div className="dictation-panel__action-buttons">
            <button
              type="button"
              className="dictation-panel__pause-btn"
              onClick={pauseRecording}
              aria-label="Pauză înregistrare"
            >
              ⏸ Pauză
            </button>
            <button
              type="button"
              className="dictation-panel__stop-btn"
              onClick={stopRecording}
              aria-label="Oprește înregistrarea"
            >
              <StopIcon />
              Oprește
            </button>
          </div>
        )}

        {state === 'paused' && (
          <div className="dictation-panel__action-buttons">
            <button
              type="button"
              className="dictation-panel__resume-btn"
              onClick={resumeRecording}
              aria-label="Continuă înregistrarea"
            >
              ▶ Continuă
            </button>
            <button
              type="button"
              className="dictation-panel__stop-btn"
              onClick={stopRecording}
              aria-label="Oprește înregistrarea"
            >
              <StopIcon />
              Oprește
            </button>
          </div>
        )}

        <div className="dictation-panel__status" role="status" aria-live="polite">
          <span
            className={`dictation-panel__status-dot ${state === 'recording' ? 'dictation-panel__status-dot--active' : ''} ${state === 'paused' ? 'dictation-panel__status-dot--paused' : ''} ${state === 'processing' ? 'dictation-panel__status-dot--processing' : ''} ${state === 'transcribed' ? 'dictation-panel__status-dot--stopped' : ''} ${state === 'error' ? 'dictation-panel__status-dot--error' : ''}`}
            aria-hidden="true"
          />
          <span className="dictation-panel__status-text">{statusText}</span>
          {showTimer && (
            <span className="dictation-panel__timer" aria-label={`Timp înregistrat: ${formatElapsed(elapsedSeconds)}`}>
              {formatElapsed(elapsedSeconds)}
            </span>
          )}
        </div>
      </div>

      {showTimer && (
        <div className="dictation-panel__recording-timeline" aria-label="Lungimea înregistrării curente">
          <span className="dictation-panel__playback-time">00:00</span>
          <div className="dictation-panel__timeline dictation-panel__timeline--live">
            <span
              className="dictation-panel__timeline-fill"
              style={{ width: `${timelineProgress}%` }}
            />
          </div>
          <span className="dictation-panel__playback-time">
            {formatElapsed(elapsedSeconds)}
          </span>
        </div>
      )}

      {showPlayback && (
        <div className="dictation-panel__playback">
          <audio ref={audioElementRef} src={audioUrl} className="dictation-panel__audio-player">
            Browserul nu suportă redarea audio.
          </audio>
          <div className="dictation-panel__player-controls">
            <button
              type="button"
              className="dictation-panel__play-btn"
              onClick={togglePlayback}
              aria-label={isPlaybackPlaying ? 'Pune pauză redării' : 'Redă înregistrarea'}
            >
              {isPlaybackPlaying ? '⏸' : '▶'}
            </button>
            <span className="dictation-panel__playback-time">
              {formatElapsed(Math.floor(playbackSeconds))}
            </span>
            <input
              type="range"
              className="dictation-panel__timeline"
              min="0"
              max={timelineDuration}
              step="0.1"
              value={Math.min(playbackSeconds, timelineDuration)}
              onChange={(event) => seekPlayback(Number(event.target.value))}
              aria-label="Poziția înregistrării"
              style={{ '--timeline-progress': `${timelineProgress}%` } as React.CSSProperties}
            />
            <span className="dictation-panel__playback-time">
              {formatElapsed(Math.ceil(playbackDuration || elapsedSeconds))}
            </span>
          </div>
          {(state === 'transcribed' || state === 'error') && (
            <button
              type="button"
              className="btn btn--secondary dictation-panel__record-again-btn"
              onClick={handleRecordAgain}
              aria-label="Înregistrează din nou"
            >
              <MicrophoneIcon />
              Înregistrează din nou
            </button>
          )}
        </div>
      )}

      <div className="dictation-panel__transcription">
        <div className="dictation-panel__transcription-header">
          <label htmlFor="transcription">Transcriere</label>
        </div>
        <textarea
          id="transcription"
          className="dictation-panel__transcription-text"
          value={transcription}
          onChange={(e) => setTranscription(e.target.value)}
          readOnly={!isTranscriptEditable}
          placeholder="Transcrierea va apărea aici după procesare."
          rows={5}
          aria-busy={state === 'processing'}
        />
        {parsedData.measurements.length > 0 && (
          <p className="dictation-panel__parsed-hint" role="status">
            {parsedData.measurements.length === 1
              ? '1 măsurătoare detectată — revizuiește înainte de aplicare.'
              : `${parsedData.measurements.length} măsurători detectate — revizuiește înainte de aplicare.`}
          </p>
        )}
      </div>
    </section>
  );
}
