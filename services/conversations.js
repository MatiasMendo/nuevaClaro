const { getApiInstances, reconectToGenesys } = require('../utils/auth')
const logger = require('../utils/Logger')
const config = require('../utils/Configuration.js');

async function getConversationsPage(pageNumber, pageSize = 100, interval) {
    // Función de apoyo que hace la query al api de genesys
    const { conversationsApi } = await getApiInstances()

    let conversations = []
    logger.info(`[getConversationsPage] :: [pageNumber] :: ${pageNumber} :: [pageSize] :: ${pageSize}`)

    const query = config.instance().getObject().addons.extractor.credentials.query
    query.interval = interval
    query.paging = {
        pageSize,
        pageNumber
    }

    let retry = 0
    while ( retry < 5 ) {
        try {
            const response = await conversationsApi.postAnalyticsConversationsDetailsQuery(query)
            conversations = response.conversations || []
            break
        } catch (e) {
            logger.error(`[getConversationsPage] No se logró obtener las conversaciones reintentando ${retry}/5`, e)
            await reconectToGenesys()
            retry++;
        }
    }
    return conversations
}

module.exports = {
    getConversationsPage
}
