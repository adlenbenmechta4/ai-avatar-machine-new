// ─── Auto Caption Generator ──────────────────────────────────────────────────
// Generates timed captions from scene scripts for video overlay.
// Uses word-length-weighted timing for more natural speech sync.

export interface CaptionCue {
  text: string;
  startTime: number;
  endTime: number;
  sceneIndex: number;
}

export interface SceneTiming {
  sceneIndex: number;
  startTime: number;
  endTime: number;
  duration: number;
  script: string;
}

/**
 * Generate caption cues from scenes and total video duration.
 * Uses word-length-weighted distribution so longer phrases get more time,
 * and adds small pauses at punctuation for natural rhythm.
 */
export function generateCaptions(
  scenes: Array<{ script: string }>,
  totalDuration: number,
): CaptionCue[] {
  if (!scenes.length || totalDuration <= 0) return [];

  const validScenes = scenes.filter((s) => s.script?.trim());
  if (!validScenes.length) return [];

  // Weight scenes by their word count (more words = more time)
  const wordCounts = validScenes.map((s) => s.script.trim().split(/\s+/).length);
  const totalWords = wordCounts.reduce((a, b) => a + b, 0);
  if (totalWords === 0) return [];

  const sceneTimings: SceneTiming[] = [];
  let currentTime = 0;

  for (let i = 0; i < validScenes.length; i++) {
    const ratio = wordCounts[i] / totalWords;
    // Reserve 5% as buffer between scenes for natural pauses
    const duration = totalDuration * ratio * 0.95;
    sceneTimings.push({
      sceneIndex: i,
      startTime: currentTime,
      endTime: currentTime + duration,
      duration,
      script: validScenes[i].script.trim(),
    });
    currentTime += duration + totalDuration * 0.05 / validScenes.length;
  }

  // Generate cues per scene using word-length-weighted timing
  const cues: CaptionCue[] = [];
  for (const scene of sceneTimings) {
    const phrases = splitIntoPhrases(scene.script);
    if (phrases.length === 0) continue;

    // Weight each phrase by its character length (longer text = more time)
    const charLengths = phrases.map((p) => p.length);
    const totalChars = charLengths.reduce((a, b) => a + b, 0);

    let phraseTime = scene.startTime;
    for (let j = 0; j < phrases.length; j++) {
      const phraseRatio = totalChars > 0 ? charLengths[j] / totalChars : 1 / phrases.length;
      // Add extra pause at sentence endings (., !, ?)
      const isSentenceEnd = /[.!?]$/.test(phrases[j].trim());
      const baseDuration = scene.duration * phraseRatio;
      const phraseDuration = isSentenceEnd ? baseDuration * 1.4 : baseDuration;

      cues.push({
        text: phrases[j],
        startTime: phraseTime,
        endTime: phraseTime + phraseDuration,
        sceneIndex: scene.sceneIndex,
      });

      phraseTime += phraseDuration;
    }
  }

  return cues;
}

/**
 * Split text into display-ready phrases (1-3 words).
 * Respects sentence boundaries, punctuation, and Arabic text.
 */
function splitIntoPhrases(text: string): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const phrases: string[] = [];
  let i = 0;

  while (i < words.length) {
    const remaining = words.length - i;

    if (remaining === 1) {
      phrases.push(words[i]);
      i++;
    } else if (remaining === 2) {
      phrases.push(words[i] + " " + words[i + 1]);
      i += 2;
    } else {
      const twoWords = words[i] + " " + words[i + 1];
      const threeWords = twoWords + " " + words[i + 2];

      // End of sentence after 2nd word
      if (/[.,!?;:]$/.test(words[i + 1])) {
        phrases.push(twoWords);
        i += 2;
      }
      // Very short 3rd word — bundle
      else if (words[i + 2].length <= 2 && !/[.,!?;:]$/.test(words[i + 1])) {
        phrases.push(threeWords);
        i += 3;
      }
      // Long 1st word — take it alone
      else if (words[i].length > 12) {
        phrases.push(words[i]);
        i++;
      }
      // Default: 2 words
      else {
        phrases.push(twoWords);
        i += 2;
      }
    }
  }

  return phrases;
}

/**
 * Convert caption cues to SRT format.
 */
export function captionsToSRT(cues: CaptionCue[]): string {
  return cues
    .map((cue, index) => {
      const start = formatSRTTime(cue.startTime);
      const end = formatSRTTime(cue.endTime);
      return index + 1 + "\n" + start + " --> " + end + "\n" + cue.text + "\n";
    })
    .join("\n");
}

function formatSRTTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return (
    String(h).padStart(2, "0") + ":" +
    String(m).padStart(2, "0") + ":" +
    String(s).padStart(2, "0") + "," +
    String(ms).padStart(3, "0")
  );
}

/**
 * Convert caption cues to WebVTT format.
 */
export function captionsToVTT(cues: CaptionCue[]): string {
  let vtt = "WEBVTT\n\n";
  for (const cue of cues) {
    vtt += formatVTTTime(cue.startTime) + " --> " + formatVTTTime(cue.endTime) + "\n" + cue.text + "\n\n";
  }
  return vtt;
}

function formatVTTTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return (
    String(m).padStart(2, "0") + ":" +
    String(s).padStart(2, "0") + "." +
    String(ms).padStart(3, "0")
  );
}
