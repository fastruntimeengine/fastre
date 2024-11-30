import { load } from "cheerio";
import { appendCookie, appendData, data, removeData } from "../storage/unique.js";
import { packages } from "../storage/global.js";
import { log } from "../modules/log.js";
import bent from "bent";
import { performance } from 'perf_hooks';
import { autoType, isUrl, setType } from "../modules/type.js";
import { strRender } from "./string.js";
import condition from "./conditions.js";

export default async function renderHTML($){
    const tagsString = 'request, for, if, data, attr, cookie, ' + Object.keys(packages).join(", ");
    let tags = $(tagsString);
    while (tags.length > 0){

        const tag = tags.eq(0);
        const tagName = tag.get(0).tagName;

        if (tagName == "attr"){
            const id = $(tag).attr('id');
            const _class = $(tag).attr('class');
            const attr = $(tag).attr('attr');
            const val = $(tag).attr('val');
            const _eval = $(tag).attr('eval');
            const type = $(tag).attr('type');
            const cond = $(tag).attr('condition') || "true";
            let selector, value;

            if (id){
                selector = `#${id}`;
            } else if (_class){
                selector = _class.split(" ").join(".");
            } else {
                log(`Either id or class is required for attr tag`, 'error');
                $(tag).replaceWith("<span></span>");
                tags = $(tagsString);
                continue;
            }

            if (condition(cond)){
                if (val){
                    if (type) value = setType(type, val);
                    else value = autoType(val);
                } else if (_eval){
                    if (type) value = setType(type, strRender(_eval));
                    else value = autoType(strRender(_eval));
                }
                $(selector).attr(attr, value);
                $(tag).replaceWith("<span></span>");
            } else {
                $(tag).replaceWith("<span></span>");
            }

            tags = $(tagsString);
            continue;
        }

        if (tagName == "if"){
            const cond = $(tag).attr('condition');
            const elseBody = $(tag).find('else').last().html() || "<span></span>";

            if (cond){
                if (condition(cond)){
                    $(tag).find('else').last().replaceWith("<span></span>");
                    let body = await renderHTML(load(tag.html(), null, false));
                    body == "" || body == undefined ? $(tag).replaceWith("<span></span>") : $(tag).replaceWith(`${body}`);
                } else {
                    let body = await renderHTML(load(elseBody));
                    body == "" ? $(tag).replaceWith("<span></span>") : $(tag).replaceWith(`${body}`);
                }
            } else {
                log("If tag without condition", 'error');
                $(tag).replaceWith("<span></span>");
            }
                
            tags = $(tagsString);
            continue;
        }

        if (tagName == "request"){
            let url = $(tag).attr('to');
            const method = $(tag).attr('method') || 'GET';
            let headers = $(tag).attr('headers') || "";
            let rbody = null;

            if (!url){
                log("Request tag without url", 'error');
                $(tag).replaceWith("<span></span>");
                tags = $(tagsString);
                continue;
            }
            
            if (!isUrl(url)){
                url = strRender(url);
                if (!isUrl(url)){
                    log("Invalid URL", 'error');
                    $(tag).replaceWith("<span></span>");
                    tags = $(tagsString);
                    continue;
                }
            }
            
            try{
                rbody = $(tag).attr('body') ? JSON.parse($(tag).attr('body')) : "";
            } catch {
                rbody = strRender($(tag).attr('body'));
            }

            const id = $(tag).attr('id');
            let response;

            headers = headers.split(';').map(header => {
                const [key, value] = header.split(':');
                return {key, value};
            });

            try{
                log(`[OUT] [${method}] ${url} initiated`, 'info');
                performance.mark("B")
                const request = bent(url, method, 'json', 200);
                response = await request(rbody, headers)
                performance.mark("C")
                performance.measure('B to C', 'B', 'C');
                const time = performance.getEntriesByName('B to C')[0].duration.toFixed(2);
                performance.clearMeasures('B to C');
                log(`[OUT] [${method}] ${url} success in ${time}ms`, 'info');
                
            } catch (err){
                log(`[OUT] [${method}] ${url} failed`, 'error');
                log(err, 'error');
                $(tag).replaceWith("<span></span>");
                tags = $(tagsString)
                continue;
            }

            if (id){
                appendData(id, autoType(response));
            } else {
                appendData("inherit", autoType(response));
            }
    
            let tagBody = await renderHTML(load($(tag).html()), null, false);
            tagBody == "" ? $(tag).replaceWith(`<span></span>`) : $(tag).replaceWith(`${tagBody}`);
    
            if (!id) {
                removeData("inherit");
            }
            
            tags = $(tagsString)
            continue;
        }

        if (tagName == "data"){
            const id = $(tag).attr('id');
            let val = $(tag).attr('val');
            let  _eval= $(tag).attr('eval');
            const type = $(tag).attr('type');
            let keys = $(tag).attr('key') || "";

            keys = keys == "" ? [] : keys.split(" ")

            if (!id){
                log("Data tag without id", 'error');
                $(tag).replaceWith("<span></span>");
                tags = $(tagsString);
                continue;    
            } else if (val || _eval){
                if (val) type ? val = setType(type, val) : val = autoType(val);
                else type ? val = setType(type, strRender(_eval)) : val = autoType(strRender(_eval));
                appendData(id, val)
                $(tag).replaceWith("<span></span>");
                tags = $(tagsString);
                continue;
            } else if (!data[id]){
                if (id == "inherit"){
                    log(`No parent data found to inherit`, 'error');
                    $(tag).replaceWith("<span></span>");
                    tags = $(tagsString);
                    continue;
                } else {
                    log(`${id} is not defined`, 'error');
                    $(tag).replaceWith("<span></span>");
                    tags = $(tagsString);
                    continue;
                }
            } else {
                let v = data[id];
                if (keys.length > 0 ){
                    for (const key of keys) {
                        v = v[key]
                        if (v===undefined) break;
                    }
                }
                if (_eval) v = strRender(_eval, v);
                $(tag).replaceWith(typeof v === 'object' ? JSON.stringify(v, null, 2) : v.toString());
            }

            tags = $(tagsString)
            continue;
        }

        if (tagName == "for"){
            const id = tag.attr('id');
            const key = tag.attr('key') || "inherit";
            let body = tag.html();

            if (!id){
                log("For tag without id", 'error');
                tag.replaceWith("<span></span>");
                tags = $(tagsString);
                continue;
            }

            let val = strRender(id);

            if (!val){
                log(`${id} is not defined`, 'error');
                tag.replaceWith("<span></span>");
                tags = $(tagsString);
                continue;
            }

            if (Array.isArray(val)){
                let bodyHTML = "";
                for (const item of val){
                    appendData(key, item);
                    bodyHTML += await renderHTML(load(body, null, false));
                    removeData(key);
                }
                bodyHTML == "" ? $(tag).replaceWith("<span></span>") : $(tag).replaceWith(`${bodyHTML}`);
            } else {
                log(`${id} is not iterable`, 'error');
                $(tag).replaceWith("<span></span>");
            }

            tags = $(tagsString);
            continue;
        }

        if (tagName == "cookie"){
            const key = $(tag).attr('key');
            const val = $(tag).attr('val');
            const _eval = $(tag).attr('eval');
            const path = $(tag).attr('path');
            const domain = $(tag).attr('domain') || '';
            const secure = $(tag).attr('secure') || false;
            const expires = $(tag).attr('expires') || '';

            if (!key){
                log("Cookie tag without key", 'error');
            } else if (val){
                appendCookie(`${key}=${val};${path ? `Path=${path};` : ''}${domain ? `Domain=${domain};` : ''} ${secure ? `Secure;` : ''}${expires ? `Expires=${expires};` : ''}`)
            } else if (_eval){
                appendCookie(`${key}=${strRender(_eval)};${path ? `Path=${path};` : ''}${domain ? `Domain=${domain};` : ''}${secure ? `Secure;` : ''}${expires ? `Expires=${expires};` : ''}`)
            } else {
                log("No value or eval provided for cookie tag", 'error');
            }

            $(tag).replaceWith("<span></span>");
            tags = $(tagsString);
            continue;
        }

        //else if it is a tag in packages
        if (packages[tagName]){
            
            //import the package packages[tagName]
            const pkg = await import("file://" + new URL(packages[tagName]).href);
            const pkgFunc = pkg.default; //default export of the package

            let result = await pkgFunc(tag, strRender);
            $(tag).replaceWith(result);
            
            tags = $(tagsString);
            continue;
        }
        
        $(tag).replaceWith("<span></span>");
        tags = $(tagsString);
    }

    return $.html();
}