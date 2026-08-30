// GENERATED FILE — do not edit.
// Vendored from backend/src/engine by `node scripts/sync-engine.mjs`.
// Edit the backend copy, then re-run that script.

/**
 * Task 7 — D1 dataset audit and hard-edge classification.
 *
 * Proves AC1 and AC2 against a case rather than asserting them: reports,
 * does not throw, so a case that falls short is visible, not hidden by a
 * crash.
 */

import type { RawCase, StudentResult } from './types.js';

export type Archetype = 'strongAverageFailure' | 'practicalFailPassingTheory' | 'weakOptional' | 'absent';

export interface HardEdgeStudent {
  id: string;
  name: string;
  archetypes: Archetype[];
}

export interface AuditCriterion {
  id: string;
  description: string;
  pass: boolean;
  detail: string;
}

export interface CaseAudit {
  caseId: string;
  pass: boolean;
  criteria: AuditCriterion[];
  hardEdgeStudents: HardEdgeStudent[];
  archetypeExamples: Record<Archetype, HardEdgeStudent[]>;
}

const ARCHETYPE_LABEL: Record<Archetype, string> = {
  strongAverageFailure: 'strong-average failure (cancelled, uncancelled GPA >= 3.50)',
  practicalFailPassingTheory: 'practical fail with passing theory',
  weakOptional: 'optional below the helping point (grade point <= 2.0)',
  absent: 'absent in at least one subject',
};

function archetypesOf(r: StudentResult): Archetype[] {
  const archetypes: Archetype[] = [];

  if (!r.passed && Number(r.gpa.uncancelledGpa) >= 3.5) {
    archetypes.push('strongAverageFailure');
  }
  if (r.subjects.some((s) => s.hasPractical && !s.absent && s.theory !== null && s.theory >= 25 && s.practicalFailed)) {
    archetypes.push('practicalFailPassingTheory');
  }
  if (r.flags.optional) archetypes.push('weakOptional');
  if (r.flags.absent) archetypes.push('absent');

  return archetypes;
}

/** AC1 + AC2 for one case, plus the students who occupy each hard edge. */
export function auditCase(caseDef: Pick<RawCase, 'case_id' | 'subjects' | 'compulsory' | 'students'>, results: StudentResult[]): CaseAudit {
  const criteria: AuditCriterion[] = [];
  const classes = new Set(caseDef.students.map((s) => s.class));
  const compulsorySet = new Set(caseDef.compulsory);

  criteria.push({
    id: 'AC1-count',
    description: 'at least 60 students',
    pass: caseDef.students.length >= 60,
    detail: `${caseDef.students.length} students`,
  });
  criteria.push({
    id: 'AC1-classes',
    description: 'exactly 2 distinct classes',
    pass: classes.size === 2,
    detail: `classes: ${[...classes].join(', ') || 'none'}`,
  });

  const markCountViolations: string[] = [];
  const optionalViolations: string[] = [];
  for (const s of caseDef.students) {
    const markCount = Object.keys(s.marks).length;
    if (markCount !== compulsorySet.size + 1) {
      markCountViolations.push(`${s.id} has ${markCount} marks`);
    }
    if (compulsorySet.has(s.optional)) {
      optionalViolations.push(`${s.id}: optional "${s.optional}" is also compulsory`);
    }
  }
  criteria.push({
    id: 'AC1-markcount',
    description: 'every student has exactly 7 marks (6 compulsory + their optional)',
    pass: markCountViolations.length === 0,
    detail: markCountViolations.length === 0 ? 'all students have 7 marks' : markCountViolations.slice(0, 5).join('; '),
  });
  criteria.push({
    id: 'AC1-optional',
    description: "the optional is one of the case's non-compulsory subject codes",
    pass: optionalViolations.length === 0,
    detail: optionalViolations.length === 0 ? 'all optionals are non-compulsory' : optionalViolations.slice(0, 5).join('; '),
  });

  const byArchetype: Record<Archetype, HardEdgeStudent[]> = {
    strongAverageFailure: [], practicalFailPassingTheory: [], weakOptional: [], absent: [],
  };
  const hardEdgeStudents: HardEdgeStudent[] = [];
  for (const r of results) {
    const archetypes = archetypesOf(r);
    if (archetypes.length === 0) continue;
    const entry: HardEdgeStudent = { id: r.id, name: r.name, archetypes };
    hardEdgeStudents.push(entry);
    for (const a of archetypes) byArchetype[a].push(entry);
  }

  for (const archetype of Object.keys(ARCHETYPE_LABEL) as Archetype[]) {
    criteria.push({
      id: `AC2-${archetype}`,
      description: `at least 1 student: ${ARCHETYPE_LABEL[archetype]}`,
      pass: byArchetype[archetype].length >= 1,
      detail: `${byArchetype[archetype].length} student(s): ${byArchetype[archetype].slice(0, 3).map((s) => s.id).join(', ')}`,
    });
  }
  criteria.push({
    id: 'AC2-total',
    description: 'at least 8 hard-edge students in total',
    pass: hardEdgeStudents.length >= 8,
    detail: `${hardEdgeStudents.length} hard-edge student(s)`,
  });

  return {
    caseId: caseDef.case_id,
    pass: criteria.every((c) => c.pass),
    criteria,
    hardEdgeStudents,
    archetypeExamples: byArchetype,
  };
}
