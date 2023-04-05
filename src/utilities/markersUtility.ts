'use strict';

import {d3Selection, LineDataPoint} from '../visualInterfaces';
import {Visual} from '../visual';
import {SeriesMarkerShape} from '../seriesMarkerShape';
import {Shapes} from '../settings';
import {LegendIconType} from '../legendIconType';

export class MarkersUtility {
    // public static initMarker(
    //     container: d3Selection<any>,
    //     uniqueName: string,
    //     markerShape: SeriesMarkerShape,
    //     markerSize: number,
    //     markerColor: string): string {
    //     // set markerD and strokeWidth from markerShape
    //     const markerD: string = MarkersUtility.getPath(markerShape);
    //     const strokeWidth: number = MarkersUtility.getStrokeWidth(markerShape);
    //
    //     let markerId: string;
    //     //init marker
    //     if (markerD !== '') {
    //         markerId = MarkersUtility.retrieveMarkerName(uniqueName, markerShape);
    //         const isMarkerNotExists = container.select('#' + markerId).empty();
    //         if (isMarkerNotExists) {
    //             const marker = container.append('marker')
    //                 .attr('id', markerId)
    //                 .attr('refX', 0)
    //                 .attr('refY', 0)
    //                 .attr('viewBox', '-6 -6 12 12')
    //                 .attr('markerWidth', markerSize)
    //                 .attr('markerHeight', markerSize);
    //             marker.append('path')
    //                 .attr('d', markerD)
    //                 .attr('stroke', markerColor)
    //                 .attr('stroke-width', strokeWidth)
    //                 .attr('fill', markerColor);
    //         }
    //     }
    //     return markerId;
    // }

    public static getPath(markerShape: SeriesMarkerShape): string {
        switch (markerShape) {
            case SeriesMarkerShape.circle : {
                return 'M 0 0 m -5 0 a 5 5 0 1 0 10 0 a 5 5 0 1 0 -10 0';
            }
            case SeriesMarkerShape.square : {
                return 'M 0 0 m -5 -5 l 10 0 l 0 10 l -10 0 z';
            }
            case SeriesMarkerShape.diamond : {
                return 'M 0 0 m -5 0 l 5 -5 l 5 5 l -5 5 z';
            }
            case SeriesMarkerShape.triangle : {
                return 'M 0 0 m -5 5 l 5 -10 l 5 10 z';
            }
            case SeriesMarkerShape.cross: {
                return 'M 0 0 m -5 -5 l 10 10 m -10 0 l 10 -10';
            }
            case SeriesMarkerShape.shortDash: {
                return 'M 0 0 l 5 0';
            }
            case SeriesMarkerShape.longDash: {
                return 'M 0 0 m -5 0 l 10 0';
            }
            case SeriesMarkerShape.plus: {
                return 'M 0 0 m -5 0 l 10 0 m -5 -5 l 0 10';
            }
        }
    }

    public static getStrokeWidth(markerShape: SeriesMarkerShape): number {
        switch (markerShape) {
            case SeriesMarkerShape.cross:
                return 1;
            case SeriesMarkerShape.shortDash:
                return 2;
            case SeriesMarkerShape.longDash:
                return 2;
            case SeriesMarkerShape.plus:
                return 1;
            case SeriesMarkerShape.circle :
            case SeriesMarkerShape.square :
            case SeriesMarkerShape.diamond :
            case SeriesMarkerShape.triangle :
            default:
                return 0;
        }
    }

    public static retrieveMarkerName(uniqueName: string, markerShape: string): string {
        let markerId: string = markerShape + uniqueName;
        markerId = markerId.replace(/\+/g, 'plus');
        markerId = markerId.replace(/[^0-9a-zA-Z]/g, '');
        return markerId;
    }

