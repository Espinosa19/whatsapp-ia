const { useState, useEffect } = React;

const API_BASE_URL = 'http://localhost:3000';

// ===== HistoryViewer Component =====
function HistoryViewer() {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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

  return React.createElement('div', { className: 'history-viewer' },
    // Sidebar
    React.createElement('aside', { className: 'users-sidebar' },
      React.createElement('div', { className: 'sidebar-header' },
        React.createElement('h2', null, '👥 Usuarios'),
        React.createElement('button', {
          className: 'refresh-btn',
          onClick: fetchUsers,
          title: 'Actualizar lista'
        }, '🔄')
      ),
      error && React.createElement('div', { className: 'error-banner' }, error),
      React.createElement('div', { className: 'users-list' },
        users.length === 0
          ? React.createElement('div', { className: 'empty-state' }, 'No hay usuarios')
          : users.map(user =>
              React.createElement('div', {
                key: user.user_id,
                className: `user-item ${selectedUser === user.user_id ? 'active' : ''}`,
                onClick: () => handleSelectUser(user.user_id)
              },
                React.createElement('div', { className: 'user-info' },
                  React.createElement('strong', { className: 'user-id' }, user.user_id),
                  React.createElement('span', { className: 'user-messages' }, `📨 ${user.message_count} msgs`)
                ),
                React.createElement('small', { className: 'user-time' },
                  user.last_message ? formatDate(user.last_message) : 'Sin actividad'
                )
              )
            )
      )
    ),

    // Messages Panel
    React.createElement('section', { className: 'messages-panel' },
      selectedUser
        ? React.createElement(React.Fragment, null,
            React.createElement('div', { className: 'messages-header' },
              React.createElement('h2', null, `💬 Conversación de ${selectedUser}`),
              React.createElement('button', {
                className: 'delete-btn',
                onClick: () => handleClearHistory(selectedUser)
              }, '🗑️ Eliminar historial')
            ),
            loading
              ? React.createElement('div', { className: 'loading' }, 'Cargando mensajes...')
              : messages.length === 0
                ? React.createElement('div', { className: 'empty-state' }, 'No hay mensajes para este usuario')
                : React.createElement('div', { className: 'messages-container' },
                    messages.map(msg =>
                      React.createElement('div', {
                        key: msg.id,
                        className: `message ${msg.role === 'user' ? 'user-msg' : 'assistant-msg'}`
                      },
                        React.createElement('div', { className: 'message-header' },
                          React.createElement('span', { className: 'role-badge' },
                            `${msg.role === 'user' ? '👤' : '🤖'} ${msg.role}`
                          ),
                          React.createElement('span', { className: 'timestamp' },
                            formatDate(msg.created_at)
                          )
                        ),
                        React.createElement('div', { className: 'message-content' }, msg.content)
                      )
                    )
                  )
          )
        : React.createElement('div', { className: 'select-user-prompt' },
            React.createElement('div', { className: 'prompt-icon' }, '👈'),
            React.createElement('p', null, 'Selecciona un usuario para ver el historial')
          )
    )
  );
}

// ===== App Component =====
function App() {
  return React.createElement('div', { className: 'app' },
    React.createElement('header', { className: 'app-header' },
      React.createElement('h1', null, '🤖 WhatsApp AI Bot - Historial de Conversaciones')
    ),
    React.createElement('main', { className: 'app-main' },
      React.createElement(HistoryViewer)
    )
  );
}

// Render
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(App));
