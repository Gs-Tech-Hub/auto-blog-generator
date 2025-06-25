import React, { createContext, useContext, useState, useEffect } from 'react';

const UserContext = createContext();

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);

  // Helper to parse token
  const parseToken = (token) => {
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return { id: payload.userId, email: payload.email };
    } catch {
      return null;
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    setUser(parseToken(token));
    // Listen for token changes (e.g., login/logout in other tabs)
    const handleStorage = (e) => {
      if (e.key === 'token') {
        setUser(parseToken(e.newValue));
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const login = (userObj, token) => {
    if (token) localStorage.setItem('token', token);
    setUser(userObj);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <UserContext.Provider value={{ user, setUser: login, logout }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
