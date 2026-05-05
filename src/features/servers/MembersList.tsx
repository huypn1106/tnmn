import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../app/firebase';
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

  if (!serverId || serverLoading) return null;

  return (
    <div className="flex flex-col border-t border-rule p-4 space-y-4">
      <h3 className="font-mono text-[10px] uppercase tracking-widest text-text-3 italic">Active Spirits</h3>
      <div className="space-y-3">
        {members.map((member) => (
          <div key={member.uid} className="flex items-center gap-3">
            <div className="relative">
              <div className="h-6 w-6 bg-bg-3 overflow-hidden rounded-full">
                {member.photoURL && <img src={member.photoURL} alt="" className="h-full w-full object-cover" />}
              </div>
              {member.role === 'dj' && (
                <div className="absolute -top-1 -right-1 h-2 w-2 bg-accent rounded-full border border-bg shadow-[0_0_8px_var(--accent)]" title="DJ" />
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <span className={`font-sans text-[11px] truncate ${member.role === 'dj' ? 'text-accent italic font-bold' : 'text-text-2'}`}>
                {member.displayName}
              </span>
              <span className="font-mono text-[8px] uppercase tracking-widest text-text-3 opacity-50">
                {member.role}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
