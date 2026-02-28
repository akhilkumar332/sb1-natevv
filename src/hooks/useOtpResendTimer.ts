import { useEffect, useRef, useState } from 'react';

export const useOtpResendTimer = () => {
  const [otpResendTimer, setOtpResendTimer] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const startResendTimer = (seconds = 30) => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    setOtpResendTimer(seconds);
    intervalRef.current = setInterval(() => {
      setOtpResendTimer((prevTime) => {
        if (prevTime <= 1) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          return 0;
        }
        return prevTime - 1;
      });
    }, 1000);
  };

  return { otpResendTimer, startResendTimer };
};
