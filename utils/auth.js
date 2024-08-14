const platform = require('purecloud-platform-client-v2')
const logger = require('./Logger')
const config = require('./Configuration.js');


let client;

async function connectToGenesys() {
    logger.info("[connectToGenesys] Creando cliente de purecloud.")
    const client_id = config.instance().getObject().addons.extractor.credentials.client_id
    const client_secret = config.instance().getObject().addons.extractor.credentials.client_secret

    client = platform.ApiClient.instance
    client.setEnvironment('mypurecloud.com')
    client.setPersistSettings(true)

    const { accessToken } = await client.loginClientCredentialsGrant(client_id, client_secret)
    client.setAccessToken(accessToken)
}

async function reconectToGenesys() {
    logger.warn("[reconectToGenesys] Reconectando cliente de purecloud.")
    const client_id = config.instance().getObject().addons.extractor.credentials.client_id
    const client_secret = config.instance().getObject().addons.extractor.credentials.client_secret

    const { accessToken } = await client.loginClientCredentialsGrant(client_id, client_secret)
    client.setAccessToken(accessToken)
}


const getApiInstances = async () => {
  try {
    if(!client){
        await connectToGenesys()
    }
    return {
      conversationsApi: new platform.ConversationsApi(),
      usersApi: new platform.UsersApi(),
      routingApi: new platform.RoutingApi(),
      recordingApi: new platform.RecordingApi(),
      authorizationApi: new platform.ObjectsApi(),
    }
  } catch (e) {
    logger.warn('[AUTH] :: Error getting api instances')
    logger.error(e)
  }
}

module.exports = {
    getApiInstances,
    reconectToGenesys,
    connectToGenesys
}
