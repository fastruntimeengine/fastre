import { performance } from 'perf_hooks';
import { join } from "path";
import { log } from "../modules/log.js";
import { appendData, clearData, data } from "../storage/unique.js";
import { setCookies } from "./cookie.js";
import getParams from "./param.js";
import { config } from "../storage/global.js"
import serveStatic from "./static.js";
import render from '../template/template.js';
import { getEnv } from '../modules/env.js';
import getCookies from './cookie.js';
import bent from 'bent'; // Import BentJS

// TURNSTILE Middleware
async function verifyTurnstile(token) {
    const postJson = bent('https://challenges.cloudflare.com', 'POST', 'json', 200);
    const response = await postJson('/turnstile/v0/siteverify', {
        secret: data['env']['TURNSTILE_SECRET'],
        response: token,
    });

    return response.success;
}

export async function serve(req, res) {
    performance.mark('A');

    // Load env variables
    appendData('env', getEnv());

    const url = new URL(req.url, `http://${req.headers.host}`);
    
    if (url.pathname.endsWith('/')) {
        url.pathname += 'index.html';
    }

    const path = join(config.dir, url.pathname);
    let status, headers, body;

    log(`[IN] [${req.method}] ${req.url}`, 'info');

    if (! await getParams(req)) {
        log("Error parsing params", "error");
    }

    if (!getCookies(req)) {
        log("Error parsing cookies", "error");
    }

    let middleware = false;

    try {
        //MIDDLEWARE - TURNSTILE
        if (req.method === 'POST' && url.pathname === '/verify-turnstile') {
            middleware = true;
            const token = data['token'];

            if (!token) {
                status = 400;
                body = JSON.stringify({ success: false, message: 'Token is missing' });
            } else {
                const isValid = await verifyTurnstile(token);
                status = isValid ? 200 : 403;
                body = JSON.stringify({ success: isValid });
            }
            headers = { 'Content-Type': 'application/json' };
        }
        
        // Static file
        else if (!path.endsWith('.html') && !path.endsWith('.req')) {
            [status, headers, body] = await serveStatic(path);
        }

        // HTML file or req file
        else if (path.endsWith('.html') || path.endsWith('.req')) {
            [status, headers, body] = await render(path);
        }
    } catch (e) {
        status = 500;
        headers = {};
        body = 'Internal Server Error';
        log(e, 'error');
    }

    res = setCookies(res);

    res.writeHead(status, headers);
    res.end(body);
    if (!middleware) clearData();

    performance.mark('D');
    performance.measure('A to D', 'A', 'D');
    const timeTaken = performance.getEntriesByName('A to D')[0].duration.toFixed(2);
    performance.clearMeasures('A to D');
    
    (status == 200) ? log(`[IN] [${req.method}] ${req.url} took ${timeTaken}ms`, 'success') : log(`[IN] [${req.method}] ${req.url} took ${timeTaken}ms`, 'error');
}