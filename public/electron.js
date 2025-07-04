const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Define o caminho para armazenar os dados do usuário. Este é um local confiável
// em diferentes sistemas operacionais.
const userDataPath = app.getPath('userData');
const dataFilePath = path.join(userDataPath, 'timeflow-data.json');

function createWindow() {
  // Cria a janela do navegador.
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      // O script de preload é a ponte segura entre o processo de renderização (React) e o principal (Node.js)
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Carrega a aplicação React.
  win.loadURL('http://localhost:3000');

  // Abre as Ferramentas de Desenvolvedor (opcional, útil para depuração)
  // win.webContents.openDevTools();
}

// --- Handlers IPC para Operações de Arquivo ---

// Este handler escuta por uma requisição 'load-data' vinda da aplicação React.
ipcMain.handle('load-data', async () => {
  try {
    // Verifica se o arquivo existe
    if (fs.existsSync(dataFilePath)) {
      const fileData = fs.readFileSync(dataFilePath, 'utf-8');
      return JSON.parse(fileData);
    }
  } catch (error) {
    console.error('Falha ao carregar os dados:', error);
  }
  // Retorna null ou uma estrutura vazia se o arquivo não existir ou se houver um erro
  return null;
});

// Este handler escuta por uma requisição 'save-data' vinda da aplicação React.
ipcMain.handle('save-data', async (event, data) => {
  try {
    // Escreve os dados no arquivo JSON, formatados para melhor leitura.
    fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Falha ao salvar os dados:', error);
  }
});

// Este método será chamado quando o Electron tiver finalizado a inicialização.
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Encerra a aplicação quando todas as janelas forem fechadas, exceto no macOS.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
