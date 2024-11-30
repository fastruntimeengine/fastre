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
                    const parsed = JSON.parse(body);
                    for (const key of Object.keys(parsed)) {
                        data[key] = parsed[key];
                    }
                    resolve(true);
                } catch (err) {
                    log('Invalid JSON', 'error');
                    reject(err);
                }
            } else {
                resolve(true);
            }
        });
        req.on('error', err => {
            log('Request error', 'error');
            reject(err);
        });
    });
}

export default async function getParams(req) {
    const method = req.method;
    const url = req.url;
    const params = method === 'GET' ? get(url) : await post(req);
    return params;
}