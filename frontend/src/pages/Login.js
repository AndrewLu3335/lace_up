import React, { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Alert, Card, Typography, Spin } from "antd";
import btn_strava_connect_with_orange from "../assets/btn_strava_connect_with_orange.svg";
import api_logo_pwrdBy_strava_horiz_black from "../assets/api_logo_pwrdBy_strava_horiz_black.svg";
import { useAuth } from "../hooks/useAuth";

const { Title, Text } = Typography;
const THEME_COLOR = '#10B981';

const ERROR_MESSAGES = {
    no_code: 'Strava did not return an authorization code. Please try again.',
    invalid_state: 'Login verification failed. Please connect with Strava again.',
    token_exchange_failed: 'Could not complete Strava authorization. Please try again later.',
    access_denied: 'You declined Strava access. Connect with Strava to use Lace Up.',
};

const Login = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { status } = useAuth();
    const errorKey = searchParams.get('error');
    const errorMsg = errorKey ? ERROR_MESSAGES[errorKey] : null;

    useEffect(() => {
        if (status === 'authenticated') {
            navigate('/runs', { replace: true });
        }
    }, [status, navigate]);

    const handleLogin = () => {
        window.location.href = `${process.env.REACT_APP_API_URL}/api/strava/connect/`;
    };

    if (status === 'loading') {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh',
                backgroundColor: '#f0f2f5',
            }}>
                <Spin size="large" />
            </div>
        );
    }

    if (status === 'authenticated') {
        return null;
    }

    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            backgroundColor: '#f0f2f5'
        }}>
            <Card style={{ width: 400, textAlign: 'center', padding: '20px' }}>
                {errorMsg && (
                    <Alert
                        type="error"
                        message={errorMsg}
                        showIcon
                        style={{ marginBottom: 16, textAlign: 'left' }}
                    />
                )}
                <Title level={2} style={{
                    marginBottom: 10,
                    fontWeight: 800,
                    letterSpacing: '-0.5px',
                    color: '#1f2937'
                }}>
                    Welcome to Lace<span style={{ color: THEME_COLOR }}>Up</span>
                </Title>

                <Text style={{
                    display: 'block',
                    marginBottom: 40,
                    fontSize: '16px',
                    color: '#6b7280',
                    fontWeight: 400
                }}>
                    Visualize your running journey
                </Text>
                <div
                    onClick={handleLogin}
                    style={{
                        cursor: 'pointer',
                        display: 'inline-block',
                        borderRadius: '4px',
                        transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
                        boxShadow: '0 4px 6px rgba(252, 76, 2, 0.2)',
                        transform: 'translateY(0)',
                        filter: 'brightness(100%)'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)';
                        e.currentTarget.style.boxShadow = '0 10px 20px rgba(252, 76, 2, 0.3)';
                        e.currentTarget.style.filter = 'brightness(105%)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0) scale(1)';
                        e.currentTarget.style.boxShadow = '0 4px 6px rgba(252, 76, 2, 0.2)';
                        e.currentTarget.style.filter = 'brightness(100%)';
                    }}
                    onMouseDown={(e) => {
                        e.currentTarget.style.transform = 'translateY(1px) scale(0.98)';
                        e.currentTarget.style.boxShadow = '0 2px 3px rgba(252, 76, 2, 0.2)';
                    }}
                    onMouseUp={(e) => {
                        e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)';
                        e.currentTarget.style.boxShadow = '0 10px 20px rgba(252, 76, 2, 0.3)';
                    }}
                >
                    <img
                        src={btn_strava_connect_with_orange}
                        alt="Connect with Strava"
                        style={{ height: '48px' }}
                    />
                </div>

                <div style={{ marginTop: 40, opacity: 0.6 }}>
                    <img
                        src={api_logo_pwrdBy_strava_horiz_black}
                        alt="Powered by Strava"
                        style={{ height: '30px' }}
                    />
                </div>
            </Card>
        </div>
    );
};

export default Login;
