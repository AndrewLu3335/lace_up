import React from 'react';
import Logo from '../assets/laceup_logo.png';

const LoadingScreen = () => {
  return (
    <div style={styles.overlay}>
      <div style={styles.container}>
        {/* Logo rotate animation */}
        <img
          src={Logo}
          alt="Loading..."
          className="loading-logo"
        />
        <p style={styles.text}>Syncing your runs...</p>
      </div>

      <style>{`
        .loading-logo {
          width: 80px;
          height: 80px;
          animation: spin 2s linear infinite;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};


const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  container: {
    textAlign: 'center',
  },
  text: {
    marginTop: '20px',
    color: '#FC4C02',
    fontWeight: 'bold',
    fontFamily: 'sans-serif',
  }
};

export default LoadingScreen;