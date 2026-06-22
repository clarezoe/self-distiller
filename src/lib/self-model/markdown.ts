// Render a Self Model (§12 JSON) as readable Markdown (PRD §10.6). Pure — unit-tested.

import type {
  LanguageModel,
  RelationshipModel,
  RoleModel,
  SceneModel,
  SelfModelJson,
} from "./schema";

function bullets(label: string, items?: string[]): string[] {
  if (!items || items.length === 0) return [];
  return [`**${label}:**`, ...items.map((i) => `- ${i}`), ""];
}

function field(label: string, value?: string): string[] {
  if (!value) return [];
  return [`- **${label}:** ${value}`];
}

function fieldArray(label: string, items?: string[]): string[] {
  if (!items || items.length === 0) return [];
  return [`- **${label}:** ${items.join(", ")}`];
}

export function toMarkdown(model: SelfModelJson): string {
  const lines: string[] = [];
  lines.push(`# Self Model v${model.version}`, "");

  // Core Self
  const c = model.core_self ?? {};
  const coreLines = [
    ...bullets("Identity", c.identity),
    ...bullets("Values", c.values),
    ...bullets("Long-term preferences", c.long_term_preferences),
    ...bullets("Decision patterns", c.decision_patterns),
    ...bullets("Communication boundaries", c.communication_boundaries),
    ...bullets("Stable dislikes", c.stable_dislikes),
  ];
  lines.push("## Core Self", "");
  lines.push(...(coreLines.length ? coreLines : ["_No core self captured yet._", ""]));

  // Language models
  lines.push("## Language Models", "");
  const langEntries = Object.entries(model.language_models ?? {});
  if (langEntries.length === 0) {
    lines.push("_None yet._", "");
  } else {
    for (const [key, lm] of langEntries) {
      lines.push(`### ${key}`);
      lines.push(...renderLanguage(lm));
      lines.push("");
    }
  }

  // Role models
  lines.push("## Role Models", "");
  const roleEntries = Object.entries(model.role_models ?? {});
  if (roleEntries.length === 0) {
    lines.push("_None yet._", "");
  } else {
    for (const [key, rm] of roleEntries) {
      lines.push(`### ${key}`);
      lines.push(...renderRole(rm));
      lines.push("");
    }
  }

  // Relationship models
  lines.push("## Relationship Models", "");
  const relEntries = Object.entries(model.relationship_models ?? {});
  if (relEntries.length === 0) {
    lines.push("_None yet._", "");
  } else {
    for (const [key, rm] of relEntries) {
      lines.push(`### ${key}`);
      lines.push(...renderRelationship(rm));
      lines.push("");
    }
  }

  // Scene models
  lines.push("## Scene Models", "");
  const sceneEntries = Object.entries(model.scene_models ?? {});
  if (sceneEntries.length === 0) {
    lines.push("_None yet._", "");
  } else {
    for (const [key, sm] of sceneEntries) {
      lines.push(`### ${key}`);
      lines.push(...renderScene(sm));
      lines.push("");
    }
  }

  // Current state
  const cs = model.current_state ?? {};
  const csLines = [
    ...bullets("Recent changes", cs.recent_changes),
    ...bullets("Temporary mood patterns", cs.temporary_mood_patterns),
    ...bullets("Language progress", cs.language_progress),
  ];
  if (csLines.length) {
    lines.push("## Current State", "", ...csLines);
  }

  // Boundaries
  const b = model.boundaries ?? {};
  const bLines = [
    ...bullets("Must not invent", b.must_not_invent),
    ...bullets("Requires user confirmation", b.requires_user_confirmation),
    ...bullets("Sensitive topics", b.sensitive_topics),
  ];
  if (bLines.length) {
    lines.push("## Boundaries", "", ...bLines);
  }

  // Unknowns
  if (model.unknowns && model.unknowns.length) {
    lines.push("## Unknowns", "", ...model.unknowns.map((u) => `- ${u}`), "");
  }

  // Suggested interviews
  if (model.suggested_interviews && model.suggested_interviews.length) {
    lines.push("## Suggested Interviews", "");
    for (const s of model.suggested_interviews) {
      const meta = [s.interviewer_persona, s.target_context].filter(Boolean).join(" · ");
      lines.push(`- ${s.goal}${meta ? ` _(${meta})_` : ""}`);
    }
    lines.push("");
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

function renderLanguage(lm: LanguageModel): string[] {
  return [
    ...field("Voice", lm.voice_summary),
    ...field("Professional style", lm.professional_style),
    ...field("Casual style", lm.casual_style),
    ...field("Current level", lm.current_level),
    ...field("Improvement trend", lm.improvement_trend),
    ...fieldArray("Sentence patterns", lm.sentence_patterns),
    ...fieldArray("Tone patterns", lm.tone_patterns),
    ...fieldArray("Common words", lm.common_words),
    ...fieldArray("Common mistakes", lm.common_mistakes),
    ...fieldArray("Avoid", lm.avoid),
    ...(lm.polish_policy
      ? [`- **Polish policy:** ${JSON.stringify(lm.polish_policy)}`]
      : []),
    ...(typeof lm.confidence === "number"
      ? [`- **Confidence:** ${lm.confidence}`]
      : []),
  ];
}

function renderRole(rm: RoleModel): string[] {
  return [
    ...field("Style", rm.style_summary),
    ...field("Feedback style", rm.feedback_style),
    ...field("Conflict style", rm.conflict_style),
    ...field("Task assignment style", rm.task_assignment_style),
    ...field("Comfort style", rm.comfort_style),
    ...field("Worry style", rm.worry_style),
    ...field("Discipline style", rm.discipline_style),
    ...fieldArray("Boundaries", rm.boundaries),
    ...fieldArray("Evidence", rm.evidence_ids),
  ];
}

function renderRelationship(rm: RelationshipModel): string[] {
  return [
    ...field("Style", rm.style_summary),
    ...field("Humor", rm.humor),
    ...field("Comfort style", rm.comfort_style),
    ...field("Reply length", rm.reply_length),
    ...field("Emoji policy", rm.emoji_policy),
    ...fieldArray("Sensitive boundaries", rm.sensitive_boundaries),
    ...fieldArray("Evidence", rm.evidence_ids),
  ];
}

function renderScene(sm: SceneModel): string[] {
  return [
    ...field("Default intent", sm.default_intent),
    ...fieldArray("Typical structure", sm.typical_structure),
    ...fieldArray("Avoid", sm.avoid),
  ];
}
