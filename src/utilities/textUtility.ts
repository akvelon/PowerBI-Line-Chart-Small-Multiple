import {select as d3select} from 'd3-selection';

export interface TextProperties {
    text?: string;
    fontFamily: string;
    fontSize: string;
    fontWeight?: string;
    fontStyle?: string;
    fontVariant?: string;
    whiteSpace?: string;
}

let canvasCtx: CanvasRenderingContext2D | null;
const ellipsis = '...';

function ensureCanvas() {
    if (canvasCtx)
        return;
    const canvas: HTMLCanvasElement = document.createElement('canvas');
    canvasCtx = canvas.getContext('2d');
}

/**
 * Measures text width at a high speed using a canvas element
 * @param textProperties The text properties (including text content) to use for text measurement.
 */
export function measureTextWidth(textProperties: TextProperties): number {
    ensureCanvas();
    if (!canvasCtx || !textProperties.text) {
        return 0;
    }

    canvasCtx.font =
        (textProperties.fontStyle || '') + ' ' +
        (textProperties.fontVariant || '') + ' ' +
        (textProperties.fontWeight || '') + ' ' +
        textProperties.fontSize + ' ' +
        (textProperties.fontFamily);
    return canvasCtx.measureText(textProperties.text).width;
}

/**
 * Compares labels text size to the available size and renders ellipses when the available size is smaller.
 * @param textProperties The text properties (including text content) to use for text measurement.
 * @param maxWidth The maximum width available for rendering the text.
 */
export function getTailoredTextOrDefault(textProperties: TextProperties, maxWidth: number): string {
    ensureCanvas();
    if (!textProperties.text) {
        return '';
    }

    const strLength = textProperties.text.length;
    if (strLength === 0)
        return textProperties.text;
    let width = measureTextWidth(textProperties);
    if (width < maxWidth)
        return textProperties.text;
    // Create a copy of the textProperties so we don't modify the one that's passed in.
    const copiedTextProperties: TextProperties = Object.create(textProperties);
    // Take the properties and apply them to svgTextElement
    // Then, do the binary search to figure out the substring we want
    // Set the substring on textElement argument
    const text = copiedTextProperties.text = ellipsis + copiedTextProperties.text;
    let min = 1;
    let max = text.length;
    let i = ellipsis.length;
    while (min <= max) {
        // num | 0 prefered to Math.floor(num) for performance benefits
        i = (min + max) / 2 | 0;
        copiedTextProperties.text = text.substr(0, i);
        width = measureTextWidth(copiedTextProperties);
        if (maxWidth > width)
            min = i + 1;
        else if (maxWidth < width)
            max = i - 1;
        else
            break;
    }
    // Since the search algorithm almost never finds an exact match,
    // it will pick one of the closest two, which could result in a
    // value bigger with than 'maxWidth' thus we need to go back by
    // one to guarantee a smaller width than 'maxWidth'.
    copiedTextProperties.text = text.substr(0, i);
    width = measureTextWidth(copiedTextProperties);
    if (width > maxWidth)
        i--;
    return text.substr(ellipsis.length, i - ellipsis.length) + ellipsis;
}

export function truncateAxis(text, width, textProperties?: TextProperties) {
    text.each(function () {
        const text = d3select(this);
        const title = text.text();
        const truncatedText = getTailoredTextOrDefault({
            text: title,
            fontFamily: (textProperties ? textProperties.fontFamily : 'sans-serif'),
            fontSize: (textProperties ? textProperties.fontSize : '11px'),
        }, width);
        text.text(truncatedText);
        text.append('title').text(title);
    });
}

export function wrapAxis(text, width, textProperties?: TextProperties, notEnclose?: boolean) {
    text.each(function () {
        const text = d3select(this);
        const title = text.text();
        const newText = notEnclose
            ? title
            : getTailoredTextOrDefault({
                text: title,
                fontFamily: (textProperties ? textProperties.fontFamily : 'sans-serif'),
                fontSize: (textProperties ? textProperties.fontSize : '11px'),
            }, width);
        text.text(newText);
        text.append('title').text(title);
    });
}

const PxPtRatio: number = 4 / 3;
const PixelString: string = 'px';

/**
 * Appends 'px' to the end of number value for use as pixel string in styles
 */
export function toString(px: number): string {
    return px + PixelString;
}

/**
 * Converts point value (pt) to pixels
 * Returns a string for font-size property
 * e.g. fromPoint(8) => '24px'
 */
export function fromPoint(pt: number): string {
    return toString(fromPointToPixel(pt));
}

/**
 * Converts point value (pt) to pixels
 * Returns a number for font-size property
 * e.g. fromPoint(8) => 24px
 */
export function fromPointToPixel(pt: number): number {
    return (PxPtRatio * pt);
}

/**
 * Converts pixels value (px) to points
 * Returns a number
 * e.g. fromPixel(24px) => 8
 */
export function fromPixelToPoint(px: number): number {
    return (px / PxPtRatio);
}

/**
 * Converts pixel value (px) to pt
 * e.g. toPoint(24) => 8
 */
export function toPoint(px: number): number {
    return px / PxPtRatio;
}


