import React, { useState, useEffect } from 'react';
import HistoryViewer from './components/HistoryViewer.jsx';
import './App.css';

export default function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>🤖 WhatsApp AI Bot - Historial de Conversaciones</h1>
      </header>
      <main className="app-main">
        <HistoryViewer />
      </main>
    </div>
  );
}
