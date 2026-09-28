import { usePaste } from "../ink/index.js";
import { getClipboardImage, type ClipboardImage } from "../utils/clipboard-image.js";

/** Single-line pastes at or above this char count are compacted into a tile. */
const PASTE_THRESHOLD = 50;

/**
 * Maximum number of lines a multiline paste may contain before it is
 * compacted into an attachment tile instead of being inserted verbatim.
 *
 * Pastes at or below this ceiling are inserted as literal text so that the
 * full content is visible in the prompt (fixes #316). Pastes above it are
 * still tiled so that very large dumps do not flood the prompt buffer.
 *
 * Exported so the Ctrl+V fallback path in app.tsx shares the same constant
 * instead of duplicating the magic number.
 */
export const MULTILINE_TILE_LINE_THRESHOLD = 50;

/**
 * Pure routing function: decides what to do with pasted text.
 *
 * Returns one of three actions:
 * - `"image"`: empty paste — caller should check the clipboard for an image.
 * - `"tile"`: paste is large enough to warrant an attachment tile.
 * - `"raw"`: paste should be inserted verbatim into the prompt buffer.
 *
 * Extracted from `useClipboardImageDetector` so the decision logic can be
 * unit-tested without any React/Ink context.
 */
export function classifyPasteText(text: string): "image" | "tile" | "raw" {
  if (text.length === 0) {
    return "image";
  }
  // Normalize CRLF and bare CR to LF so line counting and newline checks
  // are consistent across platforms and terminals (e.g. Windows Terminal
  // which sends \r or \r\n during bracketed paste).
  const normalized = text.replace(/\r\n?/g, "\n");
  // Single-line URL → raw so the link stays clickable.
  if (!normalized.includes("\n") && /^https?:\/\//.test(normalized)) {
    return "raw";
  }
  // Multiline paste (fix for #316): raw unless the paste is enormous.
  if (normalized.includes("\n")) {
    const lineCount = normalized.split("\n").length;
    return lineCount > MULTILINE_TILE_LINE_THRESHOLD ? "tile" : "raw";
  }
  // Single-line non-URL: tile if large, raw if small.
  return normalized.length >= PASTE_THRESHOLD ? "tile" : "raw";
}

export function useClipboardImageDetector(
  onImage: (img: ClipboardImage) => void,
  enabled: boolean,
  onText?: (text: string) => void,
  onInsertRaw?: (text: string) => void,
) {
  usePaste((rawText) => {
    const text = rawText.replace(/\r\n?/g, "\n");
    const action = classifyPasteText(text);
    if (action === "image") {
      getClipboardImage().then((img) => {
        if (img) onImage(img);
      });
    } else if (action === "tile" && onText) {
      onText(text);
    } else if (onInsertRaw) {
      onInsertRaw(text);
    }
  }, { isActive: enabled });
}
