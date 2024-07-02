import { load } from "cheerio";
import { appendCookie, appendData, data, removeData } from "../storage/unique.js";
import { log } from "../modules/log.js";
import bent from "bent";
import { performance } from 'perf_hooks';
import { autoType, isUrl, setType } from "../modules/type.js";
import { strRender } from "./string.js";
import condition from "./conditions.js";

//let requests = $('request');
async function requestTag(tag) {
    const request = tag;
    let url = request.attr('to');
    const method = request.attr('method') || 'GET';
    let headers = request.attr('headers') || "";
    let rbody = null;

    //chck if url is valid or not
    if (!url){
        log("Request tag without url", 'error');
        request.replaceWith("<span></span>");
        return;
    }

    //if it is not a valid url, strRender it
    if (!isUrl(url)){
        url = strRender(url);
        if (!isUrl(url)){
            log("Invalid URL", 'error');
            request.replaceWith("<span></span>");
            return;
        }
    }

    try{
        rbody = request.attr('body') ? JSON.parse(request.attr('body')): "";
    } catch {
        log(`[OUT] [${method}] ${url} failed`, 'error');
        log("Invalid JSON", 'error');
        request.replaceWith("<span></span>");
        return;
    }

    const id = request.attr('id');
    let response;
    
    //parse headers
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
        request.replaceWith("<span></span>");
        return;
    }

    if (id){
        appendData(id, autoType(response));
    } else {
        appendData("inherit", autoType(response));
    }

    let tagBody = await renderHTML(load(request.html()), null, false);
    tagBody == "" ? request.replaceWith(`<span></span>`) : request.replaceWith(`${tagBody}`);

    if (!id) {
        removeData("inherit");
    }
}

//for loop tag
//let fortag = $('for');
async function forTag(tag) {
    const id = tag.attr('id');
    const key = tag.attr('key') || "inherit";
    let body = tag.html();

    if (!id){
        log("For tag without id", 'error');
        tag.replaceWith("<span></span>");
        return;
    }

    let val = strRender(id);

    if (!val){
        log(`${id} is not defined`, 'error');
        tag.replaceWith("<span></span>");
        return;
    }

    if (Array.isArray(val)){
        let bodyHTML = "";
        for (const item of val){
            appendData(key, item);
            bodyHTML += await renderHTML(load(body, null, false));
            removeData(key);
        }
        bodyHTML == "" ? tag.replaceWith("<span></span>") : tag.replaceWith(`${bodyHTML}`);
    } else {
        log(`${id} is not iterable`, 'error');
        tag.replaceWith("<span></span>");
    }
}

//if condition tag
//let iftag = $('if');
async function ifTag(iftag){
    const cond = iftag.attr('condition');
    const elseBody = iftag.find('else').last().html() || "<span></span>";
    if (cond){
        if (condition(cond)){
            iftag.find('else').last().replaceWith("<span></span>");
            let body = await renderHTML(load(iftag.html(), null, false));
            body == "" ? iftag.replaceWith("<span></span>") : iftag.replaceWith(`${body}`);
        } else {
            let body = await renderHTML(load(elseBody, null, false));
            body == "" ? iftag.replaceWith("<span></span>") : iftag.replaceWith(`${body}`);
        }
    } else {
        log("If tag without condition", 'error');
        iftag.replaceWith("<span></span>");
    }
}

//const dataTags = $('data');
async function dataTag(tag) {
    const id = tag.attr('id');
    let val = tag.attr('val');
    let  _eval= tag.attr('eval');
    const type = tag.attr('type');
    let keys = tag.attr('key') || "";

    keys = keys == "" ? [] : keys.split(" ")

    if (!id){
        log("Data tag without id", 'error');
        return
    } else if (val || _eval){
        if (val) type ? val = setType(type, val) : val = autoType(val);
        else type ? val = setType(type, strRender(_eval)) : val = autoType(strRender(_eval));
        appendData(id, val)
        tag.replaceWith("<span></span>");
        return
    } else if (!data[id]){
        if (id == "inherit"){
            log(`No parent data found to inherit`, 'error');
            return
        } else {
            log(`${id} is not defined`, 'error');
            return
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
        tag.replaceWith(typeof v === 'object' ? JSON.stringify(v, null, 2) : v.toString());
    }
}

//const setAttr = $('attr');
async function attrTag(tag, $) {
    const id = tag.attr('id');
    const _class = tag.attr('class');
    const attr = tag.attr('attr');
    const val = tag.attr('val');
    const _eval = tag.attr('eval');
    const type = tag.attr('type');
    const cond = tag.attr('condition') || "true";
    let selector, value;
    
    if (id){
        selector = `#${id}`;
    } else if (_class){
        selector = _class.split(" ").join(".");
    } else {
        log(`Either id or class is required for attr tag`, 'error');
        return
    }

    if (val){
        if (type) value = setType(type, val);
        else value = autoType(val);
    } else if (_eval){
        if (type) value = setType(type, strRender(_eval));
        else value = autoType(strRender(_eval));
    }

    if (condition(cond)){
        $(selector).attr(attr, value);
        tag.replaceWith("<span></span>");
    } else {
        tag.replaceWith("<span></span>");
    }
}

//const setCookie = $('cookie');
async function cookieTag(tag) {
    const key = tag.attr('key');
    const val = tag.attr('val');
    const _eval = tag.attr('eval');
    const path = tag.attr('path');
    const domain = tag.attr('domain') || '';
    const secure = tag.attr('secure') || false;
    const expires = tag.attr('expires') || '';

    if (!key){
        log("Cookie tag without key", 'error');
        return
    } else if (val){
        appendCookie(`${key}=${val};${path ? `Path=${path};` : ''}${domain ? `Domain=${domain};` : ''} ${secure ? `Secure;` : ''}${expires ? `Expires=${expires};` : ''}`)
    } else if (_eval){
        appendCookie(`${key}=${strRender(_eval)};${path ? `Path=${path};` : ''}${domain ? `Domain=${domain};` : ''}${secure ? `Secure;` : ''}${expires ? `Expires=${expires};` : ''}`)
    } else {
        log("No value or eval provided for cookie tag", 'error');
    }

    tag.replaceWith("<span></span>");
}

export default async function renderHTML($) {
    let tags = $('*');
    let i = 0;
  
    while (i < tags.length) {
        const tag = $(tags[i]);
        const tagName = tag.prop('tagName').toLowerCase();
  
        switch (tagName) {
            case 'request':
                await requestTag(tag);
                break;
            case 'for':
                await forTag(tag);
                break;
            case 'if':
                await ifTag(tag);
                break;
            case 'data':
                dataTag(tag);
                break;
            case 'attr':
                attrTag(tag, $);
                break;
            case 'cookie':
                cookieTag(tag);
                break;
            default:
                break;
        }

        tags = $('*');
        i++;
    }

    return $.html();
}