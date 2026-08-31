import { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('jwt_token');
    if (token) {
      // Validate token and fetch user data from backend
      authService.getCurrentUser(token)
        .then(userData => {
          setUser({ token, ...userData });
        })
        .catch(err => {
          console.error('Failed to validate token:', err);
          localStorage.removeItem('jwt_token');
          setUser(null);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const login = (token, userData = {}) => {
    localStorage.setItem('jwt_token', token);
    setUser({ token, ...userData });
  };

  const logout = () => {
    localStorage.removeItem('jwt_token');
    setUser(null);
  };

  const updateUser = (userData) => {
    setUser(current => current ? { ...current, ...userData } : current);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