    public static getDataLineForForSteppedLineChart(dataLine: string): string {
        let newDataLine: string = dataLine.replace(/\M/, '').replace(/\V/g, '!V').replace(/\H/g, '!H').replace(/\L/g, '!L');
        const markedPoints: string[] = newDataLine.replace(/\M/g, '!M').split('!');

        newDataLine = 'M' + markedPoints[0];
        const firstItem: string[] = markedPoints[0].split(',');
        let currentX: number = +firstItem[0];
        let currentY: number = +firstItem[1];

        let j: number = 1;
        while (j < markedPoints.length) {
            const action: string = markedPoints[j][0];
            switch (action) {
                case 'H': {
                    const newX: number = +markedPoints[j].replace(/\H/, '');
                    const newDelta: number = newX - currentX;
                    currentX = newX;
                    newDataLine = newDataLine + markedPoints[j];
                    break;
                }
                case 'V': {
                    const newY: number = +markedPoints[j].replace(/\V/, '');
                    currentY = newY;
                    newDataLine = newDataLine + markedPoints[j];
                    break;
                }
                case 'M': {
                    const data: string[] = markedPoints[j].replace(/\M/, '').split(',');
                    currentX = +data[0];
                    currentY = +data[1];
                    newDataLine = newDataLine + markedPoints[j];
                    break;
                }
                case 'L': {
                    const data: string[] = markedPoints[j].replace(/\L/, '').split(',');
                    const newX: number = +data[0];
                    const newY: number = +data[1];
                    const newX1: number = (newX + currentX) / 2;
                    newDataLine = newDataLine + 'H' + newX1 + 'V' + newY + 'H' + newX;
                    currentX = newX;
                    currentY = newY;
                    break;
                }
            }
            j = j + 1;
        }
        return newDataLine;
    }

    public static appendMarkerDefsForLines(svgContainer: d3Selection<SVGElement>, lines: LineDataPoint[], shapes: Shapes) {
        const markerDefs = svgContainer
            .append('defs')
            .selectAll('path')
            .data(lines);

        const markerNames = lines.reduce<{
            [key: string]: string
        }>((previousValue, currentValue) => {
            const markerShape = currentValue.seriesMarkerShape || shapes.markerShape;
            previousValue[currentValue.name] = MarkersUtility.retrieveMarkerName(currentValue.name, markerShape);
            return previousValue;
        }, {});

        markerDefs.exit()
            .remove();

        markerDefs.enter()
            .append('marker')
            .attr('id', (d) => markerNames[d.name])
            .attr('refX', 0)
            .attr('refY', 0)
            .attr('viewBox', '-6 -6 12 12')
            .attr('markerWidth', (d) => d.markerSize ?? shapes.markerSize)
            .attr('markerHeight', (d) => d.markerSize ?? shapes.markerSize)
            .append('path')
            .attr('d', (dataPoint) => {
                return MarkersUtility.getPath(dataPoint.seriesMarkerShape ?? shapes.markerShape ?? SeriesMarkerShape.circle);
            })
            .attr('stroke-width', (dataPoint) => {
                if (dataPoint.lineStyle) {
                    return 2;
                }
                return MarkersUtility.getStrokeWidth(dataPoint.seriesMarkerShape ?? shapes.markerShape ?? SeriesMarkerShape.circle);
            })
            .attr('opacity', () => {
                return 1;
            })
            .style('fill', (dataPoint) => {
                return dataPoint.color;
            })
            .style('stroke', (dataPoint) => dataPoint.color)
            .style('stroke-dasharray', () => {
                return null;
            })
            .style('stroke-linejoin', 'round');

        return markerNames;
    }

    //
    // public static drawMarkersForSteppedLineChart(container: d3Selection<SVGElement>, lineD: string, markerPathId: string, markerId: string, strokeWidth: number) {
    //     const markerAttr = 'url(#' + markerId + ')';
    //     container.append('path')
    //         .classed(Visual.MarkerLineSelector.className, true)
    //         .attr('id', markerPathId)
    //         .attr('d', lineD)
    //         .attr('stroke-width', strokeWidth)
    //         .attr('fill', 'none')
    //         .attr('marker-start', markerAttr)
    //         .attr('marker-mid', markerAttr)
    //         .attr('marker-end', markerAttr);
    // }

}
