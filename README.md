# Node.js WorkerPoolManager

This repository demonstrates the organization and management of NodeJS child processes, referred to as "workers", within dedicated pools. It provides callback handling and load balancing. The config/default.json includes a working configuration for two different worker pools to test over provided http endpoints.

The `examples/example_node_red_flow.json` file provides a Node-RED flow to send example requests to the server.

### Features

- **Worker Pools**: Organize workers into dedicated pools.
- **One-shot Workers**: Execute tasks in one-shot processes that terminate after task completion.
- **HTTP Endpoints**:
  - `/example/pool`: Dispatch tasks to workers in a pool.
  - `/example/oneShot`: Execute tasks in one-shot processes.

### Installation

1. Ensure you have Node.js installed.
2. Clone the repository.
3. Run `npm install` to install the required dependencies.
4. Start the server using `node app.js`.


### Examples

#### Example Worker Pools

The configuration file (`config/default.json`) has two predefined worker pools:

1. **CPU Worker Pool**:
   - **Pool Name**: CPU
   - **Worker Script**: `./workers/exampleWorker_CPULoad.js`
   - **Worker Count**: 2
   - **Memory Limit**: 4048 MB

2. **Memory Worker Pool**:
   - **Pool Name**: MEM
   - **Worker Script**: `./workers/exampleWorker_MemoryUsage.js`
   - **Worker Count**: 2
   - **Memory Limit**: 4048 MB

###### `./workers/exampleWorker_CPULoad.js` This worker script simulates CPU load for a given duration.
###### `./workers/exampleWorker_MemoryUsage.js` This worker script simulates memory usage of a given amount for a given duration.

#### Dispatching Tasks to the Example Worker Pools
##### Send a POST request to `/example/pool` with the following payload:
     {
       "poolName": "<Name of the worker pool>",
       "workerTask": {<Task data>}
     }
##### Example Requests
###### Generate CPU usage
     {
       "poolName": "CPU",
       "workerTask": { "duration": 3000 }
     }
###### Generate Memory usage
     {
       "poolName": "MEM",
       "workerTask": { "duration": 3000, "mb": 300 }
     }
     
#### Dispatching Tasks for One-Shot Workers
##### Send a POST request to `/example/oneShot` with the following payload:
    {
      "workerScript": "<Path to the worker's JavaScript file>",
      "workerTask": {<Task data>},
      "workerMemoryLimit": "<Memory limit in MB, optional, default 4096 MB>"
    }  
##### Example Requests
###### Generate CPU usage
     {
       "workerScript": "./workers/exampleWorker_CPULoad.js",
       "workerTask": { "duration": 3000 },
       "workerMemoryLimit": 2048
     }
###### Generate Memory usage
     {
       "workerScript": "./workers/exampleWorker_MemoryUsage.js",
       "workerTask": { "duration": 3000, "mb": 300 },
       "workerMemoryLimit": 4096
     }
