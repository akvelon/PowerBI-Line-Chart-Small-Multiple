"use strict";

import {IValueFormatter, ValueFormatterOptions} from "powerbi-visuals-utils-formattingutils/lib/src/valueFormatter";
import {valueFormatter} from "powerbi-visuals-utils-formattingutils";

export class Formatter {
    private static _instance: Formatter = new Formatter();
    private _cachedFormatters: {} = {};

    constructor() {
        if (Formatter._instance) {
            console.log("Error: use Formatter.getInstance() instead of new.");
            return;
        }

        Formatter._instance = this;
    }

    public static getFormatter(properties: ValueFormatterOptions) {
        let singleton = Formatter._instance;

        let key = JSON.stringify(properties); //.replace(/\W/g,'_');
        let pbiFormatter: IValueFormatter;
        if (key in singleton._cachedFormatters) {
            pbiFormatter = singleton._cachedFormatters[key];
        } else {
            pbiFormatter = valueFormatter.create(properties);
            singleton._cachedFormatters[key] = pbiFormatter;
        }

        return pbiFormatter;
    }
}

export function getLineStyleParam(lineStyle: string): string {
    let strokeDasharray: string;

    switch (lineStyle) {
        case "solid":
            strokeDasharray = "none";
            break;
        case "dashed":
            strokeDasharray = "5, 5";
            break;
        case "dotted":
            strokeDasharray = "1, 5";
            break;
    }

    return strokeDasharray;
}

//         export function isValidURL(URL: string) {
//
//             if (typeof URL === 'undefined' || !URL) return false;
//             if (URL.length > 2083) return false;
//
//             let pattern = new RegExp('^https?:\\/\\/', 'i');
//             return pattern.test(URL);
//
//             /*
//             let pattern = new RegExp('^(https?:\\/\\/)?' + // protocol
//                 '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.?)+[a-z]{2,}|' + // domain name
//                 '((\\d{1,3}\\.){3}\\d{1,3}))' + // OR ip (v4) address
//                 '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // port and path
//                 '(\\?[;&a-z\\d%_.~+=-]*)?' + // query string
//                 '(\\#[-a-z\\d_]*)?$', 'i'); // fragment locator
//             return pattern.test(URL);
//             */
//         }
//
//         export function makeMeasureReadable(value: any) {
//
//             if (value === undefined) {
//                 return '(Blank)';
//             } else if (Object.prototype.toString.call(value) === '[object Date]') {
//                return value;
//             } else if (isValidURL(value)) {
//                 return makeURLReadable(value);
//             } else {
//                 return String(value).substr(0, 256);
//             }
//         };
//
//         export function makeURLReadable(URL: string) {
//             let returnName = URL;
//             if (returnName) {
//                 let parts = String(returnName).split(/[\\/.]/).slice(-2, -1);
//                 if (parts.length > 0)
//                     returnName = parts[0].replace('_', ' ').replace('-', ' ');
//             }
//             return returnName;
//         }

