import React, { useState, useMemo, useCallback } from 'react';
import { Search, Plus, ClipboardList, X, FileText, Upload } from 'lucide-react';
import { useFormacion } from '../hooks/useFormacion';
import { useTrabajadores } from '../hooks/useTrabajadores';
import { useCuadrillas } from '../hooks/useCuadrillas';
import CursosTable from './components/CursosTable';
import RegistroTable from './components/RegistroTable';
import CursoModal from '../modals/CursoModal';
import RegistroModal from '../modals/RegistroModal';
import DashboardDrawer from '../modals/DashboardDrawer';
import SearchBar from '../components/common/SearchBar';
import FilterBar from '../components/common/FilterBar';
import Avatar from '../components/common/Avatar';
import StatusBadge from '../components/common/StatusBadge';

export default function Formacion() {
  const { workers } = useTrabajadores();
  const { cuadrillas } = useCuadrillas();
  
  const {
    cursos,
    registros,
    loading: fLoading,
    error: fError,
    createCurso,
    createRegistro,
    deleteRegistro
  } = useFormacion(workers);

  const [formacionCuadrilla, setFormacionCuadrilla] = useState('todas');
  const [formacionTipo, setFormacionTipo] = useState('Todos');
  const [formacionEstado, setFormacionEstado] = useState('Todos');
  const [formacionSearch, setFormacionSearch] = useState('');

  const [selectedCourse, setSelectedCourse] = useState(null);
  const [showDashboardDrawer, setShowDashboardDrawer] = useState(false);
  const [showAddCurso, setShowAddCurso] = useState(false);
  const [showAddRegistro, setShowAddRegistro] = useState(false);
  const [showCertModal, setShowCertModal] = useState(null);

  const filteredRegistros = useMemo(() => {
    return registros.filter(r => {
      const w = workers.find(work => work.id === r.trabajador_id);
      const c = cursos.find(cur => cur.id === r.curso_id);
      if (!w || !c) return false;
      
      if (formacionCuadrilla !== 'todas') {
        const cuadrilla = cuadrillas.find(cu => cu.id === formacionCuadrilla);
        if (!cuadrilla || !cuadrilla.miembros.includes(w.id)) return false;
      }
      if (formacionTipo !== 'Todos' && c.tipo !== formacionTipo) return false;
      if (formacionEstado !== 'Todos' && r.estado !== formacionEstado) return false;
      
      if (formacionSearch.trim()) {
        const q = formacionSearch.toLowerCase();
        const mName = `${w.nombres} ${w.apellidos}`.toLowerCase().includes(q);
        const mId = w.identificacion.toLowerCase().includes(q);
        const mRol = w.rol.toLowerCase().includes(q);
        const mCurName = c.nombre.toLowerCase().includes(q);
        if (!mName && !mId && !mRol && !mCurName) return false;
      }
      return true;
    });
  }, [registros, workers, cursos, formacionCuadrilla, formacionTipo, formacionEstado, formacionSearch, cuadrillas]);

  const handleAddCurso = useCallback(async (newCurso) => {
    try {
      await createCurso(newCurso);
      setShowAddCurso(false);
    } catch (err) {
      alert("Error al registrar curso: " + err.message);
    }
  }, [createCurso]);

  const handleAddRegistro = useCallback(async (newReg) => {
    try {
      await createRegistro(newReg);
      setShowAddRegistro(false);
    } catch (err) {
      alert("Error al registrar capacitación: " + err.message);
    }
  }, [createRegistro]);

  const handleDeleteRegistro = useCallback(async (id) => {
    if (!window.confirm("¿Eliminar este registro de capacitación?")) return;
    try {
      await deleteRegistro(id);
    } catch (err) {
      alert("Error al eliminar capacitación: " + err.message);
    }
  }, [deleteRegistro]);

  const courseEnrolledStats = useCallback((courseId) => {
    const courseRegs = registros.filter(r => r.curso_id === courseId);
    const completed = courseRegs.filter(r => r.estado === 'Completada').length;
    return {
      total: courseRegs.length,
      completed,
      pct: courseRegs.length > 0 ? `${Math.round((completed / courseRegs.length) * 100)}%` : '0%'
    };
  }, [registros]);

  const courseDetailRegs = useMemo(() => {
    if (!selectedCourse) return [];
    return registros.filter(r => r.curso_id === selectedCourse.id);
  }, [selectedCourse, registros]);

  return (
    <>
      {/* Filters Bar */}
      <FilterBar>
        <div className="filter-group" style={{ minWidth: '180px' }}>
          <label>Filtrar por Cuadrilla</label>
          <select 
            className="input-glass select-glass" 
            style={{ width: '100%' }}
            value={formacionCuadrilla} 
            onChange={e => setFormacionCuadrilla(e.target.value)}
          >
            <option value="todas">Todas</option>
            {cuadrillas.map(c => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </div>
        
        <div className="filter-group">
          <label>Tipo de Formación</label>
          <select 
            className="input-glass select-glass" 
            style={{ minWidth: '150px' }}
            value={formacionTipo} 
            onChange={e => setFormacionTipo(e.target.value)}
          >
            <option value="Todos">Todos</option>
            <option value="Seguridad y Salud">Seguridad y Salud</option>
            <option value="Técnica">Técnica</option>
            <option value="Operación">Operación</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Estado de Capacitación</label>
          <select 
            className="input-glass select-glass" 
            style={{ minWidth: '150px' }}
            value={formacionEstado} 
            onChange={e => setFormacionEstado(e.target.value)}
          >
            <option value="Todos">Todos</option>
            <option value="Completada">Completada</option>
            <option value="En Curso">En Curso</option>
            <option value="Vencida">Certificación Vencida</option>
          </select>
        </div>

        <div className="filter-group" style={{ flexGrow: 1, minWidth: '200px' }}>
          <label>Buscar por empleado</label>
          <SearchBar 
            placeholder="Buscar por nombre, ID o rol..."
            value={formacionSearch}
            onChange={e => setFormacionSearch(e.target.value)}
          />
        </div>
        
        <div style={{ display: 'flex', gap: 6, alignSelf: 'flex-end' }}>
          <button 
            className="btn btn-secondary" 
            style={{ height: '42px', gap: 6, borderColor: 'var(--primary-border)', display: 'inline-flex', alignItems: 'center' }}
            onClick={() => setShowDashboardDrawer(true)}
          >
            <ClipboardList size={16} /> <span>Cuadro de Mando</span>
          </button>
          <button 
            className="btn btn-primary" 
            style={{ height: '42px', gap: 6, display: 'inline-flex', alignItems: 'center' }}
            onClick={() => setShowAddRegistro(true)}
          >
            <Plus size={16} /> <span>Registrar Capacitación</span>
          </button>
          <button 
            className="btn btn-secondary" 
            style={{ height: '42px', gap: 6, background: 'var(--bg-card)', display: 'inline-flex', alignItems: 'center' }}
            onClick={() => setShowAddCurso(true)}
          >
            <Plus size={16} /> <span>Nuevo Curso</span>
          </button>
        </div>
      </FilterBar>

      {fLoading && <div style={{ textAlign: 'center', padding: 24 }}>Cargando formación...</div>}
      {fError && <div style={{ color: 'var(--accent-red)', padding: 16 }}>Error: {fError.message}</div>}

      {/* Course Summary row */}
      {!fLoading && (
        <CursosTable 
          cursos={cursos} 
          registros={registros} 
          onSelectCourse={setSelectedCourse} 
        />
      )}

      {/* Centralized Records Table */}
      {!fLoading && (
        <RegistroTable 
          registros={filteredRegistros} 
          workers={workers} 
          cursos={cursos} 
          onShowCertificate={setShowCertModal} 
          onDeleteRegistro={handleDeleteRegistro} 
        />
      )}

      {/* Visor de Certificado Modal */}
      {showCertModal && (
        <div className="modal-overlay" onClick={() => setShowCertModal(null)}>
          <div className="modal-box" style={{ maxWidth: 640, padding: 0, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div style={{ background: 'var(--primary)', color: '#fff', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0, fontSize: 16 }}>Visor de Certificado Digital</h4>
              <button className="btn btn-secondary" style={{ padding: 4, background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff' }} onClick={() => setShowCertModal(null)}>
                <X size={16} />
              </button>
            </div>
            
            {showCertModal.certificado_url && showCertModal.certificado_url.startsWith('data:') ? (
              <div style={{ padding: 24, background: 'var(--bg-card)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                {showCertModal.certificado_url.startsWith('data:image/') ? (
                  <div style={{ maxWidth: '100%', maxHeight: '420px', overflow: 'hidden', borderRadius: 6, border: '1px solid var(--primary-border)', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
                    <img src={showCertModal.certificado_url} alt="Certificado Adjunto" style={{ width: '100%', height: 'auto', display: 'block' }} />
                  </div>
                ) : showCertModal.certificado_url.startsWith('data:application/pdf') ? (
                  <div style={{ width: '100%', height: '420px', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--primary-border)' }}>
                    <iframe src={showCertModal.certificado_url} title="Certificado PDF" style={{ width: '100%', height: '100%', border: 'none' }} />
                  </div>
                ) : (
                  <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                    <FileText size={64} style={{ color: 'var(--primary)', marginBottom: 16 }} />
                    <h4 style={{ margin: '0 0 8px 0', color: 'var(--text-primary)' }}>Archivo de Certificado Cargado</h4>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>El formato del archivo cargado no se puede previsualizar directamente en el navegador.</p>
                  </div>
                )}
                
                <div style={{ display: 'flex', gap: 12, width: '100%', justifyContent: 'center' }}>
                  <a 
                    href={showCertModal.certificado_url} 
                    download={`certificado_${showCertModal.id.slice(0, 8)}`} 
                    className="btn btn-primary" 
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none', padding: '10px 20px' }}
                  >
                    <Upload size={16} style={{ transform: 'rotate(180deg)' }} /> Descargar Certificado
                  </a>
                </div>
              </div>
            ) : (
              <div style={{ padding: 40, background: '#fff', color: '#1e293b', textAlign: 'center', position: 'relative', border: '15px solid var(--primary-light)' }}>
                <div style={{ border: '2px solid var(--primary)', padding: 30 }}>
                  <h2 style={{ fontFamily: '"Outfit", sans-serif', fontSize: 24, fontWeight: 800, color: 'var(--primary)', margin: '0 0 10px 0', letterSpacing: '0.05em' }}>
                    CERTIFICADO DE APROBACIÓN
                  </h2>
                  <p style={{ fontSize: 12, color: '#64748b', fontStyle: 'italic', margin: '0 0 24px 0' }}>Otorgado por SkyCrop Labs & Gestión Agrícola</p>
                  
                  <p style={{ fontSize: 13, margin: '0 0 8px 0', color: '#475569' }}>Este documento certifica que el operario(a)</p>
                  <h3 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: '0 0 10px 0', borderBottom: '1px solid #e2e8f0', display: 'inline-block', paddingBottom: 6, minWidth: 260 }}>
                    {(() => {
                      const w = workers.find(work => work.id === showCertModal.trabajador_id);
                      return w ? `${w.nombres} ${w.apellidos}` : 'Operario';
                    })()}
                  </h3>
                  <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 20px 0' }}>
                    CC: {(() => {
                      const w = workers.find(work => work.id === showCertModal.trabajador_id);
                      return w ? w.identificacion : '—';
                    })()} · Cargo: {(() => {
                      const w = workers.find(work => work.id === showCertModal.trabajador_id);
                      return w ? w.rol : '—';
                    })()}
                  </p>

                  <p style={{ fontSize: 13, margin: '0 0 8px 0', color: '#475569' }}>ha aprobado satisfactoriamente la capacitación de</p>
                  <h4 style={{ fontSize: 16, fontWeight: 700, color: 'var(--primary)', margin: '0 0 20px 0' }}>
                    {(() => {
                      const c = cursos.find(cur => cur.id === showCertModal.curso_id);
                      return c ? c.nombre : 'Curso Técnico';
                    })()}
                  </h4>

                  <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 24, fontSize: 11, color: '#64748b' }}>
                    <div>
                      <span style={{ display: 'block', borderBottom: '1px solid #cbd5e1', width: 120, margin: '0 auto 6px auto' }} />
                      <strong>Instructor</strong>
                      <div style={{ fontSize: 9, color: '#94a3b8' }}>SkyCrop Capacitaciones</div>
                    </div>
                    <div>
                      <div style={{ color: '#0f172a', fontWeight: 600 }}>Resultado: {showCertModal.resultado}</div>
                      <div>Fecha: {showCertModal.fecha.split('-').reverse().join('/')}</div>
                      <div style={{ color: 'var(--primary)', fontWeight: 700, marginTop: 4 }}>ID: {showCertModal.id.slice(0,8).toUpperCase()}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div style={{ padding: '12px 24px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn btn-secondary" onClick={() => setShowCertModal(null)}>Cerrar</button>
              {!(showCertModal.certificado_url && showCertModal.certificado_url.startsWith('data:')) && (
                <button className="btn btn-primary" onClick={() => window.print()}>Imprimir Diploma</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Drawer: Course Detail */}
      {selectedCourse && (
        <>
          <div className="side-drawer-overlay" onClick={() => setSelectedCourse(null)} />
          <div className="side-drawer">
            <div className="side-drawer-header">
              <h3>Detalle de Curso</h3>
              <button className="btn btn-secondary" style={{ padding: 4 }} onClick={() => setSelectedCourse(null)}>
                <X size={16} />
              </button>
            </div>
            <div className="side-drawer-body">
              <div className="glass-card" style={{ padding: 16, background: 'var(--primary-light)', borderColor: 'var(--primary-border)' }}>
                <h4 style={{ fontSize: 15, fontWeight: 800, color: 'var(--primary)', marginBottom: 4 }}>{selectedCourse.nombre}</h4>
                <span className="course-type" style={{ marginBottom: 0 }}>{selectedCourse.tipo} · {selectedCourse.total_horas} horas totales</span>
              </div>

              {/* Course stats */}
              {(() => {
                const stats = courseEnrolledStats(selectedCourse.id);
                
                return (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div className="glass-card" style={{ padding: 12, textAlign: 'center' }}>
                        <div className="course-metric-label">Inscritos</div>
                        <div className="course-metric-value">{stats.total}</div>
                      </div>
                      <div className="glass-card" style={{ padding: 12, textAlign: 'center' }}>
                        <div className="course-metric-label">Aprobación</div>
                        <div className="course-metric-value" style={{ color: 'var(--primary)' }}>
                          {stats.pct}
                        </div>
                      </div>
                    </div>

                    {/* List of enrolled workers */}
                    <div className="glass-card" style={{ padding: 16 }}>
                      <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Alumnos Registrados</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 300, overflowY: 'auto' }}>
                        {courseDetailRegs.length === 0 ? (
                          <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
                            Sin alumnos registrados.
                          </div>
                        ) : (
                          courseDetailRegs.map(r => {
                            const w = workers.find(work => work.id === r.trabajador_id);
                            if (!w) return null;

                            return (
                              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--border-color)', paddingBottom: 8 }}>
                                <Avatar worker={w} size={28} />
                                <div style={{ flexGrow: 1 }}>
                                  <div style={{ fontSize: 12, fontWeight: 600 }}>{w.nombres} {w.apellidos}</div>
                                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{w.rol} · Calif: {r.resultado}</div>
                                </div>
                                <StatusBadge status={r.estado} style={{ fontSize: 10 }} />
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </>
      )}

      {/* Drawer: General Dashboard */}
      {showDashboardDrawer && (
        <DashboardDrawer 
          workers={workers}
          cursos={cursos}
          registros={registros}
          onClose={() => setShowDashboardDrawer(false)}
        />
      )}

      {/* Modal: Agregar Curso */}
      {showAddCurso && (
        <CursoModal 
          onSubmit={handleAddCurso}
          onClose={() => setShowAddCurso(false)}
        />
      )}

      {/* Modal: Registrar Capacitación */}
      {showAddRegistro && (
        <RegistroModal 
          workers={workers}
          cursos={cursos}
          onSubmit={handleAddRegistro}
          onClose={() => setShowAddRegistro(false)}
        />
      )}
    </>
  );
}
