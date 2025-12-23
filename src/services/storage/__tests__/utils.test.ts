import { describe, it, expect } from "vitest";
import { getMimeType } from "../utils.js";

describe("getMimeType", () => {
  describe("known extensions", () => {
    it.each([
      // Images
      ["photo.jpg", "image/jpeg"],
      ["photo.jpeg", "image/jpeg"],
      ["image.png", "image/png"],
      ["animation.gif", "image/gif"],
      ["modern.webp", "image/webp"],
      ["vector.svg", "image/svg+xml"],
      // Documents
      ["document.pdf", "application/pdf"],
      ["legacy.doc", "application/msword"],
      [
        "modern.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ],
      ["spreadsheet.xls", "application/vnd.ms-excel"],
      [
        "spreadsheet.xlsx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ],
      // Other
      ["data.json", "application/json"],
      ["readme.txt", "text/plain"],
      ["export.csv", "text/csv"],
      ["archive.zip", "application/zip"],
    ])("returns correct MIME type for %s", (filename, expected) => {
      expect(getMimeType(filename)).toBe(expected);
    });
  });

  describe("case insensitivity", () => {
    it.each([
      ["PHOTO.JPG", "image/jpeg"],
      ["Photo.Png", "image/png"],
      ["DOCUMENT.PDF", "application/pdf"],
    ])("handles uppercase extension: %s", (filename, expected) => {
      expect(getMimeType(filename)).toBe(expected);
    });
  });

  describe("files with multiple dots", () => {
    it("uses the last extension", () => {
      expect(getMimeType("backup.2024.01.15.pdf")).toBe("application/pdf");
      expect(getMimeType("file.backup.json")).toBe("application/json");
      expect(getMimeType("photo.thumbnail.jpg")).toBe("image/jpeg");
    });
  });

  describe("unknown extensions", () => {
    it.each([
      ["file.unknown"],
      ["file.xyz"],
      ["file.bin"],
      ["file.dat"],
      ["noextension"],
    ])("returns application/octet-stream for %s", (filename) => {
      expect(getMimeType(filename)).toBe("application/octet-stream");
    });
  });

  describe("edge cases", () => {
    it("handles dotfiles", () => {
      expect(getMimeType(".gitignore")).toBe("application/octet-stream");
      expect(getMimeType(".env")).toBe("application/octet-stream");
    });

    it("handles empty extension", () => {
      expect(getMimeType("file.")).toBe("application/octet-stream");
    });
  });
});
