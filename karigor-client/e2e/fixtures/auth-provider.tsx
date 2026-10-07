import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from '../../src/context/AuthContext';

export function Probe() {
  const { user, isLoading, logoutUser } = useAuth();
  return <><output data-testid="account">{isLoading ? 'Loading' : user?.userId ?? 'Guest'}</output>
    <button onClick={logoutUser}>Sign out</button></>;
}
createRoot(document.getElementById('root')!).render(<BrowserRouter><AuthProvider><Probe /></AuthProvider></BrowserRouter>);
