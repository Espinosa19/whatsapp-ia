import { useState } from 'react';
import HistoryViewer from './components/HistoryViewer.jsx';
import LeadsViewer from './components/LeadsViewer.jsx';
import Dashboard from './components/Dashboard.jsx';
import './App.css';

export default function App() {
  const [currentView, setCurrentView] = useState('dashboard');

  const renderView = () => {
    switch (currentView) {
      case 'leads':
        return <LeadsViewer />;
      case 'history':
        return <HistoryViewer />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>🤖 WhatsApp AI Bot - Centro de Control</h1>

        <nav className="app-nav">
          <button onClick={() => setCurrentView('dashboard')}>
            📊 Dashboard
          </button>

          <button onClick={() => setCurrentView('leads')}>
            👥 Leads
          </button>

          <button onClick={() => setCurrentView('history')}>
            💬 Historial
          </button>
        </nav>
      </header>

      <main className="app-main">
        {renderView()}
      </main>
    </div>
  );
}
