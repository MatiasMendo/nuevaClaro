const logger = require('./Logger')
const cronParser = require('cron-parser');
const moment = require('moment-timezone');

function getInterval(daily_interval_times) {
    // Ejemplo de return: "2024-05-01T00:00:00.000Z/2024-05-30T00:00:00.000Z"
    const now = new Date();
    let start, end;
    start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1, 0, 0, 0, 0));
    end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1, 23, 59, 59, 999));

    const interval = `${start.toISOString()}/${end.toISOString()}`

    return adjustTimeInInterval(interval, daily_interval_times);
}

function formatDate(isoDateString){
    // Formatear la fecha como 'YYYY-MM-DD HH:MM:SS'
    const date = new Date(isoDateString);

    // Obtener los componentes de la fecha
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Los meses en JavaScript van de 0 a 11
    const day = String(date.getDate()).padStart(2, '0');

    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

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

function getDailyIntervals(interval, daily_interval_times){
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
        const dInterval = adjustTimeInInterval(`${current.toISOString()}/${nextDay.toISOString()}`,daily_interval_times)
        dailyIntervals.push(dInterval);
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

function adjustTimeInInterval(interval, daily_interval_times) {
    logger.info(`[adjustTimeInInterval]: Ajustando intervalo ${interval} a base de:`);
    logger.info(daily_interval_times);

    // Verifica si daily_interval_times existe
    if (daily_interval_times && daily_interval_times.start_time && daily_interval_times.end_time) {
        const [start, end] = interval.split('/');

        // Ajusta las horas de inicio y fin según daily_interval_times
        const newStart = `${start.split('T')[0]}T${daily_interval_times.start_time}`;
        const newEnd = `${start.split('T')[0]}T${daily_interval_times.end_time}`; // Mantener la misma fecha

        if (daily_interval_times.timezone) {
            // Convertir la fecha de inicio y fin a la zona horaria especificada
            const newStartMoment = moment.tz(newStart, daily_interval_times.timezone);
            const newEndMoment = moment.tz(newEnd, daily_interval_times.timezone);

            // Si la hora de fin es anterior o igual a la hora de inicio, ajustamos para que no pase al día siguiente
            if (newEndMoment.isBefore(newStartMoment)) {
                newEndMoment.add(1, 'day');
            }

            // Convertir ambas fechas a UTC
            const startUTC = newStartMoment.utc().format();
            const endUTC = newEndMoment.utc().format();

            return `${startUTC}/${endUTC}`;
        }
        return `${newStart}Z/${newEnd}Z`;
    }

    // Retorna el mismo intervalo si daily_interval_times no existe
    return interval;
}


function executionsInMonth(period, _interval) {

    const [startDate] = _interval.split('/');
    const date = new Date(startDate)
    const month = date.getUTCMonth() + 1;
    const year = date.getUTCFullYear();

    // Crear una fecha de inicio y fin para el mes
    const start = new Date(year, month - 1, 1, 0, 0, 0);
    const end = new Date(year, month, 1, 0, 0, 0);

    // Parsear el cron
    const interval = cronParser.parseExpression(period, { currentDate: start, endDate: end });

    let count = 0;

    // Contar cuántas veces se ejecuta
    logger.info(`[executionsInMonth] Obteniendo cuantas veces se ejecutara ${period} en el mes de ${month} para el año ${year}`)
    try {
        while (interval.next()) {
            count++;
        }
    } catch (err) {
        // Se termina cuando llegamos al final del mes
    }

    return count;
}

module.exports = {
    getInterval,
    formatDate,
    getDuration,
    durationToSeconds,
    isDurationGreater,
    getDailyIntervals,
    shuffle,
    divideIntoChunks,
    executionsInMonth
}
