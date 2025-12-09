import React, { useState, useEffect } from 'react';
import { 
  Trophy, 
  Calendar, 
  Users, 
  Smartphone, 
  User, 
  CheckCircle, 
  Lock, 
  LogOut,
  ClipboardList,
  Award,
  Eye,
  KeyRound,
  PlusCircle
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  onSnapshot, 
  serverTimestamp
} from 'firebase/firestore';

// --- TU CONFIGURACIÓN DE FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyDUntNdwNU38UhUXrU57fjFP3zvKcFjp7w",
  authDomain: "campeonatos-retruquete.firebaseapp.com",
  projectId: "campeonatos-retruquete",
  storageBucket: "campeonatos-retruquete.firebasestorage.app",
  messagingSenderId: "212107012314",
  appId: "1:212107012314:web:ed9f1dc1eec18e3455dde3"
};

// Inicialización
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- HASH DE SEGURIDAD (PIN OCULTO) ---
// El número 17052982 convertido a Base64 es "MTcwNTI5ODI="
// De esta forma, si alguien mira el código, no ve el número directamente.
const SECURITY_HASH = "MTcwNTI5ODI=";

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('home'); 
  const [isAdmin, setIsAdmin] = useState(false);
  const [pinInput, setPinInput] = useState('');
  
  // Estado de Datos
  const [championships, setChampionships] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [selectedChamp, setSelectedChamp] = useState(null);

  // Formularios
  const [newChampData, setNewChampData] = useState({ name: '', type: 'parejas', date: '', prizes: '' });
  const [regFormData, setRegFormData] = useState({ phone: '', player1: '', player2: '', player3: '' });
  const [feedback, setFeedback] = useState({ type: '', msg: '' });

  // --- Autenticación Silenciosa ---
  useEffect(() => {
    signInAnonymously(auth).catch((error) => {
      console.error("Error conexión anónima:", error);
    });
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // --- Lectura de Datos ---
  useEffect(() => {
    const champsRef = collection(db, 'campeonatos');
    const unsubChamps = onSnapshot(champsRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => new Date(b.date) - new Date(a.date));
      setChampionships(data);
    }, (error) => console.log("Cargando datos..."));

    const regsRef = collection(db, 'inscripciones');
    const unsubRegs = onSnapshot(regsRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRegistrations(data);
    }, (error) => console.log("Cargando inscripciones..."));

    return () => {
      unsubChamps();
      unsubRegs();
    };
  }, []);

  // --- Ayudantes ---
  const showFeedback = (type, msg) => {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback({ type: '', msg: '' }), 4000);
  };

  const validatePhone = (phone) => /^09\d{7}$/.test(phone);

  const obfuscatePhone = (phone) => {
    if (!phone || phone.length < 4) return phone;
    return `${phone.charAt(0)}${'*'.repeat(phone.length - 4)}${phone.slice(-3)}`;
  };

  // --- Lógica de Admin (PIN) ---
  const handlePinLogin = (e) => {
    e.preventDefault();
    try {
      // Comparamos el PIN ingresado (convertido a Base64) con el Hash guardado
      if (btoa(pinInput) === SECURITY_HASH) {
        setIsAdmin(true);
        setView('admin');
        setPinInput('');
        showFeedback('success', '¡Bienvenido Administrador!');
      } else {
        showFeedback('error', 'Clave de seguridad incorrecta');
        setPinInput('');
      }
    } catch (err) {
      showFeedback('error', 'Error al verificar clave');
    }
  };

  const handleLogout = () => {
    setIsAdmin(false);
    setView('home');
  };

  // --- Acciones de Datos ---
  const createChampionship = async (e) => {
    e.preventDefault();
    if (!newChampData.name || !newChampData.date) {
      showFeedback('error', 'Faltan datos obligatorios');
      return;
    }
    try {
      await addDoc(collection(db, 'campeonatos'), {
        ...newChampData,
        createdAt: serverTimestamp()
      });
      showFeedback('success', 'Campeonato creado con éxito');
      setNewChampData({ name: '', type: 'parejas', date: '', prizes: '' });
    } catch (err) {
      console.error(err);
      showFeedback('error', 'Error al guardar. Verifica tu conexión.');
    }
  };

  const registerTeam = async (e) => {
    e.preventDefault();
    
    if (!validatePhone(regFormData.phone)) {
      showFeedback('error', 'El celular debe ser 09XXXXXXX');
      return;
    }
    if (!regFormData.player1 || !regFormData.player2) {
      showFeedback('error', 'Faltan nombres de jugadores');
      return;
    }
    if (selectedChamp.type === 'trios' && !regFormData.player3) {
      showFeedback('error', 'Falta el 3er jugador');
      return;
    }

    const champRegistrations = registrations.filter(r => r.championshipId === selectedChamp.id);
    
    if (champRegistrations.find(r => r.phone === regFormData.phone)) {
      showFeedback('error', 'Celular ya registrado en este torneo');
      return;
    }

    const normalize = (str) => str ? str.toLowerCase().trim() : '';
    const registeredPlayers = new Set();
    champRegistrations.forEach(r => {
      if (r.player1) registeredPlayers.add(normalize(r.player1));
      if (r.player2) registeredPlayers.add(normalize(r.player2));
      if (r.player3) registeredPlayers.add(normalize(r.player3));
    });

    const newPlayers = [
      { name: regFormData.player1 }, 
      { name: regFormData.player2 }
    ];
    if (selectedChamp.type === 'trios') newPlayers.push({ name: regFormData.player3 });

    for (const p of newPlayers) {
      if (registeredPlayers.has(normalize(p.name))) {
        showFeedback('error', `El jugador "${p.name}" ya está inscripto`);
        return;
      }
    }

    try {
      await addDoc(collection(db, 'inscripciones'), {
        championshipId: selectedChamp.id,
        phone: regFormData.phone,
        player1: regFormData.player1,
        player2: regFormData.player2,
        player3: selectedChamp.type === 'trios' ? regFormData.player3 : null,
        registeredAt: serverTimestamp()
      });
      showFeedback('success', '¡Inscripción exitosa!');
      setRegFormData({ phone: '', player1: '', player2: '', player3: '' });
    } catch (err) {
      console.error(err);
      showFeedback('error', 'Error al inscribirse');
    }
  };

  // --- VISTAS ---

  const renderHeader = () => (
    <header className="bg-emerald-900 text-yellow-100 p-4 shadow-lg border-b-4 border-yellow-600 sticky top-0 z-50">
      <div className="max-w-4xl mx-auto flex justify-between items-center">
        <div 
          className="flex items-center gap-2 cursor-pointer" 
          onClick={() => { setView('home'); setSelectedChamp(null); }}
        >
          <div className="bg-yellow-600 p-2 rounded-full text-emerald-900">
            <Trophy size={24} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-wider uppercase">Retruquete</h1>
            <p className="text-xs text-yellow-200/80">Club de Truco Uruguayo</p>
          </div>
        </div>
        <div>
          {isAdmin ? (
            <div className="flex items-center gap-2">
               <span className="text-xs text-emerald-200 hidden sm:inline font-bold">MODO ADMIN</span>
               <button 
                onClick={handleLogout}
                className="text-xs flex items-center gap-1 bg-red-800/80 hover:bg-red-700 px-3 py-1 rounded border border-red-600 transition"
              >
                <LogOut size={14} /> Salir
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setView('login')}
              className="text-xs flex items-center gap-1 text-emerald-300 hover:text-white transition"
            >
              <Lock size={14} /> Admin
            </button>
          )}
        </div>
      </div>
    </header>
  );

  const renderFeedback = () => {
    if (!feedback.msg) return null;
    const isError = feedback.type === 'error';
    return (
      <div className={`fixed top-20 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 ${isError ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}`}>
        {isError ? <Lock size={18} /> : <CheckCircle size={18} />}
        <span className="font-medium">{feedback.msg}</span>
      </div>
    );
  };

  const renderLogin = () => (
    <div className="max-w-xs mx-auto mt-20 p-8 bg-white rounded-xl shadow-lg border border-gray-200 text-center">
      <div className="bg-emerald-100 p-3 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 text-emerald-800">
        <KeyRound size={32} />
      </div>
      <h3 className="font-bold text-gray-800 mb-2">Acceso Administrativo</h3>
      <p className="text-sm text-gray-500 mb-6">Ingresa el código de seguridad de 8 dígitos.</p>
      
      <form onSubmit={handlePinLogin} className="space-y-4">
        <input 
          type="password" 
          placeholder="********"
          className="w-full text-center text-2xl tracking-widest p-2 border border-gray-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none"
          value={pinInput}
          onChange={e => setPinInput(e.target.value)}
          maxLength={8}
          autoFocus
        />
        <button 
          type="submit"
          className="w-full bg-emerald-800 text-white font-semibold py-2 px-4 rounded shadow-sm hover:bg-emerald-900 transition"
        >
          Ingresar
        </button>
      </form>

      <button onClick={() => setView('home')} className="mt-6 text-gray-400 text-xs hover:text-gray-600 hover:underline">
        Cancelar y volver
      </button>
    </div>
  );

  const renderHome = () => (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <div className="text-center py-8">
        <h2 className="text-3xl font-bold text-emerald-900 mb-2">Próximos Campeonatos</h2>
        <p className="text-gray-600">Selecciona un torneo para inscribir a tu equipo.</p>
      </div>

      {championships.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center shadow-sm border border-gray-100">
          <Calendar size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 text-lg">No hay campeonatos activos.</p>
          {isAdmin && <p className="text-emerald-600 text-sm mt-2 font-bold">¡Hola Admin! Crea uno desde el panel.</p>}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {championships.map(champ => {
             const registeredCount = registrations.filter(r => r.championshipId === champ.id).length;
             return (
              <div key={champ.id} className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100 hover:shadow-lg transition-shadow">
                <div className="bg-emerald-50 p-4 border-b border-emerald-100 flex justify-between items-start">
                  <div>
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide mb-2 ${champ.type === 'parejas' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>
                      {champ.type}
                    </span>
                    <h3 className="text-xl font-bold text-gray-800">{champ.name}</h3>
                  </div>
                  <Trophy className="text-yellow-600" size={24} />
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex items-center gap-3 text-gray-600">
                    <Calendar size={18} className="text-emerald-600" />
                    <span>{new Date(champ.date).toLocaleDateString('es-UY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-600">
                    <Award size={18} className="text-emerald-600" />
                    <span>{champ.prizes || 'Premios a confirmar'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-600">
                    <Users size={18} className="text-emerald-600" />
                    <span>{registeredCount} equipos inscritos</span>
                  </div>
                  <button 
                    onClick={() => { setSelectedChamp(champ); setView('register'); }}
                    className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    Ver Detalles e Inscribirse <PlusCircle size={18} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderRegister = () => {
    const currentRegistrations = registrations.filter(r => r.championshipId === selectedChamp.id);
    return (
      <div className="max-w-2xl mx-auto p-4">
        <button onClick={() => setView('home')} className="text-emerald-600 mb-4 hover:underline text-sm flex items-center gap-1">
          ← Volver a campeonatos
        </button>
        <div className="bg-white rounded-xl shadow-xl overflow-hidden mb-8">
          <div className="bg-emerald-800 p-6 text-white text-center">
            <h2 className="text-xl font-bold">Inscripción</h2>
            <p className="text-emerald-200 text-sm mt-1">{selectedChamp.name} - Modalidad {selectedChamp.type}</p>
          </div>
          <form onSubmit={registerTeam} className="p-6 space-y-5">
            <div className="space-y-1">
              <label className="block text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Smartphone size={16} /> Tu Celular (Responsable)
              </label>
              <input 
                type="tel" 
                placeholder="099123456"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-lg tracking-wider"
                value={regFormData.phone}
                onChange={e => {
                  const val = e.target.value.replace(/\D/g, '');
                  if (val.length <= 9) setRegFormData({...regFormData, phone: val});
                }}
                required
              />
              <p className="text-xs text-gray-500">Sin espacios ni guiones. Debe comenzar con 09.</p>
            </div>
            <div className="border-t border-gray-100 my-4"></div>
            <div className="space-y-1">
              <label className="block text-sm font-semibold text-gray-700">Jugador 1 (Vos)</label>
              <input 
                type="text" 
                placeholder="Nombre y Apellido"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                value={regFormData.player1}
                onChange={e => setRegFormData({...regFormData, player1: e.target.value})}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-semibold text-gray-700">Jugador 2 (Pareja)</label>
              <input 
                type="text" 
                placeholder="Nombre y Apellido"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                value={regFormData.player2}
                onChange={e => setRegFormData({...regFormData, player2: e.target.value})}
                required
              />
            </div>
            {selectedChamp.type === 'trios' && (
              <div className="space-y-1 animate-in fade-in slide-in-from-top-2">
                <label className="block text-sm font-semibold text-gray-700">Jugador 3</label>
                <input 
                  type="text" 
                  placeholder="Nombre y Apellido"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  value={regFormData.player3}
                  onChange={e => setRegFormData({...regFormData, player3: e.target.value})}
                  required
                />
              </div>
            )}
            <button type="submit" className="w-full bg-gradient-to-r from-emerald-600 to-emerald-800 text-white font-bold py-3 px-4 rounded-lg shadow-md hover:shadow-lg transform active:scale-95 transition-all mt-6">
              Confirmar Inscripción
            </button>
          </form>
        </div>
        <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100">
           <div className="bg-gray-50 p-4 border-b border-gray-200 flex items-center justify-between">
             <h3 className="font-bold text-gray-700 flex items-center gap-2">
               <Eye size={18} className="text-emerald-600"/> 
               Equipos Inscriptos
             </h3>
             <span className="text-xs bg-emerald-100 text-emerald-800 py-1 px-2 rounded-full font-bold">
               Total: {currentRegistrations.length}
             </span>
           </div>
           {currentRegistrations.length === 0 ? (
             <div className="p-8 text-center text-gray-400 text-sm">
               <p>Aún no hay equipos inscriptos.</p>
             </div>
           ) : (
             <div className="overflow-x-auto">
               <table className="w-full text-sm text-left">
                 <thead className="text-xs text-gray-500 uppercase bg-gray-50/50">
                   <tr>
                     <th className="px-4 py-2">Celular (ID)</th>
                     <th className="px-4 py-2">Integrantes</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-100">
                   {currentRegistrations.map((reg) => (
                     <tr key={reg.id} className="hover:bg-gray-50 transition-colors">
                       <td className="px-4 py-3 font-mono text-gray-500">
                         {obfuscatePhone(reg.phone)}
                       </td>
                       <td className="px-4 py-3">
                         <div className="flex flex-col gap-0.5">
                            <span className="font-medium text-gray-800 flex items-center gap-1">
                               <User size={12} className="text-emerald-500"/> {reg.player1}
                            </span>
                            <span className="font-medium text-gray-800 flex items-center gap-1">
                               <User size={12} className="text-emerald-500"/> {reg.player2}
                            </span>
                            {reg.player3 && (
                              <span className="font-medium text-gray-800 flex items-center gap-1">
                                <User size={12} className="text-emerald-500"/> {reg.player3}
                              </span>
                            )}
                         </div>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
           )}
        </div>
      </div>
    );
  };

  const renderAdminPanel = () => (
    <div className="max-w-5xl mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Panel de Organización</h2>
        <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full">Modo Admin</span>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-xl shadow-md border-t-4 border-emerald-600">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <PlusCircle size={20} className="text-emerald-600"/> Nuevo Campeonato
            </h3>
            <form onSubmit={createChampionship} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase">Nombre</label>
                <input type="text" value={newChampData.name} onChange={e => setNewChampData({...newChampData, name: e.target.value})} className="w-full p-2 border rounded mt-1 focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="Ej: Torneo Verano 2024" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase">Modalidad</label>
                <div className="flex gap-4 mt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="type" checked={newChampData.type === 'parejas'} onChange={() => setNewChampData({...newChampData, type: 'parejas'})} className="text-emerald-600 focus:ring-emerald-500" /> Parejas
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="type" checked={newChampData.type === 'trios'} onChange={() => setNewChampData({...newChampData, type: 'trios'})} className="text-emerald-600 focus:ring-emerald-500" /> Tríos
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase">Fecha</label>
                <input type="date" value={newChampData.date} onChange={e => setNewChampData({...newChampData, date: e.target.value})} className="w-full p-2 border rounded mt-1 focus:ring-2 focus:ring-emerald-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase">Premios</label>
                <textarea value={newChampData.prizes} onChange={e => setNewChampData({...newChampData, prizes: e.target.value})} className="w-full p-2 border rounded mt-1 focus:ring-2 focus:ring-emerald-500 outline-none h-20" placeholder="Ej: Trofeos + Asado" />
              </div>
              <button type="submit" className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-2 rounded shadow transition">Crear Campeonato</button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <h3 className="font-bold text-lg text-gray-700 flex items-center gap-2">
            <ClipboardList size={20}/> Registros (Base de Datos Real)
          </h3>
          {championships.map(champ => {
            const champRegs = registrations.filter(r => r.championshipId === champ.id);
            return (
              <div key={champ.id} className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 p-4 border-b border-gray-200 flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-gray-800">{champ.name}</h4>
                    <p className="text-xs text-gray-500 uppercase">{champ.type} • {champ.date}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-bold text-emerald-600">{champRegs.length}</span>
                    <p className="text-xs text-gray-500">Inscriptos</p>
                  </div>
                </div>
                {champRegs.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b">
                        <tr>
                          <th className="px-4 py-3">Celular (ID)</th>
                          <th className="px-4 py-3">Jugador 1</th>
                          <th className="px-4 py-3">Jugador 2</th>
                          {champ.type === 'trios' && <th className="px-4 py-3">Jugador 3</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {champRegs.map((reg) => (
                          <tr key={reg.id} className="border-b hover:bg-gray-50">
                            <td className="px-4 py-3 font-mono text-emerald-700 font-medium">{reg.phone}</td>
                            <td className="px-4 py-3">{reg.player1}</td>
                            <td className="px-4 py-3">{reg.player2}</td>
                            {champ.type === 'trios' && <td className="px-4 py-3">{reg.player3}</td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-4 text-center text-gray-400 text-sm italic">
                    Aún no hay parejas/tríos inscriptos.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-stone-100 font-sans text-gray-800 pb-10">
      {renderFeedback()}
      {renderHeader()}
      
      <main className="mt-6">
        {view === 'home' && renderHome()}
        {view === 'register' && renderRegister()}
        {view === 'login' && renderLogin()}
        {view === 'admin' && renderAdminPanel()}
      </main>
    </div>
  );
}
