const exampleWorkerManager = require("./workerManager"); // Imports the worker manager module, which handles the creation, management, and communication with worker processes.
const express = require("express"); // Express is a minimal and flexible Node.js web application framework that provides a robust set of features for web and mobile applications.
const bodyParser = require("body-parser"); // body-parser is a middleware used to extract the entire body portion of an incoming request stream and exposes it on `req.body`. It's used to parse incoming request bodies in a middleware before your handlers.
const logger = require("./logger"); // Imports a custom logger module based on the 'winston' module
const config = require('config'); // The 'config' module provides a way to organize hierarchical configurations for your app deployments. It lets you define a set of default parameters, and extend them for different deployment environments (e.g., development, QA, production).

// Configuration values from the file /config/default.js
const PORT = config.get('httpServerConfig.port');
const REQUEST_BODY_LIMIT = config.get('httpServerConfig.requestBodyLimit');

const app = express();

// Middleware configuration
// Parse URL-encoded bodies and set a size limit
app.use(bodyParser.urlencoded({ extended: true, limit: REQUEST_BODY_LIMIT }));
// Parse JSON bodies and set a size limit
app.use(bodyParser.json({ limit: REQUEST_BODY_LIMIT }));

initializeServer();

/**
 * Initializes the server by spawning worker processes, setting up HTTP routes, 
 * and registering process termination handlers.
 */
function initializeServer() {

    if (config.has('workerPool')) {
        exampleWorkerManager.initWorkerPools(config.get('workerPool'))
        // Periodically log worker stats mainly for debugging purposes
        if (config.has('logWorkerStats') && config.get('logWorkerStats') === true) {
            setInterval(() => {
                logWorkerStats();
            }, 1000);
        }
    } else {
        logger.warn("no 'workerPool' in config");
    }

    // Set up HTTP routes for the server
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

/**
 * Handles the termination of the process by shutting down worker processes gracefully.
 */
function processTermination() {
    exampleWorkerManager.terminateWorkers();
    //exampleWorkerManager.terminateWorkers('MEM');
    process.exit(0);
}

/**
 * Logs the stats of workers, including their CPU and memory usage.
 * @param {string|null} poolName - Name of the worker pool to retrieve stats for (optional).
 */
async function logWorkerStats(poolName = null) {
    const stats = await exampleWorkerManager.getWorkerStats(poolName);
    if (stats?.workers && stats?.workers?.length) {
        for (const worker of stats.workers) {
            console.log(`Worker stats: poolName ${worker.poolName}, worker pid ${worker.pid}, cpu:${parseInt(worker.stats.cpu)}% mem:${parseInt(worker.stats.memory / 1000 / 1000)}MB runningTasks:${worker.runningTasks}`);
        }
        console.log("---------------------------");
    }
}

/**
 * Sets up HTTP routes for dispatching tasks to workers.
 * 
 * The `/example/pool` endpoint is for dispatching tasks to a specific worker pool.
 * The `/example/oneShot` endpoint is for dispatching tasks to a one-shot worker.
 */
function setupHTTP_routes() {

    // pool worker example endpoint
    app.post(`/example/pool`, async (req, res) => {
        try {
            const { poolName, workerTask } = req.body;
            const callback = function (message) {
                if (message.ok) {
                    res.status(200).send(message);
                } else {
                    res.status(500).send(message);
                }
            };
            let result = exampleWorkerManager.executePoolWorkerTask({ data: workerTask }, callback, poolName);
            if (!result.ok) {
                res.status(500).send({ error: result.message });
            }
        } catch (err) {
            // Handle any errors that occur while sending the task
            res.status(500).send({ error: err.message });
        }
    });

    // one-shot worker example endpoint
    app.post(`/example/oneShot`, async (req, res) => {
        try {
            const { workerScript, workerTask, workerMemoryLimit } = req.body;
            const callback = function (message) {
                if (message.ok) {
                    res.status(200).send(message);
                } else {
                    res.status(500).send(message);
                }
            };
            exampleWorkerManager.executeOneShotWorkerTask(workerScript, { data: workerTask }, callback, workerMemoryLimit);
        } catch (err) {
            // Handle any errors that occur while sending the task
            res.status(500).send({ error: err.message });
        }
    });

}