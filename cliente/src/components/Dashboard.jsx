import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Dashboard.css';

const API_BASE_URL = 'http://localhost:3000';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [dbStats, setDbStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedMetric, setSelectedMetric] = useState('all');

  // Cargar estadísticas
  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000); // Actualizar cada 30s
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);

      // Obtener estadísticas de leads
      const leadsResponse = await axios.get(`${API_BASE_URL}/leads/stats`);
      setStats(leadsResponse.data);

      // Obtener estadísticas de la BD general
      const dbResponse = await axios.get(`${API_BASE_URL}/db/stats`);
      setDbStats(dbResponse.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Error cargando estadísticas');
      console.error('Error:', err);
    } finally {
      setLoading(false);
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

  const StatCard = ({ title, value, icon, color, onChange }) => (
    <div
      className="stat-card"
      style={{
        borderLeft: `4px solid ${color}`,
        cursor: onChange ? 'pointer' : 'default',
      }}
      onClick={onChange}
    >
      <div className="stat-icon">{icon}</div>
      <div className="stat-content">
        <p className="stat-title">{title}</p>
        <p className="stat-value" style={{ color }}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
      </div>
    </div>
  );

  if (loading && !stats) {
    return <div className="dashboard-loading">Cargando dashboard...</div>;
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>📊 Dashboard de Leads</h1>
        <button className="refresh-btn" onClick={fetchStats} title="Actualizar">
          🔄 Actualizar
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {stats ? (
        <>
          {/* TARJETAS PRINCIPALES */}
          <div className="stats-grid">
            <StatCard
              title="Total de Leads"
              value={stats.totalLeads}
              icon="👥"
              color="#667eea"
            />
            <StatCard
              title="Nuevos"
              value={stats.byStatus.nuevo}
              icon="🆕"
              color={getStatusColor('nuevo')}
              onChange={() => setSelectedMetric('nuevo')}
            />
            <StatCard
              title="Contactados"
              value={stats.byStatus.contactado}
              icon="📞"
              color={getStatusColor('contactado')}
              onChange={() => setSelectedMetric('contactado')}
            />
            <StatCard
              title="Convertidos"
              value={stats.byStatus.convertido}
              icon="✅"
              color={getStatusColor('convertido')}
              onChange={() => setSelectedMetric('convertido')}
            />
            <StatCard
              title="Cancelados"
              value={stats.byStatus.cancelado}
              icon="❌"
              color={getStatusColor('cancelado')}
              onChange={() => setSelectedMetric('cancelado')}
            />
            <StatCard
              title="Tasa de Conversión"
              value={`${stats.conversionRate}%`}
              icon="📈"
              color="#4caf50"
            />
          </div>

          {/* SECCIÓN DE DETALLES */}
          <div className="details-section">
            {/* SERVICIOS MÁS SOLICITADOS */}
            {stats.topServices && stats.topServices.length > 0 && (
              <div className="detail-card">
                <h2>🔧 Servicios Más Solicitados</h2>
                <div className="service-list">
                  {stats.topServices.map((service, index) => (
                    <div key={index} className="service-item">
                      <span className="service-rank">#{index + 1}</span>
                      <span className="service-name">{service.service_type}</span>
                      <span className="service-count">{service.count} leads</span>
                      <div className="service-bar">
                        <div
                          className="service-fill"
                          style={{
                            width: `${(service.count / stats.totalLeads) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CIUDADES CON MÁS LEADS */}
            {stats.topCities && stats.topCities.length > 0 && (
              <div className="detail-card">
                <h2>🏙️ Ciudades</h2>
                <div className="cities-list">
                  {stats.topCities.map((city, index) => (
                    <div key={index} className="city-item">
                      <div className="city-info">
                        <span className="city-name">{city.city || 'Sin especificar'}</span>
                        <span className="city-count">{city.count} leads</span>
                      </div>
                      <div className="city-bar">
                        <div
                          className="city-fill"
                          style={{
                            width: `${(city.count / stats.totalLeads) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* FILA INFERIOR CON MÉTRICAS ADICIONALES */}
          <div className="metrics-row">
            <div className="metric-card">
              <h3>📅 Leads Recientes (7 días)</h3>
              <p className="metric-value">{stats.recentLeads}</p>
              <p className="metric-percentage">
                {stats.totalLeads > 0
                  ? `${((stats.recentLeads / stats.totalLeads) * 100).toFixed(1)}% del total`
                  : 'N/A'}
              </p>
            </div>

            {dbStats && (
              <>
                <div className="metric-card">
                  <h3>💬 Total de Mensajes</h3>
                  <p className="metric-value">{dbStats.totalMessages}</p>
                  <p className="metric-percentage">
                    {dbStats.totalUsers > 0
                      ? `${(dbStats.totalMessages / dbStats.totalUsers).toFixed(1)} por usuario`
                      : 'N/A'}
                  </p>
                </div>

                <div className="metric-card">
                  <h3>👥 Usuarios Activos</h3>
                  <p className="metric-value">{dbStats.totalUsers}</p>
                  <p className="metric-percentage">
                    {dbStats.totalMessages > 0
                      ? `${(dbStats.totalUsers / dbStats.totalMessages * 100).toFixed(1)}% participación`
                      : 'N/A'}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* DISTRIBUCIÓN DE ESTADOS (GRÁFICO CIRCULAR) */}
          <div className="chart-section">
            <h2>📊 Distribución de Estados</h2>
            <div className="status-distribution">
              {/* LEYENDA */}
              <div className="legend">
                {['nuevo', 'contactado', 'convertido', 'cancelado'].map((status) => (
                  <div key={status} className="legend-item">
                    <div
                      className="legend-color"
                      style={{ backgroundColor: getStatusColor(status) }}
                    />
                    <span>
                      {status.charAt(0).toUpperCase() + status.slice(1)}: {stats.byStatus[status]}
                    </span>
                  </div>
                ))}
              </div>

              {/* BARRAS HORIZONTALES */}
              <div className="horizontal-bars">
                {['nuevo', 'contactado', 'convertido', 'cancelado'].map((status) => (
                  <div key={status} className="bar-container">
                    <label>{status.charAt(0).toUpperCase() + status.slice(1)}</label>
                    <div className="bar-background">
                      <div
                        className="bar-fill"
                        style={{
                          width: `${stats.totalLeads > 0 ? (stats.byStatus[status] / stats.totalLeads) * 100 : 0}%`,
                          backgroundColor: getStatusColor(status),
                        }}
                      />
                    </div>
                    <span className="bar-label">
                      {stats.byStatus[status]} (
                      {stats.totalLeads > 0
                        ? ((stats.byStatus[status] / stats.totalLeads) * 100).toFixed(1)
                        : 0}
                      %)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* INFO FOOTER */}
          <div className="dashboard-footer">
            <p>Última actualización: {new Date().toLocaleString('es-MX')}</p>
          </div>
        </>
      ) : (
        <div className="no-data">No hay datos disponibles</div>
      )}
    </div>
  );
}
