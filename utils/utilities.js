const logger = require('./Logger')

function getInterval() {
    // Ejemplo de return: "2024-05-01T00:00:00.000Z/2024-05-30T00:00:00.000Z"
    const now = new Date();
    let start, end;
    start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1, 0, 0, 0, 0));
    end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1, 23, 59, 59, 999));

    return `${start.toISOString()}/${end.toISOString()}`;
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

module.exports = {
    getInterval,
    formatDate,
    getDuration,
    durationToSeconds,
    isDurationGreater,
    getDailyIntervals,
    shuffle,
    divideIntoChunks
}
