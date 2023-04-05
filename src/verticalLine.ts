'use strict';
import {IValueFormatter} from 'powerbi-visuals-utils-formattingutils/lib/src/valueFormatter';
import {d3Selection, LineDataPoint, LinePoint, SimplePoint, VerticalLineDataItem} from './visualInterfaces';
import {Line} from 'd3-shape';
import powerbi from 'powerbi-visuals-api';
import PrimitiveValue = powerbi.PrimitiveValue;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;
import {Visual} from './visual';
import {DefaultTooltipCircleRadius} from './settings';

export function generateVerticalLineData(
    categoryIsDate: boolean,
    xFormatter: IValueFormatter,
    tooltipFormatter: IValueFormatter,
    lines: LineDataPoint[],
    xAxisDataPoints: any[],
    line: Line<SimplePoint>,
    shapesShowMarkers: boolean,
    rectGlobalX: number,
    rectGlobalY: number): VerticalLineDataItem[] {
    const verticalLineDataItems: VerticalLineDataItem[] = [];
    for (let i = 0; i < xAxisDataPoints.length; i++) {
        const category: string = convertCategoryItemToString(xAxisDataPoints[i], categoryIsDate);
        let xValue: number = 0;
        const points: LinePoint[] = [];
        const tooltips: VisualTooltipDataItem[] = [];
        for (let j = 0; j < lines.length; j++) {
            const linesJ: LineDataPoint = lines[j];
            const linePoints: SimplePoint[] = linesJ.points;
            if (linePoints) {
                for (let k = 0; k < linePoints.length; k++) {
                    const simplePoint = linePoints[k];
                    const xCategory: string = convertCategoryItemToString(simplePoint.x, categoryIsDate);
                    if (xCategory == category) {
                        const data = line([simplePoint]);
                        const values = data?.replace('M', '').replace('Z', '').split(',');
                        xValue = +(values?.[0] ?? 0);
                        const yValue: number = +(values?.[1] ?? 0);
                        const value: string = tooltipFormatter.format(+simplePoint.y);
                        const showMarkers: boolean = (linesJ.showMarkers == undefined) ? shapesShowMarkers : linesJ.showMarkers;
                        const linePoint: LinePoint = {
                            y: yValue,
                            value: value,
                            name: linesJ.name,
                            color: linesJ.color,
                            showMarkers: showMarkers,
                            lineKey: linesJ.lineKey,
                        };
                        points.push(linePoint);
                        if (simplePoint.tooltips) {
                            for (let k1 = 0; k1 < simplePoint.tooltips.length; k1++) {
                                const simplePointTooltip: VisualTooltipDataItem = simplePoint.tooltips[k1];
                                const tooltip: VisualTooltipDataItem = {
                                    displayName: simplePointTooltip.displayName,
                                    value: simplePointTooltip.value,
                                };
                                if (k1 == 0) {
                                    let header: PrimitiveValue = xAxisDataPoints[i];
                                    if (categoryIsDate) {
                                        header = new Date(header.toString());
                                    }
                                    tooltip.header = xFormatter.format(header);
                                }
                                if (simplePointTooltip.color) {
                                    tooltip.color = simplePointTooltip.color;
                                } else {
                                    tooltip.color = 'black';
                                    tooltip.opacity = '0';
                                }
                                tooltips.push(tooltip);
                            }
                        }
                    }
                }
            }
        }
        if (points.length > 0) {
            const verticalLineDataItem: VerticalLineDataItem = {
                x: xValue,
                tooltips: tooltips,
                linePoints: points,
                rectGlobalX: rectGlobalX,
                rectGlobalY: rectGlobalY,
            };
            verticalLineDataItems.push(verticalLineDataItem);
        }
    }
    return verticalLineDataItems;
}

export function findNearestVerticalLineIndex(
    mouseX: number,
    verticalLineDataItems: VerticalLineDataItem[]): number {
    let index: number = 0;
    const count: number = verticalLineDataItems.length;
    let xValue: number = count > 0
        ? verticalLineDataItems[0].x
        : 0;
    let minDelta: number = Math.abs(xValue - mouseX);
    for (let j = 1; j < count; j++) {
        xValue = verticalLineDataItems[j].x;
        const delta = Math.abs(xValue - mouseX);
        if (minDelta > delta) {
            minDelta = delta;
            index = j;
        }
    }

    return index;
}

function convertCategoryItemToString(categoryItem: PrimitiveValue, categoryIsDate: boolean): string {
    if (!categoryItem) return '';
    const category: string = (categoryIsDate)
        ? new Date(categoryItem.toString()).toLocaleDateString()
        : categoryItem.toString();
    return category;
}

export function drawPointsForVerticalLine(verticalLineContainer: d3Selection<any>, x: number, points: LinePoint[]) {
    verticalLineContainer.selectAll('circle').remove();
    if (!points) return;
    for (let j = 0; j < points.length; j++) {
        const point: LinePoint = points[j];
        if (!point.showMarkers) {
            verticalLineContainer.append('circle')
                .classed(Visual.CircleSelector.className, true)
                .attr('cx', x)
                .attr('cy', point.y)
                .attr('r', DefaultTooltipCircleRadius)
                .attr('fill', point.color);
        }
    }
}
