/**
 * Custom hook for managing blood request responses
 */

import { useState } from 'react';
import { doc, updateDoc, arrayUnion, getDoc, serverTimestamp, collection, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import toast from 'react-hot-toast';

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
        toast.error('You have already responded to this request');
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
          console.error('Failed to send notification:', notifError);
          // Don't fail the whole operation if notification fails
        }
      }

      toast.success('Response sent! The blood bank will contact you soon.');
      setResponding(false);
      return true;
    } catch (err) {
      console.error('Error responding to blood request:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to send response';
      setError(errorMessage);
      toast.error(errorMessage);
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
