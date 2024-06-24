const { WebSocketServer } = require("ws")
const path = require('path');
const http = require("http")
const AuthSolidManager = require('./service/auth_solid_manager'); // Importa AuthManager
const FederatedModelManager = require('./service/fetereted_model_manager'); // Importa FederatedModelManager
const { v4: uuidv4 } = require('uuid');
const Web3SmartContract = require("./service/web3_smart_contract");
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config();


// Percorso del file JSON per il modello
const MODEL_FILE_PATH = path.join(__dirname, 'model');

// Crea il gestore del modello
const modelManager = new FederatedModelManager(MODEL_FILE_PATH);

// Crea il gestore dell'autenticazione
const authManager = new AuthSolidManager();

const contractData = JSON.parse(fs.readFileSync('./contracts/PodAccessLogger.json'));
const contractABI = contractData.abi; // ABI del contratto
const contractAddress = contractData.networks['5777'].address;

//Creo il gestore dello smart contract
const smartContractManager = new Web3SmartContract(contractABI, contractAddress);

// Inizializza il modello all'avvio del server
const init = async () => {
    await modelManager.initializeModel();
    await authManager.authenticate();
};

init();

const server = http.createServer()
const wsServer = new WebSocketServer({ server })

// Funzione per inviare un messaggio in broadcast
const broadcastMessage = (message) => {
    // Invia il messaggio in broadcast a tutti i client connessi
    wsServer.clients.forEach((client) => {
        if (client.readyState === 1) {
            client.send(message); // Invia come JSON
        }
    });
};

// Timeout per aspettare che i client inviino i pesi
const timeoutDuration = 10000; // 10 secondi

const onTimeout = async () => {
    const isUpdate = await modelManager.updateModel()

    if(!isUpdate) return;

    broadcastMessage(modelManager.getModelJson())
}

timeoutId = setTimeout(onTimeout, timeoutDuration); // Avvia il timeout

wsServer.on("connection", async (connection, request) => {
    // Invia il modello corrente al client
    connection.send(modelManager.getModelJson());

    // Ricevi i pesi dai client e aggiorna il modello
    connection.on('message', async (message) => {
        const { action, endpoint, storageUrl } = JSON.parse(message);

        if(action === 'weightsSaved') {
            try {
                const response = await authManager.fetchFileToPod(endpoint);
                const data = await response.json();
                modelManager.addWeightsList(data);
                await smartContractManager.recordAccess(storageUrl); //Registrazione Accesso in Blockchain
                await modelManager.updateModel(); //Aggirona il modello Globale

                //Viene inviato il modello aggiornato a tutti i Client Connessi
                broadcastMessage(modelManager.getModelJson())
            } catch(e) {
                console.log('Error', e)
            }
        }
    });

    connection.on("close", () => {
        console.log(`Client disconnected.`);
    });
  })
  
const port = 8000
server.listen(port, () => {
    console.log(`WebSocket server is running on port ${port}`)
})
