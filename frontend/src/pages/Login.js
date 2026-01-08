import React from "react";
import { Button, Card, Typography } from "antd";
import { ArrowRightOutlined } from "@ant-design/icons";

const { Title, Text } = Typography;

const Login = () => {
    const handleLogin = () => {
        window.location.href = "http://localhost:8000/api/strava/connect/";
    };
    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            backgroundColor: '#f0f2f5'
        }}>
            <Card style={{ width: 400, textAlign: 'center' }}>
                <Title level={3}>Welcome to LaceUp</Title>
                <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
                    Please connect with Strava to continue
                </Text>
                <Button
                    type="primary"
                    icon={<ArrowRightOutlined />}
                    onClick={handleLogin}
                    size="large"
                    block
                    style={{ backgroundColor: '#fc4c02', borderColor: '#fc4c02' }} // Strava orange color
                >
                    Connect with Strava
                </Button>
            </Card>
        </div>
    );
};

export default Login;

