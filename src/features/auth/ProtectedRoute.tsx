import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './useAuth';
import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../app/firebase';

export default function ProtectedRoute() {
  const { user, loading } = useAuth();
  const [profileLoading, setProfileLoading] = useState(true);
  const [hasProfile, setHasProfile] = useState(false);
  const location = useLocation();

  useEffect(() => {
    async function checkProfile() {
      if (user) {
        try {
          const docRef = doc(db, 'users', user.uid);
          const docSnap = await getDoc(docRef);
          setHasProfile(docSnap.exists());
        } catch (error) {
          console.error("Error checking profile:", error);
        }
      }
      setProfileLoading(false);
    }

    if (!loading) {
      if (user) {
        checkProfile();
      } else {
        setProfileLoading(false);
      }
    }
  }, [user, loading]);

  if (loading || profileLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <div className="h-4 w-4 animate-pulse rounded-full bg-accent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/signin" state={{ from: location }} replace />;
  }

  if (!hasProfile && location.pathname !== '/setup') {
    return <Navigate to="/setup" replace />;
  }
  
  if (hasProfile && location.pathname === '/setup') {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
