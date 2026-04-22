import {
  REGION_ORDER,
  type StructuringPrompt,
  type RegionId,
} from "@/types/structuring";

/**
 * Serializer for StructuringPrompt <-> cstm_prmt_info.prompt.
 *
 * Format:
 *   <!-- STUDIO:v1 -->
 *
 *   <!-- REGION:role -->
 *   {...json payload...}
 *   <!-- /REGION:role -->
 *
 *   <!-- REGION:persona -->
 *   ...
 *
 * Each region is stored as pretty-printed JSON inside explicit markers so the
 * blob is legible in the DB and round-trips 1:1 through deserialize().
 */

export const SERIALIZER_VERSION = "v1" as const;
const HEADER_PREFIX = "<!-- STUDIO:";
const HEADER = `${HEADER_PREFIX}${SERIALIZER_VERSION} -->`;

function regionOpen(id: RegionId): string {
  return `<!-- REGION:${id} -->`;
}

function regionClose(id: RegionId): string {
  return `<!-- /REGION:${id} -->`;
}

export class PromptSerializerError extends Error {
  constructor(message: string) {
    super(`prompt-serializer: ${message}`);
    this.name = "PromptSerializerError";
  }
}

export function serialize(prompt: StructuringPrompt): string {
  const blocks = REGION_ORDER.map((id) => {
    const payload = JSON.stringify(prompt[id], null, 2);
    return `${regionOpen(id)}\n${payload}\n${regionClose(id)}`;
  });
  return [HEADER, ...blocks].join("\n\n") + "\n";
}

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function deserialize(text: string): StructuringPrompt {
  if (typeof text !== "string") {
    throw new PromptSerializerError("input is not a string");
  }

  const trimmed = text.trimStart();
  if (!trimmed.startsWith(HEADER_PREFIX)) {
    throw new PromptSerializerError("missing STUDIO header");
  }

  const headerMatch = trimmed.match(/^<!-- STUDIO:(v\d+) -->/);
  if (!headerMatch) {
    throw new PromptSerializerError("invalid STUDIO header format");
  }

  const version = headerMatch[1];
  if (version !== SERIALIZER_VERSION) {
    throw new PromptSerializerError(
      `unsupported version "${version}" (expected ${SERIALIZER_VERSION})`
    );
  }

  const result: Partial<StructuringPrompt> = {};

  for (const id of REGION_ORDER) {
    const openTag = escapeForRegExp(regionOpen(id));
    const closeTag = escapeForRegExp(regionClose(id));
    const re = new RegExp(`${openTag}\\s*([\\s\\S]*?)\\s*${closeTag}`);
    const match = trimmed.match(re);

    if (!match) {
      throw new PromptSerializerError(`missing region "${id}"`);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(match[1]);
    } catch (err) {
      throw new PromptSerializerError(
        `invalid JSON in region "${id}": ${(err as Error).message}`
      );
    }

    (result as Record<RegionId, unknown>)[id] = parsed;
  }

  return result as StructuringPrompt;
}

/** True if the given text looks like a studio-serialized prompt. */
export function isSerialized(text: string): boolean {
  return typeof text === "string" && text.trimStart().startsWith(HEADER_PREFIX);
}
