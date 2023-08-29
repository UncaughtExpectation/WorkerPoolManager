# Node.js Worker Pool Management

This Node.js application demonstrates the organization and management of child processes, referred to as "workers", within dedicated pools. 
Unlike the native child-process module in Node.js, this application provides callback handling for these child processes.

The design facilitates the clear definition and grouping of processes based on specific requirements. 
The architecture is built for extensibility, making it easy to add new workers and expand core functionalities.

When a task is dispatched to a given worker pool, the worker manager allocates it to the worker with the fewest active tasks, ensuring load balancing.

For testing and simulating worker load distribution, two HTTP endpoints are included. 
Each endpoint triggers workloads in different worker pools.



## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [API Endpoints](#api-endpoints)
- [Worker Processes](#worker-processes)

## Installation

1. Ensure you have Node.js installed.
2. Clone the repository.
3. Install the required packages:

\```bash
npm install
\```

## Usage

To start the server:

\```bash
node app.js
\```

## API Endpoints

### 1. CPU Load Worker

**Endpoint**: `POST /exampleWorker/CPULoad`

**Description**: Sends a task to the example worker pool 'CPU'.

**Payload**: 
- `duration`: Duration in milliseconds for which CPU load should be simulated.

**Example**:

\```bash
curl -X POST http://localhost:3000/exampleWorker/CPULoad \
     -H "Content-Type: application/json" \
     -d '{"duration":3000}'
\```

### 2. Memory Usage Worker

**Endpoint**: `POST /exampleWorker/MemoryUsage`

**Description**: Sends a task to the example worker pool 'MEM'.

**Payload**: 
- `duration`: Duration in milliseconds for which memory should be allocated.
- `mb`: Amount of memory in megabytes to allocate.

**Example**:

\```bash
curl -X POST http://localhost:3000/exampleWorker/MemoryUsage \
     -H "Content-Type: application/json" \
     -d '{"duration":3000, "mb":300}'
\```

## Worker Processes

### 1. CPU Load Worker (`exampleWorker_CPULoad.js`)

This worker simulates CPU load for a given duration.

### 2. Memory Usage Worker (`exampleWorker_MemoryUsage.js`)

This worker simulates memory usage by allocating specified memory for a given duration.


