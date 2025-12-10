import { useState } from "react";
import FileUpload from "./components/FileUpload";
import DocumentList from "./components/DocumentList";
import './App.css';
import QuestionAnswer from "./components/QuestionAnswer";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import AuthPage from "./pages/AuthPage";

function MainApp() {
  const { user, logout } = useAuth();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const handleUploadSuccess = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  if (!user) {
    return <AuthPage />;
  }

  return (
    <div className="app">
      <header>
        <h1>KnowledgeBase for Teams</h1>
        <div className="user-info">
          <span>Welcome, {user.email}</span>
          <button onClick={logout}>Logout</button>
        </div>
        <p>Upload and manage your team's documents</p>
      </header>
      <main>
        <FileUpload onUploadSuccess={handleUploadSuccess} />
        <QuestionAnswer />
        <DocumentList refreshTrigger={refreshTrigger} />
      </main>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  )
}