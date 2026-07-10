import React, { useState, useEffect, useRef } from 'react';
import {
  Users, UserPlus, Search, Trash2, X, Camera, FileText,
  Upload, Eye, ToggleRight, ClipboardList, GraduationCap,
  DollarSign, UserCheck, Plus, Pencil, CalendarDays,
  CheckCircle2, Clock, AlertCircle, UsersRound, Settings2
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

// ─── Constants ───────────────────────────────────────────────────────────────
const ROLES = [
  'Tractorista', 'Recolector', 'Operario General', 'Fumigador',
  'Supervisor de Campo', 'Técnico de Riego', 'Operador de Dron',
  'Almacenista', 'Mecánico Agrícola', 'Agrónomo'
];
const TIPOS_CONTRATO = ['Permanente', 'Temporal', 'Contrato', 'Cosecha'];
const TIPOS_EPS      = ['Sura EPS', 'Nueva EPS', 'Sanitas', 'Compensar', 'Famisanar', 'Salud Total', 'Coomeva', 'Otra'];
const TIPOS_ARL      = ['Sura ARL', 'Positiva', 'Colmena', 'Bolívar', 'Liberty', 'Otra'];
const RH_OPTIONS     = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];
const LABOR_ESTADOS  = ['Pendiente', 'En Curso', 'Completada'];
const TIPOS_LABOR    = [
  'Cosecha', 'Siembra', 'Fumigación', 'Riego', 'Fertilización',
  'Poda', 'Mantenimiento', 'Inventario', 'Transporte', 'Otro'
];

const SUB_TABS = [
  { id: 'gestion',   label: 'Gestión de Personal',      icon: <UserCheck   size={15} /> },
  { id: 'asistencia',label: 'Asistencia y Cuadrillas',  icon: <ClipboardList size={15} /> },
  { id: 'labores',   label: 'Labores del Día',           icon: <CalendarDays  size={15} /> },
  { id: 'formacion', label: 'Formación y Capacitación',  icon: <GraduationCap size={15} /> },
  { id: 'nominas',   label: 'Nóminas y Pagos',           icon: <DollarSign    size={15} /> },
];

const EMPTY_WORKER_FORM = {
  nombres: '', apellidos: '', identificacion: '',
  edad: '', fechaNacimiento: '', fechaContratacion: '',
  tipoContrato: 'Permanente', rhSanguineo: 'O+',
  tipoEps: 'Nueva EPS', tipoArl: 'Positiva',
  contactoTelefonico: '', contactoEmergencia: '',
  foto: null, copiaContratoName: '',
  rol: 'Operario General', estado: 'Activa',
};

const EMPTY_LABOR_FORM = {
  titulo: '', tipo: 'Cosecha', descripcion: '',
  lote: '', fecha: new Date().toISOString().split('T')[0],
  estado: 'Pendiente',
  asignacion: 'cuadrilla',   // 'cuadrilla' | 'individual'
  cuadrillaId: '',
  trabajadoresIds: [],
  jornal: 1.0,
};

const EMPTY_NOMINA_FORM = {
  trabajadorId: '',
  periodo: 'Abril',
  salarioNeto: 3500000,
  horasExtras: 0,
  retenciones: 0,
  estado: 'Procesando',
  fechaPago: '',
  metodoPago: 'Transferencia Bancaria',
  comentarios: ''
};


// ─── Helpers ─────────────────────────────────────────────────────────────────
const getHorasDeJornal = (jornal) => {
  const j = Number(jornal);
  if (j === 0.25) return 2;
  if (j === 0.5) return 4;
  if (j === 0.75) return 6;
  return 8; // Default 1.00
};

const getInitials = (w) =>
  `${(w.nombres || '?')[0]}${(w.apellidos || '?')[0]}`.toUpperCase();

const getStatusBadge = (estado) => {
  switch (estado) {
    case 'Activa':   return 'badge-green';
    case 'On Leave': return 'badge-yellow';
    case 'Inactivo': return 'badge-red';
    default:         return 'badge-blue';
  }
};

const calcularEdad = (fechaNac) => {
  if (!fechaNac) return '';
  const hoy = new Date();
  const nac = new Date(fechaNac);
  let e = hoy.getFullYear() - nac.getFullYear();
  const m = hoy.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) e--;
  return e;
};

// ─── Worker Avatar ─────────────────────────────────────────────────────────
function Avatar({ worker, size = 36 }) {
  const style = { width: size, height: size, borderRadius: '50%', flexShrink: 0, fontSize: size * 0.36, fontWeight: 700 };
  if (worker.foto)
    return <img src={worker.foto} alt="" className="worker-avatar" style={style} />;
  return (
    <div className="worker-avatar-placeholder" style={style}>
      {getInitials(worker)}
    </div>
  );
}

// ─── Placeholder tab ───────────────────────────────────────────────────────
const PlaceholderTab = ({ title, desc }) => (
  <div className="empty-state">
    <div className="empty-state-icon"><ClipboardList size={28} /></div>
    <h4>{title}</h4>
    <p>{desc}</p>
  </div>
);

const INITIAL_CURSOS = [
  { id: 'c1', nombre: 'Curso de Seguridad y Salud', tipo: 'Seguridad y Salud', total_horas: 16 },
  { id: 'c2', nombre: 'Manejo de Tractor', tipo: 'Operación', total_horas: 24 },
  { id: 'c3', nombre: 'Taller de Buenas Prácticas Agrícolas', tipo: 'Técnica', total_horas: 12 },
  { id: 'c4', nombre: 'Capacitación de Primeros Auxilios', tipo: 'Seguridad y Salud', total_horas: 8 }
];

const buildMockRegistros = (workersList) => {
  if (!workersList || workersList.length === 0) return [];
  const records = [];
  const courses = INITIAL_CURSOS;
  
  const states = ['Completada', 'Completada', 'Completada', 'En Curso', 'Completada', 'Vencida', 'Vencida'];
  const dates = ['2026-04-28', '2026-05-02', '2026-05-02', '2026-05-03', '2026-05-02', '2026-05-03', '2026-05-02'];
  const scores = ['10/10', '10/10', '7/10', 'En Curso', '7/10', '8/10', '10/10'];
  const courseMap = [courses[2], courses[1], courses[1], courses[1], courses[3], courses[3], courses[3]]; // BPA, Tractor, Tractor, Tractor, Auxilio, Auxilio, Auxilio
  
  workersList.forEach((w, idx) => {
    const mIdx = idx % states.length;
    records.push({
      id: `r-${idx}`,
      trabajador_id: w.id,
      curso_id: courseMap[mIdx].id,
      fecha: dates[mIdx],
      resultado: scores[mIdx],
      estado: states[mIdx],
      certificado_url: states[mIdx] === 'Completada' ? '#' : null
    });
  });
  return records;
};


// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function TalentoHumano() {
  // ── Shared state ────────────────────────────────────────────────────────────
  const [activeSubTab, setActiveSubTab] = useState('gestion');

  const [workers, setWorkers] = useState([]);
  const [cuadrillas, setCuadrillas] = useState([]);
  const [labores, setLabores] = useState([]);

  // ── Gestión de Personal state ────────────────────────────────────────────
  const [search,         setSearch]         = useState('');
  const [cuadrillaFilter,setCuadrillaFilter] = useState('todas');
  const [tipoFilter,     setTipoFilter]     = useState('Todos');
  const [showAddWorker,  setShowAddWorker]  = useState(false);
  const [viewWorker,     setViewWorker]     = useState(null);
  const [workerForm,     setWorkerForm]     = useState({ ...EMPTY_WORKER_FORM });
  const photoRef    = useRef(null);
  const contratoRef = useRef(null);
  const certUploadRef = useRef(null);

  // ── Cuadrillas state ────────────────────────────────────────────────────
  const [showNewCuadrilla, setShowNewCuadrilla]   = useState(false);
  const [newCuadrillaName, setNewCuadrillaName]   = useState('');
  const [addingMemberTo,   setAddingMemberTo]     = useState(null); // cuadrilla id
  const [memberSearchVal,  setMemberSearchVal]    = useState('');

  // ── Labores state ────────────────────────────────────────────────────────
  const [showAddLabor, setShowAddLabor] = useState(false);
  const [laborForm,    setLaborForm]    = useState({ ...EMPTY_LABOR_FORM });
  const [laborViewMode, setLaborViewMode] = useState('tablero'); // 'tablero' | 'historial'
  const [historySearch, setHistorySearch] = useState('');
  const [historyDateStart, setHistoryDateStart] = useState('');
  const [historyDateEnd, setHistoryDateEnd] = useState('');
  const [historyType, setHistoryType] = useState('Todos');

  // ── Formación y Capacitación state ──────────────────────────────────────────
  const [cursos, setCursos] = useState([]);
  const [registros, setRegistros] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [showDashboardDrawer, setShowDashboardDrawer] = useState(false);
  const [activeDashboardTab, setActiveDashboardTab] = useState('graficos');
  const [showAddCurso, setShowAddCurso] = useState(false);
  const [showAddRegistro, setShowAddRegistro] = useState(false);
  const [showCertModal, setShowCertModal] = useState(null);
  
  // Filters
  const [formacionCuadrilla, setFormacionCuadrilla] = useState('todas');
  const [formacionTipo, setFormacionTipo] = useState('Todos');
  const [formacionEstado, setFormacionEstado] = useState('Todos');
  const [formacionSearch, setFormacionSearch] = useState('');

  // Form states
  const [newCursoForm, setNewCursoForm] = useState({ nombre: '', tipo: 'Seguridad y Salud', total_horas: 8 });
  const [newRegistroForm, setNewRegistroForm] = useState({ trabajadorId: '', cursoId: '', fecha: new Date().toISOString().split('T')[0], resultado: '10/10', estado: 'Completada', certificadoFileName: '', certificadoBase64: '' });

  // ── Nóminas y Pagos state ──────────────────────────────────────────────────
  const [nominas, setNominas] = useState([]);
  const [selectedNomina, setSelectedNomina] = useState(null);
  const [showAddNomina, setShowAddNomina] = useState(false);
  const [showEditNomina, setShowEditNomina] = useState(false);
  const [nominaPeriodFilter, setNominaPeriodFilter] = useState('Abril');
  const [nominaStatusFilter, setNominaStatusFilter] = useState('Todos');
  const [nominaTypeFilter, setNominaTypeFilter] = useState('Todos');
  const [nominaSearchFilter, setNominaSearchFilter] = useState('');
  const [nominaCuadrillaFilter, setNominaCuadrillaFilter] = useState('todas');
  const [nominaForm, setNominaForm] = useState({ ...EMPTY_NOMINA_FORM });


  // Fetch all data from Supabase
  const fetchData = async () => {
    try {
      // 1. Fetch workers
      const { data: wData, error: wError } = await supabase.from('trabajadores').select('*').order('created_at', { ascending: false });
      if (wError) throw wError;
      const mappedWorkers = (wData || []).map(w => ({
        id: w.id,
        nombres: w.nombres,
        apellidos: w.apellidos,
        identificacion: w.identificacion,
        edad: w.edad,
        fechaNacimiento: w.fecha_nacimiento,
        fechaContratacion: w.fecha_contratacion,
        tipoContrato: w.tipo_contrato,
        rhSanguineo: w.rh_sanguineo,
        tipoEps: w.tipo_eps,
        tipoArl: w.tipo_arl,
        contactoTelefonico: w.contacto_telefonico,
        contactoEmergencia: w.contacto_emergencia,
        foto: w.foto,
        copiaContratoName: w.copia_contrato_name,
        rol: w.rol,
        estado: w.estado
      }));
      setWorkers(mappedWorkers);

      // 2. Fetch cuadrillas with members
      const { data: cData, error: cError } = await supabase
        .from('cuadrillas')
        .select('*, cuadrilla_miembros(trabajador_id)');
      if (cError) throw cError;
      const mappedCuadrillas = (cData || []).map(c => ({
        id: c.id,
        nombre: c.nombre,
        miembros: (c.cuadrilla_miembros || []).map(m => m.trabajador_id)
      }));
      setCuadrillas(mappedCuadrillas);

      // 3. Fetch labores with worker relations
      const { data: lData, error: lError } = await supabase
        .from('labores')
        .select('*, labor_trabajadores(trabajador_id)')
        .order('created_at', { ascending: false });
      if (lError) throw lError;
      const mappedLabores = (lData || []).map(l => ({
        id: l.id,
        titulo: l.titulo,
        tipo: l.tipo,
        descripcion: l.descripcion,
        lote: l.lote,
        fecha: l.fecha,
        estado: l.estado,
        asignacion: l.asignacion,
        cuadrillaId: l.cuadrilla_id,
        trabajadoresIds: (l.labor_trabajadores || []).map(t => t.trabajador_id),
        jornal: l.jornal !== undefined && l.jornal !== null ? Number(l.jornal) : 1.0,
      }));
      setLabores(mappedLabores);

      // 4. Fetch cursos and registros for Formación y Capacitación
      try {
        const { data: curData, error: curError } = await supabase
          .from('cursos_formacion')
          .select('*')
          .order('created_at', { ascending: false });
        if (curError) throw curError;
        setCursos(curData || []);

        const { data: regData, error: regError } = await supabase
          .from('registros_formacion')
          .select('*')
          .order('fecha', { ascending: false });
        if (regError) throw regError;
        setRegistros(regData || []);

      } catch (fErr) {
        console.warn("Tablas de capacitación no existen en Supabase. Cargando datos mock...");
        setCursos(INITIAL_CURSOS);
        setRegistros(buildMockRegistros(mappedWorkers));
      }

      // 5. Fetch nominas
      try {
        const { data: nData, error: nError } = await supabase
          .from('nominas')
          .select('*, trabajadores(*)');
        if (nError) throw nError;
        
        const mappedNominas = (nData || []).map(n => ({
          id: n.id,
          trabajador_id: n.trabajador_id,
          periodo: n.periodo,
          salario_neto: Number(n.salario_neto) || 0,
          horas_extras: Number(n.horas_extras) || 0,
          retenciones: Number(n.retenciones) || 0,
          total_neto: Number(n.total_neto) || 0,
          estado: n.estado,
          fecha_pago: n.fecha_pago,
          metodo_pago: n.metodo_pago,
          comentarios: n.comentarios,
          trabajador: n.trabajadores ? {
            id: n.trabajadores.id,
            nombres: n.trabajadores.nombres,
            apellidos: n.trabajadores.apellidos,
            identificacion: n.trabajadores.identificacion,
            rol: n.trabajadores.rol,
            foto: n.trabajadores.foto,
            tipoContrato: n.trabajadores.tipo_contrato
          } : null
        }));
        setNominas(mappedNominas);
      } catch (nErr) {
        console.warn("Tabla 'nominas' no existe en Supabase o falló.");
        setNominas([]);
      }

    } catch (err) {
      console.error("Error al cargar datos de Talento Humano:", err.message);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);



  // ════════════════════════════════════════════════════════════════════════════
  // HANDLERS – Workers
  // ════════════════════════════════════════════════════════════════════════════
  const wfChange = (field, value) => setWorkerForm(p => ({ ...p, [field]: value }));

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => wfChange('foto', ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleContratoUpload = (e) => {
    const file = e.target.files[0]; if (!file) return;
    wfChange('copiaContratoName', file.name);
  };

  const handleAddWorker = async (e) => {
    e.preventDefault();
    if (!workerForm.nombres.trim() || !workerForm.apellidos.trim() || !workerForm.identificacion.trim()) return;

    const dbWorker = {
      nombres: workerForm.nombres.trim(),
      apellidos: workerForm.apellidos.trim(),
      identificacion: workerForm.identificacion.trim(),
      edad: Number(workerForm.edad) || null,
      fecha_nacimiento: workerForm.fechaNacimiento || null,
      fecha_contratacion: workerForm.fechaContratacion || new Date().toISOString().split('T')[0],
      tipo_contrato: workerForm.tipoContrato,
      rh_sanguineo: workerForm.rhSanguineo,
      tipo_eps: workerForm.tipoEps,
      tipo_arl: workerForm.tipoArl,
      contacto_telefonico: workerForm.contactoTelefonico,
      contacto_emergencia: workerForm.contactoEmergencia,
      foto: workerForm.foto,
      copia_contrato_name: workerForm.copiaContratoName,
      rol: workerForm.rol,
      estado: workerForm.estado || 'Activa'
    };

    try {
      const { data, error } = await supabase.from('trabajadores').insert([dbWorker]).select();
      if (error) throw error;
      if (data && data[0]) {
        const added = {
          id: data[0].id,
          nombres: data[0].nombres,
          apellidos: data[0].apellidos,
          identificacion: data[0].identificacion,
          edad: data[0].edad,
          fechaNacimiento: data[0].fecha_nacimiento,
          fechaContratacion: data[0].fecha_contratacion,
          tipoContrato: data[0].tipo_contrato,
          rhSanguineo: data[0].rh_sanguineo,
          tipoEps: data[0].tipo_eps,
          tipoArl: data[0].tipo_arl,
          contactoTelefonico: data[0].contacto_telefonico,
          contactoEmergencia: data[0].contacto_emergencia,
          foto: data[0].foto,
          copiaContratoName: data[0].copia_contrato_name,
          rol: data[0].rol,
          estado: data[0].estado
        };
        setWorkers(p => [added, ...p]);
      }
      setWorkerForm({ ...EMPTY_WORKER_FORM });
      setShowAddWorker(false);
    } catch (err) {
      alert("Error al registrar trabajador: " + err.message);
    }
  };

  const handleToggleStatus = async (id) => {
    const states = ['Activa', 'On Leave', 'Inactivo'];
    const current = workers.find(w => w.id === id);
    if (!current) return;
    const nextStatus = states[(states.indexOf(current.estado) + 1) % states.length];

    try {
      const { error } = await supabase
        .from('trabajadores')
        .update({ estado: nextStatus })
        .eq('id', id);
      if (error) throw error;
      
      setWorkers(p => p.map(w => w.id === id ? { ...w, estado: nextStatus } : w));
    } catch (err) {
      alert("Error al cambiar estado: " + err.message);
    }
  };

  const handleDeleteWorker = async (id) => {
    if (!window.confirm('¿Eliminar este trabajador?')) return;
    
    try {
      const { error } = await supabase.from('trabajadores').delete().eq('id', id);
      if (error) throw error;
      
      setWorkers(p => p.filter(w => w.id !== id));
      // Also remove from cuadrillas state
      setCuadrillas(p => p.map(c => ({ ...c, miembros: c.miembros.filter(m => m !== id) })));
      // Also remove from labores state
      setLabores(p => p.map(l => ({ ...l, trabajadoresIds: (l.trabajadoresIds||[]).filter(t => t !== id) })));
    } catch (err) {
      alert("Error al eliminar trabajador: " + err.message);
    }
  };

  // Filtered workers
  const filteredWorkers = workers.filter(w => {
    const matchCuadrilla = cuadrillaFilter === 'todas' || cuadrillas.find(c => c.id === cuadrillaFilter)?.miembros.includes(w.id);
    const matchTipo = tipoFilter === 'Todos' || w.tipoContrato === tipoFilter;
    const matchSearch = `${w.nombres} ${w.apellidos} ${w.identificacion}`.toLowerCase().includes(search.toLowerCase());
    return matchCuadrilla && matchTipo && matchSearch;
  });

  // ════════════════════════════════════════════════════════════════════════════
  // HANDLERS – Cuadrillas
  // ════════════════════════════════════════════════════════════════════════════
  const handleAddCuadrilla = async () => {
    if (!newCuadrillaName.trim()) return;

    try {
      const { data, error } = await supabase
        .from('cuadrillas')
        .insert([{ nombre: newCuadrillaName.trim() }])
        .select();
      if (error) throw error;
      if (data && data[0]) {
        const added = {
          id: data[0].id,
          nombre: data[0].nombre,
          miembros: []
        };
        setCuadrillas(p => [...p, added]);
      }
      setNewCuadrillaName('');
      setShowNewCuadrilla(false);
    } catch (err) {
      alert("Error al crear cuadrilla: " + err.message);
    }
  };

  const handleDeleteCuadrilla = async (id) => {
    if (!window.confirm('¿Eliminar esta cuadrilla?')) return;
    
    try {
      const { error } = await supabase.from('cuadrillas').delete().eq('id', id);
      if (error) throw error;
      setCuadrillas(p => p.filter(c => c.id !== id));
    } catch (err) {
      alert("Error al eliminar cuadrilla: " + err.message);
    }
  };

  const handleAddMemberToCuadrilla = async (cuadrillaId, workerId) => {
    try {
      const { error } = await supabase
        .from('cuadrilla_miembros')
        .insert([{ cuadrilla_id: cuadrillaId, trabajador_id: workerId }]);
      if (error) throw error;

      setCuadrillas(p => p.map(c =>
        c.id === cuadrillaId && !c.miembros.includes(workerId)
          ? { ...c, miembros: [...c.miembros, workerId] }
          : c
      ));
      setMemberSearchVal('');
      setAddingMemberTo(null);
    } catch (err) {
      alert("Error al agregar miembro: " + err.message);
    }
  };

  const handleRemoveMemberFromCuadrilla = async (cuadrillaId, workerId) => {
    try {
      const { error } = await supabase
        .from('cuadrilla_miembros')
        .delete()
        .eq('cuadrilla_id', cuadrillaId)
        .eq('trabajador_id', workerId);
      if (error) throw error;

      setCuadrillas(p => p.map(c =>
        c.id === cuadrillaId
          ? { ...c, miembros: c.miembros.filter(m => m !== workerId) }
          : c
      ));
    } catch (err) {
      alert("Error al remover miembro: " + err.message);
    }
  };

  // Workers not yet in this cuadrilla, filtered by search
  const availableForCuadrilla = (cuadrillaId) => {
    const cuadrilla = cuadrillas.find(c => c.id === cuadrillaId);
    if (!cuadrilla) return [];
    return workers.filter(w =>
      !cuadrilla.miembros.includes(w.id) &&
      `${w.nombres} ${w.apellidos}`.toLowerCase().includes(memberSearchVal.toLowerCase())
    );
  };

  // ════════════════════════════════════════════════════════════════════════════
  // HANDLERS – Labores
  // ════════════════════════════════════════════════════════════════════════════
  const lfChange = (field, value) => setLaborForm(p => ({ ...p, [field]: value }));

  const handleToggleWorkerInLabor = (workerId) => {
    setLaborForm(p => {
      const ids = p.trabajadoresIds || [];
      return { ...p, trabajadoresIds: ids.includes(workerId) ? ids.filter(i => i !== workerId) : [...ids, workerId] };
    });
  };

  const handleAddLabor = async (e) => {
    e.preventDefault();
    if (!laborForm.titulo.trim()) return;

    const dbLabor = {
      titulo: laborForm.titulo.trim(),
      tipo: laborForm.tipo,
      descripcion: laborForm.descripcion,
      lote: laborForm.lote,
      fecha: laborForm.fecha || new Date().toISOString().split('T')[0],
      estado: laborForm.estado || 'Pendiente',
      asignacion: laborForm.asignacion,
      cuadrilla_id: laborForm.asignacion === 'cuadrilla' && laborForm.cuadrillaId ? laborForm.cuadrillaId : null,
      jornal: Number(laborForm.jornal) || 1.0
    };

    try {
      // 1. Insert labor record
      const { data: laborResult, error: laborErr } = await supabase.from('labores').insert([dbLabor]).select();
      if (laborErr) throw laborErr;
      
      const newLaborId = laborResult[0].id;

      // 2. Insert individual workers if assignment is individual
      const workersIds = laborForm.asignacion === 'individual' ? (laborForm.trabajadoresIds || []) : [];
      if (workersIds.length > 0) {
        const relations = workersIds.map(wId => ({
          labor_id: newLaborId,
          trabajador_id: wId
        }));
        const { error: relErr } = await supabase.from('labor_trabajadores').insert(relations);
        if (relErr) throw relErr;
      }

      const added = {
        id: newLaborId,
        titulo: laborResult[0].titulo,
        tipo: laborResult[0].tipo,
        descripcion: laborResult[0].descripcion,
        lote: laborResult[0].lote,
        fecha: laborResult[0].fecha,
        estado: laborResult[0].estado,
        asignacion: laborResult[0].asignacion,
        cuadrillaId: laborResult[0].cuadrilla_id,
        trabajadoresIds: workersIds,
        jornal: Number(laborResult[0].jornal) || 1.0
      };

      setLabores(p => [added, ...p]);
      setLaborForm({ ...EMPTY_LABOR_FORM });
      setShowAddLabor(false);
    } catch (err) {
      alert("Error al registrar labor: " + err.message);
    }
  };

  const handleChangeEstadoLabor = async (id, newEstado) => {
    try {
      const { error } = await supabase
        .from('labores')
        .update({ estado: newEstado })
        .eq('id', id);
      if (error) throw error;
      setLabores(p => p.map(l => l.id === id ? { ...l, estado: newEstado } : l));
    } catch (err) {
      alert("Error al actualizar estado de la labor: " + err.message);
    }
  };

  const handleDeleteLabor = async (id) => {
    if (!window.confirm('¿Eliminar esta labor permanentemente?')) return;
    try {
      const { error } = await supabase.from('labores').delete().eq('id', id);
      if (error) throw error;
      setLabores(p => p.filter(l => l.id !== id));
    } catch (err) {
      alert("Error al eliminar labor: " + err.message);
    }
  };

  const handleArchiveActiveLabores = async () => {
    const activeLabores = labores.filter(l => ['Pendiente', 'En Curso', 'Completada'].includes(l.estado));
    if (activeLabores.length === 0) {
      alert("No hay labores activas para archivar en este momento.");
      return;
    }
    
    if (!window.confirm(`¿Finalizar el día y archivar las ${activeLabores.length} labores del tablero activo?`)) return;
    
    const activeIds = activeLabores.map(l => l.id);
    try {
      const { error } = await supabase
        .from('labores')
        .update({ estado: 'Archivada' })
        .in('id', activeIds);
        
      if (error) throw error;
      
      // Update state locally
      setLabores(p => p.map(l => activeIds.includes(l.id) ? { ...l, estado: 'Archivada' } : l));
      alert("¡Día finalizado! Las labores se han archivado correctamente.");
    } catch (err) {
      alert("Error al archivar labores: " + err.message);
    }
  };

  const handleUnarchiveLabor = async (id, originalEstado = 'Pendiente') => {
    try {
      const { error } = await supabase
        .from('labores')
        .update({ estado: originalEstado })
        .eq('id', id);
        
      if (error) throw error;
      
      // Update state locally
      setLabores(p => p.map(l => l.id === id ? { ...l, estado: originalEstado } : l));
    } catch (err) {
      alert("Error al desarchivar la labor: " + err.message);
    }
  };

  // ── Formación y Capacitación handlers ────────────────────────────────────────
  const handleCertUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setNewRegistroForm(p => ({
        ...p,
        certificadoFileName: file.name,
        certificadoBase64: ev.target.result
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleAddCurso = async (e) => {
    e.preventDefault();
    if (!newCursoForm.nombre.trim()) return;

    try {
      const { data, error } = await supabase
        .from('cursos_formacion')
        .insert([{
          nombre: newCursoForm.nombre.trim(),
          tipo: newCursoForm.tipo,
          total_horas: Number(newCursoForm.total_horas) || 8
        }])
        .select();

      if (error) throw error;

      if (data && data[0]) {
        setCursos(p => [data[0], ...p]);
      } else {
        const localNewCurso = {
          id: `c-${Date.now()}`,
          nombre: newCursoForm.nombre.trim(),
          tipo: newCursoForm.tipo,
          total_horas: Number(newCursoForm.total_horas) || 8
        };
        setCursos(p => [localNewCurso, ...p]);
      }
      setNewCursoForm({ nombre: '', tipo: 'Seguridad y Salud', total_horas: 8 });
      setShowAddCurso(false);
    } catch (err) {
      console.warn("Fallo en Supabase, agregando curso localmente:", err.message);
      const localNewCurso = {
        id: `c-${Date.now()}`,
        nombre: newCursoForm.nombre.trim(),
        tipo: newCursoForm.tipo,
        total_horas: Number(newCursoForm.total_horas) || 8
      };
      setCursos(p => [localNewCurso, ...p]);
      setNewCursoForm({ nombre: '', tipo: 'Seguridad y Salud', total_horas: 8 });
      setShowAddCurso(false);
    }
  };

  const handleAddRegistro = async (e) => {
    e.preventDefault();
    if (!newRegistroForm.trabajadorId || !newRegistroForm.cursoId) {
      alert("Por favor selecciona un trabajador y un curso.");
      return;
    }

    const dbReg = {
      trabajador_id: newRegistroForm.trabajadorId,
      curso_id: newRegistroForm.cursoId,
      fecha: newRegistroForm.fecha,
      resultado: newRegistroForm.resultado,
      estado: newRegistroForm.estado,
      certificado_url: newRegistroForm.estado === 'Completada' 
        ? (newRegistroForm.certificadoBase64 || '#') 
        : null
    };

    try {
      const { data, error } = await supabase
        .from('registros_formacion')
        .insert([dbReg])
        .select();

      if (error) throw error;

      if (data && data[0]) {
        setRegistros(p => [data[0], ...p]);
      } else {
        const localReg = {
          id: `r-${Date.now()}`,
          ...dbReg
        };
        setRegistros(p => [localReg, ...p]);
      }
      setNewRegistroForm({ trabajadorId: '', cursoId: '', fecha: new Date().toISOString().split('T')[0], resultado: '10/10', estado: 'Completada', certificadoFileName: '', certificadoBase64: '' });
      setShowAddRegistro(false);
    } catch (err) {
      console.warn("Fallo en Supabase, agregando registro localmente:", err.message);
      const localReg = {
        id: `r-${Date.now()}`,
        ...dbReg
      };
      setRegistros(p => [localReg, ...p]);
      setNewRegistroForm({ trabajadorId: '', cursoId: '', fecha: new Date().toISOString().split('T')[0], resultado: '10/10', estado: 'Completada', certificadoFileName: '', certificadoBase64: '' });
      setShowAddRegistro(false);
    }
  };

  const handleDeleteRegistro = async (id) => {
    if (!window.confirm("¿Eliminar este registro de capacitación?")) return;

    try {
      const { error } = await supabase
        .from('registros_formacion')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setRegistros(p => p.filter(r => r.id !== id));
    } catch (err) {
      console.warn("Fallo en Supabase, eliminando registro localmente:", err.message);
      setRegistros(p => p.filter(r => r.id !== id));
    }
  };

  // ── Nóminas y Pagos handlers ────────────────────────────────────────────────
  const handleAddNomina = async (e) => {
    e.preventDefault();
    if (!nominaForm.trabajadorId || !nominaForm.periodo) {
      alert("Por favor selecciona un trabajador y un período.");
      return;
    }

    const worker = workers.find(w => w.id === nominaForm.trabajadorId) || {
      id: nominaForm.trabajadorId,
      nombres: 'Trabajador',
      apellidos: 'Existente',
      identificacion: 'N/A',
      rol: 'Operario General',
      foto: null,
      tipoContrato: 'Permanente'
    };

    const valorHoraExtra = 15000;
    const totNeto = Number(nominaForm.salarioNeto) + (Number(nominaForm.horasExtras) * valorHoraExtra) - Number(nominaForm.retenciones);

    const dbNomina = {
      trabajador_id: nominaForm.trabajadorId,
      periodo: nominaForm.periodo,
      salario_neto: Number(nominaForm.salarioNeto),
      horas_extras: Number(nominaForm.horasExtras),
      retenciones: Number(nominaForm.retenciones),
      total_neto: totNeto,
      estado: nominaForm.estado,
      fecha_pago: nominaForm.fechaPago || null,
      metodo_pago: nominaForm.metodoPago || null,
      comentarios: nominaForm.comentarios || ''
    };

    try {
      const { data, error } = await supabase
        .from('nominas')
        .insert([dbNomina])
        .select();

      if (error) throw error;

      if (data && data[0]) {
        const added = {
          ...data[0],
          salario_neto: Number(data[0].salario_neto),
          horas_extras: Number(data[0].horas_extras),
          retenciones: Number(data[0].retenciones),
          total_neto: Number(data[0].total_neto),
          trabajador: worker
        };
        setNominas(p => [added, ...p]);
      } else {
        const localNomina = {
          id: `n-${Date.now()}`,
          ...dbNomina,
          trabajador: worker
        };
        setNominas(p => [localNomina, ...p]);
      }

      setNominaForm({ ...EMPTY_NOMINA_FORM });
      setShowAddNomina(false);
    } catch (err) {
      console.warn("Fallo en Supabase, agregando nómina localmente:", err.message);
      const localNomina = {
        id: `n-${Date.now()}`,
        ...dbNomina,
        trabajador: worker
      };
      setNominas(p => [localNomina, ...p]);
      setNominaForm({ ...EMPTY_NOMINA_FORM });
      setShowAddNomina(false);
    }
  };

  const handleEditNomina = async (e) => {
    e.preventDefault();
    if (!selectedNomina) return;

    const valorHoraExtra = 15000;
    const totNeto = Number(nominaForm.salarioNeto) + (Number(nominaForm.horasExtras) * valorHoraExtra) - Number(nominaForm.retenciones);

    const dbNomina = {
      salario_neto: Number(nominaForm.salarioNeto),
      horas_extras: Number(nominaForm.horasExtras),
      retenciones: Number(nominaForm.retenciones),
      total_neto: totNeto,
      estado: nominaForm.estado,
      fecha_pago: nominaForm.fechaPago || null,
      metodo_pago: nominaForm.metodoPago || null,
      comentarios: nominaForm.comentarios || ''
    };

    try {
      const { error } = await supabase
        .from('nominas')
        .update(dbNomina)
        .eq('id', selectedNomina.id);

      if (error) throw error;

      setNominas(p => p.map(n => n.id === selectedNomina.id ? {
        ...n,
        ...dbNomina,
        fecha_pago: dbNomina.fecha_pago,
        metodo_pago: dbNomina.metodo_pago
      } : n));

      setSelectedNomina(null);
      setShowEditNomina(false);
      setNominaForm({ ...EMPTY_NOMINA_FORM });
    } catch (err) {
      console.warn("Fallo en Supabase, editando nómina localmente:", err.message);
      setNominas(p => p.map(n => n.id === selectedNomina.id ? {
        ...n,
        ...dbNomina,
        fecha_pago: dbNomina.fecha_pago,
        metodo_pago: dbNomina.metodo_pago
      } : n));
      setSelectedNomina(null);
      setShowEditNomina(false);
      setNominaForm({ ...EMPTY_NOMINA_FORM });
    }
  };

  const handleDeleteNomina = async (id) => {
    if (!window.confirm("¿Eliminar este registro de nómina permanentemente?")) return;

    try {
      const { error } = await supabase
        .from('nominas')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setNominas(p => p.filter(n => n.id !== id));
    } catch (err) {
      console.warn("Fallo en Supabase, eliminando nómina localmente:", err.message);
      setNominas(p => p.filter(n => n.id !== id));
    }
  };

  const handleGenerateNominasPeriodo = async () => {
    const activeWorkers = workers.filter(w => w.estado === 'Activa');
    if (activeWorkers.length === 0) {
      alert("No hay trabajadores activos registrados para generar la nómina.");
      return;
    }

    const currentPeriod = nominaPeriodFilter;
    const existing = nominas.filter(n => n.periodo === currentPeriod);
    const pendingWorkers = activeWorkers.filter(w => !existing.some(e => e.trabajador_id === w.id));

    if (pendingWorkers.length === 0) {
      alert(`La nómina para todos los trabajadores activos de ${currentPeriod} ya ha sido generada.`);
      return;
    }

    if (!window.confirm(`¿Generar nóminas iniciales para ${pendingWorkers.length} trabajadores activos para el período ${currentPeriod}?`)) return;

    const newRecords = [];
    for (const w of pendingWorkers) {
      const basePay = w.rol === 'Tractorista' ? 4250000 : w.rol === 'Supervisor de Campo' ? 5500000 : 3500000;
      const dbNomina = {
        trabajador_id: w.id,
        periodo: currentPeriod,
        salario_neto: basePay,
        horas_extras: 0,
        retenciones: 0,
        total_neto: basePay,
        estado: 'Procesando',
        fecha_pago: null,
        metodo_pago: 'Transferencia Bancaria',
        comentarios: 'Nómina mensual generada automáticamente'
      };

      try {
        const { data, error } = await supabase
          .from('nominas')
          .insert([dbNomina])
          .select();

        if (error) throw error;
        
        if (data && data[0]) {
          newRecords.push({
            ...data[0],
            salario_neto: Number(data[0].salario_neto),
            horas_extras: Number(data[0].horas_extras),
            retenciones: Number(data[0].retenciones),
            total_neto: Number(data[0].total_neto),
            trabajador: w
          });
        } else {
          newRecords.push({
            id: `n-${Date.now()}-${Math.random()}`,
            ...dbNomina,
            trabajador: w
          });
        }
      } catch (err) {
        newRecords.push({
          id: `n-${Date.now()}-${Math.random()}`,
          ...dbNomina,
          trabajador: w
        });
      }
    }

    setNominas(p => [...newRecords, ...p]);
    alert(`Se han generado ${newRecords.length} registros de nómina correctamente para ${currentPeriod}.`);
  };

  // Labor workers display helper
  const getLaborAssigneeName = (labor) => {
    if (labor.asignacion === 'cuadrilla') {
      const c = cuadrillas.find(c => c.id === labor.cuadrillaId);
      return c ? c.nombre : 'Cuadrilla sin nombre';
    }
    return (labor.trabajadoresIds || [])
      .map(id => { const w = workers.find(w => w.id === id); return w ? `${w.nombres} ${w.apellidos}` : ''; })
      .filter(Boolean).join(', ') || 'Sin asignar';
  };

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <>
      {/* ── Sub-tab Navigation ─────────────────────────────────────────────── */}
      <nav className="sub-tabs-nav">
        {SUB_TABS.map(tab => (
          <button
            key={tab.id}
            className={`sub-tab-btn ${activeSubTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveSubTab(tab.id)}
          >
            {tab.icon}
            <span style={{ marginLeft: '6px' }}>{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* ══════════════════════════════════════════════════════════════════════
          1. GESTIÓN DE PERSONAL
      ══════════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'gestion' && (
        <>
          {/* Filter Bar */}
          <div className="filter-bar">
            <div className="filter-group" style={{ minWidth: '220px' }}>
              <label>Filtrar por Cuadrilla</label>
              <select className="input-glass select-glass" style={{ width: '100%' }}
                value={cuadrillaFilter} onChange={e => setCuadrillaFilter(e.target.value)}>
                <option value="todas">Todas</option>
                {cuadrillas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>

            <div className="filter-group">
              <label>Tipo de Empleado</label>
              <div className="toggle-group">
                {['Todos', ...TIPOS_CONTRATO].map(tipo => (
                  <button key={tipo} className={`toggle-btn ${tipoFilter === tipo ? 'active' : ''}`}
                    onClick={() => setTipoFilter(tipo)}>{tipo}</button>
                ))}
              </div>
            </div>

            <div className="filter-group" style={{ flexGrow: 1, minWidth: '200px' }}>
              <label>Buscar</label>
              <div style={{ position: 'relative' }}>
                <Search size={15} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                <input type="text" className="input-glass" style={{ width: '100%', paddingLeft: '36px' }}
                  placeholder="Buscar por nombre o identificación..."
                  value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </div>

            <button className="btn btn-primary" onClick={() => setShowAddWorker(true)}
              style={{ height: '42px', whiteSpace: 'nowrap', alignSelf: 'flex-end' }}>
              <UserPlus size={17} /> <span>Agregar Trabajador</span>
            </button>
          </div>

          {/* Cuadrilla summary pills */}
          <div className="cuadrilla-row">
            {cuadrillas.map(c => (
              <div key={c.id}
                className={`cuadrilla-card ${cuadrillaFilter === c.id ? 'selected' : ''}`}
                onClick={() => setCuadrillaFilter(p => p === c.id ? 'todas' : c.id)}>
                <h4>{c.nombre}</h4>
                <dl className="cuadrilla-stats">
                  <dt>Miembros</dt>
                  <dd>{c.miembros.length}</dd>
                  <dt>Activos</dt>
                  <dd>{c.miembros.filter(id => workers.find(w => w.id === id)?.estado === 'Activa').length}</dd>
                </dl>
              </div>
            ))}
          </div>

          {/* Workers Table */}
          <div className="glass-card" style={{ padding: 0 }}>
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th style={{ width: 50 }}>Foto</th>
                    <th>Nombre</th>
                    <th>Identificación</th>
                    <th>Rol</th>
                    <th>Tipo de Contrato</th>
                    <th>Estado</th>
                    <th style={{ textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWorkers.length > 0 ? filteredWorkers.map(w => (
                    <tr key={w.id}>
                      <td><Avatar worker={w} /></td>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {w.nombres} {w.apellidos}
                      </td>
                      <td style={{ fontWeight: 500 }}>{w.identificacion}</td>
                      <td>{w.rol}</td>
                      <td>{w.tipoContrato}</td>
                      <td><span className={`badge ${getStatusBadge(w.estado)}`}>{w.estado}</span></td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button className="btn btn-secondary" style={{ padding: '5px 8px' }}
                            title="Ver ficha" onClick={() => setViewWorker(w)}>
                            <Eye size={14} />
                          </button>
                          <button className="btn btn-secondary" style={{ padding: '5px 8px' }}
                            title="Cambiar estado" onClick={() => handleToggleStatus(w.id)}>
                            <ToggleRight size={14} />
                          </button>
                          <button className="btn btn-danger" style={{ padding: '5px 8px' }}
                            title="Eliminar" onClick={() => handleDeleteWorker(w.id)}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={7}>
                      <div className="empty-state">
                        <div className="empty-state-icon"><Users size={28} /></div>
                        <h4>No hay trabajadores registrados</h4>
                        <p>Haz clic en "Agregar Trabajador" para comenzar.</p>
                      </div>
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {workers.length > 0 && (
            <div style={{ display: 'flex', gap: 24, fontSize: 13, color: 'var(--text-muted)', marginTop: 8, flexWrap: 'wrap' }}>
              <span>Total: <strong style={{ color: 'var(--text-primary)' }}>{workers.length}</strong></span>
              <span>Activos: <strong style={{ color: 'var(--primary)' }}>{workers.filter(w => w.estado === 'Activa').length}</strong></span>
              <span>Mostrando: <strong style={{ color: 'var(--text-primary)' }}>{filteredWorkers.length}</strong></span>
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          2. ASISTENCIA Y CUADRILLAS (dynamic cuadrilla management)
      ══════════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'asistencia' && (
        <>
          <div className="section-header-row">
            <h3>Administración de Cuadrillas</h3>
            <button className="btn btn-primary" style={{ gap: 6 }}
              onClick={() => setShowNewCuadrilla(true)}>
              <Plus size={16} /> Nueva Cuadrilla
            </button>
          </div>

          {cuadrillas.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><UsersRound size={28} /></div>
              <h4>No hay cuadrillas creadas</h4>
              <p>Crea una cuadrilla para organizar al personal por actividad.</p>
            </div>
          ) : (
            <div className="cuadrilla-manager-grid">
              {cuadrillas.map(c => {
                const memberWorkers = c.miembros.map(id => workers.find(w => w.id === id)).filter(Boolean);
                const isAddingHere = addingMemberTo === c.id;
                return (
                  <div key={c.id} className="cuadrilla-manage-card">
                    <div className="cuadrilla-manage-header">
                      <h4>{c.nombre}</h4>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center' }}>
                          {memberWorkers.length} miembros
                        </span>
                        <button className="btn btn-danger" style={{ padding: '4px 6px' }}
                          title="Eliminar cuadrilla" onClick={() => handleDeleteCuadrilla(c.id)}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    <div className="cuadrilla-members-list">
                      {memberWorkers.length === 0 ? (
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', padding: '4px 0' }}>Sin miembros asignados</span>
                      ) : memberWorkers.map(w => (
                        <div key={w.id} className="cuadrilla-member-row">
                          <Avatar worker={w} size={26} />
                          <span>{w.nombres} {w.apellidos}</span>
                          <span className={`badge ${getStatusBadge(w.estado)}`} style={{ fontSize: 10, padding: '2px 7px' }}>{w.estado}</span>
                          <button title="Quitar de cuadrilla"
                            onClick={() => handleRemoveMemberFromCuadrilla(c.id, w.id)}>
                            <X size={13} />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="cuadrilla-add-member">
                      {!isAddingHere ? (
                        <button className="btn btn-secondary" style={{ width: '100%', fontSize: 13, gap: 6 }}
                          onClick={() => { setAddingMemberTo(c.id); setMemberSearchVal(''); }}>
                          <Plus size={14} /> Agregar miembro
                        </button>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div style={{ position: 'relative' }}>
                            <Search size={13} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-muted)' }} />
                            <input type="text" className="input-glass" style={{ width: '100%', paddingLeft: 32, fontSize: 13 }}
                              placeholder="Buscar trabajador..."
                              value={memberSearchVal} autoFocus
                              onChange={e => setMemberSearchVal(e.target.value)} />
                          </div>
                          <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {availableForCuadrilla(c.id).length === 0 ? (
                              <span style={{ fontSize: 12, color: 'var(--text-muted)', padding: '4px 0' }}>
                                {workers.length === 0 ? 'Registra trabajadores primero' : 'No hay coincidencias'}
                              </span>
                            ) : availableForCuadrilla(c.id).map(w => (
                              <div key={w.id} className="cuadrilla-member-row" style={{ cursor: 'pointer' }}
                                onClick={() => handleAddMemberToCuadrilla(c.id, w.id)}>
                                <Avatar worker={w} size={24} />
                                <span style={{ flexGrow: 1 }}>{w.nombres} {w.apellidos}</span>
                                <Plus size={13} style={{ color: 'var(--primary)' }} />
                              </div>
                            ))}
                          </div>
                          <button className="btn btn-secondary" style={{ fontSize: 12 }}
                            onClick={() => setAddingMemberTo(null)}>Cancelar</button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          3. LABORES DEL DÍA
      ══════════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'labores' && (
        <>
          {/* View Toggle */}
          <div className="view-toggle-container">
            <button 
              className={`view-toggle-btn ${laborViewMode === 'tablero' ? 'active' : ''}`}
              onClick={() => setLaborViewMode('tablero')}
            >
              <CalendarDays size={14} />
              Tablero Activo
            </button>
            <button 
              className={`view-toggle-btn ${laborViewMode === 'historial' ? 'active' : ''}`}
              onClick={() => setLaborViewMode('historial')}
            >
              <FileText size={14} />
              Historial y Trazabilidad
            </button>
          </div>

          {laborViewMode === 'tablero' ? (
            <>
              <div className="section-header-row">
                <h3>Labores del Día — {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn btn-secondary" style={{ gap: 6, borderColor: 'var(--primary-border)' }}
                    onClick={handleArchiveActiveLabores}>
                    <Clock size={16} /> Finalizar Día
                  </button>
                  <button className="btn btn-primary" style={{ gap: 6 }}
                    onClick={() => { setLaborForm({ ...EMPTY_LABOR_FORM }); setShowAddLabor(true); }}>
                    <Plus size={16} /> Registrar Labor
                  </button>
                </div>
              </div>

              {!labores.some(l => ['Pendiente', 'En Curso', 'Completada'].includes(l.estado)) ? (
                <div className="empty-state">
                  <div className="empty-state-icon"><CalendarDays size={28} /></div>
                  <h4>No hay labores activas en el tablero</h4>
                  <p>Registra actividades diarias para comenzar o consulta el historial.</p>
                </div>
              ) : (
                <div className="labor-kanban">
                  {LABOR_ESTADOS.map(estado => {
                    const col = labores.filter(l => l.estado === estado);
                    const dotClass = estado === 'Pendiente' ? 'pendiente' : estado === 'En Curso' ? 'en-curso' : 'completada';
                    const colColor = estado === 'Pendiente' ? 'var(--accent-gold)' : estado === 'En Curso' ? 'var(--accent-blue)' : 'var(--primary)';
                    return (
                      <div key={estado} className="labor-column">
                        <div className="labor-column-header" style={{ borderLeft: `3px solid ${colColor}` }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className={`status-dot ${dotClass}`} />
                            {estado}
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)' }}>{col.length}</span>
                        </div>

                        {col.length === 0 && (
                          <div style={{ padding: '20px 16px', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
                            Sin labores en este estado
                          </div>
                        )}

                        {col.map(labor => (
                          <div key={labor.id} className="labor-card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                              <div>
                                <div className="labor-card-title">{labor.titulo}</div>
                                <div className="labor-card-meta">
                                  <span>{labor.tipo} {labor.lote ? `· Lote: ${labor.lote}` : ''}</span>
                                  <span>Fecha: {labor.fecha}</span>
                                  {labor.descripcion && <span style={{ fontStyle: 'italic' }}>{labor.descripcion}</span>}
                                </div>
                              </div>
                              <button className="btn btn-danger" style={{ padding: '3px 6px', flexShrink: 0 }}
                                onClick={() => handleDeleteLabor(labor.id)}>
                                <Trash2 size={13} />
                              </button>
                            </div>

                            <div className="labor-card-workers">
                              <span style={{ fontSize: 11, color: 'var(--text-muted)', width: '100%', marginBottom: 2 }}>
                                {labor.asignacion === 'cuadrilla' ? 'Cuadrilla:' : 'Trabajadores:'}
                              </span>
                              <span className="worker-chip">{getLaborAssigneeName(labor)}</span>
                            </div>

                            {/* Estado changer */}
                            <div style={{ display: 'flex', gap: 4, marginTop: 10 }}>
                              {LABOR_ESTADOS.filter(e => e !== labor.estado).map(e => (
                                <button key={e} className="btn btn-secondary"
                                  style={{ fontSize: 11, padding: '3px 8px', flexGrow: 1 }}
                                  onClick={() => handleChangeEstadoLabor(labor.id, e)}>
                                  → {e}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="section-header-row">
                <h3>Historial y Trazabilidad de Labores</h3>
              </div>

              {/* History Filters */}
              <div className="history-filters-bar">
                <div className="filter-group" style={{ flexGrow: 1, minWidth: '200px' }}>
                  <label>Buscar en historial</label>
                  <div style={{ position: 'relative' }}>
                    <Search size={15} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                    <input type="text" className="input-glass" style={{ width: '100%', paddingLeft: '36px' }}
                      placeholder="Buscar por título, descripción o lote..."
                      value={historySearch} onChange={e => setHistorySearch(e.target.value)} />
                  </div>
                </div>

                <div className="filter-group">
                  <label>Tipo de Labor</label>
                  <select className="input-glass select-glass" style={{ minWidth: '150px' }}
                    value={historyType} onChange={e => setHistoryType(e.target.value)}>
                    <option value="Todos">Todos</option>
                    {TIPOS_LABOR.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div className="filter-group">
                  <label>Desde</label>
                  <input type="date" className="input-glass" value={historyDateStart}
                    onChange={e => setHistoryDateStart(e.target.value)} />
                </div>

                <div className="filter-group">
                  <label>Hasta</label>
                  <input type="date" className="input-glass" value={historyDateEnd}
                    onChange={e => setHistoryDateEnd(e.target.value)} />
                </div>
                
                {(historySearch || historyType !== 'Todos' || historyDateStart || historyDateEnd) && (
                  <button className="btn btn-secondary" style={{ height: '42px' }}
                    onClick={() => {
                      setHistorySearch('');
                      setHistoryType('Todos');
                      setHistoryDateStart('');
                      setHistoryDateEnd('');
                    }}>
                    Limpiar Filtros
                  </button>
                )}
              </div>

              {/* History Table by Worker */}
              {(() => {
                const formatDate = (dateStr) => {
                  if (!dateStr) return '';
                  const parts = dateStr.split('-');
                  if (parts.length !== 3) return dateStr;
                  return `${parts[2]}/${parts[1]}/${parts[0]}`;
                };

                const historyRows = [];
                labores.forEach(labor => {
                  if (labor.estado !== 'Archivada') return;

                  let workersForLabor = [];
                  if (labor.asignacion === 'cuadrilla') {
                    const cuadrilla = cuadrillas.find(c => c.id === labor.cuadrillaId);
                    if (cuadrilla) {
                      workersForLabor = cuadrilla.miembros.map(workerId => workers.find(w => w.id === workerId)).filter(Boolean);
                    }
                  } else {
                    workersForLabor = (labor.trabajadoresIds || []).map(workerId => workers.find(w => w.id === workerId)).filter(Boolean);
                  }

                  const laborText = `${labor.titulo} ${labor.descripcion || ''} ${labor.lote || ''} ${labor.tipo}`.toLowerCase();
                  const jVal = labor.jornal !== undefined && labor.jornal !== null ? Number(labor.jornal) : 1.0;
                  const hVal = getHorasDeJornal(jVal);

                  if (workersForLabor.length === 0) {
                    historyRows.push({
                      key: labor.id,
                      laborId: labor.id,
                      fecha: labor.fecha,
                      trabajadorName: 'Sin asignar',
                      trabajadorObj: null,
                      lote: labor.lote || '—',
                      actividad: labor.titulo,
                      descripcion: labor.descripcion,
                      jornal: jVal,
                      horas: hVal,
                      tipo: labor.tipo,
                      searchText: `${laborText} sin asignar`
                    });
                  } else {
                    workersForLabor.forEach(w => {
                      const workerName = `${w.nombres} ${w.apellidos}`;
                      historyRows.push({
                        key: `${labor.id}-${w.id}`,
                        laborId: labor.id,
                        fecha: labor.fecha,
                        trabajadorName: workerName,
                        trabajadorObj: w,
                        lote: labor.lote || '—',
                        actividad: labor.titulo,
                        descripcion: labor.descripcion,
                        jornal: jVal,
                        horas: hVal,
                        tipo: labor.tipo,
                        searchText: `${laborText} ${workerName} ${w.identificacion} ${w.rol}`.toLowerCase()
                      });
                    });
                  }
                });

                // Filter rows
                const filteredRows = historyRows.filter(row => {
                  if (historySearch.trim()) {
                    const query = historySearch.toLowerCase();
                    if (!row.searchText.includes(query)) return false;
                  }
                  if (historyDateStart && row.fecha < historyDateStart) return false;
                  if (historyDateEnd && row.fecha > historyDateEnd) return false;
                  if (historyType !== 'Todos' && row.tipo !== historyType) return false;
                  return true;
                });

                // Sort rows by Date (descending), then by worker name
                filteredRows.sort((a, b) => {
                  const dateCompare = b.fecha.localeCompare(a.fecha);
                  if (dateCompare !== 0) return dateCompare;
                  return a.trabajadorName.localeCompare(b.trabajadorName);
                });

                return (
                  <div className="glass-card" style={{ padding: 0 }}>
                    <div className="table-container">
                      <table className="custom-table">
                        <thead>
                          <tr>
                            <th>Fecha</th>
                            <th>Trabajador</th>
                            <th>Lote / Sector</th>
                            <th>Actividad Realizada</th>
                            <th>Horas Trabajadas</th>
                            <th style={{ textAlign: 'right' }}>Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredRows.length === 0 ? (
                            <tr>
                              <td colSpan={6}>
                                <div className="empty-state">
                                  <div className="empty-state-icon"><ClipboardList size={28} /></div>
                                  <h4>No se encontraron actividades archivadas</h4>
                                  <p>
                                    {labores.some(l => l.estado === 'Archivada') 
                                      ? 'Ninguna actividad coincide con los filtros aplicados.' 
                                      : 'Las labores aparecerán aquí una vez que finalices el día.'}
                                  </p>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            filteredRows.map(row => (
                              <tr key={row.key}>
                                <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{formatDate(row.fecha)}</td>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    {row.trabajadorObj ? (
                                      <>
                                        <Avatar worker={row.trabajadorObj} size={24} />
                                        <div>
                                          <div style={{ fontWeight: 600 }}>{row.trabajadorName}</div>
                                          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{row.trabajadorObj.rol}</div>
                                        </div>
                                      </>
                                    ) : (
                                      <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{row.trabajadorName}</span>
                                    )}
                                  </div>
                                </td>
                                <td style={{ fontWeight: 500 }}>{row.lote}</td>
                                <td>
                                  <div>
                                    <strong style={{ color: 'var(--text-primary)' }}>{row.actividad}</strong>
                                    <span className="badge badge-green" style={{ fontSize: 10, marginLeft: 8, background: 'var(--primary-light)', color: 'var(--primary)', padding: '2px 6px' }}>{row.tipo}</span>
                                    {row.descripcion && (
                                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, fontStyle: 'italic' }}>
                                        {row.descripcion}
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td style={{ fontWeight: 600 }}>
                                  {row.jornal.toFixed(2)} ({row.horas} hrs)
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                    <button className="btn btn-secondary" style={{ padding: '5px 8px', fontSize: 11 }}
                                      title="Desarchivar labor" onClick={() => handleUnarchiveLabor(row.laborId, 'Completada')}>
                                      Desarchivar
                                    </button>
                                    <button className="btn btn-danger" style={{ padding: '5px 8px' }}
                                      title="Eliminar labor permanentemente" onClick={() => handleDeleteLabor(row.laborId)}>
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </>
      )}

      {/* ── Placeholder tabs ──────────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════
          4. FORMACIÓN Y CAPACITACIÓN
      ══════════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'formacion' && (
        <>
          {/* Filters Bar */}
          <div className="filter-bar">
            <div className="filter-group" style={{ minWidth: '180px' }}>
              <label>Filtrar por Cuadrilla</label>
              <select className="input-glass select-glass" style={{ width: '100%' }}
                value={formacionCuadrilla} onChange={e => setFormacionCuadrilla(e.target.value)}>
                <option value="todas">Todas</option>
                {cuadrillas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            
            <div className="filter-group">
              <label>Tipo de Formación</label>
              <select className="input-glass select-glass" style={{ minWidth: '150px' }}
                value={formacionTipo} onChange={e => setFormacionTipo(e.target.value)}>
                <option value="Todos">Todos</option>
                <option value="Seguridad y Salud">Seguridad y Salud</option>
                <option value="Técnica">Técnica</option>
                <option value="Operación">Operación</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Estado de Capacitación</label>
              <select className="input-glass select-glass" style={{ minWidth: '150px' }}
                value={formacionEstado} onChange={e => setFormacionEstado(e.target.value)}>
                <option value="Todos">Todos</option>
                <option value="Completada">Completada</option>
                <option value="En Curso">En Curso</option>
                <option value="Vencida">Certificación Vencida</option>
              </select>
            </div>

            <div className="filter-group" style={{ flexGrow: 1, minWidth: '200px' }}>
              <label>Buscar por empleado</label>
              <div style={{ position: 'relative' }}>
                <Search size={15} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                <input type="text" className="input-glass" style={{ width: '100%', paddingLeft: '36px' }}
                  placeholder="Buscar por nombre, ID o rol..."
                  value={formacionSearch} onChange={e => setFormacionSearch(e.target.value)} />
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: 6, alignSelf: 'flex-end' }}>
              <button className="btn btn-secondary" style={{ height: '42px', gap: 6, borderColor: 'var(--primary-border)' }}
                onClick={() => setShowDashboardDrawer(true)}>
                <ClipboardList size={16} /> <span>Cuadro de Mando</span>
              </button>
              <button className="btn btn-primary" style={{ height: '42px', gap: 6 }}
                onClick={() => setShowAddRegistro(true)}>
                <Plus size={16} /> <span>Registrar Capacitación</span>
              </button>
              <button className="btn btn-secondary" style={{ height: '42px', gap: 6, background: 'var(--bg-card)' }}
                onClick={() => setShowAddCurso(true)}>
                <Plus size={16} /> <span>Nuevo Curso</span>
              </button>
            </div>
          </div>

          {/* Course Summary row */}
          {(() => {
            const courseEnrolledStats = (courseId) => {
              const courseRegs = registros.filter(r => r.curso_id === courseId);
              const completed = courseRegs.filter(r => r.estado === 'Completada').length;
              const pending = courseRegs.filter(r => r.estado === 'En Curso').length;
              const expired = courseRegs.filter(r => r.estado === 'Vencida').length;
              return { total: courseRegs.length, completed, pending, expired };
            };

            return (
              <div className="courses-summary-row">
                {cursos.map(c => {
                  const stats = courseEnrolledStats(c.id);
                  return (
                    <div key={c.id} className="course-summary-card" onClick={() => setSelectedCourse(c)}>
                      <div>
                        <h4>{c.nombre}</h4>
                        <span className="course-type">{c.tipo}</span>
                      </div>
                      <div className="course-card-metrics">
                        <div className="course-metric-item">
                          <div className="course-metric-label">Total</div>
                          <div className="course-metric-value">{stats.total}</div>
                        </div>
                        <div className="course-metric-item">
                          <div className="course-metric-label">Comp.</div>
                          <div className="course-metric-value" style={{ color: 'var(--primary)' }}>{stats.completed}</div>
                        </div>
                        <div className="course-metric-item">
                          <div className="course-metric-label">Pend.</div>
                          <div className="course-metric-value" style={{ color: 'var(--accent-gold)' }}>{stats.pending + stats.expired}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Centralized Records Table */}
          <div className="glass-card" style={{ padding: 0 }}>
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Foto</th>
                    <th>Nombre Empleado</th>
                    <th>ID</th>
                    <th>Rol</th>
                    <th>Nombre Capacitación</th>
                    <th>Tipo</th>
                    <th>Fecha</th>
                    <th>Puntuación</th>
                    <th>Estado</th>
                    <th>Certificado</th>
                    <th style={{ textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const filteredRegistros = registros.filter(r => {
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

                    if (filteredRegistros.length === 0) {
                      return (
                        <tr>
                          <td colSpan={11}>
                            <div className="empty-state">
                              <div className="empty-state-icon"><ClipboardList size={28} /></div>
                              <h4>No se encontraron registros de capacitación</h4>
                              <p>Asegúrate de ajustar los filtros o registra una capacitación para comenzar.</p>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    return filteredRegistros.map(r => {
                      const w = workers.find(work => work.id === r.trabajador_id);
                      const c = cursos.find(cur => cur.id === r.curso_id);
                      
                      let stateBadge = 'badge-blue';
                      if (r.estado === 'Completada') stateBadge = 'badge-green';
                      else if (r.estado === 'En Curso') stateBadge = 'badge-yellow';
                      else if (r.estado === 'Vencida') stateBadge = 'badge-red';

                      return (
                        <tr key={r.id}>
                          <td>{w && <Avatar worker={w} size={28} />}</td>
                          <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{w ? `${w.nombres} ${w.apellidos}` : '—'}</td>
                          <td>{w ? w.identificacion : '—'}</td>
                          <td>{w ? w.rol : '—'}</td>
                          <td style={{ fontWeight: 500 }}>{c ? c.nombre : '—'}</td>
                          <td>{c ? c.tipo : '—'}</td>
                          <td>{r.fecha ? r.fecha.split('-').reverse().join('/') : '—'}</td>
                          <td>{r.resultado}</td>
                          <td><span className={`badge ${stateBadge}`}>{r.estado === 'Vencida' ? 'Certificación Vencida' : r.estado}</span></td>
                          <td>
                            {r.estado === 'Completada' ? (
                              <button className="btn btn-secondary" style={{ padding: '3px 8px', fontSize: 11, color: 'var(--primary)' }}
                                onClick={() => setShowCertModal(r)}>
                                (Ver)
                              </button>
                            ) : '—'}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button className="btn btn-danger" style={{ padding: '4px 6px' }}
                              onClick={() => handleDeleteRegistro(r.id)}>
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>

          {/* Visor de Certificado Modal */}
          {showCertModal && (
            <div className="modal-overlay" onClick={() => setShowCertModal(null)}>
              <div className="modal-box" style={{ maxWidth: 640, padding: 0, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
                <div style={{ background: 'var(--primary)', color: '#fff', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0, fontSize: 16 }}>Visor de Certificado Digital</h4>
                  <button className="btn btn-secondary" style={{ padding: 4, background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff' }} onClick={() => setShowCertModal(null)}><X size={16} /></button>
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
                      <a href={showCertModal.certificado_url} download={`certificado_${showCertModal.id.slice(0, 8)}`} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none', padding: '10px 20px' }}>
                        <Upload size={16} style={{ transform: 'rotate(180deg)' }} /> Descargar Certificado
                      </a>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: 40, background: '#fff', color: '#1e293b', textAlign: 'center', position: 'relative', border: '15px solid var(--primary-light)' }}>
                    <div style={{ border: '2px solid var(--primary)', padding: 30 }}>
                      <h2 style={{ fontFamily: '"Outfit", sans-serif', fontSize: 24, fontWeight: 800, color: 'var(--primary)', margin: '0 0 10px 0', letterSpacing: '0.05em' }}>CERTIFICADO DE APROBACIÓN</h2>
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

          {/* Drawer: General Dashboard */}
          {showDashboardDrawer && (
            <>
              <div className="side-drawer-overlay" onClick={() => setShowDashboardDrawer(false)} />
              <div className="side-drawer">
                <div className="side-drawer-header">
                  <h3>Cuadro de Mando de Capacitación</h3>
                  <button className="btn btn-secondary" style={{ padding: 4 }} onClick={() => setShowDashboardDrawer(false)}><X size={16} /></button>
                </div>
                <div className="side-drawer-tabs">
                  <button className={`side-drawer-tab-btn ${activeDashboardTab === 'graficos' ? 'active' : ''}`}
                    onClick={() => setActiveDashboardTab('graficos')}>Seguimiento y Gráficas</button>
                  <button className={`side-drawer-tab-btn ${activeDashboardTab === 'calendario' ? 'active' : ''}`}
                    onClick={() => setActiveDashboardTab('calendario')}>Calendario y Planificación</button>
                </div>
                <div className="side-drawer-body">
                  {activeDashboardTab === 'graficos' ? (
                    <>
                      {/* Metric cards */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div className="glass-card" style={{ padding: 12, textAlign: 'center' }}>
                          <div className="course-metric-label">Capacitados %</div>
                          <div className="course-metric-value" style={{ fontSize: 22, color: 'var(--primary)' }}>
                            {(() => {
                              const activeWorkers = workers.filter(w => w.estado === 'Activa');
                              const trainedSet = new Set(registros.filter(r => r.estado === 'Completada').map(r => r.trabajador_id));
                              return activeWorkers.length > 0 ? `${Math.round((trainedSet.size / activeWorkers.length) * 100)}%` : '85%';
                            })()}
                          </div>
                        </div>
                        <div className="glass-card" style={{ padding: 12, textAlign: 'center' }}>
                          <div className="course-metric-label">Horas Formación</div>
                          <div className="course-metric-value" style={{ fontSize: 22, color: 'var(--accent-blue)' }}>
                            {registros.filter(r => r.estado === 'Completada').reduce((sum, r) => {
                              const c = cursos.find(cur => cur.id === r.curso_id);
                              return sum + (c ? Number(c.total_horas) : 8);
                            }, 0)} hrs
                          </div>
                        </div>
                        <div className="glass-card" style={{ padding: 12, textAlign: 'center' }}>
                          <div className="course-metric-label">Completados Mes</div>
                          <div className="course-metric-value" style={{ fontSize: 22, color: 'var(--accent-gold)' }}>5</div>
                        </div>
                        <div className="glass-card" style={{ padding: 12, textAlign: 'center' }}>
                          <div className="course-metric-label">Críticas por vencer</div>
                          <div className="course-metric-value" style={{ fontSize: 22, color: 'var(--accent-red)' }}>
                            {registros.filter(r => r.estado === 'Vencida').length}
                          </div>
                        </div>
                      </div>

                      {/* Bar Chart */}
                      <div className="glass-card" style={{ padding: 16 }}>
                        <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Cumplimiento por Tipo</h4>
                        {(() => {
                          const completedByType = registros.filter(r => r.estado === 'Completada').reduce((acc, r) => {
                            const c = cursos.find(cur => cur.id === r.curso_id);
                            const type = c ? c.tipo : 'Otros';
                            acc[type] = (acc[type] || 0) + 1;
                            return acc;
                          }, { 'Seguridad y Salud': 0, 'Técnica': 0, 'Operación': 0 });

                          const maxVal = Math.max(1, ...Object.values(completedByType));

                          return (
                            <>
                              <div className="custom-bar-chart">
                                {Object.entries(completedByType).map(([type, count]) => {
                                  const pct = (count / maxVal) * 100;
                                  let typeClass = 'seguridad';
                                  if (type === 'Técnica') typeClass = 'tecnica';
                                  if (type === 'Operación') typeClass = 'operacion';
                                  return (
                                    <div key={type} className="bar-item">
                                      <div className="bar-fill-container">
                                        <div className={`bar-fill ${typeClass}`} style={{ height: `${pct}%` }} />
                                      </div>
                                      <div className="bar-label">{type.split(' ')[0]} ({count})</div>
                                    </div>
                                  );
                                })}
                              </div>
                            </>
                          );
                        })()}
                      </div>

                      {/* Donut Chart */}
                      <div className="glass-card" style={{ padding: 16 }}>
                        <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Distribución de Estados</h4>
                        {(() => {
                          const statusCounts = registros.reduce((acc, r) => {
                            acc[r.estado] = (acc[r.estado] || 0) + 1;
                            return acc;
                          }, { 'Completada': 0, 'En Curso': 0, 'Vencida': 0 });

                          const totalStatus = Math.max(1, registros.length);
                          const compPct = (statusCounts['Completada'] / totalStatus) * 100;
                          const inPrPct = compPct + (statusCounts['En Curso'] / totalStatus) * 100;

                          return (
                            <div className="custom-donut-chart" style={{
                              '--completed-pct': `${compPct}%`,
                              '--in-progress-pct': `${inPrPct}%`
                            }}>
                              <div className="donut-visual" />
                              <div className="donut-legend">
                                <div className="legend-item">
                                  <span className="legend-color" style={{ background: 'var(--primary)' }} />
                                  <span>Completada ({statusCounts['Completada']})</span>
                                </div>
                                <div className="legend-item">
                                  <span className="legend-color" style={{ background: 'var(--accent-blue)' }} />
                                  <span>En Curso ({statusCounts['En Curso']})</span>
                                </div>
                                <div className="legend-item">
                                  <span className="legend-color" style={{ background: 'var(--accent-red)' }} />
                                  <span>Vencida ({statusCounts['Vencida']})</span>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Mini Calendar Tab */}
                      {(() => {
                        const calendarDays = [];
                        // May 2026 calendar mock (starts Friday, so 4 prev month days)
                        for (let i = 27; i <= 30; i++) calendarDays.push({ day: i, active: false, hasEvent: false });
                        for (let i = 1; i <= 31; i++) {
                          const dayStr = i < 10 ? `0${i}` : `${i}`;
                          const dateKey = `2026-05-${dayStr}`;
                          const hasEvent = registros.some(r => r.fecha === dateKey);
                          calendarDays.push({ day: i, active: true, hasEvent, dateKey });
                        }
                        const rem = 42 - calendarDays.length;
                        for (let i = 1; i <= rem; i++) calendarDays.push({ day: i, active: false, hasEvent: false });

                        return (
                          <div className="mini-calendar-container">
                            <div className="mini-calendar-header">Mayo 2026</div>
                            <div className="mini-calendar-grid">
                              {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'].map(d => (
                                <div key={d} className="calendar-day-header">{d}</div>
                              ))}
                              {calendarDays.map((c, i) => (
                                <div key={i} className={`calendar-day-cell ${c.active ? 'active-month' : ''} ${c.hasEvent ? 'has-event' : ''}`}>
                                  {c.day}
                                </div>
                              ))}
                            </div>
                            
                            <div className="calendar-events-list">
                              <h4 style={{ fontSize: 12, fontWeight: 700, margin: '14px 0 6px 0' }}>Próximas Capacitaciones</h4>
                              {registros.filter(r => r.fecha.startsWith('2026-05')).slice(0, 3).map(r => {
                                const c = cursos.find(cur => cur.id === r.curso_id);
                                const w = workers.find(work => work.id === r.trabajador_id);
                                let typeClass = 'tecnica';
                                if (c && c.tipo === 'Seguridad y Salud') typeClass = 'seguridad';
                                if (c && c.tipo === 'Operación') typeClass = 'operacion';

                                return (
                                  <div key={r.id} className={`calendar-event-card ${typeClass}`}>
                                    <div>
                                      <strong>{c ? c.nombre : 'Capacitación'}</strong>
                                      <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>{w ? `${w.nombres} ${w.apellidos}` : 'Varios'}</div>
                                    </div>
                                    <span style={{ fontWeight: 600 }}>{r.fecha.split('-')[2]} may</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
                    </>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Drawer: Course Detail */}
          {selectedCourse && (
            <>
              <div className="side-drawer-overlay" onClick={() => setSelectedCourse(null)} />
              <div className="side-drawer">
                <div className="side-drawer-header">
                  <h3>Detalle de Curso</h3>
                  <button className="btn btn-secondary" style={{ padding: 4 }} onClick={() => setSelectedCourse(null)}><X size={16} /></button>
                </div>
                <div className="side-drawer-body">
                  <div className="glass-card" style={{ padding: 16, background: 'var(--primary-light)', borderColor: 'var(--primary-border)' }}>
                    <h4 style={{ fontSize: 15, fontWeight: 800, color: 'var(--primary)', marginBottom: 4 }}>{selectedCourse.nombre}</h4>
                    <span className="course-type" style={{ marginBottom: 0 }}>{selectedCourse.tipo} · {selectedCourse.total_horas} horas totales</span>
                  </div>

                  {/* Course stats */}
                  {(() => {
                    const courseRegs = registros.filter(r => r.curso_id === selectedCourse.id);
                    const completed = courseRegs.filter(r => r.estado === 'Completada').length;
                    const inProgress = courseRegs.filter(r => r.estado === 'En Curso').length;
                    const expired = courseRegs.filter(r => r.estado === 'Vencida').length;
                    
                    return (
                      <>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          <div className="glass-card" style={{ padding: 12, textAlign: 'center' }}>
                            <div className="course-metric-label">Inscritos</div>
                            <div className="course-metric-value">{courseRegs.length}</div>
                          </div>
                          <div className="glass-card" style={{ padding: 12, textAlign: 'center' }}>
                            <div className="course-metric-label">Aprobación</div>
                            <div className="course-metric-value" style={{ color: 'var(--primary)' }}>
                              {courseRegs.length > 0 ? `${Math.round((completed / courseRegs.length) * 100)}%` : '0%'}
                            </div>
                          </div>
                        </div>

                        {/* List of enrolled workers */}
                        <div className="glass-card" style={{ padding: 16 }}>
                          <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Alumnos Registrados</h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 300, overflowY: 'auto' }}>
                            {courseRegs.length === 0 ? (
                              <div style={{ textStyle: 'italic', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>Sin alumnos registrados.</div>
                            ) : (
                              courseRegs.map(r => {
                                const w = workers.find(work => work.id === r.trabajador_id);
                                if (!w) return null;
                                let badgeColor = 'badge-blue';
                                if (r.estado === 'Completada') badgeColor = 'badge-green';
                                else if (r.estado === 'En Curso') badgeColor = 'badge-yellow';
                                else if (r.estado === 'Vencida') badgeColor = 'badge-red';

                                return (
                                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--border-color)', paddingBottom: 8 }}>
                                    <Avatar worker={w} size={28} />
                                    <div style={{ flexGrow: 1 }}>
                                      <div style={{ fontSize: 12, fontWeight: 600 }}>{w.nombres} {w.apellidos}</div>
                                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{w.rol} · Calif: {r.resultado}</div>
                                    </div>
                                    <span className={`badge ${badgeColor}`} style={{ fontSize: 10 }}>{r.estado}</span>
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

          {/* Modal: Agregar Curso */}
          {showAddCurso && (
            <div className="modal-overlay" onClick={() => setShowAddCurso(false)}>
              <div className="modal-box" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                  <h3>Crear Nuevo Curso</h3>
                  <button className="btn btn-secondary" style={{ padding: 6 }}
                    onClick={() => setShowAddCurso(false)}><X size={18} /></button>
                </div>
                <div className="modal-body">
                  <form onSubmit={handleAddCurso}>
                    <div style={{ marginBottom: 16 }}>
                      <label className="form-label">Nombre del Curso *</label>
                      <input type="text" className="input-glass" style={{ width: '100%' }}
                        placeholder="Ej. Taller de Poda Básica" required
                        value={newCursoForm.nombre} onChange={e => setNewCursoForm(p => ({ ...p, nombre: e.target.value }))} />
                    </div>

                    <div style={{ marginBottom: 16 }}>
                      <label className="form-label">Tipo de Capacitación</label>
                      <select className="input-glass select-glass" style={{ width: '100%' }}
                        value={newCursoForm.tipo} onChange={e => setNewCursoForm(p => ({ ...p, tipo: e.target.value }))}>
                        <option value="Seguridad y Salud">Seguridad y Salud</option>
                        <option value="Técnica">Técnica</option>
                        <option value="Operación">Operación</option>
                      </select>
                    </div>

                    <div style={{ marginBottom: 20 }}>
                      <label className="form-label">Horas Totales</label>
                      <input type="number" className="input-glass" style={{ width: '100%' }}
                        min="1" max="120"
                        value={newCursoForm.total_horas} onChange={e => setNewCursoForm(p => ({ ...p, total_horas: e.target.value }))} />
                    </div>

                    <div style={{ display: 'flex', gap: 12 }}>
                      <button type="button" className="btn btn-secondary" style={{ flexGrow: 1 }}
                        onClick={() => setShowAddCurso(false)}>Cancelar</button>
                      <button type="submit" className="btn btn-primary" style={{ flexGrow: 1 }}>Crear Curso</button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* Modal: Registrar Capacitación */}
          {showAddRegistro && (
            <div className="modal-overlay" onClick={() => setShowAddRegistro(false)}>
              <div className="modal-box" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                  <h3>Registrar Registro de Capacitación</h3>
                  <button className="btn btn-secondary" style={{ padding: 6 }}
                    onClick={() => setShowAddRegistro(false)}><X size={18} /></button>
                </div>
                <div className="modal-body">
                  <form onSubmit={handleAddRegistro}>
                    <div style={{ marginBottom: 16 }}>
                      <label className="form-label">Trabajador *</label>
                      <select className="input-glass select-glass" style={{ width: '100%' }} required
                        value={newRegistroForm.trabajadorId} onChange={e => setNewRegistroForm(p => ({ ...p, trabajadorId: e.target.value }))}>
                        <option value="">— Selecciona un trabajador —</option>
                        {workers.map(w => (
                          <option key={w.id} value={w.id}>{w.nombres} {w.apellidos} ({w.rol})</option>
                        ))}
                      </select>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                      <label className="form-label">Curso de Capacitación *</label>
                      <select className="input-glass select-glass" style={{ width: '100%' }} required
                        value={newRegistroForm.cursoId} onChange={e => setNewRegistroForm(p => ({ ...p, cursoId: e.target.value }))}>
                        <option value="">— Selecciona un curso —</option>
                        {cursos.map(c => (
                          <option key={c.id} value={c.id}>{c.nombre} ({c.tipo})</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group-container" style={{ gap: 12, marginBottom: 16 }}>
                      <div>
                        <label className="form-label">Fecha</label>
                        <input type="date" className="input-glass" style={{ width: '100%' }} required
                          value={newRegistroForm.fecha} onChange={e => setNewRegistroForm(p => ({ ...p, fecha: e.target.value }))} />
                      </div>
                      <div>
                        <label className="form-label">Puntuación / Calificación</label>
                        <input type="text" className="input-glass" style={{ width: '100%' }}
                          placeholder="Ej. 10/10 o En Curso" required
                          value={newRegistroForm.resultado} onChange={e => setNewRegistroForm(p => ({ ...p, resultado: e.target.value }))} />
                      </div>
                    </div>

                    <div style={{ marginBottom: 20 }}>
                      <label className="form-label">Estado</label>
                      <div className="toggle-group">
                        {['Completada', 'En Curso', 'Vencida'].map(st => (
                          <button type="button" key={st}
                            className={`toggle-btn ${newRegistroForm.estado === st ? 'active' : ''}`}
                            onClick={() => setNewRegistroForm(p => ({ ...p, estado: st, resultado: st === 'En Curso' ? 'En Curso' : p.resultado }))}>
                            {st === 'Vencida' ? 'Vencida' : st}
                          </button>
                        ))}
                      </div>
                    </div>

                    {newRegistroForm.estado === 'Completada' && (
                      <div style={{ marginBottom: 20 }}>
                        <label className="form-label">Subir Certificado Diseñado</label>
                        <div className="file-upload-zone" onClick={() => certUploadRef.current?.click()}>
                          <Upload size={20} style={{ color: 'var(--text-muted)' }} />
                          <span style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                            {newRegistroForm.certificadoFileName || 'Haz clic para seleccionar el certificado'}
                          </span>
                          <input ref={certUploadRef} type="file" accept=".pdf,.jpg,.jpeg,.png"
                            style={{ display: 'none' }} onChange={handleCertUpload} />
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 12 }}>
                      <button type="button" className="btn btn-secondary" style={{ flexGrow: 1 }}
                        onClick={() => setShowAddRegistro(false)}>Cancelar</button>
                      <button type="submit" className="btn btn-primary" style={{ flexGrow: 1 }}>Registrar</button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {activeSubTab === 'nominas' && (() => {
        // Formateador de moneda colombiana (COP)
        const formatCOP = (val) => {
          return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);
        };

        // Formateador abreviado para millones (e.g. $45.2M COP)
        const formatCOPMillon = (val) => {
          if (val >= 1000000) {
            return `$${(val / 1000000).toFixed(1)}M COP`;
          }
          return formatCOP(val);
        };

        // Lógica de filtrado de nóminas
        const filteredNominas = nominas.filter(n => {
          const w = n.trabajador || workers.find(work => work.id === n.trabajador_id);
          if (!w) return false;

          // 1. Filtro de periodo
          if (nominaPeriodFilter && n.periodo !== nominaPeriodFilter) return false;

          // 2. Filtro de estado de pago
          if (nominaStatusFilter !== 'Todos' && n.estado !== nominaStatusFilter) return false;

          // 3. Filtro de tipo de contrato / empleado
          if (nominaTypeFilter !== 'Todos') {
            const contractType = w.tipoContrato || w.tipo_contrato || 'Permanente';
            if (contractType !== nominaTypeFilter) return false;
          }

          // 4. Filtro por cuadrilla
          if (nominaCuadrillaFilter !== 'todas') {
            const cuadrilla = cuadrillas.find(c => c.id === nominaCuadrillaFilter);
            if (!cuadrilla || !cuadrilla.miembros.includes(w.id)) return false;
          }

          // 5. Filtro de búsqueda (nombre o CC)
          if (nominaSearchFilter.trim()) {
            const q = nominaSearchFilter.toLowerCase();
            const fullName = `${w.nombres} ${w.apellidos}`.toLowerCase();
            const iden = (w.identificacion || '').toLowerCase();
            if (!fullName.includes(q) && !iden.includes(q)) return false;
          }

          return true;
        });

        // Métricas calculadas para el período seleccionado
        const periodNominas = nominas.filter(n => n.periodo === nominaPeriodFilter);
        
        const totalNominaMes = periodNominas.reduce((sum, n) => sum + (n.total_neto || 0), 0);
        const pagosPendientesCount = periodNominas.filter(n => n.estado === 'Procesando').length;
        const pagosProcesadosCount = periodNominas.filter(n => n.estado === 'Completado').length;
        const incidentesCount = periodNominas.filter(n => n.estado === 'Fallido' || n.estado === 'Vencida').length;

        // Cuadro de mando - Métricas secundarias
        const totalCostoLaboral = totalNominaMes;
        const totalHorasExtrasAcum = periodNominas.reduce((sum, n) => sum + (n.horas_extras || 0), 0);
        const tasaPagosATiempo = periodNominas.length > 0
          ? Math.round((periodNominas.filter(n => n.estado === 'Completado').length / periodNominas.length) * 100)
          : 100;

        // Datos para gráfico de evolución (Feb, Mar, Abr / Mar, Abr, May)
        const getCostByPeriod = (periodName) => {
          return nominas.filter(n => n.periodo === periodName).reduce((sum, n) => sum + (n.total_neto || 0), 0);
        };

        const displayPeriods = nominaPeriodFilter === 'Mayo' ? ['Marzo', 'Abril', 'Mayo'] : ['Febrero', 'Marzo', 'Abril'];
        
        // Asignar costos por mes
        const costMonth1 = getCostByPeriod(displayPeriods[0]);
        const costMonth2 = getCostByPeriod(displayPeriods[1]);
        const costMonth3 = getCostByPeriod(displayPeriods[2]);

        const maxCostPeriod = Math.max(1, costMonth1, costMonth2, costMonth3);
        const heightPct1 = Math.round((costMonth1 / maxCostPeriod) * 100);
        const heightPct2 = Math.round((costMonth2 / maxCostPeriod) * 100);
        const heightPct3 = Math.round((costMonth3 / maxCostPeriod) * 100);

        // Distribución de Costos por Rol (Gráfico de Dona)
        const roleCosts = periodNominas.reduce((acc, n) => {
          const w = n.trabajador || workers.find(work => work.id === n.trabajador_id);
          const role = w ? w.rol : 'Operario General';
          acc[role] = (acc[role] || 0) + (n.total_neto || 0);
          return acc;
        }, {});

        const sortedRoleCosts = Object.entries(roleCosts).sort((a, b) => b[1] - a[1]);
        const totalRoleCostSum = Object.values(roleCosts).reduce((sum, c) => sum + c, 0);

        // Colores asignados a los roles principales
        const roleColorPalette = [
          'var(--accent-blue)', // Tractorista
          'var(--primary)',     // Operario General
          'var(--accent-red)',     // Recolector
          'var(--accent-gold)',    // Otros
          'var(--text-muted)'
        ];

        let conicGradientSegments = [];
        let accumulatedPercentage = 0;

        if (totalRoleCostSum > 0) {
          sortedRoleCosts.forEach(([role, cost], idx) => {
            const pct = (cost / totalRoleCostSum) * 100;
            const start = accumulatedPercentage;
            const end = accumulatedPercentage + pct;
            accumulatedPercentage = end;
            const color = roleColorPalette[idx % roleColorPalette.length];
            conicGradientSegments.push(`${color} ${start.toFixed(1)}% ${end.toFixed(1)}%`);
          });
        }
        const donutStyle = {
          background: conicGradientSegments.length > 0 
            ? `conic-gradient(${conicGradientSegments.join(', ')})` 
            : 'conic-gradient(var(--border-color) 0% 100%)'
        };

        return (
          <>
            {/* Barra de Filtros Superiores */}
            <div className="filter-bar">
              <div className="filter-group" style={{ minWidth: '180px' }}>
                <label>Filtrar por Cuadrilla</label>
                <select className="input-glass select-glass" style={{ width: '100%' }}
                  value={nominaCuadrillaFilter} onChange={e => setNominaCuadrillaFilter(e.target.value)}>
                  <option value="todas">Todas las cuadrillas</option>
                  {cuadrillas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>

              <div className="filter-group" style={{ minWidth: '150px' }}>
                <label>Estado de Pago</label>
                <select className="input-glass select-glass" style={{ width: '100%' }}
                  value={nominaStatusFilter} onChange={e => setNominaStatusFilter(e.target.value)}>
                  <option value="Todos">Todos los estados</option>
                  <option value="Completado">Completado</option>
                  <option value="Procesando">Procesando</option>
                  <option value="Fallido">Fallido</option>
                  <option value="Vencida">Vencida</option>
                </select>
              </div>

              <div className="filter-group" style={{ minWidth: '140px' }}>
                <label>Periodo (Mes)</label>
                <select className="input-glass select-glass" style={{ width: '100%' }}
                  value={nominaPeriodFilter} onChange={e => setNominaPeriodFilter(e.target.value)}>
                  <option value="Enero">Enero 2026</option>
                  <option value="Febrero">Febrero 2026</option>
                  <option value="Marzo">Marzo 2026</option>
                  <option value="Abril">Abril 2026</option>
                  <option value="Mayo">Mayo 2026</option>
                </select>
              </div>

              <div className="filter-group">
                <label>Tipo de Empleado</label>
                <div className="toggle-group">
                  {['Todos', ...TIPOS_CONTRATO].map(tipo => (
                    <button key={tipo} className={`toggle-btn ${nominaTypeFilter === tipo ? 'active' : ''}`}
                      onClick={() => setNominaTypeFilter(tipo)}>{tipo}</button>
                  ))}
                </div>
              </div>

              <div className="filter-group" style={{ flexGrow: 1, minWidth: '200px' }}>
                <label>Busca por empleado</label>
                <div style={{ position: 'relative' }}>
                  <Search size={15} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                  <input type="text" className="input-glass" style={{ width: '100%', paddingLeft: '36px' }}
                    placeholder="Buscar por nombre o identificación..."
                    value={nominaSearchFilter} onChange={e => setNominaSearchFilter(e.target.value)} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, alignSelf: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={handleGenerateNominasPeriodo}
                  title="Generar planilla de nómina para todos los trabajadores activos del mes actual"
                  style={{ height: '42px', whiteSpace: 'nowrap' }}>
                  <Settings2 size={16} /> <span>Generar Planilla</span>
                </button>
                <button className="btn btn-primary" onClick={() => { setNominaForm({ ...EMPTY_NOMINA_FORM, periodo: nominaPeriodFilter }); setShowAddNomina(true); }}
                  style={{ height: '42px', whiteSpace: 'nowrap' }}>
                  <Plus size={16} /> <span>Registrar Pago</span>
                </button>
              </div>
            </div>

            {/* Layout principal a dos columnas */}
            <div className="nominas-layout">
              {/* Columna Izquierda: KPIs superiores + Tabla */}
              <div className="nominas-main">
                {/* Tarjetas resumen KPI */}
                <div className="kpi-row">
                  <div className="kpi-card active" onClick={() => setNominaStatusFilter('Todos')}>
                    <span className="kpi-card-header">Total Nómina {nominaPeriodFilter}</span>
                    <span className="kpi-card-value">{formatCOP(totalNominaMes)}</span>
                    <span className="kpi-card-footer">Costo neto liquidado del mes</span>
                  </div>

                  <div className="kpi-card" onClick={() => setNominaStatusFilter('Procesando')}>
                    <span className="kpi-card-header" style={{ color: 'var(--accent-gold)' }}>Pagos Pendientes</span>
                    <span className="kpi-card-value" style={{ color: 'var(--accent-gold)' }}>{pagosPendientesCount}</span>
                    <span className="kpi-card-footer">Transacciones en proceso de pago</span>
                  </div>

                  <div className="kpi-card" onClick={() => setNominaStatusFilter('Completado')}>
                    <span className="kpi-card-header" style={{ color: 'var(--primary)' }}>Pagos Procesados</span>
                    <span className="kpi-card-value" style={{ color: 'var(--primary)' }}>{pagosProcesadosCount}</span>
                    <span className="kpi-card-footer">Transacciones completadas con éxito</span>
                  </div>

                  <div className="kpi-card" onClick={() => setNominaStatusFilter('Fallido')}>
                    <span className="kpi-card-header" style={{ color: 'var(--accent-red)' }}>Incidentes de Pago</span>
                    <span className="kpi-card-value" style={{ color: 'var(--accent-red)' }}>{incidentesCount}</span>
                    <span className="kpi-card-footer">Fallidos o vencidos por conciliar</span>
                  </div>
                </div>

                {/* Tabla de registros */}
                <div className="glass-card" style={{ padding: 0 }}>
                  <div className="table-container">
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th>Foto</th>
                          <th>Nombre Empleado</th>
                          <th>ID</th>
                          <th>Rol</th>
                          <th>Periodo</th>
                          <th>Salario Neto</th>
                          <th>Horas Extras</th>
                          <th>Retenciones</th>
                          <th>Total Neto</th>
                          <th>Estado</th>
                          <th style={{ textAlign: 'right' }}>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredNominas.length === 0 ? (
                          <tr>
                            <td colSpan={11}>
                              <div className="empty-state">
                                <div className="empty-state-icon"><DollarSign size={28} /></div>
                                <h4>No hay registros de nómina para mostrar</h4>
                                <p>Prueba a cambiar los filtros o haz clic en **Generar Planilla** para autocompletar el mes.</p>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          filteredNominas.map(n => {
                            const w = n.trabajador || workers.find(work => work.id === n.trabajador_id);
                            if (!w) return null;

                            let statusBadge = 'badge-blue';
                            if (n.estado === 'Completado') statusBadge = 'badge-green';
                            else if (n.estado === 'Procesando') statusBadge = 'badge-yellow';
                            else if (n.estado === 'Fallido') statusBadge = 'badge-red';
                            else if (n.estado === 'Vencida') statusBadge = 'badge-red';

                            return (
                              <tr key={n.id}>
                                <td><Avatar worker={w} size={28} /></td>
                                <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{w.nombres} {w.apellidos}</td>
                                <td>{w.identificacion || '—'}</td>
                                <td>{w.rol}</td>
                                <td style={{ textTransform: 'capitalize' }}>{n.periodo}</td>
                                <td>{formatCOP(n.salario_neto)}</td>
                                <td style={{ textAlign: 'center' }}>{n.horas_extras} hrs</td>
                                <td>{formatCOP(n.retenciones)}</td>
                                <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{formatCOP(n.total_neto)}</td>
                                <td><span className={`badge ${statusBadge}`}>{n.estado}</span></td>
                                <td style={{ textAlign: 'right' }}>
                                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                    <button className="btn btn-secondary" style={{ padding: '6px' }}
                                      onClick={() => {
                                        setSelectedNomina(n);
                                        setNominaForm({
                                          trabajadorId: n.trabajador_id,
                                          periodo: n.periodo,
                                          salarioNeto: n.salario_neto,
                                          horasExtras: n.horas_extras,
                                          retenciones: n.retenciones,
                                          estado: n.estado,
                                          fechaPago: n.fecha_pago || '',
                                          metodoPago: n.metodo_pago || 'Transferencia Bancaria',
                                          comentarios: n.comentarios || ''
                                        });
                                        setShowEditNomina(true);
                                      }}
                                      title="Editar registro de pago">
                                      <Pencil size={13} />
                                    </button>
                                    <button className="btn btn-danger" style={{ padding: '6px' }}
                                      onClick={() => handleDeleteNomina(n.id)}
                                      title="Eliminar registro">
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Columna Derecha: Cuadro de Mando de Nómina (Panel Lateral) */}
              <div className="nominas-sidebar">
                <div className="glass-card" style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, borderBottom: '1px solid var(--border-color)', paddingBottom: 12 }}>
                    Cuadro de Mando de Nómina y Pagos
                  </h3>

                  {/* KPIs Secundarios */}
                  <div className="sidebar-metrics-list">
                    <div className="sidebar-metric-card">
                      <span className="sidebar-metric-title">Total Costo Laboral ({nominaPeriodFilter})</span>
                      <span className="sidebar-metric-value">{formatCOPMillon(totalCostoLaboral)}</span>
                      <span className="sidebar-metric-desc">Gasto total en mano de obra en el mes</span>
                    </div>

                    <div className="sidebar-metric-card">
                      <span className="sidebar-metric-title">Tasa de Pagos a Tiempo</span>
                      <span className="sidebar-metric-value" style={{ color: 'var(--primary)' }}>{tasaPagosATiempo}%</span>
                      <span className="sidebar-metric-desc">Porcentaje de transacciones completadas</span>
                    </div>

                    <div className="sidebar-metric-card">
                      <span className="sidebar-metric-title">Total Horas Extras</span>
                      <span className="sidebar-metric-value" style={{ color: 'var(--accent-blue)' }}>{totalHorasExtrasAcum} hrs</span>
                      <span className="sidebar-metric-desc">Horas adicionales laboradas en el mes</span>
                    </div>

                    <div className="sidebar-metric-card">
                      <span className="sidebar-metric-title">Incidentes de Pago</span>
                      <span className="sidebar-metric-value" style={{ color: incidentesCount > 0 ? 'var(--accent-red)' : 'var(--text-secondary)' }}>
                        {incidentesCount}
                      </span>
                      <span className="sidebar-metric-desc">Transacciones fallidas pendientes</span>
                    </div>
                  </div>

                  {/* Gráfico 1: Evolución de Costos de Nómina */}
                  <div style={{ marginTop: 10 }}>
                    <h4 style={{ fontSize: 12, fontWeight: 700, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
                      Evolución de Costos ({displayPeriods.join(', ')})
                    </h4>
                    <div className="evolution-bars-container">
                      <div className="evolution-bar-wrapper">
                        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)' }}>{formatCOPMillon(costMonth1).split(' ')[0]}</span>
                        <div className="evolution-bar-fill-container">
                          <div className="evolution-bar-fill" style={{ height: `${heightPct1}%` }} />
                        </div>
                        <span className="evolution-bar-label">{displayPeriods[0].slice(0, 3)}</span>
                      </div>

                      <div className="evolution-bar-wrapper">
                        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)' }}>{formatCOPMillon(costMonth2).split(' ')[0]}</span>
                        <div className="evolution-bar-fill-container">
                          <div className="evolution-bar-fill" style={{ height: `${heightPct2}%` }} />
                        </div>
                        <span className="evolution-bar-label">{displayPeriods[1].slice(0, 3)}</span>
                      </div>

                      <div className="evolution-bar-wrapper">
                        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)' }}>{formatCOPMillon(costMonth3).split(' ')[0]}</span>
                        <div className="evolution-bar-fill-container">
                          <div className="evolution-bar-fill secondary" style={{ height: `${heightPct3}%` }} />
                        </div>
                        <span className="evolution-bar-label">{displayPeriods[2].slice(0, 3)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Gráfico 2: Distribución de Costos por Rol */}
                  <div style={{ marginTop: 10 }}>
                    <h4 style={{ fontSize: 12, fontWeight: 700, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
                      Distribución por Rol
                    </h4>
                    
                    <div className="role-donut-chart">
                      <div className="role-donut-visual" style={donutStyle} />

                      <div className="role-donut-legend">
                        {sortedRoleCosts.map(([role, cost], idx) => {
                          const pct = totalRoleCostSum > 0 ? Math.round((cost / totalRoleCostSum) * 100) : 0;
                          const color = roleColorPalette[idx % roleColorPalette.length];
                          return (
                            <div key={role} className="role-legend-item">
                              <div className="role-legend-label">
                                <span className="legend-color" style={{ background: color }} />
                                <span>{role}</span>
                              </div>
                              <span className="role-legend-value">{pct}%</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal: Registrar Pago (Agregar) */}
            {showAddNomina && (
              <div className="modal-overlay" onClick={() => setShowAddNomina(false)}>
                <div className="modal-box" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
                  <div className="modal-header">
                    <h3>Registrar Pago de Nómina</h3>
                    <button className="btn btn-secondary" style={{ padding: 6 }}
                      onClick={() => setShowAddNomina(false)}><X size={18} /></button>
                  </div>
                  <div className="modal-body">
                    <form onSubmit={handleAddNomina}>
                      <div style={{ marginBottom: 14 }}>
                        <label className="form-label">Trabajador *</label>
                        <select className="input-glass select-glass" style={{ width: '100%' }} required
                          value={nominaForm.trabajadorId} onChange={e => {
                            const wId = e.target.value;
                            const w = workers.find(work => work.id === wId);
                            const baseSalary = w ? (w.rol === 'Tractorista' ? 4250000 : w.rol === 'Supervisor de Campo' ? 5500000 : 3500000) : 3500000;
                            setNominaForm(p => ({ ...p, trabajadorId: wId, salarioNeto: baseSalary }));
                          }}>
                          <option value="">— Selecciona un trabajador activo —</option>
                          {workers.filter(w => w.estado === 'Activa').map(w => (
                            <option key={w.id} value={w.id}>{w.nombres} {w.apellidos} ({w.rol})</option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group-container" style={{ marginBottom: 14, gap: 12 }}>
                        <div>
                          <label className="form-label">Periodo (Mes) *</label>
                          <select className="input-glass select-glass" style={{ width: '100%' }} required
                            value={nominaForm.periodo} onChange={e => setNominaForm(p => ({ ...p, periodo: e.target.value }))}>
                            <option value="Enero">Enero</option>
                            <option value="Febrero">Febrero</option>
                            <option value="Marzo">Marzo</option>
                            <option value="Abril">Abril</option>
                            <option value="Mayo">Mayo</option>
                          </select>
                        </div>
                        <div>
                          <label className="form-label">Estado inicial *</label>
                          <select className="input-glass select-glass" style={{ width: '100%' }} required
                            value={nominaForm.estado} onChange={e => setNominaForm(p => ({ ...p, estado: e.target.value, fechaPago: e.target.value === 'Completado' ? new Date().toISOString().split('T')[0] : '' }))}>
                            <option value="Procesando">Procesando</option>
                            <option value="Completado">Completado</option>
                            <option value="Fallido">Fallido</option>
                            <option value="Vencida">Vencida</option>
                          </select>
                        </div>
                      </div>

                      <div className="form-group-container" style={{ marginBottom: 14, gap: 12 }}>
                        <div>
                          <label className="form-label">Salario Base (COP) *</label>
                          <input type="number" className="input-glass" style={{ width: '100%' }} required
                            value={nominaForm.salarioNeto} onChange={e => setNominaForm(p => ({ ...p, salarioNeto: Number(e.target.value) }))} />
                        </div>
                        <div>
                          <label className="form-label">Horas Extras *</label>
                          <input type="number" className="input-glass" style={{ width: '100%' }} required min="0"
                            value={nominaForm.horasExtras} onChange={e => setNominaForm(p => ({ ...p, horasExtras: Number(e.target.value) }))} />
                          <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>Valor H.E: $15.000 COP</span>
                        </div>
                      </div>

                      <div className="form-group-container" style={{ marginBottom: 14, gap: 12 }}>
                        <div>
                          <label className="form-label">Retenciones / Descuentos *</label>
                          <input type="number" className="input-glass" style={{ width: '100%' }} required min="0"
                            value={nominaForm.retenciones} onChange={e => setNominaForm(p => ({ ...p, retenciones: Number(e.target.value) }))} />
                        </div>
                        <div>
                          <label className="form-label">Método de Pago</label>
                          <select className="input-glass select-glass" style={{ width: '100%' }}
                            value={nominaForm.metodoPago} onChange={e => setNominaForm(p => ({ ...p, metodoPago: e.target.value }))}>
                            <option value="Transferencia Bancaria">Transferencia Bancaria</option>
                            <option value="Efectivo">Efectivo</option>
                            <option value="Cheque">Cheque</option>
                          </select>
                        </div>
                      </div>

                      {nominaForm.estado === 'Completado' && (
                        <div style={{ marginBottom: 14 }}>
                          <label className="form-label">Fecha de Pago *</label>
                          <input type="date" className="input-glass" style={{ width: '100%' }} required
                            value={nominaForm.fechaPago} onChange={e => setNominaForm(p => ({ ...p, fechaPago: e.target.value }))} />
                        </div>
                      )}

                      <div style={{ marginBottom: 18 }}>
                        <label className="form-label">Comentarios / Incidentes</label>
                        <textarea className="input-glass" style={{ width: '100%', minHeight: 60, resize: 'vertical' }}
                          placeholder="Notas sobre el pago, motivo de fallo o vencimiento..."
                          value={nominaForm.comentarios} onChange={e => setNominaForm(p => ({ ...p, comentarios: e.target.value }))} />
                      </div>

                      <div style={{ display: 'flex', gap: 12 }}>
                        <button type="button" className="btn btn-secondary" style={{ flexGrow: 1 }}
                          onClick={() => { setNominaForm({ ...EMPTY_NOMINA_FORM }); setShowAddNomina(false); }}>
                          Cancelar
                        </button>
                        <button type="submit" className="btn btn-primary" style={{ flexGrow: 1 }}>
                          Registrar Pago
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            )}

            {/* Modal: Editar Pago */}
            {showEditNomina && selectedNomina && (
              <div className="modal-overlay" onClick={() => { setSelectedNomina(null); setShowEditNomina(false); }}>
                <div className="modal-box" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
                  <div className="modal-header">
                    <h3>Editar Registro de Pago</h3>
                    <button className="btn btn-secondary" style={{ padding: 6 }}
                      onClick={() => { setSelectedNomina(null); setShowEditNomina(false); }}><X size={18} /></button>
                  </div>
                  <div className="modal-body">
                    {(() => {
                      const w = selectedNomina.trabajador || workers.find(work => work.id === selectedNomina.trabajador_id);
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, padding: '10px 14px', borderRadius: 10, background: 'var(--primary-light)' }}>
                          <Avatar worker={w} size={36} />
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 14 }}>{w ? `${w.nombres} ${w.apellidos}` : 'Empleado'}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{w ? w.rol : ''} · CC: {w ? w.identificacion : ''}</div>
                          </div>
                        </div>
                      );
                    })()}

                    <form onSubmit={handleEditNomina}>
                      <div className="form-group-container" style={{ marginBottom: 14, gap: 12 }}>
                        <div>
                          <label className="form-label">Periodo (Mes)</label>
                          <input type="text" className="input-glass" style={{ width: '100%' }} readOnly value={nominaForm.periodo} />
                        </div>
                        <div>
                          <label className="form-label">Estado de Pago *</label>
                          <select className="input-glass select-glass" style={{ width: '100%' }} required
                            value={nominaForm.estado} onChange={e => setNominaForm(p => ({ ...p, estado: e.target.value, fechaPago: e.target.value === 'Completado' ? (p.fechaPago || new Date().toISOString().split('T')[0]) : '' }))}>
                            <option value="Procesando">Procesando</option>
                            <option value="Completado">Completado</option>
                            <option value="Fallido">Fallido</option>
                            <option value="Vencida">Vencida</option>
                          </select>
                        </div>
                      </div>

                      <div className="form-group-container" style={{ marginBottom: 14, gap: 12 }}>
                        <div>
                          <label className="form-label">Salario Base (COP) *</label>
                          <input type="number" className="input-glass" style={{ width: '100%' }} required
                            value={nominaForm.salarioNeto} onChange={e => setNominaForm(p => ({ ...p, salarioNeto: Number(e.target.value) }))} />
                        </div>
                        <div>
                          <label className="form-label">Horas Extras *</label>
                          <input type="number" className="input-glass" style={{ width: '100%' }} required min="0"
                            value={nominaForm.horasExtras} onChange={e => setNominaForm(p => ({ ...p, horasExtras: Number(e.target.value) }))} />
                          <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>Valor H.E: $15.000 COP</span>
                        </div>
                      </div>

                      <div className="form-group-container" style={{ marginBottom: 14, gap: 12 }}>
                        <div>
                          <label className="form-label">Retenciones / Descuentos *</label>
                          <input type="number" className="input-glass" style={{ width: '100%' }} required min="0"
                            value={nominaForm.retenciones} onChange={e => setNominaForm(p => ({ ...p, retenciones: Number(e.target.value) }))} />
                        </div>
                        <div>
                          <label className="form-label">Método de Pago</label>
                          <select className="input-glass select-glass" style={{ width: '100%' }}
                            value={nominaForm.metodoPago} onChange={e => setNominaForm(p => ({ ...p, metodoPago: e.target.value }))}>
                            <option value="Transferencia Bancaria">Transferencia Bancaria</option>
                            <option value="Efectivo">Efectivo</option>
                            <option value="Cheque">Cheque</option>
                          </select>
                        </div>
                      </div>

                      {nominaForm.estado === 'Completado' && (
                        <div style={{ marginBottom: 14 }}>
                          <label className="form-label">Fecha de Pago *</label>
                          <input type="date" className="input-glass" style={{ width: '100%' }} required
                            value={nominaForm.fechaPago} onChange={e => setNominaForm(p => ({ ...p, fechaPago: e.target.value }))} />
                        </div>
                      )}

                      <div style={{ marginBottom: 18 }}>
                        <label className="form-label">Comentarios / Incidentes</label>
                        <textarea className="input-glass" style={{ width: '100%', minHeight: 60, resize: 'vertical' }}
                          placeholder="Notas sobre el pago, motivo de fallo o vencimiento..."
                          value={nominaForm.comentarios} onChange={e => setNominaForm(p => ({ ...p, comentarios: e.target.value }))} />
                      </div>

                      <div style={{ display: 'flex', gap: 12 }}>
                        <button type="button" className="btn btn-secondary" style={{ flexGrow: 1 }}
                          onClick={() => { setSelectedNomina(null); setShowEditNomina(false); setNominaForm({ ...EMPTY_NOMINA_FORM }); }}>
                          Cancelar
                        </button>
                        <button type="submit" className="btn btn-primary" style={{ flexGrow: 1 }}>
                          Guardar Cambios
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            )}
          </>
        );
      })()}


      {/* ══════════════════════════════════════════════════════════════════════
          MODAL – Agregar Trabajador (popup centered)
      ══════════════════════════════════════════════════════════════════════ */}
      {showAddWorker && (
        <div className="modal-overlay" onClick={() => setShowAddWorker(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Registrar Nuevo Trabajador</h3>
              <button className="btn btn-secondary" style={{ padding: 6 }}
                onClick={() => setShowAddWorker(false)}><X size={18} /></button>
            </div>

            <div className="modal-body">
              <form onSubmit={handleAddWorker}>
                {/* Photo */}
                <div className="photo-upload-zone" onClick={() => photoRef.current?.click()}>
                  {workerForm.foto
                    ? <img src={workerForm.foto} alt="preview" />
                    : (<>
                        <Camera size={24} style={{ color: 'var(--text-muted)', marginBottom: 4 }} />
                        <span className="upload-hint">Subir foto del trabajador</span>
                      </>)}
                  <input ref={photoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoUpload} />
                </div>

                {/* Names */}
                <div className="form-group-container">
                  <div>
                    <label className="form-label">Nombres *</label>
                    <input type="text" className="input-glass" style={{ width: '100%' }}
                      placeholder="Ej. Juan Carlos" required
                      value={workerForm.nombres} onChange={e => wfChange('nombres', e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label">Apellidos *</label>
                    <input type="text" className="input-glass" style={{ width: '100%' }}
                      placeholder="Ej. Pérez López" required
                      value={workerForm.apellidos} onChange={e => wfChange('apellidos', e.target.value)} />
                  </div>
                </div>

                {/* ID + Birth */}
                <div className="form-group-container">
                  <div>
                    <label className="form-label">Identificación (CC) *</label>
                    <input type="text" className="input-glass" style={{ width: '100%' }}
                      placeholder="Ej. 1001234567" required
                      value={workerForm.identificacion} onChange={e => wfChange('identificacion', e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label">Fecha de Nacimiento</label>
                    <input type="date" className="input-glass" style={{ width: '100%' }}
                      value={workerForm.fechaNacimiento}
                      onChange={e => setWorkerForm(p => ({ ...p, fechaNacimiento: e.target.value, edad: calcularEdad(e.target.value) }))} />
                  </div>
                </div>

                {/* Age + Hire */}
                <div className="form-group-container">
                  <div>
                    <label className="form-label">Edad</label>
                    <input type="number" className="input-glass" style={{ width: '100%' }}
                      placeholder="Se calcula automáticamente"
                      value={workerForm.edad} readOnly={!!workerForm.fechaNacimiento}
                      onChange={e => wfChange('edad', e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label">Fecha de Contratación</label>
                    <input type="date" className="input-glass" style={{ width: '100%' }}
                      value={workerForm.fechaContratacion}
                      onChange={e => wfChange('fechaContratacion', e.target.value)} />
                  </div>
                </div>

                {/* Contract + Role */}
                <div className="form-group-container">
                  <div>
                    <label className="form-label">Tipo de Contrato</label>
                    <select className="input-glass select-glass" style={{ width: '100%' }}
                      value={workerForm.tipoContrato} onChange={e => wfChange('tipoContrato', e.target.value)}>
                      {TIPOS_CONTRATO.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Rol / Cargo</label>
                    <select className="input-glass select-glass" style={{ width: '100%' }}
                      value={workerForm.rol} onChange={e => wfChange('rol', e.target.value)}>
                      {ROLES.map(r => <option key={r}>{r}</option>)}
                    </select>
                  </div>
                </div>

                {/* RH + EPS */}
                <div className="form-group-container">
                  <div>
                    <label className="form-label">RH Sanguíneo</label>
                    <select className="input-glass select-glass" style={{ width: '100%' }}
                      value={workerForm.rhSanguineo} onChange={e => wfChange('rhSanguineo', e.target.value)}>
                      {RH_OPTIONS.map(r => <option key={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Tipo de EPS</label>
                    <select className="input-glass select-glass" style={{ width: '100%' }}
                      value={workerForm.tipoEps} onChange={e => wfChange('tipoEps', e.target.value)}>
                      {TIPOS_EPS.map(e => <option key={e}>{e}</option>)}
                    </select>
                  </div>
                </div>

                {/* ARL + Phone */}
                <div className="form-group-container">
                  <div>
                    <label className="form-label">Tipo de ARL</label>
                    <select className="input-glass select-glass" style={{ width: '100%' }}
                      value={workerForm.tipoArl} onChange={e => wfChange('tipoArl', e.target.value)}>
                      {TIPOS_ARL.map(a => <option key={a}>{a}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Contacto Telefónico</label>
                    <input type="tel" className="input-glass" style={{ width: '100%' }}
                      placeholder="Ej. +57 312 345 6789"
                      value={workerForm.contactoTelefonico} onChange={e => wfChange('contactoTelefonico', e.target.value)} />
                  </div>
                </div>

                {/* Emergency contact */}
                <div className="form-group-container">
                  <div>
                    <label className="form-label">Contacto de Emergencia</label>
                    <input type="tel" className="input-glass" style={{ width: '100%' }}
                      placeholder="Ej. +57 300 987 6543"
                      value={workerForm.contactoEmergencia} onChange={e => wfChange('contactoEmergencia', e.target.value)} />
                  </div>
                </div>

                {/* Contract file */}
                <div>
                  <label className="form-label">Anexar Copia del Contrato</label>
                  <div className="file-upload-zone" onClick={() => contratoRef.current?.click()}>
                    <Upload size={20} style={{ color: 'var(--text-muted)' }} />
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                      Haz clic para seleccionar el archivo
                    </span>
                    {workerForm.copiaContratoName && (
                      <span className="file-name">{workerForm.copiaContratoName}</span>
                    )}
                    <input ref={contratoRef} type="file" accept=".pdf,.doc,.docx,.jpg,.png"
                      style={{ display: 'none' }} onChange={handleContratoUpload} />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                  <button type="button" className="btn btn-secondary" style={{ flexGrow: 1 }}
                    onClick={() => { setWorkerForm({ ...EMPTY_WORKER_FORM }); setShowAddWorker(false); }}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary" style={{ flexGrow: 1 }}>
                    Registrar Trabajador
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL – Nueva Cuadrilla
      ══════════════════════════════════════════════════════════════════════ */}
      {showNewCuadrilla && (
        <div className="modal-overlay" onClick={() => setShowNewCuadrilla(false)}>
          <div className="modal-box" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Nueva Cuadrilla</h3>
              <button className="btn btn-secondary" style={{ padding: 6 }}
                onClick={() => setShowNewCuadrilla(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <label className="form-label">Nombre de la cuadrilla</label>
              <input type="text" className="input-glass" style={{ width: '100%', marginBottom: 16 }}
                placeholder="Ej. Cuadrilla 6 – Empaque" autoFocus
                value={newCuadrillaName} onChange={e => setNewCuadrillaName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddCuadrilla(); }} />
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn btn-secondary" style={{ flexGrow: 1 }}
                  onClick={() => setShowNewCuadrilla(false)}>Cancelar</button>
                <button className="btn btn-primary" style={{ flexGrow: 1 }}
                  onClick={handleAddCuadrilla}>Crear Cuadrilla</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL – Registrar Labor
      ══════════════════════════════════════════════════════════════════════ */}
      {showAddLabor && (
        <div className="modal-overlay" onClick={() => setShowAddLabor(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Registrar Labor del Día</h3>
              <button className="btn btn-secondary" style={{ padding: 6 }}
                onClick={() => setShowAddLabor(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleAddLabor}>

                {/* Título + Tipo */}
                <div className="form-group-container">
                  <div>
                    <label className="form-label">Título de la Labor *</label>
                    <input type="text" className="input-glass" style={{ width: '100%' }}
                      placeholder="Ej. Cosecha sector norte" required
                      value={laborForm.titulo} onChange={e => lfChange('titulo', e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label">Tipo de Labor</label>
                    <select className="input-glass select-glass" style={{ width: '100%' }}
                      value={laborForm.tipo} onChange={e => lfChange('tipo', e.target.value)}>
                      {TIPOS_LABOR.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                </div>

                {/* Lote + Fecha */}
                <div className="form-group-container">
                  <div>
                    <label className="form-label">Lote / Sector</label>
                    <input type="text" className="input-glass" style={{ width: '100%' }}
                      placeholder="Ej. Lote A2"
                      value={laborForm.lote} onChange={e => lfChange('lote', e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label">Fecha</label>
                    <input type="date" className="input-glass" style={{ width: '100%' }}
                      value={laborForm.fecha} onChange={e => lfChange('fecha', e.target.value)} />
                  </div>
                </div>

                {/* Número de jornales */}
                <div style={{ marginBottom: 16 }}>
                  <label className="form-label">Número de jornales</label>
                  <select className="input-glass select-glass" style={{ width: '100%' }}
                    value={laborForm.jornal || 1.0} onChange={e => lfChange('jornal', parseFloat(e.target.value))}>
                    <option value={0.25}>0.25 (2 horas)</option>
                    <option value={0.50}>0.50 (4 horas)</option>
                    <option value={0.75}>0.75 (6 horas)</option>
                    <option value={1.00}>1.00 (8 horas)</option>
                  </select>
                </div>

                {/* Description */}
                <div style={{ marginBottom: 16 }}>
                  <label className="form-label">Descripción (opcional)</label>
                  <textarea className="input-glass" style={{ width: '100%', minHeight: 68, resize: 'vertical' }}
                    placeholder="Detalle adicional de la labor..."
                    value={laborForm.descripcion} onChange={e => lfChange('descripcion', e.target.value)} />
                </div>

                {/* Estado inicial */}
                <div style={{ marginBottom: 16 }}>
                  <label className="form-label">Estado inicial</label>
                  <div className="toggle-group">
                    {LABOR_ESTADOS.map(e => (
                      <button type="button" key={e}
                        className={`toggle-btn ${laborForm.estado === e ? 'active' : ''}`}
                        onClick={() => lfChange('estado', e)}>{e}</button>
                    ))}
                  </div>
                </div>

                {/* Asignación */}
                <div style={{ marginBottom: 16 }}>
                  <label className="form-label">Asignar a</label>
                  <div className="toggle-group" style={{ marginBottom: 12 }}>
                    <button type="button"
                      className={`toggle-btn ${laborForm.asignacion === 'cuadrilla' ? 'active' : ''}`}
                      onClick={() => lfChange('asignacion', 'cuadrilla')}>
                      <UsersRound size={14} style={{ marginRight: 4 }} /> Cuadrilla
                    </button>
                    <button type="button"
                      className={`toggle-btn ${laborForm.asignacion === 'individual' ? 'active' : ''}`}
                      onClick={() => lfChange('asignacion', 'individual')}>
                      <UserCheck size={14} style={{ marginRight: 4 }} /> Trabajadores individuales
                    </button>
                  </div>

                  {laborForm.asignacion === 'cuadrilla' ? (
                    <select className="input-glass select-glass" style={{ width: '100%' }}
                      value={laborForm.cuadrillaId} onChange={e => lfChange('cuadrillaId', e.target.value)}>
                      <option value="">— Selecciona una cuadrilla —</option>
                      {cuadrillas.map(c => <option key={c.id} value={c.id}>{c.nombre} ({c.miembros.length} miembros)</option>)}
                    </select>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 10, padding: 10 }}>
                      {workers.length === 0 ? (
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No hay trabajadores registrados</span>
                      ) : workers.map(w => {
                        const selected = (laborForm.trabajadoresIds || []).includes(w.id);
                        return (
                          <label key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '4px 6px', borderRadius: 8, background: selected ? 'var(--primary-light)' : 'transparent', fontSize: 13 }}>
                            <input type="checkbox" checked={selected} onChange={() => handleToggleWorkerInLabor(w.id)} style={{ accentColor: 'var(--primary)' }} />
                            <Avatar worker={w} size={24} />
                            <span>{w.nombres} {w.apellidos}</span>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>{w.rol}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                  <button type="button" className="btn btn-secondary" style={{ flexGrow: 1 }}
                    onClick={() => { setLaborForm({ ...EMPTY_LABOR_FORM }); setShowAddLabor(false); }}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary" style={{ flexGrow: 1 }}>
                    Registrar Labor
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL – Ficha del Trabajador (read-only)
      ══════════════════════════════════════════════════════════════════════ */}
      {viewWorker && (
        <div className="modal-overlay" onClick={() => setViewWorker(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Ficha del Trabajador</h3>
              <button className="btn btn-secondary" style={{ padding: 6 }}
                onClick={() => setViewWorker(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                {/* Photo */}
                <div style={{ textAlign: 'center', flexShrink: 0 }}>
                  {viewWorker.foto
                    ? <img src={viewWorker.foto} alt="" style={{ width: 100, height: 100, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--border-color)' }} />
                    : <div style={{ width: 100, height: 100, borderRadius: '50%', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 800, color: 'var(--primary)', border: '3px solid var(--border-color)' }}>
                        {getInitials(viewWorker)}
                      </div>
                  }
                  <div style={{ marginTop: 8 }}>
                    <span className={`badge ${getStatusBadge(viewWorker.estado)}`}>{viewWorker.estado}</span>
                  </div>
                </div>

                {/* Details */}
                <div style={{ flexGrow: 1 }}>
                  <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>{viewWorker.nombres} {viewWorker.apellidos}</h3>
                  <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 16 }}>{viewWorker.rol}</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
                    {[
                      ['Identificación', viewWorker.identificacion],
                      ['Edad', viewWorker.edad ? `${viewWorker.edad} años` : 'N/A'],
                      ['Fecha de Nacimiento', viewWorker.fechaNacimiento || 'N/A'],
                      ['Fecha de Contratación', viewWorker.fechaContratacion || 'N/A'],
                      ['Tipo de Contrato', viewWorker.tipoContrato],
                      ['RH Sanguíneo', viewWorker.rhSanguineo],
                      ['EPS', viewWorker.tipoEps],
                      ['ARL', viewWorker.tipoArl],
                      ['Teléfono', viewWorker.contactoTelefonico || 'N/A'],
                      ['Contacto Emergencia', viewWorker.contactoEmergencia || 'N/A'],
                    ].map(([label, value], i) => (
                      <div key={i}>
                        <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>{label}</span>
                        <strong style={{ color: 'var(--text-primary)' }}>{value}</strong>
                      </div>
                    ))}
                  </div>

                  {/* Cuadrillas */}
                  {(() => {
                    const myC = cuadrillas.filter(c => c.miembros.includes(viewWorker.id));
                    return myC.length > 0 ? (
                      <div style={{ marginTop: 16 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Cuadrillas asignadas</span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {myC.map(c => <span key={c.id} className="worker-chip">{c.nombre}</span>)}
                        </div>
                      </div>
                    ) : null;
                  })()}

                  {viewWorker.copiaContratoName && (
                    <div style={{ marginTop: 16, padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                      <FileText size={16} style={{ color: 'var(--primary)' }} />
                      <span style={{ color: 'var(--text-secondary)' }}>Contrato:</span>
                      <strong style={{ color: 'var(--primary)' }}>{viewWorker.copiaContratoName}</strong>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
