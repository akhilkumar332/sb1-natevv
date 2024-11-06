// src/utils/authStorage.ts

export const authStorage = {
    setAuthToken: (token: string) => {
      localStorage.setItem('authToken', token);
      localStorage.setItem('lastLoginTime', Date.now().toString());
      localStorage.setItem('lastActiveTime', Date.now().toString());
    },
  
    clearAuthData: () => {
      localStorage.removeItem('authToken');
      localStorage.removeItem('lastLoginTime');
      localStorage.removeItem('lastActiveTime');
      localStorage.removeItem('user');
      sessionStorage.clear();
    },
  
    updateLastActiveTime: () => {
      localStorage.setItem('lastActiveTime', Date.now().toString());
    },
    
    getLastActiveTime: (): number => {
      const lastActiveTime = localStorage.getItem('lastActiveTime');
      return lastActiveTime ? parseInt(lastActiveTime, 10) : Date.now();
    },
  
    getLastLoginTime: (): number => {
      const lastLoginTime = localStorage.getItem('lastLoginTime');
      return lastLoginTime ? parseInt(lastLoginTime, 10) : Date.now();
    }
};