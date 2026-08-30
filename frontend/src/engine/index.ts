// GENERATED FILE — do not edit.
// Vendored from backend/src/engine by `node scripts/sync-engine.mjs`.
// Edit the backend copy, then re-run that script.

/** Public surface of the engine. Internal helpers are not re-exported. */

export * from './types.js';
export * from './rules.js';
export { partsOf, displayAbsent, displayTheory, displayPractical, displayTotal, displayGradePoint, displayGpa, MarkFormatError } from './format.js';
export type { MarkParts } from './format.js';
export { gradeSubject } from './grade.js';
export { aggregate } from './gpa.js';
export type { GpaResult } from './gpa.js';
export { evaluateStudent, evaluateCase, StudentMarkError } from './engine.js';
export { buildChecklists } from './checklists.js';
export type { ChecklistRow, MultipleRow, Checklists } from './checklists.js';
export { summarise } from './summary.js';
export { auditCase } from './audit.js';
export type { Archetype, HardEdgeStudent, AuditCriterion, CaseAudit } from './audit.js';
