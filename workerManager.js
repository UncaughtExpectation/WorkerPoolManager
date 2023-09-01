const { fork } = require("child_process"); // The 'child_process' module provides the ability to spawn subprocesses. The 'fork' method is a special case of 'spawn' that spawns a new instance of the V8 engine. 
const pidusage = require("pidusage"); // 'pidusage' is a library that provides information about the resource usage (CPU and memory) of a process based on its PID (Process ID). 
const logger = require("./logger"); // Imports a custom logger module based on the 'winston' module
const { v4: uuidv4 } = require("uuid"); // The 'uuid' library is used to generate universally unique identifiers (UUIDs). Here, we're specifically using the v4 method, which produces random UUIDs.

const WORKER_MESSAGE_TYPES = {
  INIT: "init",
  INIT_DONE: "initDone",
  WORK_DONE: "workDone",
  TERMINATE: "terminate",
  ERROR: "error",
};

class WorkerPool {

  #workerPools = new Map();
  #workerSet = new Set();
  #pendingTasks = [];
  #taskCallbacks = new Map();

  constructor() {

  }

  initWorkerPools(workerPoolConfig) {
    if (!workerPoolConfig) {
      return false;
    }
    for (const config of workerPoolConfig) {
      if (!config.workerScript) {
        logger.error(`missing workerScript in worker pool config`);
        continue;
      }
      if (!config.poolName) {
        logger.error(`missing poolName in worker pool config`);
        continue;
      }
      for (let i = 0; i < config.workerCount; i++) {
        this.#spawnPoolWorker(config.workerScript, config.poolName, config.workerMemoryLimit);
      }
    }
  }


  /**
   * Adds a task to the queue for processing by worker processes.
   * @param {Object} task - The task to be added.
   * @param {Function} callback - The function to call once the task is processed.
   * @param {string} poolName - The worker pool that should execute the task.
   */
  executePoolWorkerTask(task, callback, poolName) {
    let res = { ok: true };

    let pool = this.#workerPools.get(poolName)
    if (!pool) {
      res.ok = false;
      res.message = `Worker pool ${poolName} does not exists`;
      return res;
    }

    task.id = uuidv4();
    task.type = "work";
    task.poolName = poolName;
    this.#pendingTasks.push({ task, callback });
    this.#processNextTask();
    return res;
  }


  /**
  * Executes a task in a one-shot-worker. After the tasks is finished, the worker will terminate.
  * @param {Object} task - The task to be added.
  * @param {Function} callback - The function to call once the task is processed.
  */
  executeOneShotWorkerTask(workerScript, task, callback, memoryLimit = 4096) {
    let worker = this.#spawnOneShotWorker(workerScript, memoryLimit);

    task.id = uuidv4();
    task.type = "work";
    this.#taskCallbacks.set(task.id, callback);
    worker.send(task);
  }

  /**
   * Retrieves the stats of all or specific pool of workers.
   * @param {string} poolName - Name of the worker pool to retrieve stats for (optional).
   * @returns {Object} - Object containing the stats of the workers.
   */
  async getWorkerStats(poolName = null) {
    // Get workers from the specified pool, or all workers if no poolName is specified.
    const targetWorkers = poolName ? this.#workerPools.get(poolName) : this.#workerSet;

    const workers = await Promise.all(
      [...targetWorkers].map(async (worker) => {
        try {
          const stats = await pidusage(worker.pid);
          return { poolName: worker.poolName, pid: worker.pid, runningTasks: worker.runningTasks, stats };
        } catch (err) {
          return null;
        }
      }),
    );

    return { workers: workers.filter(Boolean) };
  }

  /**
   * Terminates all workers or a specific pool of workers.
   * @param {string} poolName - The pool of workers to terminate.
   */
  terminateWorkers(poolName = null) {
    const workersToTerminate = poolName
      ? this.#workerPools.get(poolName)
      : this.#workerSet;

    if (!workersToTerminate) {
      return;
    }
    workersToTerminate.forEach((worker) => {
      worker.send({ type: WORKER_MESSAGE_TYPES.TERMINATE });
      worker.on("exit", () => logger.info(`Worker ${worker.pid} has exited.`));
    });
  }

  /**
   * Spawns pool worker processes.
   * @param {string} workerJS_path - Path to the worker's JavaScript file.
   * @param {string} poolName - Name of the worker pool.
   * @param {string} memoryLimit - memory limit of the workers (--max-old-space-size)
   */
  #spawnPoolWorker(workerScript, poolName, memoryLimit = 4096) {
    // Initialize the pool if not already present
    if (!this.#workerPools.has(poolName)) {
      this.#workerPools.set(poolName, new Set());
    }

