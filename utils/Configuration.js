const logger = require("./Logger.js");
const axios = require("axios");

class Configuration {
  static instance() {
    if (Configuration.singleton) return Configuration.singleton;
    Configuration.singleton = new Configuration();
    return Configuration.singleton;
  }

  constructor() {
    this.initialized = false;
    this.configuration = null;
    this.tenant_id = null;
    this.apilayer_url = null;
  }

  async configure(tenant_id_, apilayer_url) {
    this.tenant_id = tenant_id_;
    this.apilayer_url = apilayer_url;

    while(true) {
        try {
            let result = await axios.get(
                apilayer_url + '/ingestor/v1/configuration',
                {
                    params: { body: JSON.stringify({tenant_id: tenant_id_}) },
                    headers: { 'Content-Type': 'application/json' }
                });
            
            this.configuration = result.data;
            return true;

        }
        catch(e) {
            logger.error("[INPUT][Config] Error " + e);
            await sleep(5000);
        }
    }
  }

  getObject() {
    if (this.configuration == null) {
      throw "Configuration null";
    }
    return this.configuration;
  }

  gettenant_id() {
    return this.tenant_id;
  }

  getapilayer_url() {
    return this.apilayer_url;
  }
}

exports.instance = function () {
  return Configuration.instance();
};

function sleep(milisegundos) {
  return new Promise((resolve) => setTimeout(resolve, milisegundos));
}
