# Node.js WorkerPoolManager

This repository demonstrates the organization and management of child processes, referred to as "workers", within dedicated pools. It provides callback handling and load balancing.

The `examples/example_node_red_flow.json` file provides a Node-RED flow to send example requests to the server.

## Features

- **Worker Pools**: Organize workers into dedicated pools.
- **One-shot Workers**: Execute tasks in one-shot processes that terminate after task completion.
- **HTTP Endpoints**:
  - `/example/pool`: Dispatch tasks to workers in a pool.
  - `/example/oneShot`: Execute tasks in one-shot processes.

## Installation

1. Ensure you have Node.js installed.
2. Clone the repository.
3. Run `npm install` to install the required dependencies.
4. Start the server using `node app.js`.

## Default Worker Pools

The configuration file (`config/default.json`) has two predefined worker pools:

1. **CPU Worker Pool**:
   - **Pool Name**: CPU
   - **Worker Script**: `./workers/exampleWorker_CPULoad.js`
   - **Worker Count**: 1
   - **Memory Limit**: 4048 MB

2. **Memory Worker Pool**:
   - **Pool Name**: MEM
   - **Worker Script**: `./workers/exampleWorker_MemoryUsage.js`
   - **Worker Count**: 1
   - **Memory Limit**: 4048 MB


## Dispatching Tasks to Worker Pools

Send a POST request to `/example/pool` with the following body:

```json
{
  "poolName": "<Name of the worker pool>",
  "workerTask": "<Task data>"
}
```

### Dispatching Tasks to One-shot Processes

Send a POST request to `/example/oneShot` with the following body:

```json
{
  "workerScript": "<Path to the worker's JavaScript file>",
  "workerMemoryLimit": "<Memory limit in MB, optional, default 4096 MB>",
  "workerTask": "<Task data>"
}
```

### Example Workers

1. **CPU Load Worker** (`./workers/exampleWorker_CPULoad.js`): This worker simulates CPU load for a given duration. The main function is `generateCPULoad(ms)` where `ms` is the duration in milliseconds.

2. **Memory Usage Worker** (`./workers/exampleWorker_MemoryUsage.js`): This worker simulates memory usage of a given amount for a given duration. The main function is `simulateMemoryUsage(mb, duration)` where `mb` is the memory amount in MB and `duration` is the duration in milliseconds.

### Example Requests


**CPU Worker Pool Request**:
   - **Endpoint**: `/example/pool`
   - **Payload**:
     ```json
     {
       "workerTask": { "duration": 3000 },
       "poolName": "CPU"
     }
     ```

**Memory Worker Pool Request**:
   - **Endpoint**: `/example/pool`
   - **Payload**:
     ```json
     {
       "workerTask": { "duration": 3000, "mb": 300 },
       "poolName": "MEM"
     }
     ```

**One-shot Worker Request (CPU Load)**:
   - **Endpoint**: `/example/oneShot`
   - **Payload**:
     ```json
     {
       "workerTask": { "duration": 3000 },
       "workerScript": "./workers/exampleWorker_CPULoad.js"
     }
     ```

**One-shot Worker Request (Memory Usage)**:
   - **Endpoint**: `/example/oneShot`
   - **Payload**:
     ```json
     {
       "workerTask": { "duration": 3000, "mb": 300 },
       "workerScript": "./workers/exampleWorker_MemoryUsage.js",
       "workerMemoryLimit": 4096
     }
     ```
