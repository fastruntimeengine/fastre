#!/usr/bin/env node
import boxen from 'boxen';
import chalk from 'chalk';
import { performance } from 'perf_hooks';

const v = '1.4.0';

console.log(
    boxen(chalk.hex("#04e1c3").bold(`FASTRE ${v}`), {
        padding: 1,
        margin: 1,
        borderStyle: 'double',
    })
);

performance.mark('start');

log('Starting FASTRE...', 'info');

//native
import http from 'http';
import minimist from 'minimist';

//modules
import {log, disableLogs} from './modules/log.js';
import configLoader from './modules/config.js';
import { serve } from './server/server.js';

//variables
const args = minimist(process.argv.slice(2));
import { config, appendConfig, clearConfig } from './storage/global.js';
import env from './modules/env.js';
import { loadPackages } from './modules/packages.js';

if (args.silent) disableLogs();

if (!args.config){
    log('Config file not provided', 'error');
    process.exit(1);
} else {
    log(`Using config file ${args.config}`, 'info');
    let config = configLoader(args.config);
    for (const key in config){
        appendConfig(key, config[key]);
    }
    env(config);
}

loadPackages();

const server = http.createServer(async (req, res) => {
    await serve(req, res)
});

server.on('error', (error) => {
    if (error.code === 'EADDRINUSE'){
        log(`Port ${config.port} is already in use`, 'error');
        process.exit(1);
    }
});

server.listen(config.port, () => {
    performance.mark('end');
    performance.measure('start to end', 'start', 'end');
    const started = performance.getEntriesByName('start to end')[0].duration.toFixed(2);
    log(`FASTRE has started successfully in ${started}ms`, 'success');
    log(`Listening on port ${config.port}`, 'info');
    console.log(chalk.blue.bold(`[INFO] Server running at http://localhost:${config.port} serving from ${config.dir}`));
});

server.on('close', () => {
    clearConfig();
});