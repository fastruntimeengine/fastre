import { log } from "./log.js";

export function setType(type, str){
    if (type == "string"){
        return str;
    } else if (type == "number"){
        if (isNaN(str)){
            log(`Invalid number: ${str}`, 'error');
            return 0;
        }
        return Number(str);
    } else if (type == "boolean"){
        if (str == "true"){
            return true;
        } else if (str == "false"){
            return false;
        } else {
            log(`Invalid boolean: ${str}`, 'error');
            return false;
        }
    } else if (type == "object"){
        try {
            return JSON.parse(str);
        } catch (error) {
            log(`Invalid object: ${str}`, 'error');
            return {};
        }
    }
    log(`Invalid type: ${type}`, 'error');
    return str;
}

export function autoType(val){
    if (typeof val == "string"){
        if (val == "true"){
            return true;
        } else if (val == "false"){
            return false;
        } else if (!isNaN(val)){
            return Number(val);
        } else {
            try {
                return JSON.parse(val);
            } catch (error) {
                return val;
            }
        }
    } else {
        return val;
    }
}

export function getType(val){
    if (typeof val == "string"){
        if (val == "true" || val == "false"){
            return "boolean";
        } else if (!isNaN(val)){
            return "number";
        } else {
            try {
                JSON.parse(val);
                return "object";
            } catch (error) {
                return "string";
            }
        }
    } else {
        return typeof val;
    }
}