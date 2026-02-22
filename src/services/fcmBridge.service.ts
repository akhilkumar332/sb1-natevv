type FcmBridgePayload = {
  messageId?: string;
  from?: string;
  notification?: {
    title?: string;
    body?: string;
  };
  data?: Record<string, any>;
};

const BRIDGE_URL = (import.meta as any).env?.VITE_FCM_BRIDGE_URL || '/.netlify/functions/fcm-bridge';

export const sendFcmToBridge = async (payload: FcmBridgePayload): Promise<boolean> => {
  if (typeof window === 'undefined') return false;
  if (!payload) return false;

  const userId = payload.data?.userId;
  if (!userId) return false;

  const body = {
    payload,
    userId,
    userRole: payload.data?.userRole || payload.data?.role,
    messageId: payload.messageId || payload.data?.messageId,
    receivedAt: Date.now(),
    source: 'foreground',
  };

  try {
    const response = await fetch(BRIDGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
    });
    return response.ok;
  } catch {
    return false;
  }
};
