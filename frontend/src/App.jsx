import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import PostsPage from './components/PostsPage';
import ScheduledPage from './components/ScheduledPage';
import KeywordsPage from './components/KeywordsPage';
import { LoginForm, RegisterForm } from './components/AuthForms.jsx';
import { UserProvider, useUser } from './context/UserContext';

function AppContent() {
  const { user, setUser, logout } = useUser();
  const [showRegister, setShowRegister] = React.useState(false);

  if (!user) {
    return showRegister ? (
      <>
        <RegisterForm onRegister={() => setShowRegister(false)} />
        <div className="text-center mt-4">
          <button onClick={() => setShowRegister(false)} className="text-blue-600 underline">Already have an account? Login</button>
        </div>
      </>
    ) : (
      <>
        <LoginForm onLogin={setUser} />
        <div className="text-center mt-4">
          <button onClick={() => setShowRegister(true)} className="text-blue-600 underline">No account? Register</button>
        </div>
      </>
    );
  }

  return (
    <Router>
      <div className="flex justify-end p-2">
        <span className="mr-4">{user.email}</span>
        <button onClick={logout} className="btn">Logout</button>
      </div>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/posts" element={<PostsPage />} />
        <Route path="/scheduled" element={<ScheduledPage />} />
        <Route path="/keywords" element={<KeywordsPage />} />
      </Routes>
    </Router>
  );
}

const App = () => (
  <UserProvider>
    <AppContent />
  </UserProvider>
);

export default App;