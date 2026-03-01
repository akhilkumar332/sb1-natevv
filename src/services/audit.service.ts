import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { AuditLog } from '../types/database.types';
import { captureHandledError } from './errorLog.service';
import { COLLECTIONS } from '../constants/firestore';

export type AuditAction =
  | 'role_change'
  | 'portal_switch'
  | 'portal_clear'
  | 'impersonation_start'
  | 'impersonation_stop'
  | 'admin_update_user_status'
  | 'admin_verify_user'
  | 'admin_delete_user'
  | 'admin_approve_verification'
  | 'admin_reject_verification'
  | 'admin_mark_under_review';

export interface AuditEventInput {
  actorUid: string;
  actorRole: string;
  action: AuditAction | string;
  targetUid?: string;
  metadata?: Record<string, any>;
}

export const logAuditEvent = async (event: AuditEventInput): Promise<void> => {
  try {
    const payload: Omit<AuditLog, 'id'> = {
      actorUid: event.actorUid,
      actorRole: event.actorRole,
      action: event.action,
      ...(event.targetUid ? { targetUid: event.targetUid } : {}),
      ...(event.metadata ? { metadata: event.metadata } : {}),
      createdAt: serverTimestamp() as unknown as AuditLog['createdAt'],
    };
    await addDoc(collection(db, COLLECTIONS.AUDIT_LOGS), payload);
  } catch (error) {
    void captureHandledError(error, {
      source: 'frontend',
      scope: 'admin',
      metadata: { kind: 'audit.log.write' },
    });
  }
};
