// ─── Caption Utilities ──────────────────────────────────────────────────────
// Supports: SRT file parsing, auto-generation, and caption display.

export interface CaptionCue {
  text: string;
  startTime: number; // seconds
  endTime: number;   // seconds
}

// ─── SRT Parser ─────────────────────────────────────────────────────────────

/**
 * Parse SRT file content into CaptionCue[].
 * Handles standard SRT format with index, time range, and text.
 */
export function parseSRT(srtText: string): CaptionCue[] {
  const cues: CaptionCue[] = [];
  // Remove BOM if present
  const text = srtText.replace(/^\uFEFF/, "").trim();

  // Split by double newlines (blank lines separate blocks)
  const blocks = text.split(/\n\s*\n/);

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 3) continue;

    // Find the time line (contains "-->")
    let timeLineIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("-->")) {
        timeLineIdx = i;
        break;
      }
    }
    if (timeLineIdx < 0) continue;

    const timeLine = lines[timeLineIdx];
    const match = timeLine.match(
      /(\d{1,2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[,.](\d{3})/
    );
    if (!match) continue;

    const start = toSeconds(+match[1], +match[2], +match[3], +match[4]);
    const end = toSeconds(+match[5], +match[6], +match[7], +match[8]);

    // Text is everything after the time line
    const cueText = lines.slice(timeLineIdx + 1).join(" ").trim();
    // Remove HTML tags
    const cleanText = cueText.replace(/<[^>]*>/g, "").trim();

    if (cleanText) {
      cues.push({ text: cleanText, startTime: start, endTime: end });
    }
  }

  return cues;
}

// ─── VTT Parser ─────────────────────────────────────────────────────────────

/**
 * Parse WebVTT file content into CaptionCue[].
 */
export function parseVTT(vttText: string): CaptionCue[] {
  const cues: CaptionCue[] = [];
  const text = vttText.replace(/^\uFEFF/, "").trim();

  // Remove WEBVTT header and any metadata
  const lines = text.split("\n");
  let i = 0;
  while (i < lines.length && !lines[i].includes("-->")) {
    i++;
  }

  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) {
      i++;
      continue;
    }

    // Try to parse time cue
    if (line.includes("-->")) {
      const match = line.match(
        /(?:(\d{1,2}):)?(\d{2}):(\d{2})[.](\d{3})\s*-->\s*(?:(\d{1,2}):)?(\d{2}):(\d{2})[.](\d{3})/
      );
      if (match) {
        const startH = match[1] ? +match[1] : 0;
        const endH = match[5] ? +match[5] : 0;
        const start = startH * 3600 + +match[2] * 60 + +match[3] + +match[4] / 1000;
        const end = endH * 3600 + +match[6] * 60 + +match[7] + +match[8] / 1000;

        // Collect text lines until next blank line or time cue
        i++;
        const textLines: string[] = [];
        while (i < lines.length && lines[i].trim() && !lines[i].includes("-->")) {
          textLines.push(lines[i].trim());
          i++;
        }
        const cueText = textLines.join(" ").replace(/<[^>]*>/g, "").trim();
        if (cueText) {
          cues.push({ text: cueText, startTime: start, endTime: end });
        }
        continue;
      }
    }
    i++;
  }

  return cues;
}

/**
 * Auto-detect and parse subtitle file (SRT or VTT).
 */
export function parseSubtitleFile(content: string, filename?: string): CaptionCue[] {
  const ext = filename?.toLowerCase().split(".").pop() || "";
  if (ext === "vtt" || content.trim().startsWith("WEBVTT")) {
    return parseVTT(content);
  }
  return parseSRT(content);
}

// ─── Auto Caption Generation (improved) ─────────────────────────────────────

/**
 * Auto-generate captions from scene scripts with improved timing.
 * Uses average Arabic/English speech rate: ~2.5 words/sec.
 * Adds natural pauses at punctuation boundaries.
 *
 * Note: This is an ESTIMATION. For perfect speech sync, upload an SRT file.
 */
