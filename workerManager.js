const { fork } = require("child_process");
const pidusage = require("pidusage");

// Define constants for message types to avoid typos and improve readability.
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
    // Map to store worker groups
    this.workerGroups = new Map();
    // Queue to store tasks that need to be processed.
    this.pendingTasks = [];
    // Map to store callbacks associated with tasks.
    this.taskCallbacks = new Map();
  }

  /**
   * Initialize worker processes.
   * @param {number} workerCount - Number of workers to initialize.
   */
  spawnWorkers(workerCount = 2, workerJS_path, group = "default") {
    // Initialize the group if not already present
    if (!this.workerGroups.has(group)) {
      this.workerGroups.set(group, new Set());
    }

    for (let i = 0; i < workerCount; i++) {
      const worker = fork(workerJS_path, [], {
        execArgv: ['--expose-gc']
      });

      worker.group = group;
      worker.runningTasks = 0;

      worker.on("message", this.processWorkerMessage.bind(this, worker));
      worker.on("exit", this.manageWorkerExit.bind(this, worker, group));

      worker.send({ type: MESSAGE_TYPES.INIT });

      this.workerSet.add(worker);
      this.workerGroups.get(group).add(worker);
    }
  }

  /**
   * Handle messages received from workers.
   * @param {Object} worker - The worker that sent the message.
   * @param {Object} message - The message received.
   */
  processWorkerMessage(worker, message) {
    if (!message) return;

    switch (message.type) {
      case MESSAGE_TYPES.INIT_DONE: {
        console.log(`workerGroup ${worker.group}, worker pid ${message.data.pid} initialized`);
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
   * Handle worker exit events.
   * @param {Object} exitedWorker - The worker that exited.
   * @param {number} code - Exit code.
   * @param {string} signal - Signal that caused the exit.
   */
  manageWorkerExit(exitedWorker, code, signal, group = "default") {
    console.warn(
      `Worker ${exitedWorker.pid} exited with code ${code} and signal ${signal}`
    );
    this.workerSet.delete(exitedWorker);
    this.workerGroups.get(group).delete(exitedWorker);

    if (code !== 0) {
      console.warn(`Restarting worker ${exitedWorker.pid}...`);
      this.spawnWorkers(1, group);
    }
  }
  /**
   * Execute the next task in the queue.
   */
  processNextTask() {
    if (!this.pendingTasks.length) return;

    const { task, callback } = this.pendingTasks.shift();
    const workerGroup = this.workerGroups.get(task.group || "default") || this.workerSet;

    const leastBusyWorker = [...workerGroup].reduce((a, b) =>
      a.runningTasks <= b.runningTasks ? a : b,
    );

    this.taskCallbacks.set(task.id, callback);
    leastBusyWorker.send(task);
    leastBusyWorker.runningTasks++;
  }

  /**
   * Add a task to the worker task queue.
   * @param {Object} task - The task to be processed.
   * @param {Function} callback - Callback to be executed once the task is done.
   */
  addWorkerTask(task, callback, group = "default") {
    task.group = group;
    this.pendingTasks.push({ task, callback });
    this.processNextTask();
  }

  /**
   * Get the status of all workers.
   * @returns {Object} - An object containing the status of all workers.
   */
  async getWorkerStatus(workerGroup = null) {
    // Get workers from the specified group, or all workers if no group is specified.
    const targetWorkers = workerGroup ? this.workerGroups.get(workerGroup) : this.workerSet;

    const workers = await Promise.all(
      [...targetWorkers].map(async (worker) => {
        try {
          const stats = await pidusage(worker.pid);
          return { group: worker.group, pid: worker.pid, runningTasks: worker.runningTasks, stats };
        } catch (err) {
          return null;
        }
      }),
    );

    return { workers: workers.filter(Boolean) };
  }

  /**
   * Terminate all workers.
   */
  terminateWorkers(group = null) {
    const workersToTerminate = group
      ? this.workerGroups.get(group)
      : this.workerSet;

    workersToTerminate.forEach((worker) => {
      worker.send({ type: MESSAGE_TYPES.TERMINATE });
      worker.on("exit", () => console.log(`Worker ${worker.pid} has exited.`));
    });
  }
}

module.exports = new WorkerPool();
