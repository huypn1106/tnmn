import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../../app/firebase';
import { useAuth } from '../auth/useAuth';

export default function InvitePage() {
  const { token } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [server, setServer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchInvite() {
      if (!token) return;
      try {
        const q = query(collection(db, 'servers'), where('inviteToken', '==', token));
        const snap = await getDocs(q);
        if (snap.empty) {
          setError('Invalid or expired invite link.');
        } else {
          const serverDoc = snap.docs[0];
          const serverData = { id: serverDoc.id, ...serverDoc.data() };
          setServer(serverData);
          
          // If already a member, just redirect
          if (user && (serverData as any).members.includes(user.uid)) {
            navigate(`/server/${serverDoc.id}`);
          }
        }
      } catch (err) {
        console.error(err);
        setError('Failed to load invite.');
      } finally {
        setLoading(false);
      }
    }

    if (!authLoading) fetchInvite();
  }, [token, user, authLoading, navigate]);

  const handleJoin = async () => {
    if (!user || !server) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'servers', server.id), {
        members: arrayUnion(user.uid),
        [`roles.${user.uid}`]: 'guest'
      });
      navigate(`/server/${server.id}`);
    } catch (err) {
      console.error(err);
      setError('Failed to join server.');
      setLoading(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <div className="h-4 w-4 animate-pulse rounded-full bg-accent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-bg text-center px-4">
        <h2 className="font-serif text-3xl italic text-text mb-4">Oops.</h2>
        <p className="font-mono text-xs uppercase tracking-widest text-text-3 mb-8">{error}</p>
        <button onClick={() => navigate('/')} className="border border-rule px-8 py-3 font-mono text-xs uppercase">Go Home</button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-4 text-center">
      <div className="max-w-md space-y-8">
        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-widest text-text-3">You've been invited to join</p>
          <h1 className="font-serif text-5xl italic text-text">{server.name}</h1>
        </div>

        {server.coverURL && (
          <div className="mx-auto h-48 w-48 border border-rule bg-bg-2 p-2 shadow-2xl">
            <img src={server.coverURL} alt="" className="h-full w-full object-cover" />
          </div>
        )}

        <button
          onClick={handleJoin}
          className="w-full bg-accent py-4 font-mono text-sm uppercase tracking-widest text-white transition-all hover:brightness-110"
        >
          Join Server
        </button>
        
        <button onClick={() => navigate('/')} className="text-text-3 font-mono text-[10px] uppercase tracking-widest hover:text-text-2">
          Decline
        </button>
      </div>
    </div>
  );
}
