import { log } from "../modules/log.js";
import { data } from "../storage/unique.js";

function get(url){
    let params = url.split('?')[1];
    if (!params) return {};
    params = params.split('&');
    params.forEach(param => {
        let [key, value] = param.split('=');
        data[key] = value;
    });
    return true;
}

function post(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            if (body) {
                try {
                    let parsed = {};

                    // Check the content type of the request
                    if (req.headers['content-type'] === 'application/json') {
                        // Parse JSON body
                        parsed = JSON.parse(body);
                    } else if (req.headers['content-type'] === 'application/x-www-form-urlencoded') {
                        // Parse URL-encoded form data
                        parsed = Object.fromEntries(new URLSearchParams(body).entries());
                    } else {
                        throw new Error('Unsupported content type');
                    }

                    // Process all parsed data and merge it with global data object
                    for (const key of Object.keys(parsed)) {
                        data[key] = parsed[key];
                    }

                    resolve(true);
                } catch (err) {
                    log('Invalid input data', 'error');
                    reject(err);
                }
            } else {
                resolve(true); // No body provided, resolve without processing
            }
        });

        req.on('error', err => {
            log('Request error', 'error');
            reject(err);
        });
    });
}


export default async function getParams(req) {
    try {
        const method = req.method;
        const url = req.url;
        const params = method === 'GET' ? get(url) : await post(req);
        return params;
    } catch (err) {
        log('Failed to parse request parameters', 'error');
        return false;
    }
}