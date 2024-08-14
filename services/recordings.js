const { getApiInstances, reconectToGenesys } = require('../utils/auth');
const logger = require('../utils/Logger');
const { formatDate, getDuration, isDurationGreater, durationToSeconds } = require('../utils/utilities');
const { getUser } = require('./users');


async function getRecordingsMetadata(conversation) {
    // Se obtiene el metadata del recording de mayor duracion de todos los recordings de una conversacion
    let retry = 0
    let recordingResult = undefined
    while (retry < 5){
        try {
            const { recordingApi } = await getApiInstances()
            recordingResult = await recordingApi.getConversationRecordingmetadata(conversation.conversationId)
            break
        } catch (e) {
            logger.error(e, `[ERROR] :: [RECORDING] :: [getRecordingsMetadata] :: Error getting recording for conversationId ${conversation.conversationId}`)
            retry ++
            await new Promise(resolve => setTimeout(resolve, 1000))
            await reconectToGenesys()
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
            logger.info(`Getting metadata for ${conversation.conversationId} recording ${recording.id}`)
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
            const tipo_llamada = conversation.originatingDirection == "inbound" ? "Inbound" : "Outbound"


            /* USEFULL DATA */
            // QUEUE ID
            let queue_id = ""
            for (const participant of conversation.participants) {
                if(participant.purpose == 'agent' && participant.userId){
                    for (const session of participant.sessions){
                        for (const segment of session.segments) {
                            queue_id = queue_id != segment.queueId ? segment.queueId : queue_id
                        }
                    }
                }
            }
            /* CUSTOM DATA */
            // Custom_data_01          // QUEUE ID
            // const Custom_data_01 = queue_id == "1fee010a-94f9-4e0c-893d-abe1594aeb23" ? "Emergencia_GSS" : queue_id == "0afc4d64-89a1-4062-95d7-6001448c645a" ? "Comercial_GSS" : ""


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
                    // "Custom_data_01": Custom_data_01,
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
                        "recordingId"       : recording.id,
                        "conversationId"    : conversation.conversationId,
                        "fileState"         : recording.fileState,
                        "queueId"           : queue_id
                    }
                }
            }
        }
        return formattedMetadata
    }
}

module.exports = {
    getRecordingsMetadata
}
