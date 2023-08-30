const winston = require("winston");
const DailyRotateFile = require("winston-daily-rotate-file");

const myFormat = winston.format.printf(({ timestamp, level, message }) => {
    const date = new Date(timestamp);
    const formattedDate = `${date.getDate().toString().padStart(2, "0")}.${(
        date.getMonth() + 1
    )
        .toString()
        .padStart(2, "0")}.${date.getFullYear()}`;
    const formattedTime = `${date.getHours().toString().padStart(2, "0")}:${date
        .getMinutes()
        .toString()
        .padStart(2, "0")}:${date.getSeconds().toString().padStart(2, "0")}`;
    return `${formattedDate} | ${formattedTime} | ${level} | ${message}`;
});

const logger = winston.createLogger({
    level: "debug", // Log only if info.level <= this level
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
    ),
    transports: [
        // Write all logs with level `info` and below to a daily rotate file
        new DailyRotateFile({
            filename: "logs/%DATE%.log",
            datePattern: "YYYY-MM-DD",
            zippedArchive: true,
            maxSize: "20m",
            maxFiles: "14d",
            format: winston.format.combine(winston.format.timestamp(), myFormat),
        }),
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.colorize(),
                myFormat
            ),
        }),
    ],
});

module.exports = logger;
