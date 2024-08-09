const { getApiInstances, reconectToGenesys, connectToGenesys } = require('./utils/auth.js');
const logger = require('./utils/Logger.js');
const config = require('./utils/Configuration.js');
const NodeCron = require('node-cron')
const axios = require('axios')

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
    const cron = config.instance().getObject().microservices.extractor.cron
    daily_quota = config.instance().getObject().quota.job

    // Se conecta a la API de Genesys Cloud
    await connectToGenesys()



    if(interval){   // En caso de que se configure manualmente el intervalo
        logger.info(`[main] Ejecución manual descargando grabaciones de ${tenant} para el intervalo ${interval}`)


        // Separar el intervalo en intervalos diarios
        const intervals = getDailyIntervals(interval)

        if(max_audio){ // En caso de que exista una cantidad máxima de audios a descargar (NO TIEMPO) entregadas manualmente
            logger.info(`[main] Se define manualmente el máximo de ${max_audio} audios a descargar`)
            daily_quota = Math.ceil(max_audio/intervals.length)
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
        logger.info(`[patchInApiLayer] Se han procesado ${(i + 1) * 25}/${conversations.length} `)
    }
    logger.info(`[stageConversations] Se ha finalizado el proceso de subir ${conversations.length + 1} de ${conversations.length + 1}`)
}

function getInterval() {
    // Ejemplo de return: "2024-05-01T00:00:00.000Z/2024-05-30T00:00:00.000Z"
    const now = new Date();
    let start, end;
    start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1, 0, 0, 0, 0));
    end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1, 23, 59, 59, 999));

    return `${start.toISOString()}/${end.toISOString()}`;
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




    logger.info(`[stageConversations] Comienza proceso de selección de conversaciones para llenar cuota diaria de ${daily_quota}`)

    let current_quota = 0
    // Se seleccionan conversaciones hasta llenar la quota diaria
    const recordingsMetadata = []
    for (const current_conversation of shuffledConversations) {
        const metadata = await getRecordingsMetadata(current_conversation)
        const fileState = metadata ? metadata.customdata.fileState : ""
        if(fileState != "AVAILABLE"){
            continue
        }
        current_quota += max_audio ? 1 : metadata.duration
        recordingsMetadata.push(metadata)
        if(current_quota >= daily_quota){
            break
        }
    }
    logger.info(`[stageConversations] Se seleccionaron ${recordingsMetadata.length} de ${conversations.length} con cuota diaria (${current_quota} / ${daily_quota})`)

    return recordingsMetadata
}

