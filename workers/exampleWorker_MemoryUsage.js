// Define constants for message types.
const MESSAGE_TYPES = {
  INIT: "init",
  WORK: "work",
  TERMINATE: "terminate",
  INIT_DONE: "initDone",
  WORK_DONE: "workDone",
  ERROR: "error",
};

// Event listener for incoming messages from the main process.
process.on("message", async (task) => {
  try {
    await processTask(task);
  } catch (err) {
    reportError(task, err);
  }
});

/**
 * Handle incoming tasks based on their type.
 * @param {Object} task - The incoming task.
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
 * Handle errors that occur during task processing.
 * @param {Object} task - The task that caused the error.
 * @param {Error} err - The error that occurred.
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
  // Set up listeners for unhandled errors and rejections.
  process.on("uncaughtException", (err) => {
    console.error(`Uncaught exception in worker ${process.pid}:`, err);
  });

  process.on("unhandledRejection", (reason) => {
    console.error(
      `Unhandled promise rejection in worker ${process.pid}:`,
      reason,
    );
  });

  return { pid: process.pid };
}

/**
 * @param {Object} task - The task to process.
 * @returns {string} - A message indicating the work is done.
 */
async function work(task) {
  if (task) {
    //Simulate some work
    await simulateMemoryUsage(task.data.mb, task.data.duration)
    //throw new Error('This is a test error.');
  }
  return task;
}

async function simulateMemoryUsage(mb, duration) {
  const sizePerChunk = (mb * 1024 * 1024) / 10;  // Divide total bytes by 10 to get size per chunk

  const memoryChunks = [];

  for (let j = 0; j < 10; j++) {
    const buffer = Buffer.alloc(sizePerChunk);
    buffer.fill(0);
    memoryChunks.push(buffer);
  }

  await new Promise(resolve => setTimeout(resolve, duration));

  memoryChunks.length = 0; // Clear the main array
  if (typeof global.gc === 'function') {
    global.gc(); // Force garbage collection (requires --expose-gc flag when starting Node)
  }
}