export function autoGenerateCaptions(
  scenes: Array<{ script: string }>,
  totalDuration: number,
): CaptionCue[] {
  if (!scenes.length || totalDuration <= 0) return [];

  const validScenes = scenes.filter((s) => s.script?.trim());
  if (!validScenes.length) return [];

  // Calculate total word count
  const wordCounts = validScenes.map((s) => s.script.trim().split(/\s+/).length);
  const totalWords = wordCounts.reduce((a, b) => a + b, 0);
  if (totalWords === 0) return [];

  // Speech rate: ~2.5 words per second (average for Arabic/English)
  const SPEECH_RATE = 2.5;
  const naturalDuration = totalWords / SPEECH_RATE;

  // Scale factor: fit natural duration into available video duration
  const scaleFactor = naturalDuration > totalDuration
    ? totalDuration / naturalDuration  // compress if text is too long
    : 1; // don't stretch if text is short

  const cues: CaptionCue[] = [];
  let currentTime = 0;

  for (let si = 0; si < validScenes.length; si++) {
    const script = validScenes[si].script.trim();
    if (!script) continue;

    const sceneWordCount = wordCounts[si];
    const sceneNaturalDuration = (sceneWordCount / SPEECH_RATE) * scaleFactor;

    // Split into phrases (2-4 words per phrase)
    const phrases = splitIntoPhrases(script);
    if (phrases.length === 0) continue;

    const phraseWordCounts = phrases.map((p) => p.split(/\s+/).length);
    const phraseTotalWords = phraseWordCounts.reduce((a, b) => a + b, 0);

    let phraseTime = currentTime;
    for (let pi = 0; pi < phrases.length; pi++) {
      const phraseRatio = phraseTotalWords > 0 ? phraseWordCounts[pi] / phraseTotalWords : 1 / phrases.length;
      let phraseDuration = sceneNaturalDuration * phraseRatio;

      // Add pause after sentence-ending punctuation
      if (/[.!?]$/.test(phrases[pi].trim())) {
        phraseDuration *= 1.5;
      }
      // Small pause after comma/semicolon
      else if (/[,;]$/.test(phrases[pi].trim())) {
        phraseDuration *= 1.2;
      }

      cues.push({
        text: phrases[pi],
        startTime: phraseTime,
        endTime: phraseTime + phraseDuration,
      });

      phraseTime += phraseDuration;
    }

    // Add small gap between scenes
    currentTime = phraseTime + 0.3;
  }

  // Scale all cues to fit within totalDuration if they exceed it
  if (cues.length > 0 && cues[cues.length - 1].endTime > totalDuration) {
    const overflow = cues[cues.length - 1].endTime;
    const compressRatio = totalDuration / overflow;
    for (const cue of cues) {
      cue.startTime *= compressRatio;
      cue.endTime *= compressRatio;
    }
  }

  return cues;
}

// ─── Export to SRT ──────────────────────────────────────────────────────────

export function exportToSRT(cues: CaptionCue[]): string {
  return cues
    .map((cue, index) => {
      const start = formatTimeSRT(cue.startTime);
      const end = formatTimeSRT(cue.endTime);
      return index + 1 + "\n" + start + " --> " + end + "\n" + cue.text + "\n";
    })
    .join("\n");
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function toSeconds(h: number, m: number, s: number, ms: number): number {
  return h * 3600 + m * 60 + s + ms / 1000;
}

function formatTimeSRT(seconds: number): string {
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

function splitIntoPhrases(text: string): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const phrases: string[] = [];
  let i = 0;

  while (i < words.length) {
    const remaining = words.length - i;

    if (remaining <= 3) {
      phrases.push(words.slice(i).join(" "));
      break;
    }

    // Take 2-3 words per phrase
    const take = words[i + 2] && words[i + 2].length <= 4 ? 3 : 2;
    phrases.push(words.slice(i, i + take).join(" "));
    i += take;
  }

  return phrases;
}
