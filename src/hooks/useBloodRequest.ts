/**
 * Custom hook for managing blood request responses
 */

import { useState } from 'react';
import { doc, updateDoc, arrayUnion, getDoc, serverTimestamp, collection, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { notify } from 'services/notify.service';
import { captureHandledError } from '../services/errorLog.service';

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
      const { requestId, donorId, donorName, donorPhone, donorEmail } = params;

      // Get the blood request
      const requestRef = doc(db, 'bloodRequests', requestId);
      const requestSnap = await getDoc(requestRef);

      if (!requestSnap.exists()) {
        throw new Error('Blood request not found');
      }

      const requestData = requestSnap.data();

      // Check if donor already responded
      const respondedDonors = requestData.respondedDonors || [];
      if (respondedDonors.some((d: any) => d.donorId === donorId)) {
        notify.error('You have already responded to this request');
        setResponding(false);
        return false;
      }

      // Add donor to responded list
      await updateDoc(requestRef, {
        respondedDonors: arrayUnion({
          donorId,
          donorName,
          donorPhone,
          donorEmail,
          respondedAt: serverTimestamp(),
          status: 'pending',
        }),
        updatedAt: serverTimestamp(),
      });

      // Send notification to hospital
      if (requestData.hospitalId) {
        try {
          const notificationRef = doc(collection(db, 'notifications'));
          await setDoc(notificationRef, {
            userId: requestData.hospitalId,
            title: 'Donor Response',
            message: `${donorName} has responded to your blood request for ${requestData.bloodType}`,
            type: 'blood_request_response',
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
