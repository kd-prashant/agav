import { describe, it, expect } from "vitest";
import {
  classifyPasteText,
  MULTILINE_TILE_LINE_THRESHOLD,
} from "../hooks/use-paste-handler.js";

// ---------------------------------------------------------------------------
// classifyPasteText — pure routing logic for pasted text (fixes #316)
//
// This is the testable seam extracted from useClipboardImageDetector.
// The hook itself wires the result to React/Ink callbacks, but the routing
// decision is fully deterministic and requires no UI context to verify.
// ---------------------------------------------------------------------------

describe("classifyPasteText", () => {
  // -------------------------------------------------------------------------
  // Empty paste → trigger clipboard-image lookup
  // -------------------------------------------------------------------------
  it("returns 'image' for an empty string", () => {
    expect(classifyPasteText("")).toBe("image");
  });

  // -------------------------------------------------------------------------
  // Single-line URL → raw insert (link must stay clickable)
  // -------------------------------------------------------------------------
  it("returns 'raw' for a single-line http URL", () => {
    expect(classifyPasteText("http://example.com")).toBe("raw");
  });

  it("returns 'raw' for a single-line https URL", () => {
    expect(classifyPasteText("https://github.com/prapaa-ai/agav/issues/316")).toBe("raw");
  });

  // -------------------------------------------------------------------------
  // Single-line non-URL text: threshold boundary
  // -------------------------------------------------------------------------
  it("returns 'raw' for short single-line text (below threshold)", () => {
    // 49 chars — just under PASTE_THRESHOLD of 50
    expect(classifyPasteText("a".repeat(49))).toBe("raw");
  });

  it("returns 'tile' for long single-line text (at or above threshold)", () => {
    expect(classifyPasteText("a".repeat(50))).toBe("tile");
    expect(classifyPasteText("a".repeat(200))).toBe("tile");
  });

  // -------------------------------------------------------------------------
  // Multiline paste: the fix for #316
  // Normal multiline pastes (≤ ceiling) must go to raw, not tile.
  // -------------------------------------------------------------------------
  it("returns 'raw' for a small multiline paste (the #316 regression case)", () => {
    // The exact case from the issue: 6-line, 115-char snippet.
    const paste = "Hello\nThis is how\nit should\nlook like\nwhenever we\ntry to paste";
    expect(paste.split("\n").length).toBe(6); // sanity
    expect(classifyPasteText(paste)).toBe("raw");
  });

  it("returns 'raw' for multiline pastes with Windows CRLF line endings", () => {
    const paste = "Line one\r\nLine two\r\nLine three\r\nLine four\r\nLine five\r\nLine six";
    expect(classifyPasteText(paste)).toBe("raw");
  });

  it("returns 'raw' for multiline pastes with bare CR line endings (Windows Terminal bracketed paste)", () => {
    // In Windows Terminal, bracketed paste mode sends \r as newline separators.
    const paste = "Line one\rLine two\rLine three\rLine four\rLine five\rLine six";
    expect(classifyPasteText(paste)).toBe("raw");
  });

  it("returns 'raw' for a two-line paste regardless of total char length", () => {
    // Even if this exceeds PASTE_THRESHOLD chars, having \n puts it on the
    // multiline path where only line count matters.
    const paste = "a".repeat(200) + "\n" + "b".repeat(200);
    expect(classifyPasteText(paste)).toBe("raw");
  });

  it("returns 'raw' for a multiline paste exactly at the line ceiling", () => {
    const lines = Array.from({ length: MULTILINE_TILE_LINE_THRESHOLD }, (_, i) => `line ${i}`);
    expect(classifyPasteText(lines.join("\n"))).toBe("raw");
  });

  // -------------------------------------------------------------------------
  // Very large multiline paste: tile for protection
  // -------------------------------------------------------------------------
  it("returns 'tile' for a multiline paste exceeding the line ceiling", () => {
    const lines = Array.from({ length: MULTILINE_TILE_LINE_THRESHOLD + 1 }, (_, i) => `line ${i}`);
    expect(classifyPasteText(lines.join("\n"))).toBe("tile");
  });

  it("returns 'tile' for a 500-line paste (stress case)", () => {
    const lines = Array.from({ length: 500 }, (_, i) => `line ${i}`);
    expect(classifyPasteText(lines.join("\n"))).toBe("tile");
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------
  it("treats a URL that also contains a newline as multiline (not the URL path)", () => {
    // The URL guard requires !text.includes("\n"), so a multi-line string
    // that starts with a URL goes to the multiline branch instead.
    const paste = "https://example.com\nsecond line";
    expect(classifyPasteText(paste)).toBe("raw"); // 2 lines ≤ ceiling → raw
  });

  it("MULTILINE_TILE_LINE_THRESHOLD is exported and equals 50", () => {
    // Guards that the constant is exported correctly and not accidentally changed.
    expect(MULTILINE_TILE_LINE_THRESHOLD).toBe(50);
  });
});
