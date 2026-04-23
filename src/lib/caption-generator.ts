// ─── Auto Caption Generator ──────────────────────────────────────────────────
// Generates timed captions from scene scripts for video overlay or SRT burning.
// Free & fast — no API calls needed, pure text + timing logic.

export interface CaptionCue {
  text: string;       // The word or phrase to display
  startTime: number;  // in seconds
  endTime: number;    // in seconds
  sceneIndex: number; // which scene this belongs to
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
 * Splits each scene's script into phrases (1-3 words each) and distributes
 * them evenly across the scene's time slot.
 */
export function generateCaptions(
  scenes: Array<{ script: string }>,
  totalDuration: number, // seconds
): CaptionCue[] {
  if (!scenes.length || totalDuration <= 0) return [];

  const validScenes = scenes.filter((s) => s.script?.trim());
  if (!validScenes.length) return [];

  // Calculate timing per scene (equal distribution)
  const sceneTimings: SceneTiming[] = [];
  const numValid = validScenes.length;
  const avgDuration = totalDuration / numValid;

  let currentTime = 0;
  for (let i = 0; i < numValid; i++) {
    const duration = avgDuration;
    sceneTimings.push({
      sceneIndex: i,
      startTime: currentTime,
      endTime: currentTime + duration,
      duration,
      script: validScenes[i].script.trim(),
    });
    currentTime += duration;
  }

  // Generate cues per scene
  const cues: CaptionCue[] = [];
  for (const scene of sceneTimings) {
    const phrases = splitIntoPhrases(scene.script);
    if (phrases.length === 0) continue;

    const phraseDuration = scene.duration / phrases.length;
    for (let j = 0; j < phrases.length; j++) {
      cues.push({
        text: phrases[j],
        startTime: scene.startTime + j * phraseDuration,
        endTime: scene.startTime + (j + 1) * phraseDuration,
        sceneIndex: scene.sceneIndex,
      });
    }
  }

  return cues;
}

/**
 * Split text into display-ready phrases (1-3 words).
 * Respects sentence boundaries and punctuation.
 */
function splitIntoPhrases(text: string): string[] {
  // Split by words first
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const phrases: string[] = [];
  let i = 0;

  while (i < words.length) {
    // Take 2-3 words per phrase (better readability)
    const remaining = words.length - i;

    if (remaining === 1) {
      phrases.push(words[i]);
      i++;
    } else if (remaining === 2) {
      phrases.push(words[i] + " " + words[i + 1]);
      i += 2;
    } else {
      // Take 2 words, but try to avoid splitting at punctuation
      const twoWords = words[i] + " " + words[i + 1];
      const threeWords = twoWords + " " + words[i + 2];

      // If the 2nd word ends with punctuation, take only 2
      if (/[.,!?;:]$/.test(words[i + 1])) {
        phrases.push(twoWords);
        i += 2;
      }
      // If the 3rd word is very short (1-2 chars), bundle with previous 2
      else if (words[i + 2].length <= 2) {
        phrases.push(threeWords);
        i += 3;
      }
      // Default: take 2 words
      else {
        phrases.push(twoWords);
        i += 2;
      }
    }
  }

  return phrases;
}

/**
 * Convert caption cues to SRT format (for burning subtitles via FFmpeg).
 */
export function captionsToSRT(cues: CaptionCue[]): string {
  return cues
    .map((cue, index) => {
      const start = formatSRTTime(cue.startTime);
      const end = formatSRTTime(cue.endTime);
      return `${index + 1}\n${start} --> ${end}\n${cue.text}\n`;
    })
    .join("\n");
}

/**
 * Convert seconds to SRT time format: HH:MM:SS,mmm
 */
function formatSRTTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);

  return (
    String(h).padStart(2, "0") +
    ":" +
    String(m).padStart(2, "0") +
    ":" +
    String(s).padStart(2, "0") +
    "," +
    String(ms).padStart(3, "0")
  );
}

/**
 * Convert caption cues to WebVTT format (for HTML5 video track).
 */
export function captionsToVTT(cues: CaptionCue[]): string {
  let vtt = "WEBVTT\n\n";
  for (const cue of cues) {
    vtt += `${formatVTTTime(cue.startTime)} --> ${formatVTTTime(cue.endTime)}\n${cue.text}\n\n`;
  }
  return vtt;
}

function formatVTTTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return (
    String(m).padStart(2, "0") +
    ":" +
    String(s).padStart(2, "0") +
    "." +
    String(ms).padStart(3, "0")
  );
}
