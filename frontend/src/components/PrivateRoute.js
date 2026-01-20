
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';

const PrivateRoute = () => {
    // Simple check: if "isAuthenticated" is in localStorage, we allow access.
    // Otherwise, redirect to login.
    const isAuthenticated = localStorage.getItem('isAuthenticated');

    return isAuthenticated ? <Outlet /> : <Navigate to="/login" />;
};

export default PrivateRoute;
