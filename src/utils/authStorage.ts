// src/utils/authStorage.ts

export const authStorage = {
    setAuthToken: (token: string) => {
      localStorage.setItem('authToken', token);
      localStorage.setItem('lastLoginTime', Date.now().toString());
    },
  
    clearAuthData: () => {
      localStorage.removeItem('authToken');
      localStorage.removeItem('lastLoginTime');
      localStorage.removeItem('user');
      sessionStorage.clear();
    },
  
    updateLastActiveTime: () => {
      localStorage.setItem('lastLoginTime', Date.now().toString());
    }
  };