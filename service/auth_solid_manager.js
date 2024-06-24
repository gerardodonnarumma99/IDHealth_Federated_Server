const { Session } = require('@inrupt/solid-client-authn-node');
const dotenv = require('dotenv');

dotenv.config();

class AuthSolidManager {
  constructor() {
    this.clientId = process.env.CLIENT_ID,
    this.clientSecret = process.env.CLIENT_SECRET,
    this.oidcIssuer = process.env.OIDC_ISSUER,
    this.session = new Session();
  }

  async authenticate() {
    // Effettua il login per ottenere la sessione
    await this.session.login({
      clientId: this.clientId,
      clientSecret: this.clientSecret,
      oidcIssuer: this.oidcIssuer,
    });

    if (!this.session.info.isLoggedIn) {
      throw new Error('Session is not authenticated');
    }

    return this.session;
  }

  getSession() {
    if (!this.session.info.isLoggedIn) {
      throw new Error('Session is not authenticated');
    }

    return this.session;
  }

  async fetchFileToPod(endpoint) {
    // Usa fetch() per recuperare il file JSON dal Solid POD
    const response = await this.session.fetch(endpoint);
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.statusText}`);
    }

    return response;
  }
}

module.exports = AuthSolidManager;
