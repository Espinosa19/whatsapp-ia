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

// ===== Dashboard Component =====
function Dashboard() {
  const [stats, setStats] = React.useState(null);
  const [dbStats, setDbStats] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const leadsResponse = await axios.get(`${API_BASE_URL}/leads/stats`);
      setStats(leadsResponse.data);
      const dbResponse = await axios.get(`${API_BASE_URL}/db/stats`);
      setDbStats(dbResponse.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Error cargando estadísticas');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !stats) {
    return React.createElement('div', { style: { padding: '20px', textAlign: 'center', color: '#999' } },
      'Cargando dashboard...'
    );
  }

  if (!stats) {
    return React.createElement('div', { style: { padding: '20px', textAlign: 'center', color: '#999' } },
      'No hay datos disponibles'
    );
  }

  return React.createElement('div', { style: { padding: '30px', overflowY: 'auto', flex: 1 } },
    error && React.createElement('div', { style: { background: '#fee', color: '#c33', padding: '15px', marginBottom: '20px', borderRadius: '6px' } }, error),
    
    React.createElement('h2', { style: { marginTop: 0, fontSize: '24px', color: '#333', marginBottom: '20px' } }, '📊 Dashboard de Leads'),
    
    // Tarjetas principales
    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '30px' } },
      React.createElement('div', { style: { background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', borderLeft: '4px solid #667eea' } },
        React.createElement('p', { style: { margin: '0 0 10px 0', fontSize: '12px', color: '#999', fontWeight: 'bold' } }, '👥 TOTAL'),
        React.createElement('p', { style: { margin: 0, fontSize: '28px', fontWeight: 'bold', color: '#667eea' } }, stats.totalLeads)
      ),
      React.createElement('div', { style: { background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', borderLeft: '4px solid #ff9800' } },
        React.createElement('p', { style: { margin: '0 0 10px 0', fontSize: '12px', color: '#999', fontWeight: 'bold' } }, '🆕 NUEVOS'),
        React.createElement('p', { style: { margin: 0, fontSize: '28px', fontWeight: 'bold', color: '#ff9800' } }, stats.byStatus.nuevo)
      ),
      React.createElement('div', { style: { background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', borderLeft: '4px solid #2196f3' } },
        React.createElement('p', { style: { margin: '0 0 10px 0', fontSize: '12px', color: '#999', fontWeight: 'bold' } }, '📞 CONTACTADOS'),
        React.createElement('p', { style: { margin: 0, fontSize: '28px', fontWeight: 'bold', color: '#2196f3' } }, stats.byStatus.contactado)
      ),
      React.createElement('div', { style: { background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', borderLeft: '4px solid #4caf50' } },
        React.createElement('p', { style: { margin: '0 0 10px 0', fontSize: '12px', color: '#999', fontWeight: 'bold' } }, '✅ CONVERTIDOS'),
        React.createElement('p', { style: { margin: 0, fontSize: '28px', fontWeight: 'bold', color: '#4caf50' } }, stats.byStatus.convertido)
      ),
      React.createElement('div', { style: { background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', borderLeft: '4px solid #f44336' } },
        React.createElement('p', { style: { margin: '0 0 10px 0', fontSize: '12px', color: '#999', fontWeight: 'bold' } }, '❌ CANCELADOS'),
        React.createElement('p', { style: { margin: 0, fontSize: '28px', fontWeight: 'bold', color: '#f44336' } }, stats.byStatus.cancelado)
      ),
      React.createElement('div', { style: { background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', borderLeft: '4px solid #4caf50' } },
        React.createElement('p', { style: { margin: '0 0 10px 0', fontSize: '12px', color: '#999', fontWeight: 'bold' } }, '📈 CONVERSIÓN'),
        React.createElement('p', { style: { margin: 0, fontSize: '28px', fontWeight: 'bold', color: '#4caf50' } }, stats.conversionRate + '%')
      )
    ),
    
    // Servicios
    stats.topServices && stats.topServices.length > 0 && React.createElement('div', { style: { background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '20px' } },
      React.createElement('h3', { style: { margin: '0 0 15px 0', fontSize: '16px', color: '#333' } }, '🔧 Top Servicios'),
      stats.topServices.map((service, i) =>
        React.createElement('div', { key: i, style: { marginBottom: '12px' } },
          React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: '6px' } },
            React.createElement('span', { style: { fontSize: '14px', fontWeight: '600' } }, service.service_type),
            React.createElement('span', { style: { fontSize: '12px', color: '#999' } }, service.count + ' leads')
          ),
          React.createElement('div', { style: { background: '#f0f0f0', height: '6px', borderRadius: '3px' } },
            React.createElement('div', { style: { background: '#667eea', height: '100%', borderRadius: '3px', width: (service.count / stats.totalLeads * 100) + '%' } })
          )
        )
      )
    )
  );
}

// ===== App Component =====
function App() {
  const [currentView, setCurrentView] = React.useState('dashboard');

  return React.createElement('div', { className: 'app' },
    React.createElement('header', { className: 'app-header' },
      React.createElement('h1', null, '🤖 WhatsApp AI Bot - Centro de Control'),
      React.createElement('nav', { className: 'app-nav' },
        React.createElement('button', {
          className: `nav-btn ${currentView === 'dashboard' ? 'active' : ''}`,
          onClick: () => setCurrentView('dashboard'),
          style: {
            background: currentView === 'dashboard' ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.2)',
            color: currentView === 'dashboard' ? '#667eea' : 'white',
            border: '2px solid ' + (currentView === 'dashboard' ? 'white' : 'transparent'),
            padding: '10px 20px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: currentView === 'dashboard' ? '700' : '600',
            transition: 'all 0.3s',
            marginRight: '10px'
          }
        }, '📊 Dashboard'),
        React.createElement('button', {
          className: `nav-btn ${currentView === 'leads' ? 'active' : ''}`,
          onClick: () => setCurrentView('leads'),
          style: {
            background: currentView === 'leads' ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.2)',
            color: currentView === 'leads' ? '#667eea' : 'white',
            border: '2px solid ' + (currentView === 'leads' ? 'white' : 'transparent'),
            padding: '10px 20px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: currentView === 'leads' ? '700' : '600',
            transition: 'all 0.3s',
            marginRight: '10px'
          }
        }, '👥 Leads'),
        React.createElement('button', {
          className: `nav-btn ${currentView === 'history' ? 'active' : ''}`,
          onClick: () => setCurrentView('history'),
          style: {
            background: currentView === 'history' ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.2)',
            color: currentView === 'history' ? '#667eea' : 'white',
            border: '2px solid ' + (currentView === 'history' ? 'white' : 'transparent'),
            padding: '10px 20px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: currentView === 'history' ? '700' : '600',
            transition: 'all 0.3s'
          }
        }, '💬 Historial')
      )
    ),
    React.createElement('main', { className: 'app-main' },
      currentView === 'dashboard' && React.createElement(Dashboard),
      currentView === 'history' && React.createElement(HistoryViewer),
      currentView === 'leads' && React.createElement('div', { style: { padding: '20px', color: '#666' } },
        React.createElement('h2', null, '👥 Leads'),
        React.createElement('p', null, 'Vista de Leads disponible en el navegador moderno (http://localhost:3001)')
      )
    )
  );
}

// Render
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(App));
