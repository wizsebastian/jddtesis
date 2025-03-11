import  { useState, useEffect, useRef } from "react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const users = [
  { username: "supervisor", password: "123", role: "SUPERVISOR" },
  { username: "user1", password: "123", role: "ESTADO" },
  { username: "user2", password: "123", role: "CONTRACTOR" },
];

// Crear un canal global fuera del componente
let globalChannel = null;

const App = () => {
  const [currentUser, setCurrentUser] = useState(
    JSON.parse(sessionStorage.getItem("currentUser")) || null
  );
  const [files, setFiles] = useState(
    () => JSON.parse(localStorage.getItem("files")) || []
  );
  const [blocks, setBlocks] = useState(
    () => JSON.parse(localStorage.getItem("blocks")) || []
  );
  const [logs, setLogs] = useState(
    () => JSON.parse(localStorage.getItem("logs")) || []
  );
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [currentBlockchainFile, setCurrentBlockchainFile] = useState(null);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [currentBlock, setCurrentBlock] = useState(null);
  const [verifyKeys, setVerifyKeys] = useState({
    SUPERVISOR: "",
    ESTADO: "",
    CONTRACTOR: "",
  });
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [selectedFileName, setSelectedFileName] = useState("");
  const [selectedFilePath, setSelectedFilePath] = useState("");
  const fileInputRef = useRef(null);

  // Inicializar el canal de comunicación
  useEffect(() => {
    // Si no existe el canal global, crear uno nuevo
    if (!globalChannel) {
      globalChannel = new BroadcastChannel("securechain_channel");
    }

    const handleMessage = (message) => {
      if (
        ["UPDATE_FILES", "UPDATE_BLOCKS", "UPDATE_LOGS"].includes(
          message.data.type
        )
      ) {
        loadData();
      }
      if (message.data.type === "NEW_NOTIFICATION") {
        toast.info(message.data.message);
      }
    };

    globalChannel.onmessage = handleMessage;

    // No cerramos el canal al desmontar para evitar problemas
    return () => {
      globalChannel.onmessage = null;
    };
  }, []);

  const loadData = () => {
    try {
      const storedFiles = JSON.parse(localStorage.getItem("files")) || [];
      const storedBlocks = JSON.parse(localStorage.getItem("blocks")) || [];
      const storedLogs = JSON.parse(localStorage.getItem("logs")) || [];

      setFiles(storedFiles);
      setBlocks(storedBlocks);
      setLogs(storedLogs);
    } catch (error) {
      console.error("Error al cargar datos:", error);
    }
  };

  const saveData = (key, value, type) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      if (globalChannel) {
        globalChannel.postMessage({ type });
      }
    } catch (error) {
      console.error(`Error al guardar ${key}:`, error);
    }
  };

  const handleLogin = () => {
    const user = users.find(
      (u) => u.username === loginUsername && u.password === loginPassword
    );
    if (user) {
      setCurrentUser(user);
      sessionStorage.setItem("currentUser", JSON.stringify(user));
      addLog(`🔑 ${user.username} (${user.role}) ha iniciado sesión.`);
    } else {
      toast.error("❌ Usuario o contraseña incorrectos.");
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("currentUser");
    setCurrentUser(null);
  };

  const addLog = (message) => {
    const timestamp = new Date().toLocaleString();
    const newLog = `${timestamp} - ${message}`;
    const newLogs = [...logs, newLog];
    setLogs(newLogs);
    saveData("logs", newLogs, "UPDATE_LOGS");
    try {
      if (globalChannel) {
        globalChannel.postMessage({
          type: "NEW_NOTIFICATION",
          message: newLog,
        });
      }
    } catch (error) {
      console.error("Error al enviar notificación:", error);
    }
    toast.info(message);
  };

  const handleFileInputChange = (e) => {
    if (e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedFileName(file.name);
      setSelectedFilePath(URL.createObjectURL(file));
    }
  };

  const uploadFile = () => {
    if (selectedFileName.trim() !== "") {
      const hash = Math.random().toString(36).substring(2, 15);
      const newFile = {
        name: selectedFileName,
        path: selectedFilePath,
        hash,
        approvals: [],
        rejections: [],
        addedToBlockchain: false,
        createdBy: currentUser.username,
        createdAt: new Date().getTime(),
        keys: {
          SUPERVISOR: Math.random().toString(36).substring(2, 10),
          ESTADO: Math.random().toString(36).substring(2, 10),
          CONTRACTOR: Math.random().toString(36).substring(2, 10),
        },
      };
      // Añadir el nuevo archivo al inicio de la lista
      const updatedFiles = [newFile, ...files];
      setFiles(updatedFiles);
      saveData("files", updatedFiles, "UPDATE_FILES");

      addLog(
        `📤 ${currentUser.username} subió el archivo "${selectedFileName}".`
      );
      setSelectedFileName("");
      setSelectedFilePath("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } else {
      toast.error("❌ Selecciona un archivo antes de subirlo.");
    }
  };

  const approveFile = (index) => {
    if (!files[index]) return;

    // Crea una copia profunda para evitar problemas de referencia
    const updatedFiles = JSON.parse(JSON.stringify(files));

    if (!updatedFiles[index].approvals.includes(currentUser.role)) {
      updatedFiles[index].approvals.push(currentUser.role);

      // Actualizar estado inmediatamente
      setFiles(updatedFiles);
      saveData("files", updatedFiles, "UPDATE_FILES");

      addLog(
        `✅ ${currentUser.username} aprobó el archivo "${updatedFiles[index].name}".`
      );

      if (updatedFiles[index].approvals.length === 3) {
        addLog(
          `🔒 Archivo "${updatedFiles[index].name}" ha sido aprobado por 3 usuarios y está listo para ser agregado al blockchain.`
        );
      }
    } else {
      toast.warning("⚠️ Ya has aprobado este archivo.");
    }
  };

  const rejectFile = (index) => {
    if (!files[index]) return;

    // Copia profunda
    const updatedFiles = JSON.parse(JSON.stringify(files));

    if (!updatedFiles[index].rejections.includes(currentUser.role)) {
      updatedFiles[index].rejections.push(currentUser.role);

      setFiles(updatedFiles);
      saveData("files", updatedFiles, "UPDATE_FILES");

      addLog(
        `❌ ${currentUser.username} rechazó el archivo "${updatedFiles[index].name}".`
      );
    } else {
      toast.warning("⚠️ Ya has rechazado este archivo.");
    }
  };

  const addToBlockchain = (index) => {
    if (!files[index]) return;

    const file = files[index];

    // Verificar que sea el creador del archivo
    if (file.createdBy !== currentUser.username) {
      toast.error(
        "❌ Solo el creador del archivo puede agregarlo al blockchain."
      );
      return;
    }

    // Verificar que tenga 3 aprobaciones
    if (file.approvals.length < 3) {
      toast.error(
        "❌ El archivo debe tener 3 aprobaciones para ser agregado al blockchain."
      );
      return;
    }

    // Mostrar modal con claves
    setCurrentBlockchainFile({ ...file }); // Crear copia para evitar mutaciones
    setShowKeyModal(true);
  };

  const confirmAddToBlockchain = () => {
    if (!currentBlockchainFile) return;

    // Crear nuevo bloque con este archivo
    const newBlock = {
      hash: Math.random().toString(36).substring(2, 15),
      previousHash: blocks.length > 0 ? blocks[blocks.length - 1].hash : "0",
      files: [currentBlockchainFile.name],
      path: currentBlockchainFile.path,
      timestamp: new Date().toLocaleString(),
      keys: currentBlockchainFile.keys,
    };

    const updatedBlocks = [...blocks, newBlock];
    setBlocks(updatedBlocks);
    saveData("blocks", updatedBlocks, "UPDATE_BLOCKS");

    addLog(
      `📦 ${currentUser.username} ha agregado el archivo "${currentBlockchainFile.name}" a la blockchain.`
    );

    // Eliminar el archivo de la lista de pendientes
    const fileIndex = files.findIndex(
      (f) => f.hash === currentBlockchainFile.hash
    );
    if (fileIndex !== -1) {
      const updatedFiles = [...files];
      updatedFiles.splice(fileIndex, 1);
      setFiles(updatedFiles);
      saveData("files", updatedFiles, "UPDATE_FILES");
    }

    // Cerrar modal
    setShowKeyModal(false);
    setCurrentBlockchainFile(null);
  };

  const openVerifyModal = (block) => {
    if (!block) return;

    setCurrentBlock({ ...block }); // Crear copia para evitar mutaciones
    setVerifyKeys({
      SUPERVISOR: "",
      ESTADO: "",
      CONTRACTOR: "",
    });
    setShowVerifyModal(true);
  };

  const verifyBlockAccess = () => {
    if (!currentBlock) return;

    // Verificar si el bloque tiene claves
    if (!currentBlock.keys) {
      toast.error("❌ Este bloque no tiene claves de acceso configuradas.");
      setShowVerifyModal(false);
      setCurrentBlock(null);
      return;
    }

    // Verificar claves
    const isValid =
      verifyKeys.SUPERVISOR === currentBlock.keys.SUPERVISOR &&
      verifyKeys.ESTADO === currentBlock.keys.ESTADO &&
      verifyKeys.CONTRACTOR === currentBlock.keys.CONTRACTOR;

    if (isValid) {
      toast.success(
        "✅ Verificación exitosa. Ahora puedes acceder al archivo."
      );
      addLog(
        `🔓 ${currentUser.username} ha verificado acceso al archivo en el bloque ${currentBlock.hash}.`
      );
      // Aquí podrías abrir el archivo o redirigir a la ruta
      if (currentBlock.path) {
        window.open(currentBlock.path, "_blank");
      } else {
        toast.warning("⚠️ Este bloque no tiene una ruta de archivo definida.");
      }
    } else {
      toast.error(
        "❌ Las claves ingresadas no son correctas. Acceso denegado."
      );
      addLog(
        `🚫 ${currentUser.username} ha intentado acceder a un archivo pero la verificación falló.`
      );
    }

    setShowVerifyModal(false);
    setCurrentBlock(null);
  };

  // Mostrar todos los archivos pendientes a todos los usuarios
  const filteredFiles = files || [];

  // Validar que currentBlockchainFile y currentBlock tengan claves antes de mostrar modalas
  const safeShowKeyModal =
    showKeyModal && currentBlockchainFile && currentBlockchainFile.keys;
  const safeShowVerifyModal = showVerifyModal && currentBlock;

  return (
    <div className="p-6 text-white bg-gray-900 min-h-screen">
      <ToastContainer position="top-right" autoClose={3000} />
      {!currentUser ? (
        <div className="flex flex-col items-center">
          <h2 className="text-2xl font-bold">Iniciar Sesión</h2>
          <input
            className="mt-4 p-2 bg-gray-700 rounded"
            placeholder="Usuario"
            value={loginUsername}
            onChange={(e) => setLoginUsername(e.target.value)}
          />
          <input
            className="mt-2 p-2 bg-gray-700 rounded"
            type="password"
            placeholder="Contraseña"
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
          />
          <button
            className="mt-4 bg-blue-500 hover:bg-blue-700 p-2 rounded"
            onClick={handleLogin}
          >
            Ingresar
          </button>
        </div>
      ) : (
        <>
          <h1 className="text-3xl font-bold mb-4">
            SecureChain - Bienvenido {currentUser.username}
          </h1>
          <button className="bg-red-500 p-2 rounded" onClick={handleLogout}>
            Cerrar Sesión
          </button>

          <h2 className="text-2xl font-bold mt-6">📤 Subir Archivos</h2>
          <div className="bg-gray-800 p-4 rounded mt-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileInputChange}
              className="bg-gray-700 p-2 rounded w-full"
            />
            <div className="mt-2">
              {selectedFileName && (
                <p className="text-green-400">
                  Archivo seleccionado: {selectedFileName}
                </p>
              )}
            </div>
            <button
              className="bg-blue-500 hover:bg-blue-700 p-2 rounded mt-2"
              onClick={uploadFile}
            >
              Subir Archivo
            </button>
          </div>

          <h2 className="text-2xl font-bold mt-6">📁 Archivos Pendientes</h2>
          {filteredFiles.length > 0 ? (
            filteredFiles.map((file, index) => (
              <div
                key={file.hash || index}
                className="bg-gray-800 p-4 rounded mt-2"
              >
                <div className="flex justify-between items-center">
                  <div>
                    📄 {file.name} | 🔢 Aprobaciones: {file.approvals.length}/3
                    {file.createdBy === currentUser.username && (
                      <span className="ml-2 bg-green-700 text-xs p-1 rounded">
                        Tu archivo
                      </span>
                    )}
                    {file.approvals.length >= 3 && (
                      <span className="ml-2 bg-blue-700 text-xs p-1 rounded">
                        Aprobado ✓
                      </span>
                    )}
                  </div>
                  <div>
                    {file.approvals.length < 3 && (
                      <>
                        <button
                          className="bg-blue-500 p-2 ml-2 rounded"
                          onClick={() => approveFile(index)}
                          disabled={file.approvals.includes(currentUser.role)}
                        >
                          Aprobar
                        </button>
                        <button
                          className="bg-red-500 p-2 ml-2 rounded"
                          onClick={() => rejectFile(index)}
                          disabled={file.rejections.includes(currentUser.role)}
                        >
                          Rechazar
                        </button>
                      </>
                    )}
                    {file.createdBy === currentUser.username &&
                      file.approvals.length >= 3 && (
                        <button
                          className="bg-green-500 p-2 ml-2 rounded"
                          onClick={() => addToBlockchain(index)}
                        >
                          Agregar al Blockchain
                        </button>
                      )}
                  </div>
                </div>
                {file.path && (
                  <div
                    className={`mt-2 text-sm ${
                      file.approvals.length >= 3
                        ? "text-yellow-400 font-medium"
                        : "text-gray-400"
                    }`}
                  >
                    {file.approvals.length >= 3 ? "🔗 " : ""}Ruta: {file.path}
                  </div>
                )}
              </div>
            ))
          ) : (
            <p className="mt-2">No hay archivos pendientes.</p>
          )}

          <h2 className="text-2xl font-bold mt-6">🔗 Blockchain</h2>
          {Array.isArray(blocks) && blocks.length > 0 ? (
            blocks.map((block, index) => (
              <div
                key={block.hash || index}
                className="bg-gray-800 p-4 rounded mt-2"
              >
                <div className="flex justify-between items-center">
                  <div>
                    🔗 Hash: {block.hash} | ⏮️ Hash Anterior:{" "}
                    {block.previousHash} | 🕒 {block.timestamp}
                  </div>
                  <button
                    className="bg-blue-500 p-2 rounded"
                    onClick={() => openVerifyModal(block)}
                  >
                    Ver Archivo
                  </button>
                </div>
                <ul>
                  {Array.isArray(block.files) &&
                    block.files.map((file, i) => <li key={i}>📄 {file}</li>)}
                </ul>
              </div>
            ))
          ) : (
            <p>No hay bloques en la blockchain aún.</p>
          )}
        </>
      )}

      {safeShowKeyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg w-full max-w-lg">
            <h3 className="text-xl font-bold mb-4">
              Claves de Acceso para el Blockchain
            </h3>
            <p className="mb-4">
              El archivo <strong>{currentBlockchainFile.name}</strong> será
              agregado al blockchain con las siguientes claves:
            </p>

            <div className="bg-gray-700 p-4 rounded mb-4">
              <div className="mb-2">
                <span className="font-bold">Ruta del archivo:</span>
                <div className="bg-gray-900 p-2 rounded mt-1">
                  {currentBlockchainFile.path}
                </div>
              </div>
              <div className="mb-2">
                <span className="font-bold">Clave SUPERVISOR:</span>
                <div className="bg-gray-900 p-2 rounded mt-1">
                  {currentBlockchainFile.keys.SUPERVISOR}
                </div>
              </div>
              <div className="mb-2">
                <span className="font-bold">Clave ESTADO:</span>
                <div className="bg-gray-900 p-2 rounded mt-1">
                  {currentBlockchainFile.keys.ESTADO}
                </div>
              </div>
              <div className="mb-2">
                <span className="font-bold">Clave CONTRACTOR:</span>
                <div className="bg-gray-900 p-2 rounded mt-1">
                  {currentBlockchainFile.keys.CONTRACTOR}
                </div>
              </div>
            </div>

            <p className="text-yellow-400 mb-4">
              <strong>Importante:</strong> Guarda estas claves. Serán necesarias
              para acceder al archivo desde el blockchain.
            </p>

            <div className="flex justify-end">
              <button
                className="bg-gray-500 p-2 rounded mr-2"
                onClick={() => setShowKeyModal(false)}
              >
                Cancelar
              </button>
              <button
                className="bg-green-500 p-2 rounded"
                onClick={confirmAddToBlockchain}
              >
                Confirmar y Agregar
              </button>
            </div>
          </div>
        </div>
      )}

      {safeShowVerifyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg w-full max-w-lg">
            <h3 className="text-xl font-bold mb-4">
              Verificar Acceso al Archivo
            </h3>
            <p className="mb-4">
              Ingresa las 3 claves de acceso para verificar el acceso al
              archivo:
            </p>

            <div className="mb-4">
              <label className="block mb-1">Clave SUPERVISOR:</label>
              <input
                type="text"
                className="w-full p-2 bg-gray-700 rounded"
                value={verifyKeys.SUPERVISOR}
                onChange={(e) =>
                  setVerifyKeys({ ...verifyKeys, SUPERVISOR: e.target.value })
                }
              />
            </div>

            <div className="mb-4">
              <label className="block mb-1">Clave ESTADO:</label>
              <input
                type="text"
                className="w-full p-2 bg-gray-700 rounded"
                value={verifyKeys.ESTADO}
                onChange={(e) =>
                  setVerifyKeys({ ...verifyKeys, ESTADO: e.target.value })
                }
              />
            </div>

            <div className="mb-4">
              <label className="block mb-1">Clave CONTRACTOR:</label>
              <input
                type="text"
                className="w-full p-2 bg-gray-700 rounded"
                value={verifyKeys.CONTRACTOR}
                onChange={(e) =>
                  setVerifyKeys({ ...verifyKeys, CONTRACTOR: e.target.value })
                }
              />
            </div>

            <div className="flex justify-end">
              <button
                className="bg-gray-500 p-2 rounded mr-2"
                onClick={() => setShowVerifyModal(false)}
              >
                Cancelar
              </button>
              <button
                className="bg-blue-500 p-2 rounded"
                onClick={verifyBlockAccess}
              >
                Verificar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
