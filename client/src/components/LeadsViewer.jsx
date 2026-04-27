import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './LeadsViewer.css';

const API_BASE_URL = 'http://localhost:3000';

export default function LeadsViewer() {
  const [leads, setLeads] = useState([]);
  const [filteredLeads, setFilteredLeads] = useState([]);
  const [filterClientType, setFilterClientType] = useState('todos'); // todos, nuevo, recurrente
  const [selectedLead, setSelectedLead] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Filtros
  const [filterStatus, setFilterStatus] = useState('todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('recent'); // recent, name, phone

  // Modal de edición
  const [editingLead, setEditingLead] = useState(null);
  const [editForm, setEditForm] = useState({});

  // Cargar leads al iniciar
  useEffect(() => {
    fetchLeads();
    const interval = setInterval(fetchLeads, 30000); // Actualizar cada 30s
    return () => clearInterval(interval);
  }, []);

  // Calcular tipo de cliente (nuevo/recurrente) por client_phone (vacío/null = siempre nuevo)
  const clientTypeMap = React.useMemo(() => {
    const map = {};
    leads.forEach(lead => {
      const phone = lead.client_phone && lead.client_phone.trim() !== '' ? lead.client_phone : null;
      if (!phone) return;
      map[phone] = (map[phone] || 0) + 1;
    });
    return map;
  }, [leads]);

  // Aplicar filtros y búsqueda
  useEffect(() => {
    let result = [...leads];

    // Filtrar por estado
    if (filterStatus !== 'todos') {
      result = result.filter(lead => lead.status === filterStatus);
    }

    // Filtrar por tipo de cliente
    if (filterClientType !== 'todos') {
      result = result.filter(lead => {
        const phone = lead.client_phone && lead.client_phone.trim() !== '' ? lead.client_phone : null;
        const count = phone ? clientTypeMap[phone] : 0;
        if (!phone) {
          // Sin teléfono siempre cuenta como nuevo
          return filterClientType === 'nuevo';
        }
        if (filterClientType === 'nuevo') return count <= 1;
        if (filterClientType === 'recurrente') return count > 1;
        return true;
      });
    }

    // Buscar por nombre o teléfono
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        lead =>
          lead.client_name?.toLowerCase().includes(query) ||
          lead.client_phone?.toLowerCase().includes(query) ||
          lead.service_type?.toLowerCase().includes(query)
      );
    }

    // Ordenar
    if (sortBy === 'name') {
      result.sort((a, b) => a.client_name.localeCompare(b.client_name));
    } else if (sortBy === 'phone') {
      result.sort((a, b) => (a.client_phone || '').localeCompare(b.client_phone || ''));
    } else {
      result.sort((a, b) => b.created_at - a.created_at);
    }

    setFilteredLeads(result);
  }, [leads, filterStatus, filterClientType, searchQuery, sortBy, clientTypeMap]);

 const fetchLeads = async () => {
  try {
    setLoading(true);
    setError(null);

    const { data } = await axios.get(`${API_BASE_URL}/leads`);

    if (!data.success) throw new Error(data.error);

    const normalized = (data.leads || []).map(lead => ({
      ...lead,
      client_name: lead.client_name || 'Sin nombre',
      client_phone: lead.client_phone || '',
      client_email: lead.client_email || '',
      service_type: lead.service_type || '',
      address: lead.address || '',
      city: lead.city || '',
      status: lead.status || 'nuevo',
      created_at: lead.created_at || null,
      updated_at: lead.updated_at || null
    }));

    setLeads(normalized);

  } catch (err) {
    setError(err.message || 'Error cargando leads');
  } finally {
    setLoading(false);
  }
};



  const changeLeadStatus = async (leadId, newStatus) => {
    try {
      await axios.put(`${API_BASE_URL}/leads/${leadId}/status`, { status: newStatus });
      setLeads(leads.map(lead => 
        lead.id === leadId ? { ...lead, status: newStatus } : lead
      ));
      if (selectedLead?.id === leadId) {
        setSelectedLead({ ...selectedLead, status: newStatus });
      }
    } catch (err) {
      setError('Error actualizando estado del lead');
    }
  };

  const deleteLead = async (leadId) => {
    if (!window.confirm('¿Estás seguro que quieres eliminar este lead?')) return;

    try {
      await axios.delete(`${API_BASE_URL}/leads/${leadId}`);
      setLeads(leads.filter(lead => lead.id !== leadId));
      if (selectedLead?.id === leadId) {
        setSelectedLead(null);
      }
    } catch (err) {
      setError('Error eliminando lead');
    }
  };

  const openEditModal = (lead) => {
    setEditingLead(lead.id);
    setEditForm({ ...lead });
  };

  const saveEdit = async () => {
    try {
      await axios.put(`${API_BASE_URL}/leads/${editingLead}`, editForm);
      setLeads(leads.map(lead => 
        lead.id === editingLead ? { ...lead, ...editForm } : lead
      ));
      setSelectedLead({ ...selectedLead, ...editForm });
      setEditingLead(null);
    } catch (err) {
      setError('Error actualizando lead');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'nuevo': return '#ff9800';
      case 'contactado': return '#2196f3';
      case 'convertido': return '#4caf50';
      case 'cancelado': return '#f44336';
      default: return '#999';
    }
  };

  const getStatusLabel = (status) => {
    const labels = {
      nuevo: '🆕 Nuevo',
      contactado: '📞 Contactado',
      convertido: '✅ Convertido',
      cancelado: '❌ Cancelado',
    };
    return labels[status] || status;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('es-MX');
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('es-MX');
  };

  return (
    <div className="leads-viewer">
      {/* SIDEBAR IZQUIERDO - LISTA DE LEADS */}
      <div className="leads-sidebar">
        <div className="sidebar-header">
          <h2>📋 Leads</h2>
          <button className="refresh-btn" onClick={fetchLeads} title="Actualizar">
            🔄
          </button>
        </div>

        {error && <div className="error-banner">{error}</div>}

        {/* FILTROS */}
        <div className="filters-section">
          <input
            type="text"
            className="search-input"
            placeholder="🔍 Buscar por nombre, teléfono..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <div className="filter-group">
            <label>Estado:</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="todos">Todos</option>
              <option value="nuevo">🆕 Nuevo</option>
              <option value="contactado">📞 Contactado</option>
              <option value="convertido">✅ Convertido</option>
              <option value="cancelado">❌ Cancelado</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Cliente:</label>
            <select
              value={filterClientType}
              onChange={e => setFilterClientType(e.target.value)}
            >
              <option value="todos">Todos</option>
              <option value="nuevo">🆕 Nuevo</option>
              <option value="recurrente">🔁 Recurrente</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Ordenar por:</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="recent">Más recientes</option>
              <option value="name">Nombre</option>
              <option value="phone">Teléfono</option>
            </select>
          </div>
        </div>

        {/* LISTA DE LEADS */}
        <div className="leads-list">
          {loading && <div className="loading">Cargando leads...</div>}
          {!loading && filteredLeads.length === 0 && (
            <div className="empty-state">No hay leads con esos criterios</div>
          )}
          {!loading &&
            filteredLeads.map((lead) => (
              <div
                key={lead.id}
                className={`lead-item ${selectedLead?.id === lead.id ? 'active' : ''}`}
                onClick={() => setSelectedLead(lead)}
              >
                <div className="lead-header">
                  <span className="lead-name">{lead.client_name}</span>
                  <span
                    className="status-badge"
                    style={{ backgroundColor: getStatusColor(lead.status) }}
                  >
                    {getStatusLabel(lead.status).split(' ')[0]}
                  </span>
                </div>
                <div className="lead-info">
                  <div className="lead-phone">📞 {lead.client_phone && lead.client_phone.trim() !== '' ? lead.client_phone : 'Sin teléfono'}</div>
                  <div className="lead-service">🔧 {lead.service_type || 'N/A'}</div>
                  <div className="lead-date">{formatDate(lead.created_at)}</div>
                  <div className="lead-clienttype">
                    {lead.client_phone && lead.client_phone.trim() !== '' && clientTypeMap[lead.client_phone] > 1 ? (
                      <span title="Cliente recurrente">🔁</span>
                    ) : (
                      <span title="Cliente nuevo">🆕</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
        </div>

        <div className="leads-footer">
          <small>Total: {filteredLeads.length}</small>
        </div>
      </div>

      {/* PANEL DERECHO - DETALLES DEL LEAD */}
      <div className="lead-details-panel">
        {selectedLead ? (
          <>
            <div className="details-header">
              <h2>{selectedLead.client_name}</h2>
              <button className="close-btn" onClick={() => setSelectedLead(null)}>
                ✕
              </button>
            </div>

            {editingLead === selectedLead.id ? (
              // MODO EDICIÓN
              <div className="edit-form">
                <div className="form-group">
                  <label>Nombre:</label>
                  <input
                    type="text"
                    value={editForm.client_name || ''}
                    onChange={(e) =>
                      setEditForm({ ...editForm, client_name: e.target.value })
                    }
                  />
                </div>

                <div className="form-group">
                  <label>Teléfono:</label>
                  <input
                    type="text"
                    value={editForm.client_phone || ''}
                    onChange={(e) =>
                      setEditForm({ ...editForm, client_phone: e.target.value })
                    }
                  />
                </div>

                <div className="form-group">
                  <label>Email:</label>
                  <input
                    type="email"
                    value={editForm.client_email || ''}
                    onChange={(e) =>
                      setEditForm({ ...editForm, client_email: e.target.value })
                    }
                  />
                </div>

                <div className="form-group">
                  <label>Servicio:</label>
                  <input
                    type="text"
                    value={editForm.service_type || ''}
                    onChange={(e) =>
                      setEditForm({ ...editForm, service_type: e.target.value })
                    }
                  />
                </div>

                <div className="form-group">
                  <label>Dirección:</label>
                  <input
                    type="text"
                    value={editForm.address || ''}
                    onChange={(e) =>
                      setEditForm({ ...editForm, address: e.target.value })
                    }
                  />
                </div>

                <div className="form-group">
                  <label>Notas:</label>
                  <textarea
                    value={editForm.notes || ''}
                    onChange={(e) =>
                      setEditForm({ ...editForm, notes: e.target.value })
                    }
                  />
                </div>

                <div className="edit-buttons">
                  <button className="btn-save" onClick={saveEdit}>
                    ✅ Guardar
                  </button>
                  <button
                    className="btn-cancel"
                    onClick={() => setEditingLead(null)}
                  >
                    ❌ Cancelar
                  </button>
                </div>
              </div>
            ) : (
              // MODO VISUALIZACIÓN
              <>
                <div className="details-content">
                  <div className="detail-section">
                    <h3>📞 Contacto</h3>
                    <p>
                      <strong>Teléfono:</strong> {selectedLead.client_phone}
                    </p>
                    <p>
                      <strong>Email:</strong>{' '}
                      {selectedLead.client_email || 'No registrado'}
                    </p>
                  </div>

                  <div className="detail-section">
                    <h3>🔧 Servicio</h3>
                    <p>
                      <strong>Tipo:</strong> {selectedLead.service_type}
                    </p>
                    <p>
                      <strong>Dirección:</strong> {selectedLead.address}
                    </p>
                    <p>
                      <strong>Ciudad:</strong> {selectedLead.city || 'N/A'}
                    </p>
                  </div>

                  <div className="detail-section">
                    <h3>📅 Cita</h3>
                    <p>
                      <strong>Fecha preferida:</strong>{' '}
                      {formatDate(selectedLead.preferred_date)}
                    </p>
                    <p>
                      <strong>Hora:</strong> {selectedLead.preferred_time || '-'}
                    </p>
                    {selectedLead.calendar_link && (
                      <p>
                        <strong>Google Calendar:</strong>{' '}
                        <a
                          href={selectedLead.calendar_link}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Ver evento
                        </a>
                      </p>
                    )}
                  </div>

                  <div className="detail-section">
                    <h3>📝 Notas</h3>
                    <p>{selectedLead.notes || 'Sin notas'}</p>
                  </div>

                  <div className="detail-section">
                    <h3>📊 Estado</h3>
                    <div className="status-buttons">
                      {['nuevo', 'contactado', 'convertido', 'cancelado'].map(
                        (status) => (
                          <button
                            key={status}
                            className={`status-btn ${
                              selectedLead.status === status ? 'active' : ''
                            }`}
                            style={{
                              borderColor: getStatusColor(status),
                              color:
                                selectedLead.status === status
                                  ? '#fff'
                                  : getStatusColor(status),
                              backgroundColor:
                                selectedLead.status === status
                                  ? getStatusColor(status)
                                  : 'transparent',
                            }}
                            onClick={() => changeLeadStatus(selectedLead.id, status)}
                          >
                            {getStatusLabel(status)}
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  <div className="detail-section">
                    <h3>🕐 Información</h3>
                    <p>
                      <strong>Creado:</strong> {formatDateTime(selectedLead.created_at)}
                    </p>
                    <p>
                      <strong>Actualizado:</strong>{' '}
                      {formatDateTime(selectedLead.updated_at)}
                    </p>
                  </div>
                </div>

                <div className="details-actions">
                  <button
                    className="btn-edit"
                    onClick={() => openEditModal(selectedLead)}
                  >
                    ✏️ Editar
                  </button>
                  <button
                    className="btn-delete"
                    onClick={() => deleteLead(selectedLead.id)}
                  >
                    🗑️ Eliminar
                  </button>
                </div>
              </>
            )}
          </>
        ) : (
          <div className="no-selection">
            <p>👈 Selecciona un lead para ver los detalles</p>
          </div>
        )}
      </div>
    </div>
  );
}
