const axios = require('axios');
const logger = require('../utils/Logger')
const config = require('../utils/Configuration.js');

async function postInApiLayer(audio){
    try{
        if(!audio){
            throw new Error(`Parametros invalidos audio == undefined`) ;
        }
        const reqBody = {
            "tenant_id": config.instance().gettenant_id(),
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

        // logger.info(body);

        let retry = 0
        let postResult = {}
        while (retry < 5){
            try {
                postResult = await axios.request(body);
                if(postResult.status !== 200){
                    throw new Error(postResult.data);
                }
                break
            } catch (e) {
                logger.error(e, `[postInapiLayer(Error)]: [${retry}/5]: No se logro postear la informacion en la capa de api ${postResult.data}`)
                retry ++
                await new Promise(resolve => setTimeout(resolve, 1000))
            }
        }
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
            "tenant_id": config.instance().gettenant_id(),
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
        // logger.info(body)
        let retry = 0
        let postResult = {}
        while (retry < 5){
            try {
                postResult = await axios.request(body);
                if(postResult.status !== 200){
                    throw new Error(postResult.data);
                }
                break
            } catch (e) {
                logger.error(e, `[patchInapiLayer(Error)]: [${retry}/5]: No se logro postear la informacion en la capa de api ${postResult.data}`)
                retry ++
            }
        }
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

module.exports = {
    postInApiLayer,
    patchInApiLayer
}
