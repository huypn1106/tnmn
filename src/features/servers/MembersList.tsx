import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { ref, onValue } from 'firebase/database';
import { db, rtdb } from '../../app/firebase';
import { useServer } from './useServer';

interface Member {
  uid: string;
  displayName: string;
  photoURL: string;
}

export default function MembersList() {
  const { serverId } = useParams<{ serverId: string }>();
  const { server, loading: serverLoading } = useServer(serverId);
  const [members, setMembers] = useState<(Member & { role: string })[]>([]);
  const [presence, setPresence] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!server) {
      setMembers([]);
      return;
    }

    const fetchMembers = async () => {
      const currentRoles = server.roles || {};
      const profiles = await Promise.all(
        server.members.map(async (uid) => {
          const userSnap = await getDoc(doc(db, 'users', uid));
          const profile = userSnap.exists() ? userSnap.data() : { displayName: 'Unknown', photoURL: '' };
          return { uid, ...profile, role: currentRoles[uid] || 'guest' } as any;
        })
      );
      setMembers(profiles);
    };

    fetchMembers();
  }, [server]);

  useEffect(() => {
    if (!server?.members) return;

    const unsubscribes = server.members.map((uid) => {
      const pRef = ref(rtdb, `presence/${uid}`);
      return onValue(pRef, (snap) => {
        setPresence((prev) => ({ ...prev, [uid]: snap.val() }));
      });
    });

    return () => unsubscribes.forEach((unsub) => unsub());
  }, [server?.members]);

  if (!serverId || serverLoading) return null;

  const activeMembers = members.filter((member) => {
    const status = presence[member.uid];
    return status?.online && status?.activeServerId === serverId;
  });

  return (
    <div className="flex flex-col border-t border-rule bg-bg-2/50 backdrop-blur-sm p-6 space-y-5">
      <div className="flex items-center gap-2.5">
        <div className="flex h-5 w-5 items-center justify-center rounded bg-accent/10 text-accent">
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </div>
        <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-text-3">Active Spirits</h3>
      </div>

      <div className="space-y-3">
        {activeMembers.length === 0 ? (
          <p className="font-serif text-[10px] italic text-text-3 opacity-40 px-1 tracking-wide leading-relaxed">
            "The silence is profound, waiting for a presence."
          </p>
        ) : (
          activeMembers.map((member) => (
            <div key={member.uid} className="group flex items-center gap-3 transition-all">
              <div className="relative shrink-0">
                <div className={`h-8 w-8 overflow-hidden rounded-xl border p-[2px] transition-all duration-300 ${
                  member.role === 'dj' ? 'border-accent/40 bg-accent/5' : 'border-rule bg-bg-3'
                }`}>
                  {member.photoURL ? (
                    <img src={member.photoURL} alt="" className="h-full w-full rounded-lg object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-text-3 uppercase">
                      {member.displayName.charAt(0)}
                    </div>
                  )}
                </div>
                {member.role === 'dj' && (
                  <div className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-accent text-[6px] text-white shadow-lg shadow-accent/20 ring-2 ring-bg-2" title="DJ">
                    <svg className="h-2 w-2" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className={`truncate font-sans text-[12px] font-medium tracking-wide transition-colors ${
                  member.role === 'dj' ? 'text-accent' : 'text-text group-hover:text-white'
                }`}>
                  {member.displayName}
                </span>
                <div className="flex items-center gap-1.5 opacity-50 transition-opacity group-hover:opacity-100">
                  <span className={`h-1 w-1 rounded-full ${member.role === 'dj' ? 'bg-accent' : 'bg-text-3'}`} />
                  <span className="font-mono text-[8px] uppercase tracking-wider text-text-3">
                    {member.role}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
