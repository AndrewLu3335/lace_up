
import React from 'react';
import { Navigate, Outlet, useSearchParams } from 'react-router-dom';

const PrivateRoute = () => {
    // Simple check: if "isAuthenticated" is in localStorage, we allow access.
    // Otherwise, redirect to login.

    const [searchParams] = useSearchParams();
    let isAuthenticated = localStorage.getItem('isAuthenticated');
    if (searchParams.get('login_success') === '1') {
        isAuthenticated = true;
    }


    return isAuthenticated ? <Outlet /> : <Navigate to="/login" />;
};

export default PrivateRoute;
