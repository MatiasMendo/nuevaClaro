const { getApiInstances } = require('../utils/auth')
const logger = require('../utils/Logger')

async function getQueueDetails(queueId) {
    let retry = 0
    let queue
    const { routingApi } = await getApiInstances()
    while (retry < 5){
        try {
            queue = await routingApi.getRoutingQueue(queueId)
            break
        } catch (error) {
            logger.warn(`Error getting queue ${queueId}`)
            logger.error(error)
            await new Promise(resolve => setTimeout(resolve, 1000))
            retry++
        }
    }
    return queue ? queue : ""
}

module.exports = {
    getQueueDetails
}