async function getConversationsPage(pageNumber, pageSize = 100, interval) {
    // Función de apoyo que hace la query al api de genesys
    const { conversationsApi } = await getApiInstances()

    let conversations = []
    // logger.info(`[getConversationsPage] :: [${interval}] :: [pageNumber] :: ${pageNumber} :: [pageSize] :: ${pageSize}`)

    const query = config.instance().getObject().microservices.extractor.credentials.query
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

async function getRecordingsMetadata(conversation) {
    // Se obtiene el metadata del recording de mayor duracion de todos los recordings de una conversacion
    let retry = 0
    const recordingList = []
    let recordingResult = undefined
    while (retry < 5){
        try{
            const { recordingApi } = await getApiInstances()
            recordingResult = await recordingApi.getConversationRecordingmetadata(conversation.conversationId)
            break
        } catch (e) {
            logger.error(error, `[ERROR] :: [RECORDING] :: [getRecordingsMetadata] :: Error getting recording for conversationId ${conversation.conversationId}`)
            retry ++
        }
    }
    let record_duracion_audio_seleccionado = "00:00:00"
    let recordingMetadata = undefined

    let formattedMetadata = undefined

    if(recordingResult){
        for (const recording of recordingResult) {
            if(recording.media != "audio"){
                // logger.info(`[getRecordingsMetadata] :: [conversationId] :: ${conversation.conversationId} :: [recordingId] :: ${recording.id} :: ${recording.media}`)
                continue;
            }
            logger.info(recording)
            /* FORMAT DOCUMENT */
            // nombre_audio            // (REQUIRED): Name of original audio file
            const nombre_audio = conversation.conversationId + "_" + recording.id

            // id                      // (REQUIRED): Call ID
            const id = conversation.conversationId

            // agentid                 // (REQUIRED): Id of agent into the call
            let agentid = ""
            for (const participant of conversation.participants) {
                if(participant.purpose == 'agent' && participant.userId){
                    agentid = participant.userId
                }
            }

            // nombre_agente           // (REQUIRED): Name of agent into the call
            const user_details = await getUser(agentid)
            const nombre_agente = user_details.name ? user_details.name : ""

            // ANI                     // (REQUIRED): Call ANI
            let ani = ""
            for (const participant of conversation.participants) {
                if(participant.purpose == 'agent' && participant.userId){
                    for (const session of participant.sessions){
                        if(session.ani){
                            ani = session.ani.split(":")[1]
                        }
                    }
                }
            }

            // datetime                // (REQUIRED): Time when the call was placed, in format YYYY-MM-DD HH:MM:SS
            const datetime = formatDate(recording.startTime)

            // record_start_time       // (REQUIRED): Time when the recording call started, in format YYYY-MM-DD HH:MM:SS
            const record_start_time = formatDate(recording.startTime)

            // record_end_time         // (REQUIRED): Time when ends the recording call, in format YYYY-MM-DD HH:MM:SS
            const record_end_time = formatDate(recording.endTime)

            // record_duracion_audio   // (REQUIRED): Recording duration, in format HH:MM:SS
            const record_duracion_audio = getDuration(record_start_time, record_end_time)

            // tipo_llamada            // (REQUIRED): Call Direction (In|Out)bound
            const tipo_llamada = conversation.originatingDirection

            if(isDurationGreater(record_duracion_audio, record_duracion_audio_seleccionado)){
                recordingMetadata = {
                    "nombre_audio": nombre_audio,
                    "id": id,
                    "nombre_agente": nombre_agente,
                    "agentid": agentid,
                    "ANI": ani,
                    "datetime": datetime,
                    "record_start_time": record_start_time,
                    "record_end_time": record_end_time,
                    "record_duracion_audio": record_duracion_audio,
                    "tipo_llamada": tipo_llamada,
                    // "Custom_data_01": "",
                    // "Custom_data_01": "",
                    // "Custom_data_02": "",
                    // "Custom_data_03": "",
                    // "Custom_data_04": "",
                    // "Custom_data_05": "",
                    // "Custom_data_06": "",
                    // "Custom_data_07": "",
                    // "Custom_data_08": "",
                    // "Custom_data_09": "",
                    // "Custom_data_10": "",
                    // "Custom_data_11": "",
                    // "Custom_data_12": "",
                    // "Custom_data_13": "",
                    // "Custom_data_14": "",
                    // "Custom_data_15": "",
                    // "Custom_data_16": "",
                    // "Custom_data_17": "",
                    // "Custom_data_18": "",
                    // "Custom_data_19": "",
                    // "Custom_data_20": "",
                    // "Custom_data_21": "",
                    // "Custom_data_22": "",
                    // "Custom_data_23": "",
                    // "Custom_data_24": "",
                    // "Custom_data_25": "",
                    // "Custom_data_26": "",
                    // "Custom_data_27": "",
                    // "Custom_data_28": "",
                    // "Custom_data_29": "",
                    // "Custom_data_30": ""
                }
                record_duracion_audio_seleccionado = record_duracion_audio

                formattedMetadata = {
                    "source" : nombre_audio,
                    "duration" : durationToSeconds(record_duracion_audio),
                    "metadata" : JSON.stringify(recordingMetadata),
                    "customdata" : {
                        "recordingId": recording.id,
                        "conversationId" : conversation.conversationId,
                        "fileState" : recording.fileState
                    }
                }
            }
        }
        return formattedMetadata
    }
}

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

function formatDate(isoDateString){
    const date = new Date(isoDateString);

    // Obtener los componentes de la fecha
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Los meses en JavaScript van de 0 a 11
    const day = String(date.getDate()).padStart(2, '0');

    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    // Formatear la fecha como 'YYYY-MM-DD HH:MM:SS'
    const formattedDate = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

    return formattedDate;
}

function getDuration(recordStartTime,recordEndTime){
    // Convertir las cadenas de tiempo en objetos Date
    const startTime = new Date(recordStartTime);
    const endTime = new Date(recordEndTime);

    // Calcular la diferencia en milisegundos
    const durationMs = endTime - startTime;

    // Convertir la diferencia en milisegundos a horas, minutos y segundos
    const hours = String(Math.floor(durationMs / (1000 * 60 * 60))).padStart(2, '0');
    const minutes = String(Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))).padStart(2, '0');
    const seconds = String(Math.floor((durationMs % (1000 * 60)) / 1000)).padStart(2, '0');

    // Formatear la duración como 'HH:MM:SS'
    const recordDuration = `${hours}:${minutes}:${seconds}`;

    return recordDuration
}

