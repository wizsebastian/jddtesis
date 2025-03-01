import React, { useState, useEffect, useRef } from "react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const users = [
  { username: "supervisor", password: "123", role: "SUPERVISOR" },
  { username: "user1", password: "123", role: "ESTADO" },
  { username: "user2", password: "123", role: "CONTRACTOR" },
];

let channel = new BroadcastChannel("securechain_channel");

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
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [selectedFileName, setSelectedFileName] = useState("");
  const [selectedFilePath, setSelectedFilePath] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => {
    channel.onmessage = (message) => {
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
  }, []);

  const loadData = () => {
    setFiles(JSON.parse(localStorage.getItem("files")) || []);
    setBlocks(JSON.parse(localStorage.getItem("blocks")) || []);
    setLogs(JSON.parse(localStorage.getItem("logs")) || []);
  };

  const saveData = (key, value, type) => {
    localStorage.setItem(key, JSON.stringify(value));
    channel.postMessage({ type });
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
    channel.postMessage({ type: "NEW_NOTIFICATION", message: newLog });
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
      };
      const updatedFiles = [...files, newFile];
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

    const updatedFiles = [...files];
    if (!updatedFiles[index].approvals.includes(currentUser.role)) {
      updatedFiles[index].approvals.push(currentUser.role);
      addLog(
        `✅ ${currentUser.username} aprobó el archivo "${updatedFiles[index].name}".`
      );

      if (updatedFiles[index].approvals.length === 3) {
        addLog(
          `🔒 Archivo "${updatedFiles[index].name}" ha sido aprobado por 3 usuarios y está listo para ser agregado al blockchain.`
        );
      }
      setFiles(updatedFiles);
      saveData("files", updatedFiles, "UPDATE_FILES");
    } else {
      toast.warning("⚠️ Ya has aprobado este archivo.");
    }
  };

  const rejectFile = (index) => {
    if (!files[index]) return;

    const updatedFiles = [...files];
    updatedFiles[index].rejections.push(currentUser.role);
    addLog(
      `❌ ${currentUser.username} rechazó el archivo "${updatedFiles[index].name}".`
    );

    setFiles(updatedFiles);
    saveData("files", updatedFiles, "UPDATE_FILES");
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

    // Crear nuevo bloque con este archivo
    const newBlock = {
      hash: Math.random().toString(36).substring(2, 15),
      previousHash: blocks.length > 0 ? blocks[blocks.length - 1].hash : "0",
      files: [file.name],
      timestamp: new Date().toLocaleString(),
    };

    const updatedBlocks = [...blocks, newBlock];
    setBlocks(updatedBlocks);
    saveData("blocks", updatedBlocks, "UPDATE_BLOCKS");

    addLog(
      `📦 ${currentUser.username} ha agregado el archivo "${file.name}" a la blockchain.`
    );

    // Eliminar el archivo de la lista de pendientes
    const updatedFiles = files.filter((_, i) => i !== index);
    setFiles(updatedFiles);
    saveData("files", updatedFiles, "UPDATE_FILES");
  };

  const createBlock = () => {
    const approvedFiles = files.filter(
      (file) =>
        file.approvals.length === 3 && file.createdBy === currentUser.username
    );
    if (approvedFiles.length === 0) return;

    const newBlock = {
      hash: Math.random().toString(36).substring(2, 15),
      previousHash: blocks.length > 0 ? blocks[blocks.length - 1].hash : "0",
      files: approvedFiles.map((file) => file.name),
      timestamp: new Date().toLocaleString(),
    };

    const updatedBlocks = [...blocks, newBlock];
    setBlocks(updatedBlocks);
    saveData("blocks", updatedBlocks, "UPDATE_BLOCKS");

    addLog(
      `📦 Se creó un bloque en la blockchain con ${approvedFiles.length} archivos aprobados.`
    );

    const remainingFiles = files.filter(
      (file) =>
        file.approvals.length < 3 || file.createdBy !== currentUser.username
    );
    setFiles(remainingFiles);
    saveData("files", remainingFiles, "UPDATE_FILES");
  };

  // Mostrar todos los archivos pendientes a todos los usuarios
  const filteredFiles = files;

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
              <div key={index} className="bg-gray-800 p-4 rounded mt-2">
                <div className="flex justify-between items-center">
                  <div>
                    📄 {file.name} | 🔢 Aprobaciones: {file.approvals.length}/3
                    {file.createdBy === currentUser.username && (
                      <span className="ml-2 bg-green-700 text-xs p-1 rounded">
                        Tu archivo
                      </span>
                    )}
                  </div>
                  <div>
                    <button
                      className="bg-blue-500 p-2 ml-2 rounded"
                      onClick={() => approveFile(files.indexOf(file))}
                    >
                      Aprobar
                    </button>
                    <button
                      className="bg-red-500 p-2 ml-2 rounded"
                      onClick={() => rejectFile(files.indexOf(file))}
                    >
                      Rechazar
                    </button>
                    {file.createdBy === currentUser.username &&
                      file.approvals.length >= 3 && (
                        <button
                          className="bg-green-500 p-2 ml-2 rounded"
                          onClick={() => addToBlockchain(files.indexOf(file))}
                        >
                          Agregar al Blockchain
                        </button>
                      )}
                  </div>
                </div>
                {file.path && (
                  <div className="mt-2 text-gray-400 text-sm">
                    Ruta: {file.path}
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
              <div key={index} className="bg-gray-800 p-4 rounded mt-2">
                🔗 Hash: {block.hash} | ⏮️ Hash Anterior: {block.previousHash} |
                🕒 {block.timestamp}
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
    </div>
  );
};

export default App;
