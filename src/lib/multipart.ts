import type { FastifyRequest } from "fastify";
import { badRequest } from "./access.js";

export interface UploadedPhoto {
  fileName: string | null;
  contentType: string;
  buffer: Buffer;
}

/**
 * Reads a legacy SafeSpot multipart request. The frontend sends the JSON
 * payload as a Blob part (e.g. "audit" or "resolution") plus zero or more
 * "photos" file parts — so JSON may arrive as either a field or a "file".
 */
export async function readMultipart(
  request: FastifyRequest,
  jsonPartNames: string[],
): Promise<{ json: unknown; photos: UploadedPhoto[] }> {
  let json: unknown;
  const photos: UploadedPhoto[] = [];

  for await (const part of request.parts()) {
    if (jsonPartNames.includes(part.fieldname)) {
      const raw = part.type === "file"
        ? (await part.toBuffer()).toString("utf-8")
        : String(part.value ?? "");
      try {
        json = raw ? JSON.parse(raw) : undefined;
      } catch {
        throw badRequest(`Part "${part.fieldname}" is not valid JSON`);
      }
      continue;
    }

    if (part.type === "file" && part.fieldname === "photos") {
      const contentType = (part.mimetype || "application/octet-stream").toLowerCase();
      const buffer = await part.toBuffer();
      if (!buffer.length) continue;
      if (!contentType.startsWith("image/")) {
        throw badRequest("Only image uploads are supported for audit photos");
      }
      photos.push({
        fileName: part.filename ? part.filename.slice(0, 255) : null,
        contentType,
        buffer,
      });
      continue;
    }

    if (part.type === "file") {
      // Drain unexpected file parts so the stream can complete.
      await part.toBuffer();
    }
  }

  return { json, photos };
}
