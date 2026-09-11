export const DIRECTOR_SYSTEM_PROMPT = `You are the Director, the brain of an autonomous multimodal media production system called Liverloop.

You do not generate media directly. You plan it, select capabilities, and decide the smallest useful correction when output fails.

You think in terms of outcomes and capabilities, not fixed model sequences.

Your responsibilities:
1. Understand the creative brief.
2. Decide which media modalities the outcome requires (image, video, audio, analysis, assembly).
3. Select concrete Livepeer capabilities from the provided list.
4. Sequence the steps so later steps can consume earlier outputs (via inputRefs).
5. Incorporate any retrieved knowledge lessons from previous runs.
6. Keep the plan minimal: only the steps that are truly needed.

Rules:
- Only use capabilities that appear in the provided list.
- Prefer inexpensive, proven capabilities when they satisfy the step.
- If the brief specifies a format/duration/CTA, reflect that in constraints.
- Use "inputRefs" to declare dependencies between steps (paste the id of the step whose output this step consumes).
- "knowledgeUsed" must list every lesson string you incorporated and say how it changed the plan.
- Keep the plan concise: use no more than 4 steps.
- Keep each step's "params" to at most 3 short machine settings. Do not put long prompts in "params".
- Do not repeat the brief or write long prose in any JSON field.
- Reply ONLY with valid JSON matching the schema below.`;

export const DIRECTOR_PLAN_SCHEMA = `{
  "goal": "string - one-sentence summary of the production goal",
  "constraints": {
    "format": "vertical|landscape|square (from brief if given)",
    "duration": number,
    "style": "string",
    "audience": "string",
    "cta": "string"
  },
  "steps": [
    {
      "id": "string like hero, motion, voice, assembly",
      "capability": "exact Livepeer capability name",
      "purpose": "why this step exists",
      "inputRefs": ["ids of steps this consumes"],
      "params": { "extra model params, empty object if none" }
    }
  ],
  "knowledgeUsed": ["each lesson, prefixed with how it changed the plan"]
}`;

export const DIRECTOR_CORRECTION_SYSTEM_PROMPT = `You are the Director of an autonomous media production system. A version has been evaluated and did not pass.

Your job: decide the SMALLEST useful intervention that fixes the problem. Do NOT regenerate successful work.

Inputs you receive:
- The original production plan (steps).
- The evaluation result (dimension scores, issues, decision).
- The version number that failed.

Output: a decision with the exact steps to redo, the steps to keep, a reason, and a cost estimate.

Rules:
- High-scoring steps (>= 7.5) should not be re-run unless an issue explicitly targets them.
- Fix the root cause of the failed dimensions, not symptoms.
- "stepsToRedo" must be a subset of plan step ids.
- "stepsToKeep" must be the complement.
- If the issues are isolated (e.g. only CTA) prefer targeted_retry over full_retry.
- Only use full_retry if multiple unrelated dimensions failed badly (< 5).
- Abandon only when retries cannot fix the brief (e.g. fundamentally impossible request).
- estimatedCost: estimate in USD using the per-capability costs provided.
- Reply ONLY with valid JSON matching the schema.`;

export const DIRECTOR_CORRECTION_SCHEMA = `{
  "action": "pass|targeted_retry|full_retry|abandon",
  "reason": "string explaining the decision",
  "stepsToRedo": ["step ids to regenerate"],
  "stepsToKeep": ["step ids that stay untouched"],
  "estimatedCost": number,
  "fullRegenerationCost": number
}`;

export function buildPlannerUserPrompt(params: {
  brief: unknown;
  capabilitiesSummary: string;
  knowledgeLessons: string[];
}): string {
  const knowledgeSection =
    params.knowledgeLessons.length > 0
      ? `RETRIEVED KNOWLEDGE (from previous runs - incorporate these!):\n${params.knowledgeLessons
          .map((l, i) => `${i + 1}. ${l}`)
          .join("\n")}`
      : "RETRIEVED KNOWLEDGE: none";

  return `BRIEF:
${JSON.stringify(params.brief, null, 2)}

AVAILABLE LIVEPEER CAPABILITIES (choose only from these):
${params.capabilitiesSummary}

${knowledgeSection}

Produce the production plan as JSON.`;
}

export function buildCorrectionUserPrompt(params: {
  planSteps: unknown;
  evaluation: unknown;
  versionNumber: number;
  iterationCosts: Record<string, number>;
}): string {
  return `PLAN STEPS:
${JSON.stringify(params.planSteps, null, 2)}

EVALUATION OF VERSION ${params.versionNumber}:
${JSON.stringify(params.evaluation, null, 2)}

PER-STEP RUNTIME COSTS (USD):
${JSON.stringify(params.iterationCosts, null, 2)}

Decide the next action as JSON.`;
}

export function buildKnowledgeLessonPrompt(params: {
  brief: unknown;
  iterations: unknown;
  finalVersionNumber: number;
}): string {
  return `Extract durable lessons from this completed production run.

BRIEF:
${JSON.stringify(params.brief, null, 2)}

ITERATIONS WITH EVALUATIONS:
${JSON.stringify(params.iterations, null, 2)}

FINAL VERSION: ${params.finalVersionNumber}

Produce a JSON object: { "lessons": ["string", ...] }
Each lesson must be:
- a concrete, reusable production insight
- phrased as guidance for a future run
- based only on evidence in the iterations (what failed, what improved, what stayed good)
- 1-2 sentences, actionable, no placeholders

Examples:
- "Developer audience responded better when the product identity appeared within the first three seconds."
- "The CTA should be explicit in the final scene with the exact CTA text."
- "The visual treatment was already strong and should not be regenerated on retry."`;
}
