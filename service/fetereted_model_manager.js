const fs = require('fs');
const tf = require('@tensorflow/tfjs-node');
const path = require('path');
const { parse } = require("csv-parse");

class FederatedModelManager {
  constructor(modelFilePath) {
    this.modelFilePath = modelFilePath;
    this.model = null;
    this.weightsList = new Array();
  }

  async initializeModel() {

    if (fs.existsSync(`${this.modelFilePath}/model.json`)) {
      this.model = await tf.loadLayersModel(`file:///${this.modelFilePath}/model.json`); // Carica il modello
      return;
    }

    const glucoseValues = new Array();
    const timestamps = new Array();
    fs.createReadStream('./dataset.csv')
      .pipe(parse({ delimiter: ",", from_line: 3 }))
      .on("data", (data) => {
        if(data[1] && data[2]) {
          glucoseValues.push(parseFloat(data[1]));
          timestamps.push(new Date(data[2]).getTime());
        }
      })
      .on("end", async () => {
        // Crea i tensor
        const xs = tf.tensor2d(timestamps, [timestamps.length, 1]);
        const ys = tf.tensor2d(glucoseValues, [glucoseValues.length, 1]);

        // Addestra il modello sul server
        this.model = tf.sequential({
          layers: [
            tf.layers.dense({ inputShape: [1], units: 1 }), // hidden layer con 10 unità
          ],
        });

        this.model.compile({ optimizer: "adam", loss: 'meanSquaredError' });

        await this.model.fit(xs, ys, { epochs: 20 });
        this.saveModel()
      })
  }

  async saveModel() {
    if (this.model) {
      await this.model.save(`file://${this.modelFilePath}`); // Salva il modello
    }
  }

  getModelJson() {
    const jsonFilePath = path.join(this.modelFilePath, 'model.json');
    const jsonData = fs.readFileSync(jsonFilePath, 'utf8');
    return jsonData;
  }

  addWeightsList(weigth) {
    this.weightsList.push(weigth);
  }

  async updateModel() {
    if(this.weightsList.length === 0) return false;
    
    // Estrarre i pesi da tutti i client
    const weights = this.weightsList.map((clientWeights) =>
      clientWeights.map((w) => tf.tensor(w.data, w.shape))
    );

    // Calcolare la media dei pesi per ogni elemento
    const averageWeights = weights[0].map((_, idx) =>
      tf.stack(weights.map((w) => w[idx])).mean(0) //Gestisce i tensori e calcola la media pesata
    );

    this.model.setWeights(averageWeights);

    await this.saveModel(); // Salva il modello aggiornato
    this.weightsList = new Array();
    return true;
  }
}

module.exports = FederatedModelManager;
