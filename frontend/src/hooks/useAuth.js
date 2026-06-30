import { useEffect, useState } from 'react';
import axios from 'axios';

// Resolves the current Django Session into the frontend authentication state.
export function useAuth() {
    const [status, setStatus] = useState('loading'); // loading, authenticated, unauthenticated
    const [user, setUser] = useState(null); // user object
    
    useEffect(()=>{
        axios.get(`${process.env.REACT_APP_API_URL}/api/strava/me/`, {
            withCredentials: true,
        })
            .then((res)=>{
                setUser(res.data);
                setStatus('authenticated');
            })
            .catch((err)=>{
                setUser(null);
                setStatus('unauthenticated');
            });
    }, []);

    return {status, user};

}
