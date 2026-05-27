
import React from 'react';
import { Navigate, Outlet} from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Spin } from 'antd';
const PrivateRoute = () => {
    const { status } = useAuth();

    if (status === 'loading') {
        return (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 80 }}>
            <Spin size="large" />
          </div>
        );
    }
    return  status === 'authenticated' ? <Outlet /> : <Navigate to="/login" />;
};

export default PrivateRoute;