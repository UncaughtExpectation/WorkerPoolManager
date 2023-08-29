const exampleWorkerManager = require("./workerManager");
const express = require("express");
const bodyParser = require("body-parser");
const { v4: uuidv4 } = require("uuid");
const logger = require("./logger");
const config = require('config');

// Configuration values from the config module
const PORT = config.get('server.port');
const REQUEST_BODY_LIMIT = config.get('server.requestBodyLimit');

const app = express();

// Middleware configuration
// Parse URL-encoded bodies and set a size limit
app.use(bodyParser.urlencoded({ extended: true, limit: REQUEST_BODY_LIMIT }));
// Parse JSON bodies and set a size limit
app.use(bodyParser.json({ limit: REQUEST_BODY_LIMIT }));

initializeServer();

function initializeServer() {
    exampleWorkerManager.spawnWorkers(2, './workers/exampleWorker_CPULoad.js', 'CPU');
    exampleWorkerManager.spawnWorkers(2, './workers/exampleWorker_MemoryUsage.js', 'MEM');

    // Periodically log worker stats mainly for debugging purposes

    setInterval(() => {
        logWorkerStats();
    }, 1000);

    setupHTTP_routes();

    // Start the HTTP server on the configured port
    app.listen(PORT, () => {
        logger.info(`Server started on http://localhost:${PORT}`);
    });

    // Set up process termination handlers to gracefully handle shutdown scenarios
    process.on("exit", processTermination);
    process.on("SIGINT", processTermination); // Handle Ctrl+C
    process.on("SIGTERM", processTermination); // Handle kill command
}

function processTermination() {
    // Terminate the worker processes gracefully
    exampleWorkerManager.terminateWorkers('CPU');
    exampleWorkerManager.terminateWorkers('MEM');
    process.exit(0);
}

async function logWorkerStats(workerGroup = null) {
    const statuses = await exampleWorkerManager.getWorkerStatus(workerGroup);
    for (const worker of statuses.workers) {
        console.log(`workerGroup ${worker.group}, worker pid ${worker.pid}, cpu:${parseInt(worker.stats.cpu)}% mem:${parseInt(worker.stats.memory / 1000 / 1000)}MB runningTasks:${worker.runningTasks}`);
    }
    console.log("---------------------------");
}

function setupHTTP_routes() {
    // Define the endpoint to send a task to a worker
    app.post(`/exampleWorker/CPULoad`, async (req, res) => {
        try {
            exampleWorkerManager.addWorkerTask({ id: uuidv4(), type: "work", data: req.body },
                (message) => {
                    if (message.ok) {
                        res.status(200).send(message);
                    } else {
                        res.status(500).send(message);
                    }
                }, 'CPU'
            );
        } catch (err) {
            // Handle any errors that occur while sending the task
            res.status(500).send({ error: err.message });
        }
    });

    app.post(`/exampleWorker/MemoryUsage`, async (req, res) => {
        try {
            exampleWorkerManager.addWorkerTask({ id: uuidv4(), type: "work", data: req.body },
                (message) => {
                    if (message.ok) {
                        res.status(200).send(message);
                    } else {
                        res.status(500).send(message);
                    }
                }, 'MEM'
            );
        } catch (err) {
            // Handle any errors that occur while sending the task
            res.status(500).send({ error: err.message });
        }
    });
}