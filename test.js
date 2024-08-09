async function getInterval(periodo) {
    const now = new Date();
    let start, end;

    if (periodo === "diario") {
        // Inicio y fin del día anterior en UTC
        start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1, 0, 0, 0, 0));
        end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1, 23, 59, 59, 999));
    } else if (periodo === "mensual") {
        // Inicio y fin del mes anterior en UTC
        start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 0, 0, 0, 0));
        end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999));
    } else if (periodo === "semanal") {
        // Inicio y fin de la semana anterior (lunes a domingo) en UTC
        const dayOfWeek = now.getUTCDay();
        const startOfWeek = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - dayOfWeek - 6, 0, 0, 0, 0));
        const endOfWeek = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - dayOfWeek, 23, 59, 59, 999));
        
        start = startOfWeek;
        end = endOfWeek;
    } else {
        throw new Error(`Periodo ${periodo} es inválido, tiene que ser diario, mensual o semanal`);
    }

    return `${start.toISOString()}/${end.toISOString()}`;
}

// Ejemplo de uso:
getInterval("diario").then(console.log);
getInterval("mensual").then(console.log);
getInterval("semanal").then(console.log);
