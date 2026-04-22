import React, { useState } from 'react';
import HistoryViewer from './components/HistoryViewer.jsx';
import LeadsViewer from './components/LeadsViewer.jsx';
import Dashboard from './components/Dashboard.jsx';
import './App.css';

export default function App() {
  const [currentView, setCurrentView] = useState('dashboard'); // dashboard, leads, history

  return (
    <div className="app">
      <header className="app-header">
        <h1>🤖 WhatsApp AI Bot - Centro de Control</h1>
        <nav className="app-nav">
          <button
            className={`nav-btn ${currentView === 'dashboard' ? 'active' : ''}`}
            onClick={() => setCurrentView('dashboard')}
          >
            📊 Dashboard
          </button>
          <button
            className={`nav-btn ${currentView === 'leads' ? 'active' : ''}`}
            onClick={() => setCurrentView('leads')}
          >
            👥 Leads
          </button>
          <button
            className={`nav-btn ${currentView === 'history' ? 'active' : ''}`}
            onClick={() => setCurrentView('history')}
          >
            💬 Historial
          </button>
        </nav>
      </header>
      <main className="app-main">
        {currentView === 'dashboard' && <Dashboard />}
        {currentView === 'leads' && <LeadsViewer />}
        {currentView === 'history' && <HistoryViewer />}
      </main>
    </div>
  );
}
