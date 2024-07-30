import {isAbsolute, resolve} from 'path';
import {readFileSync} from 'fs';
import {log} from './log.js';

var loaded = {};

//load environment variables

export default function env(config){
    let vars = {};
    if(config.env){
        if(isAbsolute(config.env)){
            config.env = resolve(config.env);
        } else {
            config.env = resolve(config.dir, config.env);
        }

        log(`Loading env file ${config.env}`, 'info');

        try {
            vars = JSON.parse(readFileSync(config.env));
        } catch (error) {
            log('Failed to load env file', 'error');
            log(error, 'error');
            process.exit(1);
        }
    }

    vars = {...process.env, ...vars};

    //load env variables into loaded
    for (const key in vars){
        loaded[key] = vars[key];
    }
}

export function getEnv(){
    return loaded;
}