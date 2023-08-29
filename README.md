# Node.js Worker Pool Management System

This project provides a system to manage worker processes in Node.js. 
It includes a main server that spawns and manages worker processes using a worker manager.

The system is designed to manage multiple worker pools (groups). 
Each worker pool can have multiple worker processes associated with it. 

When a task is sent to a specific worker pool, the worker manager assigns the task to the worker within that pool with the fewest currently running tasks. 
This ensures efficient load distribution among the workers.

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [API Endpoints](#api-endpoints)
- [Worker Processes](#worker-processes)
- [Worker Pool Management](#worker-pool-management)

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


