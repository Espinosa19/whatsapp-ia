import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './HistoryViewer.css';

const API_BASE_URL = 'http://localhost:3000';

export default function HistoryViewer() {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Obtener lista de usuarios
  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setError(null);
      const response = await axios.get(`${API_BASE_URL}/db/stats`);
      setUsers(response.data.topUsers || []);
    } catch (err) {
      setError('Error al obtener usuarios: ' + err.message);
      console.error(err);
    }
  };

  // Obtener mensajes del usuario seleccionado
  const handleSelectUser = async (userId) => {
    setSelectedUser(userId);
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.get(`${API_BASE_URL}/db/messages?userId=${userId}`);
      setMessages(response.data.messages || []);
    } catch (err) {
      setError('Error al obtener mensajes: ' + err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = async (userId) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar el historial de este usuario?')) {
      try {
        await axios.delete(`${API_BASE_URL}/db/messages`, { data: { userId } });
        setMessages([]);
        setSelectedUser(null);
        fetchUsers();
        alert('Historial eliminado correctamente');
      } catch (err) {
        setError('Error al eliminar historial: ' + err.message);
        console.error(err);
      }
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="history-viewer">
      {/* Sidebar con usuarios */}
      <aside className="users-sidebar">
        <div className="sidebar-header">
          <h2>👥 Usuarios</h2>
          <button 
            className="refresh-btn" 
            onClick={fetchUsers}
            title="Actualizar lista"
          >
            🔄
          </button>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <div className="users-list">
          {users.length === 0 ? (
            <div className="empty-state">No hay usuarios</div>
          ) : (
            users.map(user => (
              <div
                key={user.user_id}
                className={`user-item ${selectedUser === user.user_id ? 'active' : ''}`}
                onClick={() => handleSelectUser(user.user_id)}
              >
                <div className="user-info">
                  <strong className="user-id">{user.user_id}</strong>
                  <span className="user-messages">📨 {user.message_count} msgs</span>
                </div>
                <small className="user-time">
                  {user.last_message ? formatDate(user.last_message) : 'Sin actividad'}
                </small>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Panel de mensajes */}
      <section className="messages-panel">
        {selectedUser ? (
          <>
            <div className="messages-header">
              <h2>💬 Conversación de {selectedUser}</h2>
              <button
                className="delete-btn"
                onClick={() => handleClearHistory(selectedUser)}
              >
                🗑️ Eliminar historial
              </button>
            </div>

            {loading ? (
              <div className="loading">Cargando mensajes...</div>
            ) : messages.length === 0 ? (
              <div className="empty-state">No hay mensajes para este usuario</div>
            ) : (
              <div className="messages-container">
                {messages.map(msg => (
                  <div
                    key={msg.id}
                    className={`message ${msg.role === 'user' ? 'user-msg' : 'assistant-msg'}`}
                  >
                    <div className="message-header">
                      <span className="role-badge">{msg.role === 'user' ? '👤' : '🤖'} {msg.role}</span>
                      <span className="timestamp">{formatDate(msg.created_at)}</span>
                    </div>
                    <div className="message-content">
                      {msg.content}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="select-user-prompt">
            <div className="prompt-icon">👈</div>
            <p>Selecciona un usuario para ver el historial</p>
          </div>
        )}
      </section>
    </div>
  );
}
