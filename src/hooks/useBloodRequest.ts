/**
 * Custom hook for managing blood request responses
 */

import { useState } from 'react';
import { doc, updateDoc, arrayUnion, getDoc, serverTimestamp, collection, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { notify } from 'services/notify.service';
import { captureHandledError } from '../services/errorLog.service';
import { COLLECTIONS } from '../constants/firestore';

interface RespondToRequestParams {
  requestId: string;
  donorId: string;
  donorName: string;
  donorPhone?: string;
  donorEmail?: string;
}

export const useBloodRequest = () => {
  const [responding, setResponding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reportBloodRequestError = (err: unknown, kind: string) => {
    void captureHandledError(err, {
      source: 'frontend',
      scope: 'donor',
      metadata: { kind, hook: 'useBloodRequest' },
    });
  };

  const respondToRequest = async (params: RespondToRequestParams) => {
    setResponding(true);
    setError(null);

    try {
      // donorPhone/donorEmail stay on the params type for callers, but are no
      // longer written: respondedDonors holds UIDs only, and the blood bank
      // resolves contact details from the donor profile.
      const { requestId, donorId, donorName } = params;

      // Get the blood request
      const requestRef = doc(db, COLLECTIONS.BLOOD_REQUESTS, requestId);
      const requestSnap = await getDoc(requestRef);

      if (!requestSnap.exists()) {
        throw new Error('Blood request not found');
      }

      const requestData = requestSnap.data();

      // respondedDonors is a list of donor UID strings. That is what
      // database.types.ts declares, what optimisticUpdates and donor.service
      // write, and what firestore.rules enforces -- isSelfAppendOnly() checks
      // `request.auth.uid in respondedDonors`. This hook used to append an
      // object instead, which failed twice over: the Firestore SDK throws on a
      // serverTimestamp() sentinel nested inside an array element before any
      // request is sent, and even without that the rule could never match.
      const respondedDonors: string[] = Array.isArray(requestData.respondedDonors)
        ? requestData.respondedDonors
        : [];
      if (respondedDonors.includes(donorId)) {
        notify.error('You have already responded to this request');
        setResponding(false);
        return false;
      }

      // Only respondedDonors and updatedAt may change here -- the rule pins the
      // affected keys to exactly those two.
      await updateDoc(requestRef, {
        respondedDonors: arrayUnion(donorId),
        updatedAt: serverTimestamp(),
      });

      // Notify the requester. The shape is dictated by
      // isBloodRequestNotificationForRequester() in firestore.rules: it requires
      // relatedType 'blood_request', a relatedId pointing at an existing request,
      // userId equal to that request's requesterId, and the caller's uid already
      // present in respondedDonors -- which is why this runs after the update
      // above. The previous payload targeted hospitalId with no relatedType or
      // relatedId, so the rule could never pass.
      if (requestData.requesterId) {
        try {
          const notificationRef = doc(collection(db, COLLECTIONS.NOTIFICATIONS));
          await setDoc(notificationRef, {
            userId: requestData.requesterId,
            title: 'Donor Response',
            message: `${donorName} has responded to your blood request for ${requestData.bloodType}`,
            type: 'blood_request_response',
            relatedType: 'blood_request',
            relatedId: requestId,
            priority: 'high',
            read: false,
            createdAt: serverTimestamp(),
            data: {
              requestId,
              donorId,
              donorName,
            },
          });
        } catch (notifError) {
          reportBloodRequestError(notifError, 'blood_request.notify_hospital');
          // Don't fail the whole operation if notification fails
        }
      }

      notify.success('Response sent! The blood bank will contact you soon.');
      setResponding(false);
      return true;
    } catch (err) {
      reportBloodRequestError(err, 'blood_request.respond');
      const errorMessage = err instanceof Error ? err.message : 'Failed to send response';
      setError(errorMessage);
      notify.error(errorMessage);
      setResponding(false);
      return false;
    }
  };

  return {
    respondToRequest,
    responding,
    error,
  };
};
