const { connectToGenesys } = require('./utils/auth.js');
const logger = require('./utils/Logger.js');
const config = require('./utils/Configuration.js');
const NodeCron = require('node-cron')
const { patchInApiLayer, postInApiLayer } = require('./services/apiLayer.js');
const { getRecordingsMetadata } = require('./services/recordings.js');
const { getDailyIntervals, shuffle, divideIntoChunks } = require('./utils/utilities.js');
const { getConversationsPage } = require('./services/conversations.js');

if(process.argv.length < 5) {
    logger.error("[INPUT][] Starting microservice error arguments");
    return;
}

const tenant = process.argv[2];
const apylayer_url = process.argv[3];
let interval = process.argv[4];
const max_audio = process.argv[5];
let daily_quota

async function main() {
    // Se obtienen las configuraciones del tenant en el api layer
    await config.instance().configure(tenant, apylayer_url)
    const cron = config.instance().getObject().addons.extractor.cron
    daily_quota = config.instance().getObject().addons.extractor.quota

    // Se conecta a la API de Genesys Cloud
    await connectToGenesys()

    if(interval){   // En caso de que se configure manualmente el intervalo
        logger.info(`[main] Ejecución manual descargando grabaciones de ${tenant} para el intervalo ${interval}`)


        // Separar el intervalo en intervalos diarios
        const intervals = getDailyIntervals(interval)

        if(max_audio){ // En caso de que exista una cantidad máxima de audios a descargar (NO TIEMPO) entregadas manualmente
            logger.info(`[main] Se define manualmente el máximo de ${max_audio} audios a descargar por cola`)

            for (let id in daily_quota) {
                daily_quota[id] = Math.ceil(max_audio/intervals.length)
            }
        }

        // Obtener conversaciones por cada intervalo diario
        for (const current_interval of intervals) {
            const conversations = await getConversations(current_interval)
            await stageConversations(conversations, intervals.length)
        }
    } else {        // En caso contrario
        // Se crea la función de CRON
        logger.info(`[main] Ejecución automática descargará grabaciones de ${tenant} en el periodo ${cron}`)
        NodeCron.schedule(cron, async () => {
            // Se obtiene el intervalo
            interval = getInterval()
            logger.info(`[main] Ejecución automática descargando grabaciones de ${tenant} para el intervalo ${interval}`)

            // Se obtienen las conversaciones de ese intervalo
            const conversations = await getConversations(interval)

            // Se suben al API LAYER
            await stageConversations(conversations)
        })
    }
}

async function stageConversations(conversations) {
    // Se suben las conversaciones al API Layer
    logger.info(`[stageConversations] Comienza proceso de subir las conversaciones seleccionadas al Api Layer`)

    const postInApiLayerResult = await postInApiLayer(conversations.pop())
    const jobId = postInApiLayerResult.data

    logger.info(`[stageConversations] Se subiran las conversaciones restantes al JOB ID: ${jobId}`)

    // Se separa en chunks para subirlo al API Layer
    const chunks = divideIntoChunks(conversations, 25)
    for (const i in chunks) {
        const chunk = chunks[i]
        await patchInApiLayer(chunk, jobId)
        logger.info(`[patchInApiLayer] Se han procesado ${i} chunks de ${chunks.length} `)
    }
    logger.info(`[stageConversations] Se ha finalizado el proceso de subir ${conversations.length + 1} de ${conversations.length + 1}`)
}

async function getConversations(interval){
    // Obtiene todas las conversaciones en un intervalo
    logger.info(`[getConversations] Obteniendo todas las conversaciones del intervalo ${interval}`)
    const pageSize = 100
    let pageNumber = 1
    const conversations = []

    while(true){
        const conversationsPage = await getConversationsPage(pageNumber, pageSize, interval)

        if(conversationsPage.length === 0){
            break
        }
        conversations.push(...conversationsPage)
        pageNumber++
    }
    logger.info(`[getConversations] se encontrarón ${conversations.length} conversaciones en ${interval}`)

    // Se desordenan las conversaciones del dia procesandose
    logger.info(`[stageConversations] Se desordena la lista de las ${conversations.length} conversaciones`)
    const shuffledConversations = shuffle(conversations)

    logger.info(`[stageConversations] Comienza proceso de selección de conversaciones para llenar cuota diaria de`)
    logger.info(daily_quota)

    // Se crea el current quota
    let current_quota = {}
    for (let id in daily_quota){
        current_quota[id] = 0
    }

    // Se seleccionan conversaciones hasta llenar la quota diaria
    const recordingsMetadata = []
    for (const current_conversation of shuffledConversations) {
        let formattedMetadata = await getRecordingsMetadata(current_conversation)

        let allReachedQuota = true;

        for (let id in daily_quota) {
            if (current_quota[id] <= daily_quota[id]) {
                allReachedQuota = false;
                logger.info(`Falta que se llene la cuota de ${id}: ${current_quota[id]}/${daily_quota[id]}`)
            }
        }
        if (allReachedQuota){
            break;
        }

        if(current_quota[formattedMetadata.customdata.queueId] + formattedMetadata.duration <= daily_quota[formattedMetadata.customdata.queueId] + (max_audio ? 0 : 900)){ // 15 minutos de relajo
            if(isConversationValid(formattedMetadata)) {
                logger.info(`Se han agregado ${recordingsMetadata.length}`)
                recordingsMetadata.push(formattedMetadata)
                current_quota[formattedMetadata.customdata.queueId] = current_quota[formattedMetadata.customdata.queueId] + (max_audio ? 1 : formattedMetadata.duration)
            }
        }
    }
    logger.info(`[stageConversations] Se seleccionaron ${recordingsMetadata.length} de ${conversations.length} con cuota diaria: `, current_quota)
    return recordingsMetadata
}

function isConversationValid(metadata) {
    const fileState = metadata ? metadata.customdata.fileState : ""
    const duration = metadata ? metadata.duration : ""
    const duration_rules = config.instance().getObject().addons.extractor.duration

    if(fileState !== "AVAILABLE"){
        return false
    }
    if (duration_rules.gt && duration <= duration_rules.gt) {
        logger.info(`Duración del audio es: ${duration}s <= ${duration_rules.gt}s`)
        return false;
    }
    if (duration_rules.gte && duration < duration_rules.gte) {
        logger.info(`Duración del audio es: ${duration}s < ${duration_rules.gte}s`)
        return false;
    }
    if (duration_rules.lt && duration >= duration_rules.lt) {
        logger.info(`Duración del audio es: ${duration}s >= ${duration_rules.gte}s`)
        return false;
    }
    if (duration_rules.lte && duration > duration_rules.lte) {
        logger.info(`Duración del audio es: ${duration}s > ${duration_rules.lte}s`)
        return false;
    }

    return true;
}

main();
