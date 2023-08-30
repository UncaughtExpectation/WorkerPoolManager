const { fork } = require("child_process"); // The 'child_process' module provides the ability to spawn subprocesses. The 'fork' method is a special case of 'spawn' that spawns a new instance of the V8 engine. 
const pidusage = require("pidusage"); // 'pidusage' is a library that provides information about the resource usage (CPU and memory) of a process based on its PID (Process ID). 
const logger = require("./logger"); // Imports a custom logger module based on the 'winston' module

// Constants for different message types to ensure consistency and clarity.
const MESSAGE_TYPES = {
  INIT: "init",
  INIT_DONE: "initDone",
  WORK_DONE: "workDone",
  TERMINATE: "terminate",
  ERROR: "error",
};

class WorkerPool {
  constructor() {
    // Set to store all active worker processes.
    this.workerSet = new Set();
    // Map to store worker pools
    this.workerPools = new Map();
    // Queue to store tasks that need to be processed.
    this.pendingTasks = [];
    // Map to store callbacks associated with tasks.
    this.taskCallbacks = new Map();
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
      this.spawnWorkers(config.workerCount || 1, config.workerScript, config.poolName, config.workerMemoryLimit || 1);
    }
  }

  /**
   * Spawns worker processes.
   * @param {number} workerCount - The number of worker processes to spawn.
   * @param {string} workerJS_path - Path to the worker's JavaScript file.
   * @param {string} poolName - Name of the worker pool.
   * @param {string} memoryLimit - memory limit of the workers (--max-old-space-size)
   */
  spawnWorkers(workerCount = 2, workerScript, poolName = "default", memoryLimit = 4096) {
    // Initialize the pool if not already present
    if (!this.workerPools.has(poolName)) {
      this.workerPools.set(poolName, new Set());
    }

    for (let i = 0; i < workerCount; i++) {

      let execArgV = [];
      execArgV.push('--expose-gc');
      execArgV.push(`--max-old-space-size=${memoryLimit}`);
      const worker = fork(workerScript, [], { execArgv: execArgV });

      worker.poolName = poolName;
      worker.memoryLimit = memoryLimit;
      worker.workerScript = workerScript;
      worker.runningTasks = 0;

      worker.on("message", this.processWorkerMessage.bind(this, worker));
      worker.on("exit", this.manageWorkerExit.bind(this, worker, poolName));

      worker.send({ type: MESSAGE_TYPES.INIT });

      this.workerSet.add(worker);
      this.workerPools.get(poolName).add(worker);
    }
  }

  /**
   * Processes messages received from worker processes.
   * @param {Object} worker - The worker sending the message.
   * @param {Object} message - The actual message content.
   */
  processWorkerMessage(worker, message) {
    if (!message) return;

    switch (message.type) {
      case MESSAGE_TYPES.INIT_DONE: {
        console.log(`Worker initialized: poolName ${worker.poolName}, worker pid ${message.data.pid}, memoryLimit: ${worker.memoryLimit}, workerScript: ${worker.workerScript}`);
        break;
      }
      case MESSAGE_TYPES.WORK_DONE:
      case MESSAGE_TYPES.ERROR: {
        worker.runningTasks--;
        const callback = this.taskCallbacks.get(message.id);
        if (callback) {
          callback(message);
          this.taskCallbacks.delete(message.id);
        }
        this.processNextTask();
        break;
      }
    }
  }

  /**
   * Manages the exit events of worker processes.
   * @param {Object} exitedWorker - The worker that has exited.
   * @param {string} poolName - The pool the worker belongs to.
   * @param {number} code - The exit code.
   * @param {string} signal - The signal causing the exit.
   */
  manageWorkerExit(exitedWorker, code, signal, poolName = "default") {
    console.warn(
      `Worker ${exitedWorker.pid} exited with code ${code} and signal ${signal}`
    );
    this.workerSet.delete(exitedWorker);
    this.workerPools.get(poolName).delete(exitedWorker);

    if (code !== 0) {
      console.warn(`Restarting worker ${exitedWorker.pid}...`);
      this.spawnWorkers(1, poolName);
    }
  }

  /**
   * Processes the next task in the queue, if available.
   */
  processNextTask() {
    if (!this.pendingTasks.length) return;

    const { task, callback } = this.pendingTasks.shift();
    const workerPool = this.workerPools.get(task.poolName || "default") || this.workerSet;

    const leastBusyWorker = [...workerPool].reduce((a, b) =>
      a.runningTasks <= b.runningTasks ? a : b,
    );

    this.taskCallbacks.set(task.id, callback);
    leastBusyWorker.send(task);
    leastBusyWorker.runningTasks++;
  }

  /**
   * Adds a task to the queue for processing by worker processes.
   * @param {Object} task - The task to be added.
   * @param {Function} callback - The function to call once the task is processed.
   * @param {string} poolName - The worker pool that should execute the task.
   */
  addWorkerTask(task, callback, poolName = "default") {
    task.poolName = poolName;
    this.pendingTasks.push({ task, callback });
    this.processNextTask();
  }

  /**
   * Retrieves the status of all or specific pool of workers.
   * @param {string} poolName - Name of the worker pool to retrieve status for (optional).
   * @returns {Object} - Object containing the status of the workers.
   */
  async getWorkerStatus(poolName = null) {
    // Get workers from the specified pool, or all workers if no poolName is specified.
    const targetWorkers = poolName ? this.workerPools.get(poolName) : this.workerSet;

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
      ? this.workerPools.get(poolName)
      : this.workerSet;

    workersToTerminate.forEach((worker) => {
      worker.send({ type: MESSAGE_TYPES.TERMINATE });
      worker.on("exit", () => console.log(`Worker ${worker.pid} has exited.`));
    });
  }
}

module.exports = new WorkerPool();
