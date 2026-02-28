import NotificationPermissionPrompt from './NotificationPermissionPrompt';
import { useFcmNotificationBridge } from '../../hooks/useFcmNotificationBridge';

type PortalNotificationBridgeProps = {
  disabled?: boolean;
  className?: string;
};

function PortalNotificationBridge({ disabled = false, className = 'mb-4' }: PortalNotificationBridgeProps) {
  useFcmNotificationBridge();

  if (disabled) return null;

  return (
    <div className={className}>
      <NotificationPermissionPrompt />
    </div>
  );
}

export default PortalNotificationBridge;

