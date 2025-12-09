import React, { useState, useEffect } from "react";
import {
  Trophy,
  Calendar,
  Users,
  PlusCircle,
  Smartphone,
  User,
  CheckCircle,
  Lock,
  LogOut,
  ClipboardList,
  Award,
  Eye,
  ShieldCheck,
} from "lucide-react";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";

// --- CONFIGURACIÓN DE ADMINS ---
// ¡IMPORTANTE! Agrega aquí los correos de Gmail que tendrán permiso de Administrador
const ADMIN_EMAILS = ["tu-email@gmail.com", "otro-admin@gmail.com"];

// --- TU CONFIGURACIÓN DE FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyDUntNdwNU38UhUXrU57fjFP3zvKcFjp7w",
  authDomain: "campeonatos-retruquete.firebaseapp.com",
  projectId: "campeonatos-retruquete",
  storageBucket: "campeonatos-retruquete.firebasestorage.app",
  messagingSenderId: "212107012314",
  appId: "1:212107012314:web:ed9f1dc1eec18e3455dde3",
};

// Inicialización
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// --- Componente Principal ---
export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState("home");
  const [isAdmin, setIsAdmin] = useState(false);

  // Estado de Datos
  const [championships, setChampionships] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [selectedChamp, setSelectedChamp] = useState(null);

  // Formularios
  const [newChampData, setNewChampData] = useState({
    name: "",
    type: "parejas",
    date: "",
    prizes: "",
  });
  const [regFormData, setRegFormData] = useState({
    phone: "",
    player1: "",
    player2: "",
    player3: "",
  });
  const [feedback, setFeedback] = useState({ type: "", msg: "" });

  // --- Autenticación y Seguridad ---
  useEffect(() => {
    // Escuchar cambios en la sesión
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);

      // Si el usuario tiene email y está en la lista de permitidos, es Admin
      if (
        currentUser &&
        currentUser.email &&
        ADMIN_EMAILS.includes(currentUser.email)
      ) {
        setIsAdmin(true);
        // Si estaba en login, lo mandamos al panel
        if (view === "login") setView("admin");
      } else {
        setIsAdmin(false);
      }
    });

    // Si no hay usuario, iniciar como anónimo (para que puedan ver datos públicos)
    // Solo si no estamos ya intentando loguearnos
    if (!auth.currentUser) {
      signInAnonymously(auth).catch((error) => {
        console.error("Auth anónima:", error);
      });
    }

    return () => unsubscribe();
  }, [view]);

  // --- Lectura de Datos ---
  useEffect(() => {
    // Siempre leemos datos, las reglas de Firestore deciden si vemos o no
    const champsRef = collection(db, "campeonatos");
    const unsubChamps = onSnapshot(
      champsRef,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        data.sort((a, b) => new Date(b.date) - new Date(a.date));
        setChampionships(data);
      },
      (error) => console.log("Esperando datos...")
    );

    const regsRef = collection(db, "inscripciones");
    const unsubRegs = onSnapshot(
      regsRef,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setRegistrations(data);
      },
      (error) => console.log("Esperando datos...")
    );

    return () => {
      unsubChamps();
      unsubRegs();
    };
  }, []);

  // --- Ayudantes ---
  const showFeedback = (type, msg) => {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback({ type: "", msg: "" }), 4000);
  };

  const validatePhone = (phone) => /^09\d{7}$/.test(phone);

  const obfuscatePhone = (phone) => {
    if (!phone || phone.length < 4) return phone;
    return `${phone.charAt(0)}${"*".repeat(phone.length - 4)}${phone.slice(
      -3
    )}`;
  };

  // --- Acciones de Login ---
  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      // El useEffect se encargará de verificar si es admin
    } catch (error) {
      console.error(error);
      showFeedback("error", "Error al iniciar sesión con Google");
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setIsAdmin(false);
    setView("home");
    // Volvemos a entrar como anónimo para que pueda seguir viendo la web
    signInAnonymously(auth);
  };

  // --- Acciones de Datos ---
  const createChampionship = async (e) => {
    e.preventDefault();
    if (!newChampData.name || !newChampData.date) {
      showFeedback("error", "Faltan datos obligatorios");
      return;
    }
    try {
      await addDoc(collection(db, "campeonatos"), {
        ...newChampData,
        createdAt: serverTimestamp(),
      });
      showFeedback("success", "Campeonato creado con éxito");
      setNewChampData({ name: "", type: "parejas", date: "", prizes: "" });
    } catch (err) {
      console.error(err);
      showFeedback("error", "Error al crear (¿Tienes permisos?)");
    }
  };

  const registerTeam = async (e) => {
    e.preventDefault();

    if (!validatePhone(regFormData.phone)) {
      showFeedback("error", "El celular debe ser 09XXXXXXX");
      return;
    }
    if (!regFormData.player1 || !regFormData.player2) {
      showFeedback("error", "Faltan nombres de jugadores");
      return;
    }
    if (selectedChamp.type === "trios" && !regFormData.player3) {
      showFeedback("error", "Falta el 3er jugador");
      return;
    }

    // Validaciones de duplicados
    const champRegistrations = registrations.filter(
      (r) => r.championshipId === selectedChamp.id
    );

    if (champRegistrations.find((r) => r.phone === regFormData.phone)) {
      showFeedback("error", "Celular ya registrado en este torneo");
      return;
    }

    const normalize = (str) => (str ? str.toLowerCase().trim() : "");
    const registeredPlayers = new Set();
    champRegistrations.forEach((r) => {
      if (r.player1) registeredPlayers.add(normalize(r.player1));
      if (r.player2) registeredPlayers.add(normalize(r.player2));
      if (r.player3) registeredPlayers.add(normalize(r.player3));
    });

    const newPlayers = [
      { name: regFormData.player1 },
      { name: regFormData.player2 },
    ];
    if (selectedChamp.type === "trios")
      newPlayers.push({ name: regFormData.player3 });

    for (const p of newPlayers) {
      if (registeredPlayers.has(normalize(p.name))) {
        showFeedback("error", `El jugador "${p.name}" ya está inscripto`);
        return;
      }
    }

    try {
      await addDoc(collection(db, "inscripciones"), {
        championshipId: selectedChamp.id,
        phone: regFormData.phone,
        player1: regFormData.player1,
        player2: regFormData.player2,
        player3: selectedChamp.type === "trios" ? regFormData.player3 : null,
        registeredAt: serverTimestamp(),
      });
      showFeedback("success", "¡Inscripción exitosa!");
      setRegFormData({ phone: "", player1: "", player2: "", player3: "" });
    } catch (err) {
      console.error(err);
      showFeedback("error", "Error al inscribirse");
    }
  };

  // --- Renders ---

  const renderHeader = () => (
    <header className="bg-emerald-900 text-yellow-100 p-4 shadow-lg border-b-4 border-yellow-600 sticky top-0 z-50">
      <div className="max-w-4xl mx-auto flex justify-between items-center">
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => {
            setView("home");
            setSelectedChamp(null);
          }}
        >
          <div className="bg-yellow-600 p-2 rounded-full text-emerald-900">
            <Trophy size={24} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-wider uppercase">
              Retruquete
            </h1>
            <p className="text-xs text-yellow-200/80">Club de Truco Uruguayo</p>
          </div>
        </div>
        <div>
          {isAdmin ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-emerald-200 hidden sm:inline">
                Hola Admin
              </span>
              <button
                onClick={handleLogout}
                className="text-xs flex items-center gap-1 bg-red-800/80 hover:bg-red-700 px-3 py-1 rounded border border-red-600 transition"
              >
                <LogOut size={14} /> Salir
              </button>
            </div>
          ) : (
            <button
              onClick={() => setView("login")}
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
    const isError = feedback.type === "error";
    return (
      <div
        className={`fixed top-20 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 ${
          isError ? "bg-red-600 text-white" : "bg-green-600 text-white"
        }`}
      >
        {isError ? <Lock size={18} /> : <CheckCircle size={18} />}
        <span className="font-medium">{feedback.msg}</span>
      </div>
    );
  };

  const renderLogin = () => (
    <div className="max-w-xs mx-auto mt-20 p-8 bg-white rounded-xl shadow-lg border border-gray-200 text-center">
      <div className="bg-emerald-100 p-3 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 text-emerald-800">
        <ShieldCheck size={32} />
      </div>
      <h3 className="font-bold text-gray-800 mb-2">Acceso Administrativo</h3>
      <p className="text-sm text-gray-500 mb-6">
        Solo para organizadores autorizados.
      </p>

      <button
        onClick={handleGoogleLogin}
        className="w-full bg-white border border-gray-300 text-gray-700 font-semibold py-2 px-4 rounded shadow-sm hover:bg-gray-50 transition flex items-center justify-center gap-2"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
        Ingresar con Google
      </button>

      <button
        onClick={() => setView("home")}
        className="mt-4 text-emerald-600 text-sm hover:underline"
      >
        Volver al inicio
      </button>

      {user && !isAdmin && (
        <div className="mt-4 p-2 bg-red-50 text-red-700 text-xs rounded border border-red-100">
          Tu correo <strong>{user.email}</strong> no está autorizado.
        </div>
      )}
    </div>
  );

  // --- El resto de componentes se mantienen igual ---

  const renderHome = () => (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <div className="text-center py-8">
        <h2 className="text-3xl font-bold text-emerald-900 mb-2">
          Próximos Campeonatos
        </h2>
        <p className="text-gray-600">
          Selecciona un torneo para inscribir a tu equipo.
        </p>
      </div>

      {championships.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center shadow-sm border border-gray-100">
          <Calendar size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 text-lg">No hay campeonatos activos.</p>
          {isAdmin && (
            <p className="text-emerald-600 text-sm mt-2 font-bold">
              ¡Hola Admin! Crea uno desde el panel.
            </p>
          )}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {championships.map((champ) => {
            const registeredCount = registrations.filter(
              (r) => r.championshipId === champ.id
            ).length;
            return (
              <div
                key={champ.id}
                className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100 hover:shadow-lg transition-shadow"
              >
                <div className="bg-emerald-50 p-4 border-b border-emerald-100 flex justify-between items-start">
                  <div>
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide mb-2 ${
                        champ.type === "parejas"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-purple-100 text-purple-800"
                      }`}
                    >
                      {champ.type}
                    </span>
                    <h3 className="text-xl font-bold text-gray-800">
                      {champ.name}
                    </h3>
                  </div>
                  <Trophy className="text-yellow-600" size={24} />
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex items-center gap-3 text-gray-600">
                    <Calendar size={18} className="text-emerald-600" />
                    <span>
                      {new Date(champ.date).toLocaleDateString("es-UY", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        timeZone: "UTC",
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-600">
                    <Award size={18} className="text-emerald-600" />
                    <span>{champ.prizes || "Premios a confirmar"}</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-600">
                    <Users size={18} className="text-emerald-600" />
                    <span>{registeredCount} equipos inscritos</span>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedChamp(champ);
                      setView("register");
                    }}
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
    const currentRegistrations = registrations.filter(
      (r) => r.championshipId === selectedChamp.id
    );
    return (
      <div className="max-w-2xl mx-auto p-4">
        <button
          onClick={() => setView("home")}
          className="text-emerald-600 mb-4 hover:underline text-sm flex items-center gap-1"
        >
          ← Volver a campeonatos
        </button>
        <div className="bg-white rounded-xl shadow-xl overflow-hidden mb-8">
          <div className="bg-emerald-800 p-6 text-white text-center">
            <h2 className="text-xl font-bold">Inscripción</h2>
            <p className="text-emerald-200 text-sm mt-1">
              {selectedChamp.name} - Modalidad {selectedChamp.type}
            </p>
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
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "");
                  if (val.length <= 9)
                    setRegFormData({ ...regFormData, phone: val });
                }}
                required
              />
              <p className="text-xs text-gray-500">
                Sin espacios ni guiones. Debe comenzar con 09.
              </p>
            </div>
            <div className="border-t border-gray-100 my-4"></div>
            <div className="space-y-1">
              <label className="block text-sm font-semibold text-gray-700">
                Jugador 1 (Vos)
              </label>
              <input
                type="text"
                placeholder="Nombre y Apellido"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                value={regFormData.player1}
                onChange={(e) =>
                  setRegFormData({ ...regFormData, player1: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-semibold text-gray-700">
                Jugador 2 (Pareja)
              </label>
              <input
                type="text"
                placeholder="Nombre y Apellido"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                value={regFormData.player2}
                onChange={(e) =>
                  setRegFormData({ ...regFormData, player2: e.target.value })
                }
                required
              />
            </div>
            {selectedChamp.type === "trios" && (
              <div className="space-y-1 animate-in fade-in slide-in-from-top-2">
                <label className="block text-sm font-semibold text-gray-700">
                  Jugador 3
                </label>
                <input
                  type="text"
                  placeholder="Nombre y Apellido"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  value={regFormData.player3}
                  onChange={(e) =>
                    setRegFormData({ ...regFormData, player3: e.target.value })
                  }
                  required
                />
              </div>
            )}
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-emerald-600 to-emerald-800 text-white font-bold py-3 px-4 rounded-lg shadow-md hover:shadow-lg transform active:scale-95 transition-all mt-6"
            >
              Confirmar Inscripción
            </button>
          </form>
        </div>
        <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100">
          <div className="bg-gray-50 p-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-bold text-gray-700 flex items-center gap-2">
              <Eye size={18} className="text-emerald-600" />
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
                    <tr
                      key={reg.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-gray-500">
                        {obfuscatePhone(reg.phone)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-gray-800 flex items-center gap-1">
                            <User size={12} className="text-emerald-500" />{" "}
                            {reg.player1}
                          </span>
                          <span className="font-medium text-gray-800 flex items-center gap-1">
                            <User size={12} className="text-emerald-500" />{" "}
                            {reg.player2}
                          </span>
                          {reg.player3 && (
                            <span className="font-medium text-gray-800 flex items-center gap-1">
                              <User size={12} className="text-emerald-500" />{" "}
                              {reg.player3}
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
        <h2 className="text-2xl font-bold text-gray-800">
          Panel de Organización
        </h2>
        <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full">
          Modo Admin
        </span>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-xl shadow-md border-t-4 border-emerald-600">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <PlusCircle size={20} className="text-emerald-600" /> Nuevo
              Campeonato
            </h3>
            <form onSubmit={createChampionship} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase">
                  Nombre
                </label>
                <input
                  type="text"
                  value={newChampData.name}
                  onChange={(e) =>
                    setNewChampData({ ...newChampData, name: e.target.value })
                  }
                  className="w-full p-2 border rounded mt-1 focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="Ej: Torneo Verano 2024"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase">
                  Modalidad
                </label>
                <div className="flex gap-4 mt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="type"
                      checked={newChampData.type === "parejas"}
                      onChange={() =>
                        setNewChampData({ ...newChampData, type: "parejas" })
                      }
                      className="text-emerald-600 focus:ring-emerald-500"
                    />{" "}
                    Parejas
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="type"
                      checked={newChampData.type === "trios"}
                      onChange={() =>
                        setNewChampData({ ...newChampData, type: "trios" })
                      }
                      className="text-emerald-600 focus:ring-emerald-500"
                    />{" "}
                    Tríos
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase">
                  Fecha
                </label>
                <input
                  type="date"
                  value={newChampData.date}
                  onChange={(e) =>
                    setNewChampData({ ...newChampData, date: e.target.value })
                  }
                  className="w-full p-2 border rounded mt-1 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase">
                  Premios
                </label>
                <textarea
                  value={newChampData.prizes}
                  onChange={(e) =>
                    setNewChampData({ ...newChampData, prizes: e.target.value })
                  }
                  className="w-full p-2 border rounded mt-1 focus:ring-2 focus:ring-emerald-500 outline-none h-20"
                  placeholder="Ej: Trofeos + Asado"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-2 rounded shadow transition"
              >
                Crear Campeonato
              </button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <h3 className="font-bold text-lg text-gray-700 flex items-center gap-2">
            <ClipboardList size={20} /> Registros (Base de Datos Real)
          </h3>
          {championships.map((champ) => {
            const champRegs = registrations.filter(
              (r) => r.championshipId === champ.id
            );
            return (
              <div
                key={champ.id}
                className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden"
              >
                <div className="bg-gray-50 p-4 border-b border-gray-200 flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-gray-800">{champ.name}</h4>
                    <p className="text-xs text-gray-500 uppercase">
                      {champ.type} • {champ.date}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-bold text-emerald-600">
                      {champRegs.length}
                    </span>
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
                          {champ.type === "trios" && (
                            <th className="px-4 py-3">Jugador 3</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {champRegs.map((reg) => (
                          <tr
                            key={reg.id}
                            className="border-b hover:bg-gray-50"
                          >
                            <td className="px-4 py-3 font-mono text-emerald-700 font-medium">
                              {reg.phone}
                            </td>
                            <td className="px-4 py-3">{reg.player1}</td>
                            <td className="px-4 py-3">{reg.player2}</td>
                            {champ.type === "trios" && (
                              <td className="px-4 py-3">{reg.player3}</td>
                            )}
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
        {view === "home" && renderHome()}
        {view === "register" && renderRegister()}
        {view === "login" && renderLogin()}
        {view === "admin" && renderAdminPanel()}
      </main>
    </div>
  );
}
