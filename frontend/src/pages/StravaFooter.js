import React from "react";

import PoweredByLogo from "../assets/api_logo_pwrdBy_strava_horiz_orange.svg";

const StravaFooter = () => {
    return (
        <footer style={{
            textAlign: 'center',
            marginTop: 'auto',
            padding: '30px 0',
            borderTop: '1px solid #f0f0f0',
            backgroundColor: '#fafafa',
            color: '#9ca3af',
            width: '100%'
        }}>
            <img
                src={PoweredByLogo}
                alt="Powered by Strava"
                style={{ height: '32px', opacity: 0.8, marginBottom: '8px' }}
            />
            <div style={{ fontSize: '12px' }}>
                Data provided by Strava API
            </div>
        </footer>
    );
};

export default StravaFooter;