function durationToSeconds(duration) {
    const [hours, minutes, seconds] = duration.split(':').map(Number);
    return hours * 3600 + minutes * 60 + seconds;
}

function isDurationGreater(duration1, duration2) {
    const seconds1 = durationToSeconds(duration1);
    const seconds2 = durationToSeconds(duration2);
    return seconds1 > seconds2;
}

function getDailyIntervals(interval){
    logger.info(`[getDailyIntervals] Obteniendo lista de intervalos diarios de ${interval}`)
    // Dividir el intervalo en dos fechas
    const [start, end] = interval.split("/");

    // Convertir las fechas a objetos Date
    const startDate = new Date(start);
    const endDate = new Date(end);

    // Crear una lista para almacenar los intervalos diarios
    const dailyIntervals = [];

    // Función para añadir un día a una fecha
    const addDays = (date, days) => {
    const result = new Date(date);
    result.setUTCDate(result.getUTCDate() + days);
    return result;
    };

    // Iterar sobre cada día en el intervalo
    for (let current = startDate; current < endDate; current = addDays(current, 1)) {
    const nextDay = addDays(current, 1);
        dailyIntervals.push(`${current.toISOString()}/${nextDay.toISOString()}`);
    }
    return dailyIntervals
}

function shuffle(array) {
    // Copiar la lista original para no modificarla directamente
    const shuffledArray = array.slice();

    for (let i = shuffledArray.length - 1; i > 0; i--) {
      // Generar un índice aleatorio entre 0 e i
      const j = Math.floor(Math.random() * (i + 1));

      // Intercambiar los elementos en las posiciones i y j
      [shuffledArray[i], shuffledArray[j]] = [shuffledArray[j], shuffledArray[i]];
    }

    return shuffledArray;
}

function divideIntoChunks(array, chunkSize) {
    const result = [];
    for (let i = 0; i < array.length; i += chunkSize) {
        const chunk = array.slice(i, i + chunkSize);
        result.push(chunk);
    }
    return result;
}

async function postInApiLayer(audio){
    try{
        if(!audio){
            throw new Error(`Parametros invalidos audio == undefined`) ;
        }
        const reqBody = {
            "tenant_id": tenant,
            "audios": [audio]
        }
        const body={
            method: 'post',
            maxBodyLength: Infinity,
            url: config.instance().getapilayer_url() + '/ingestor/v1/new',
            headers: {
                'Content-Type': 'application/json'
            },
            data:reqBody,

        };
        logger.info(body);
        const postResult=await axios.request(body);
        if(postResult.status !== 200){
            throw new Error(postResult.data);
        }
        logger.info(`[postInapiLayer()]: Proceso finalizado correctamente ${postResult.data.job_id}.`);
        return{
            "status":200,
            "data":postResult.data.job_id
        };
    }catch(e){
        logger.error(`[postInapiLayer(Error)]: No se logro postear la informacion en la capa de api ${e}`);
        return{
            "status":500,
            "data":`[postInapiLayer(Error)]: No se logro postear la informacion en la capa de api ${e}`
        };
    }
}

async function patchInApiLayer(audios, jobId){
    try{
        if(!audios||!jobId){
            throw new Error(`No se obtuvo el body request jobId`);
        }
        if(!Array.isArray(audios) ){
            logger.error(`El audios no es un Array !`);
            throw new Error(`El audios no es un Array !`);
        }
        let reqBody = JSON.stringify({
            "tenant_id": tenant,
            "job_id": jobId,
            "audios":audios
        });

        const body={
            method: 'patch',
            maxBodyLength: Infinity,
            url:`${config.instance().getapilayer_url()}/ingestor/v1/new`,
            headers: {
                'Content-Type': 'application/json'
            },
            data:reqBody,

        };
        logger.info(body)
        const postResult=await axios.request(body);
        if(postResult.status !== 200){
            throw new Error(postResult.data);
        }
        logger.info(`[patchInapiLayer()]: Proceso finalizado correctamente ${jobId}.`);
        // return{
        //     "status":200,
        //     "data":`[patchInapiLayer()]: Proceso finalizado correctamente ${jobId}.`
        // };
    }catch(e){
        logger.error(`[patchInapiLayer(Error)]: No se logro postear la informacion en la capa de api ${e}`);
        return{
            "status":500,
            "data":`[patchInapiLayer(Error)]: No se logro postear la informacion en la capa de api ${e}`
        };
    }
}

main();
