import { useEffect, useMemo, useRef, useState } from 'react';
import { doc, getDoc, onSnapshot, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { MessageSquareHeart, X } from 'lucide-react';
import { db } from '../../firebase';
import { COLLECTIONS } from '../../constants/firestore';
import {
  NPS_COMMENT_MAX_LENGTH,
  NPS_DISMISS_SNOOZE_MS,
  NPS_PROMPT_SOURCE,
  NPS_QUESTION_VERSION,
  NPS_SCORE,
  NPS_SEGMENT,
  clampNpsComment,
  getNpsCycleKey,
  getNpsSegmentFromScore,
  isValidNpsScore,
  normalizeNpsRole,
  toNpsDocId,
} from '../../constants/nps';
import { HOUR_MS } from '../../constants/time';
import { notify } from '../../services/notify.service';

type UserRoleLike = 'donor' | 'ngo' | 'bloodbank' | 'hospital' | 'admin' | 'superadmin' | undefined;

type NpsFeedbackPromptProps = {
  userId?: string | null;
  userRole?: UserRoleLike;
  className?: string;
  promptLabel?: string;
};

function NpsFeedbackPrompt({
  userId,
  userRole,
  className = '',
  promptLabel = 'Quarterly NPS',
}: NpsFeedbackPromptProps) {
  const role = normalizeNpsRole(userRole);
  const [cycleKey, setCycleKey] = useState(() => getNpsCycleKey());
  const [visible, setVisible] = useState(false);
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const overrideTriggeredRef = useRef(false);

  const dismissKey = useMemo(() => (userId ? `bh_nps_dismissed_${userId}_${cycleKey}` : ''), [userId, cycleKey]);

  useEffect(() => {
    const interval = setInterval(() => {
      const nextCycleKey = getNpsCycleKey();
      setCycleKey((prev) => (prev === nextCycleKey ? prev : nextCycleKey));
    }, HOUR_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let active = true;
    let unsubscribeOverride: (() => void) | null = null;
    overrideTriggeredRef.current = false;
    setChecking(true);
    setVisible(false);

    const run = async () => {
      if (!userId || !role) {
        if (active) {
          setVisible(false);
          setChecking(false);
        }
        return;
      }

      try {
        const responseId = toNpsDocId(userId, cycleKey);
        const responseRef = doc(db, COLLECTIONS.NPS_RESPONSES, responseId);
        const overrideRef = doc(db, COLLECTIONS.NPS_PROMPT_OVERRIDES, responseId);

        // Live-listen for admin manual triggers while user stays on dashboard.
        unsubscribeOverride = onSnapshot(overrideRef, async (nextOverrideSnapshot) => {
          if (!active) return;
          const overrideEnabledLive = nextOverrideSnapshot.exists() && nextOverrideSnapshot.data()?.enabled === true;
          if (!overrideEnabledLive) return;
          overrideTriggeredRef.current = true;
          try {
            const latestResponse = await getDoc(responseRef);
            if (!active || latestResponse.exists()) return;
            setVisible(true);
            void setDoc(overrideRef, {
              enabled: false,
              updatedAt: serverTimestamp(),
            }, { merge: true }).catch(() => {});
          } catch {
            // Keep listener resilient; ignore transient read failures.
          }
        });

        const [snapshot, overrideSnapshot] = await Promise.all([getDoc(responseRef), getDoc(overrideRef)]);
        if (!active) return;
        if (snapshot.exists()) {
          if (overrideSnapshot.exists() && overrideSnapshot.data()?.enabled === true) {
            void setDoc(overrideRef, {
              enabled: false,
              updatedAt: serverTimestamp(),
            }, { merge: true }).catch(() => {});
          }
          setVisible(false);
          return;
        }

        const overrideEnabled = overrideSnapshot.exists() && overrideSnapshot.data()?.enabled === true;
        if (overrideEnabled) {
          setVisible(true);
          void setDoc(overrideRef, {
            enabled: false,
            updatedAt: serverTimestamp(),
          }, { merge: true }).catch(() => {});
          return;
        }

        const dismissedAt = typeof window !== 'undefined'
          ? Number(window.localStorage.getItem(dismissKey) || 0)
          : 0;
        if (!overrideTriggeredRef.current && dismissedAt && Date.now() - dismissedAt < NPS_DISMISS_SNOOZE_MS) {
          setVisible(false);
          return;
        }

        setVisible(true);
      } catch {
        if (!active) return;
        // Fail-open: if read fails, keep UI non-blocking and hidden.
        setVisible(false);
      } finally {
        if (active) setChecking(false);
      }
    };

    void run();

    return () => {
      active = false;
      if (unsubscribeOverride) unsubscribeOverride();
    };
  }, [cycleKey, dismissKey, role, userId]);

  if (checking || !visible || !userId || !role) return null;

  const handleDismiss = () => {
    try {
      if (dismissKey) {
        window.localStorage.setItem(dismissKey, String(Date.now()));
      }
    } catch {
      // ignore storage errors
    }
    setVisible(false);
  };

  const handleSubmit = async () => {
    if (score === null || !isValidNpsScore(score)) {
      notify.error('Please select a score from 0 to 10.');
      return;
    }

    setSubmitting(true);
    try {
      const responseId = toNpsDocId(userId, cycleKey);
      const responseRef = doc(db, COLLECTIONS.NPS_RESPONSES, responseId);
      const existing = await getDoc(responseRef);
      if (existing.exists()) {
        notify.info('Feedback already submitted for this quarter.');
        setVisible(false);
        return;
      }

      const normalizedComment = clampNpsComment(comment);
      await setDoc(responseRef, {
        userId,
        userRole: role,
        score,
        segment: getNpsSegmentFromScore(score),
        ...(normalizedComment ? { comment: normalizedComment } : {}),
        cycleKey,
        questionVersion: NPS_QUESTION_VERSION,
        source: NPS_PROMPT_SOURCE,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      const overrideRef = doc(db, COLLECTIONS.NPS_PROMPT_OVERRIDES, responseId);
      const overrideSnapshot = await getDoc(overrideRef);
      if (overrideSnapshot.exists()) {
        void updateDoc(overrideRef, {
          enabled: false,
          updatedAt: serverTimestamp(),
        }).catch(() => {});
      }

      notify.success('Thank you for your feedback.');
      setVisible(false);
    } catch {
      notify.error('Failed to submit feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className={`rounded-2xl border border-red-200 bg-white p-4 shadow-sm sm:p-5 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-600">{promptLabel}</p>
          <h3 className="mt-1 text-base font-bold text-gray-900 sm:text-lg">How likely are you to recommend BloodHub?</h3>
          <p className="mt-1 text-xs text-gray-500">0 = Not likely, 10 = Extremely likely</p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50"
          aria-label={`Dismiss ${promptLabel} prompt`}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-6 gap-2 sm:grid-cols-11">
        {Array.from({ length: NPS_SCORE.max - NPS_SCORE.min + 1 }, (_, index) => {
          const value = index + NPS_SCORE.min;
          const isSelected = score === value;
          return (
            <button
              key={`nps-score-${value}`}
              type="button"
              onClick={() => setScore(value)}
              className={`rounded-lg border px-2 py-2 text-sm font-semibold transition-all ${
                isSelected
                  ? 'border-red-600 bg-red-600 text-white shadow-sm'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-red-300 hover:bg-red-50'
              }`}
              aria-pressed={isSelected}
            >
              {value}
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500">
        <span>Detractor ({NPS_SEGMENT.detractor})</span>
        <span>Passive ({NPS_SEGMENT.passive})</span>
        <span>Promoter ({NPS_SEGMENT.promoter})</span>
      </div>

      <div className="mt-4">
        <label className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-gray-500">
          <MessageSquareHeart className="h-4 w-4 text-red-500" />
          Optional comment
        </label>
        <textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          rows={3}
          maxLength={NPS_COMMENT_MAX_LENGTH}
          placeholder="What influenced your score?"
          className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
        />
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={handleDismiss}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          disabled={submitting}
        >
          Not now
        </button>
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={submitting}
          className="rounded-lg border border-red-600 bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
        >
          {submitting ? 'Submitting...' : 'Submit feedback'}
        </button>
      </div>
    </section>
  );
}

export default NpsFeedbackPrompt;