    let execArgV = [];
    execArgV.push('--expose-gc');
    execArgV.push(`--max-old-space-size=${memoryLimit}`);
    const worker = fork(workerScript, [], { execArgv: execArgV });

    worker.poolName = poolName;
    worker.memoryLimit = memoryLimit;
    worker.workerScript = workerScript;
    worker.runningTasks = 0;

    worker.on("message", this.#processPoolWorkerMessage.bind(this, worker));
    worker.on("exit", this.#managePoolWorkerExit.bind(this, worker, poolName));

    worker.send({ type: WORKER_MESSAGE_TYPES.INIT });

    this.#workerSet.add(worker);
    this.#workerPools.get(poolName).add(worker);
  }

  /**
  * Spawns a one-shot worker processes.
  * @param {string} workerJS_path - Path to the worker's JavaScript file.
  * @param {string} poolName - Name of the worker pool.
  * @param {string} memoryLimit - memory limit of the workers (--max-old-space-size)
  */
  #spawnOneShotWorker(workerScript, memoryLimit = 4096) {
    let execArgV = [];
    execArgV.push('--expose-gc');
    execArgV.push(`--max-old-space-size=${memoryLimit}`);
    const worker = fork(workerScript, [], { execArgv: execArgV });

    worker.memoryLimit = memoryLimit;
    worker.workerScript = workerScript;

    worker.on("message", this.#processOneShotWorkerMessage.bind(this, worker));
    //worker.send({ type: WORKER_MESSAGE_TYPES.INIT });
    logger.debug(`OneShotWorker pid ${worker.pid} spawned, script ${workerScript}`)
    return worker;
  }

  /**
   * Processes messages received from worker processes.
   * @param {Object} worker - The worker sending the message.
   * @param {Object} message - The actual message content.
   */
  #processPoolWorkerMessage(worker, message) {
    if (!message) return;

    switch (message.type) {
      case WORKER_MESSAGE_TYPES.INIT_DONE: {
        logger.debug(`Worker initialized: poolName ${worker.poolName}, worker pid ${message.data.pid}, memoryLimit: ${worker.memoryLimit}, workerScript: ${worker.workerScript}`);
        break;
      }
      case WORKER_MESSAGE_TYPES.WORK_DONE:
      case WORKER_MESSAGE_TYPES.ERROR: {
        worker.runningTasks--;
        const callback = this.#taskCallbacks.get(message.id);
        if (callback) {
          callback(message);
          this.#taskCallbacks.delete(message.id);
        }
        this.#processNextTask();
        break;
      }
    }
  }

  /**
   * Processes messages received from one-shot worker processes.
   * @param {Object} worker - The worker sending the message.
   * @param {Object} message - The actual message content.
   */
  #processOneShotWorkerMessage(worker, message) {
    if (!message) return;
    const callback = this.#taskCallbacks.get(message.id);
    if (callback) {
      callback(message);
      this.#taskCallbacks.delete(message.id);
      worker.send({ type: WORKER_MESSAGE_TYPES.TERMINATE });
      worker.on("exit", (exitCode) => logger.debug(`OneShotWorker pid ${worker.pid} exited with code ${exitCode}.`));
    }
  }

  /**
   * Manages the exit events of worker processes.
   * @param {Object} worker - The worker that has exited.
   * @param {string} poolName - The pool the worker belongs to.
   * @param {number} code - The exit code.
   * @param {string} signal - The signal causing the exit.
   */
  #managePoolWorkerExit(worker, code, signal) {
    logger.warn(
      `Worker ${worker.pid} exited with code ${code} and signal ${signal}`
    );
    this.#workerSet.delete(worker);
    this.#workerPools.get(worker.poolName).delete(worker);

    if (code !== 0) {
      logger.warn(`Restarting worker ${worker.pid}...`);
      this.spawnPoolWorker(worker.workerScript, worker.poolName, worker.workerMemoryLimit || 1);
    }
  }

  /**
   * Processes the next task in the queue, if available.
   */
  #processNextTask() {
    if (!this.#pendingTasks.length) return;

    const { task, callback } = this.#pendingTasks.shift();
    const workerPool = this.#workerPools.get(task.poolName) || this.#workerSet;

    const leastBusyWorker = [...workerPool].reduce((a, b) =>
      a.runningTasks <= b.runningTasks ? a : b,
    );

    this.#taskCallbacks.set(task.id, callback);
    leastBusyWorker.send(task);
    leastBusyWorker.runningTasks++;
  }

}

module.exports = new WorkerPool();
