// Constants for different message types.
const MESSAGE_TYPES = {
  INIT: "init",
  WORK: "work",
  TERMINATE: "terminate",
  INIT_DONE: "initDone",
  WORK_DONE: "workDone",
  ERROR: "error",
};

// Listen for messages from the main process.
process.on("message", async (task) => {
  try {
    await processTask(task);
  } catch (err) {
    reportError(task, err);
    throw err;
  }
});

/**
 * Processes incoming tasks based on their type.
 * @param {Object} task - The task to be processed.
 */
async function processTask(task) {
  let response = {
    ok: true,
    data: {},
    id: task.id,
  };

  switch (task.type) {
    case MESSAGE_TYPES.INIT:
      response.data = init();
      response.type = MESSAGE_TYPES.INIT_DONE;
      break;
    case MESSAGE_TYPES.WORK:
      response.data = await work(task);
      response.type = MESSAGE_TYPES.WORK_DONE;
      break;
    case MESSAGE_TYPES.TERMINATE:
      process.exit(0);
      return; // Exit immediately without sending a response.
    default:
      console.error(
        `WorkerProcess ${process.pid}: Unknown task type: ${task.type}`,
      );
      return;
  }

  // Send the response back to the main process.
  process.send(response);
}

/**
 * Reports errors encountered during task processing.
 * @param {Object} task - The task that triggered the error.
 * @param {Error} err - The encountered error.
 */
function reportError(task, err) {
  console.error(`WorkerProcess ${process.pid}: ${err.message}`);
  process.send({
    ok: false,
    id: task.id,
    data: err.message,
    type: MESSAGE_TYPES.ERROR,
  });
}

/**
 * Initialize the worker and set up error listeners.
 * @returns {Object} - An object containing the worker's PID.
 */
function init() {
  return { pid: process.pid };
}


/**
 * Processes a given task.
 * @param {Object} task - The task to be processed.
 * @returns {Object} - The processed task.
 */
async function work(task) {
  if (task) {
    //Simulate some work
    await generateCPULoad(task.data.duration)
    //throw new Error('This is a test error.');
  }
  return task;
}

/**
 * Simulates CPU load for a given duration.
 * @param {number} ms - Duration in milliseconds.
 */
async function generateCPULoad(ms = 2000) {
  const start = performance.now();
  const end = start + ms;
  while (performance.now() < end) {
    // Keep the CPU busy
  }
}
