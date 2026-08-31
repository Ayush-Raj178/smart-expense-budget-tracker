import { createContext, useContext, useEffect, useState } from 'react';
import { authService } from '@/services/authService';

const FeatureFlagsContext = createContext(null);

export const FeatureFlagsProvider = ({ children }) => {
  const [otpVerificationEnabled, setOtpVerificationEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    authService.getFeatureFlags()
      .then((flags) => {
        if (active) setOtpVerificationEnabled(flags.otpVerificationEnabled !== false);
      })
      .catch(() => {
        // Fail closed: retain full verification if the public configuration cannot be loaded.
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <FeatureFlagsContext.Provider value={{ otpVerificationEnabled, loading }}>
      {children}
    </FeatureFlagsContext.Provider>
  );
};

export const useFeatureFlags = () => {
  const context = useContext(FeatureFlagsContext);
  if (!context) {
    throw new Error('useFeatureFlags must be used within a FeatureFlagsProvider');
  }
  return context;
};
