import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useServers } from './useServers';
import FriendSearch from '../friends/FriendSearch';
import FriendsList from '../friends/FriendsList';
import { useAuth } from '../auth/useAuth';
import CreateServerModal from './CreateServerModal';

export default function ServerList() {
  const { servers, loading } = useServers();
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="flex h-full flex-col p-4 overflow-y-auto custom-scrollbar">
      <div className="mb-8 flex items-center justify-between">
        <h2 className="font-mono text-xs uppercase tracking-widest text-text-3">Servers</h2>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="text-text-3 transition-colors hover:text-accent"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      <div className="space-y-2">
        {loading ? (
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="h-10 w-full bg-bg-3" />)}
          </div>
        ) : (
          servers.map((server) => (
            <NavLink
              key={server.id}
              to={`/server/${server.slug || server.id}`}
              className={({ isActive }) => 
                `flex items-center gap-3 border-l-2 py-2 pl-2 transition-all hover:bg-bg-3 ${
                  isActive ? 'border-accent bg-bg-3 text-white' : 'border-transparent text-text-2'
                }`
              }
            >
              {server.coverURL ? (
                <img src={server.coverURL} alt="" className="h-6 w-6 object-cover grayscale opacity-50" />
              ) : (
                <div className="flex h-6 w-6 items-center justify-center bg-bg-3 font-mono text-[10px] uppercase">
                  {server.name.charAt(0)}
                </div>
              )}
              <span className="truncate font-sans text-sm font-medium">{server.name}</span>
            </NavLink>
          ))
        )}
      </div>

      {/* Friends Section */}
      <div className="mt-8 pt-8 border-t border-rule space-y-8">
        <FriendsList />
        <FriendSearch />
      </div>

      <div className="mt-auto pt-8">
        {/* Simple sign out / status area */}
        <div className="flex items-center gap-3 border-t border-rule pt-4">
           <div className="h-8 w-8 bg-bg-3 overflow-hidden">
             {user?.photoURL && <img src={user.photoURL} alt="" className="h-full w-full object-cover" />}
           </div>
           <div className="flex flex-col truncate">
             <span className="font-sans text-xs font-bold text-text-2 truncate italic">{user?.displayName || 'User'}</span>
             <span className="font-mono text-[10px] text-accent uppercase animate-pulse">Live</span>
           </div>
        </div>
      </div>

      <CreateServerModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}
