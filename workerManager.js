const { fork } = require("child_process"); // The 'child_process' module provides the ability to spawn subprocesses. The 'fork' method is a special case of 'spawn' that spawns a new instance of the V8 engine. 
const pidusage = require("pidusage"); // 'pidusage' is a library that provides information about the resource usage (CPU and memory) of a process based on its PID (Process ID). 

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
    // Map to store worker groups
    this.workerGroups = new Map();
    // Queue to store tasks that need to be processed.
    this.pendingTasks = [];
    // Map to store callbacks associated with tasks.
    this.taskCallbacks = new Map();
  }

  /**
   * Spawns worker processes.
   * @param {number} workerCount - The number of worker processes to spawn.
   * @param {string} workerJS_path - Path to the worker's JavaScript file.
   * @param {string} group - Name of the worker group.
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
   * Processes messages received from worker processes.
   * @param {Object} worker - The worker sending the message.
   * @param {Object} message - The actual message content.
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
   * Manages the exit events of worker processes.
   * @param {Object} exitedWorker - The worker that has exited.
   * @param {string} group - The group the worker belongs to.
   * @param {number} code - The exit code.
   * @param {string} signal - The signal causing the exit.
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
   * Processes the next task in the queue, if available.
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
   * Adds a task to the queue for processing by worker processes.
   * @param {Object} task - The task to be added.
   * @param {Function} callback - The function to call once the task is processed.
   * @param {string} group - The group the task belongs to.
   */
  addWorkerTask(task, callback, group = "default") {
    task.group = group;
    this.pendingTasks.push({ task, callback });
    this.processNextTask();
  }

  /**
   * Retrieves the status of all or specific group of workers.
   * @param {string} workerGroup - The group of workers to retrieve status for.
   * @returns {Object} - Object containing the status of the workers.
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
   * Terminates all workers or a specific group of workers.
   * @param {string} group - The group of workers to terminate.
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
