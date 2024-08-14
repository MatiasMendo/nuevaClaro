const { getApiInstances } = require('../utils/auth.js');
const logger = require('../utils/Logger')

async function getUser(userId) {
    let retry = 0
    const { usersApi } = await getApiInstances()
    while (retry < 5){
        try {
            user = await usersApi.getUser(userId)
            // logger.info(`[getUser] :: [usersApi] :: User ${userId} retrieved successfully`)
            break
        } catch (error) {
            logger.warn(`Error getting user ${userId}`)
            logger.error(error)
            await new Promise(resolve => setTimeout(resolve, 1000))
            retry++
        }
    }
    return user
}

module.exports = {
    getUser
}
