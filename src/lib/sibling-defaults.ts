import { SIBLING_PRMT_CDS, type SiblingPrmtCd } from "./prompt-codes";

export interface SiblingDefault {
  prompt: string;
  json_schema: string | null;
}

/**
 * TODO(sibling-defaults): Replace the placeholder payloads below with real
 * PA4000 / PA1000 / PC1000 content once the user provides them.
 *
 * Per docs/unified-workspace-plan.md §7 blocker resolution, we proceed with
 * placeholders and the expectation that users will edit the records via the
 * sidebar (step 7) after the initial apply.
 *
 * When real values arrive, only this file needs to change.
 */
export const SIBLING_DEFAULTS: Record<SiblingPrmtCd, SiblingDefault> = {
  PA4000: {
    prompt: "[TODO: PA4000 기본 프롬프트를 실제 값으로 교체하세요]",
    json_schema: null,
  },
  PA1000: {
    prompt: "[TODO: PA1000 기본 프롬프트를 실제 값으로 교체하세요]",
    json_schema: null,
  },
  PC1000: {
    prompt: "[TODO: PC1000 기본 프롬프트를 실제 값으로 교체하세요]",
    json_schema: null,
  },
};

export function getSiblingDefault(prmtCd: SiblingPrmtCd): SiblingDefault {
  return SIBLING_DEFAULTS[prmtCd];
}

/** Returns true if every SIBLING_PRMT_CD has a corresponding default. */
export function assertSiblingDefaultsComplete(): void {
  for (const cd of SIBLING_PRMT_CDS) {
    if (!SIBLING_DEFAULTS[cd]) {
      throw new Error(`sibling-defaults: missing entry for ${cd}`);
    }
  }
}
