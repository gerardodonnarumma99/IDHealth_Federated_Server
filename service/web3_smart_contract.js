const fs = require("fs")
const { Web3 } = require('web3');
const dotenv = require('dotenv');

dotenv.config();

class Web3SmartContract {
    constructor(contractABI, contractAddress) {
        this.web3 = new Web3(new Web3.providers.HttpProvider(process.env.BLOCKCHAIN_PROVIDER_URL));
        this.contract = new this.web3.eth.Contract(contractABI, contractAddress);
        this.contractAddress = contractAddress;
    }

    async signedTransaction(transaction) {
        const signedTx = await this.web3.eth.accounts.signTransaction(transaction, process.env.PRIVATE_KEY);
        await this.web3.eth.sendSignedTransaction(signedTx.rawTransaction);
    }

    // Controlla il nonce per l'indirizzo 'from'
    async getNonce() {
        return await this.web3.eth.getTransactionCount(process.env.PUBLIC_KEY, 'latest'); // Ottieni il nonce
    }

    //Funzione per registrare gli accessi
    async recordAccess(storage) {
        const gasEstimate = await this.contract.methods.recordAccess(storage).estimateGas({ from: process.env.PUBLIC_KEY });

        const data = this.contract.methods.recordAccess(storage).encodeABI();

        const tx = {
            to: this.contractAddress,
            data,
            gas: gasEstimate,
            gasPrice: this.web3.utils.toWei('20', 'gwei'),
            //nonce,
            from: process.env.PUBLIC_KEY,
        };

        await this.signedTransaction(tx);
    }

    // Funzione per ottenere gli accessi registrati
    async getAccesses(storage) {
        const accesses = await this.contract.methods.getAccesses(storage).call({ from: process.env.PUBLIC_KEY });
        return accesses;
    }
}

module.exports = Web3SmartContract;
