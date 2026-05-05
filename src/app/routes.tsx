import { lazy, Suspense } from 'react';
import { createBrowserRouter } from 'react-router-dom';

const SignInPage = lazy(() => import('../features/auth/SignInPage'));
const UsernameSetup = lazy(() => import('../features/auth/UsernameSetup'));
const ProtectedRoute = lazy(() => import('../features/auth/ProtectedRoute'));
const AppLayout = lazy(() => import('../features/servers/AppLayout'));
const ServerView = lazy(() => import('../features/servers/ServerView'));
const InvitePage = lazy(() => import('../features/servers/InvitePage'));

const Loading = () => (
  <div className="flex min-h-screen items-center justify-center bg-bg">
    <div className="h-4 w-4 animate-pulse rounded-full bg-accent" />
  </div>
);

export const router = createBrowserRouter([
  {
    path: '/signin',
    element: <Suspense fallback={<Loading />}><SignInPage /></Suspense>,
  },
  {
    path: '/join/:token',
    element: <Suspense fallback={<Loading />}><InvitePage /></Suspense>,
  },
  {
    element: <Suspense fallback={<Loading />}><ProtectedRoute /></Suspense>,
    children: [
      {
        path: '/setup',
        element: <Suspense fallback={<Loading />}><UsernameSetup /></Suspense>,
      },
      {
        element: <Suspense fallback={<Loading />}><AppLayout /></Suspense>,
        children: [
          {
            path: '/',
            element: <ServerView />,
          },
          {
            path: '/server/:serverId',
            element: <ServerView />,
          },
        ],
      },
    ],
  },
]);
