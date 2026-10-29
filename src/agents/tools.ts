// src/agents/tools.ts

import type { SymptomInfo, NextStepResult, NextStep } from './types';
import { findKnowledgeEntry, KNOWLEDGE_BASE } from './knowledge';
import type { InformationProvider } from '../services/informationProvider';

/**
 * Default local information provider.
 * This implements the InformationProvider interface using our local knowledge base.
 *
 * WHY a separate provider?
 * In the future, you could swap this with an API-based provider
 * without changing any agent code. This is the "Dependency Injection" pattern.
 */
export const localProvider: InformationProvider = {
  lookupInfo,
  suggestNextStep,
};

/**
 * TOOL A: lookup_info(symptom)
 *
 * Given a symptom name, looks up general information from our knowledge base.
 *
 * Returns:
 * - matchedTopics: which topics in the KB matched
 * - information: the general info text
 * - coverage: how well we cover this symptom
 * - references: source labels
 *
 * @param symptom - A canonical symptom name (e.g., "fever") or alias (e.g., "high temperature")
 */
export function lookupInfo(symptom: string): SymptomInfo {
  const entry = findKnowledgeEntry(symptom);

  // If we don't know this symptom, say so honestly
  if (!entry) {
    return {
      symptom,
      matchedTopics: [],
      information:
        `Our demo knowledge base does not have specific information about "${symptom}". ` +
        'This does not mean your concern is not valid. ' +
        'Please consult a healthcare professional for proper evaluation.',
      coverage: 'not_covered',
      references: [],
    };
  }

  // Build a comprehensive information string from multiple fields
  const information = [
    entry.generalInfo,
    `Common causes include: ${entry.commonCauses}`,
    `General self-care: ${entry.selfCareInfo}`,
    `Consider seeking help if: ${entry.seekHelpIf}`,
  ].join('\n\n');

  return {
    symptom: entry.name,
    matchedTopics: [entry.category, entry.name],
    information,
    coverage: 'covered',
    references: ['sT23 Demo Knowledge Base (not clinically reviewed)'],
  };
}

/**
 * TOOL B: suggest_next_step(symptom)
 *
 * Given a symptom, returns a recommendation from four categories:
 * 'rest' | 'hydrate' | 'see_professional' | 'urgent'
 *
 * The rules are deterministic and explicitly documented:
 *
 * 1. If the symptom is in the knowledge base, use its defaultStep
 * 2. If the symptom is NOT in the knowledge base, recommend 'see_professional'
 *    (conservative: we don't know enough to give reassurance)
 * 3. The PlannerAgent may override this based on urgency and combinations
 *
 * @param symptom - A canonical symptom name
 */
export function suggestNextStep(symptom: string): NextStepResult {
  const entry = findKnowledgeEntry(symptom);

  if (!entry) {
    return {
      recommendation: 'see_professional',
      reasons: [
        `"${symptom}" is not in our demo knowledge base.`,
        'When information is limited, professional evaluation is recommended.',
        'This is a conservative default, not a clinical assessment.',
      ],
      symptom,
    };
  }

  const reasons: string[] = [];

  // Chest pain always gets see_professional at minimum
  if (entry.name === 'chest pain') {
    reasons.push('Chest pain should always be evaluated by a healthcare professional.');
    return {
      recommendation: 'see_professional',
      reasons,
      symptom: entry.name,
    };
  }

  // Use the knowledge base default
  reasons.push(
    `Based on general information for ${entry.name}, ` +
    `"${entry.defaultStep}" is a reasonable general suggestion.`
  );
  reasons.push('This is not a substitute for professional medical advice.');

  return {
    recommendation: entry.defaultStep,
    reasons,
    symptom: entry.name,
  };
}

/**
 * Priority map for comparing recommendations.
 * Higher number = more serious.
 *
 * WHY do we need this?
 * When a user has multiple symptoms, we need to pick the MOST serious
 * recommendation. This map lets us compare: urgent > see_professional > hydrate > rest.
 */
export const STEP_PRIORITY: Record<NextStep, number> = {
  rest: 0,
  hydrate: 1,
  see_professional: 2,
  urgent: 3,
};