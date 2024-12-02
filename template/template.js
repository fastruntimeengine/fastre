import { load } from "cheerio";
import { existsSync, readFileSync, stat } from "fs";
import { config } from "../storage/global.js";
import { notfound } from "../default/defaults.js";
import { log } from "../modules/log.js";
import renderHTML from "./html.js";

export default async function render(path){
    let status, headers, body;

    if (!existsSync(path)){
        log(`[404] ${path} not found`, 'error');
        status = 404;
        headers = {"Content-Type": "text/html"}
        if (config.errors?.["404"]){
            render(config.errors["404"]);
        } else {
            body = notfound;
        }
    } else {
        body = readFileSync(path, 'utf-8');
    }

    body = await renderHTML(load(body));

    status = 200;
    headers = {};

    if (path.split('.').pop() === 'req'){
        headers["Content-Type"] = "application/json";
        try {
            body = body.replace(/<[^>]*>/g, '');
            if (/^\s*$/.test(body)){
                body = JSON.stringify({});
            } else {
                body = JSON.stringify(JSON.parse(body));
            }
        } catch (error) {
            log(`[500] ${path} didnot return valid JSON`, 'error');
            status = 500;
            body = JSON.stringify({error: "Internal Server Error"});
        }
    } else {
        headers["Content-Type"] = "text/html";
    }

    return [status, headers, body];
}