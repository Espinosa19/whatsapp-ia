import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000';

export default function ChatViewer({ lead, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const bottomRef = useRef(null);
  const containerRef = useRef(null);

  // 🚀 Cargar mensajes + auto refresh
  useEffect(() => {
    if (!lead || !lead.user_id) {
      setMessages([]);
      setError('No hay usuario seleccionado o no tiene ID.');
      return;
    }

    setError(null);
    fetchMessages();

    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [lead]);

  // ✅ Detectar si el usuario está abajo
  const isUserNearBottom = () => {
    const el = containerRef.current;
    if (!el) return false;

    const threshold = 100;
    return el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  };

  // ✅ Scroll inteligente
  useEffect(() => {
    if (isUserNearBottom()) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // 📡 Obtener mensajes (optimizado)
  const fetchMessages = async () => {
    if (!lead || !lead.user_id) return;

    try {
      const response = await axios.get(
        `${API_BASE_URL}/db/messages?userId=${lead.user_id}`
      );

      const newMessages = response.data.messages || [];

      // 🔥 Evita re-render innecesario
      if (newMessages.length !== messages.length) {
        setMessages(newMessages);
      }

    } catch (err) {
      setError('Error cargando mensajes');
    }
  };

  // 📤 Enviar mensaje
  const sendMessage = async () => {
    if (!input.trim() || !lead || !lead.user_id) return;

    try {
      await axios.post(`${API_BASE_URL}/messages`, {
        userId: lead.user_id,
        role: 'human',
        content: input
      });

      setInput('');
      await fetchMessages();

      // 🔥 Forzar scroll solo cuando tú envías
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);

    } catch (err) {
      setError('Error enviando mensaje');
    }
  };

  // ❌ Sin usuario válido
  if (!lead || !lead.user_id) {
    return (
      <div style={styles.emptyContainer}>
        <div>No hay usuario seleccionado o no tiene ID.</div>
        <button onClick={onClose} style={{ marginTop: 16 }}>
          Cerrar
        </button>
      </div>
    );
  }

  // 🎯 Estilo dinámico del contenedor (FIX correcto)
  const containerStyle = {
    position: 'fixed',
    right: 0,
    top: 0,
    width: isExpanded ? 'min(900px, 80vw)' : '400px',
    height: '100vh',
    background: '#fff',
    borderLeft: '1px solid #ddd',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 1000,
    transition: 'width 0.3s ease'
  };

  return (
    <div style={containerStyle}>
      
      {/* HEADER */}
      <div style={styles.header}>
        <strong>{lead.client_name}</strong>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            style={styles.headerBtn}
            title={isExpanded ? 'Reducir chat' : 'Expandir chat'}
          >
            {isExpanded ? '🗕' : '🗖'}
          </button>

          <button onClick={onClose} style={styles.closeBtn}>
            ✕
          </button>
        </div>
      </div>

      {/* MENSAJES */}
      <div style={styles.messagesContainer} ref={containerRef}>
        {loading && <div style={styles.info}>Cargando mensajes...</div>}
        {error && <div style={styles.error}>{error}</div>}

        {!loading && !error && messages.length === 0 && (
          <div style={styles.info}>No hay mensajes.</div>
        )}

        {messages.map((msg, i) => {
          const isMe = msg.role === 'human';
          const isBot = msg.role === 'assistant';
          const isClient = msg.role === 'user';

          return (
            <div
              key={i}
              style={{
                display: 'flex',
                justifyContent: isMe ? 'flex-end' : 'flex-start',
                marginBottom: '10px'
              }}
            >
              <div style={{
                maxWidth: '70%',
                padding: '10px 14px',
                borderRadius: '12px',
                background: isMe
                  ? '#4caf50'
                  : isBot
                  ? '#ede7f6'
                  : '#ffffff',
                color: isMe ? 'white' : '#333',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                border: isClient ? '1px solid #ddd' : 'none'
              }}>
                {/* etiqueta */}
                <div style={styles.label}>
                  {isMe && 'Tú'}
                  {isClient && 'Cliente'}
                  {isBot && 'Bot'}
                </div>

                {/* mensaje */}
                <div>{msg.content}</div>

                {/* hora */}
                {msg.created_at && (
                  <div style={styles.time}>
                    {new Date(msg.created_at).toLocaleTimeString()}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* referencia scroll */}
        <div ref={bottomRef} />
      </div>

      {/* INPUT */}
      <div style={styles.inputContainer}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribe un mensaje..."
          style={styles.input}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
        />

        <button onClick={sendMessage} style={styles.sendBtn}>
          Enviar
        </button>
      </div>

    </div>
  );
}

/* 🎨 ESTILOS LIMPIOS */
const styles = {
  header: {
    padding: '12px',
    background: '#1976d2',
    color: 'white',
    display: 'flex',
    justifyContent: 'space-between'
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: 'white',
    cursor: 'pointer'
  },
  headerBtn: {
    background: 'transparent',
    border: 'none',
    color: 'white',
    cursor: 'pointer',
    fontSize: '16px'
  },
  messagesContainer: {
    flex: 1,
    padding: '10px',
    overflowY: 'auto',
    background: '#f5f5f5'
  },
  inputContainer: {
    display: 'flex',
    padding: '10px',
    borderTop: '1px solid #ddd'
  },
  input: {
    flex: 1,
    padding: '8px',
    borderRadius: '6px',
    border: '1px solid #ccc'
  },
  sendBtn: {
    marginLeft: '8px',
    background: '#1976d2',
    color: 'white',
    border: 'none',
    padding: '8px 12px',
    borderRadius: '6px',
    cursor: 'pointer'
  },
  label: {
    fontSize: '10px',
    marginBottom: '4px',
    opacity: 0.6
  },
  time: {
    fontSize: '10px',
    marginTop: '4px',
    opacity: 0.5,
    textAlign: 'right'
  },
  info: {
    color: '#888'
  },
  error: {
    color: 'red'
  },
  emptyContainer: {
    position: 'fixed',
    right: 0,
    top: 0,
    width: '400px',
    height: '100vh',
    background: '#fff',
    borderLeft: '1px solid #ddd',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column'
  }
};