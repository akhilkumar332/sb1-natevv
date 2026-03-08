import { beforeEach, describe, expect, it } from 'vitest';
import {
  getCmsDiagnosticsSummary,
  recordCmsOperationFailure,
  resetCmsDiagnostics,
} from '../cmsDiagnostics.service';

describe('cmsDiagnostics.service', () => {
  beforeEach(() => {
    localStorage.clear();
    resetCmsDiagnostics();
  });

  it('records and summarizes failures by kind', () => {
    recordCmsOperationFailure('page_save', 'page failed');
    recordCmsOperationFailure('post_save', 'post failed');
    recordCmsOperationFailure('schedule_transition', 'schedule failed');

    const summary = getCmsDiagnosticsSummary();
    expect(summary.totalFailures).toBe(3);
    expect(summary.recent24hFailures).toBe(3);
    expect(summary.byKind.page_save).toBe(1);
    expect(summary.byKind.post_save).toBe(1);
    expect(summary.byKind.schedule_transition).toBe(1);
    expect(summary.lastFailureAt).not.toBeNull();
  });

  it('resets diagnostics state', () => {
    recordCmsOperationFailure('page_save', 'page failed');
    resetCmsDiagnostics();
    const summary = getCmsDiagnosticsSummary();
    expect(summary.totalFailures).toBe(0);
    expect(summary.recent24hFailures).toBe(0);
    expect(summary.lastFailureAt).toBeNull();
  });
});
