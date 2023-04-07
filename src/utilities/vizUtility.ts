'use strict';

import {IValueFormatter, ValueFormatterOptions} from 'powerbi-visuals-utils-formattingutils/lib/src/valueFormatter';
import {valueFormatter} from 'powerbi-visuals-utils-formattingutils';

export class Formatter {
    private static _instance: Formatter = new Formatter();
    private _cachedFormatters: {} = {};

    constructor() {
        if (Formatter._instance) {
            console.log('Error: use Formatter.getInstance() instead of new.');
            return;
        }

        Formatter._instance = this;
    }

    public static getFormatter(properties: ValueFormatterOptions) {
        const singleton = Formatter._instance;

        const key = JSON.stringify(properties); //.replace(/\W/g,'_');
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

export function getLineStyleParam(lineStyle: string): string | null {
    switch (lineStyle) {
        case 'solid':
            return 'none';
        case 'dashed':
            return '5, 5';
        case 'dotted':
            return '1, 5';
    }

    return null;
}
