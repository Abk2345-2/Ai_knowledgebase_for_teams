import { createContext, useState, useContext, useEffect } from 'react';
import { api } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            const userData = JSON.parse(localStorage.getItem('user') || '{}');
            setUser(userData);
        }
        setLoading(false);
    }, []);

    const login = async (email, password) => {
        try {
            const response = await api.login(email, password);
            localStorage.setItem('token', response.access_token);
            localStorage.setItem('user', JSON.stringify({ email }));
            setUser(email);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.response?.data?.detail || 'Login Failed' };
        }
    };

    const register = async (email, name, password) => {
        try {
            await api.register(email, name, password);
            return await login(email, password);
        } catch (error) {
            return { success: false, error: error?.response?.data?.detail || 'Registration Failed' };
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
    }

    return (
        <AuthContext.Provider value={{ user, login, register, logout, loading }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
}