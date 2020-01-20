import powerbi from 'powerbi-visuals-api';
import VisualUpdateType = powerbi.VisualUpdateType;
import DataViewMetadataColumn = powerbi.DataViewMetadataColumn;
import DataViewValueColumn = powerbi.DataViewValueColumn;
import ISelectionIdBuilder = powerbi.extensibility.ISelectionIdBuilder;
import ISelectionId = powerbi.extensibility.ISelectionId;
import DataViewObjects = powerbi.DataViewObjects;
import PrimitiveValue = powerbi.PrimitiveValue;

import * as d3 from 'd3';

import { valueFormatter } from 'powerbi-visuals-utils-formattingutils';
import IValueFormatter = valueFormatter.IValueFormatter;

import { interactivityBaseService } from 'powerbi-visuals-utils-interactivityutils';
import IInteractivityService = interactivityBaseService.IInteractivityService;
import { shapesInterfaces } from 'powerbi-visuals-utils-svgutils';
import BoundingRect = shapesInterfaces.BoundingRect;

import { Visual } from './visual';
import { getLegendData } from './utilities/legendUtility';
import { VizUtility } from './utilities/vizUtility';
import { WebBehavior } from './behavior';
import { MarkersUtility } from './utilities/markersUtility';
import { renderVisual } from './renderVisual';
import { shapes, DimmedOpacity } from './settings';
import {
    LassoData,
    LineDataPointForLasso,
    SimplePoint,
    LinePoint,
    VerticalLineDataItem,
    CategoryType,
    VisualDomain,
    LineDataPoint,
    VisualDataPoint,
    VerticalLineDataItemsGlobalWithKey,
    LegendDataPointExtended,
    VerticalLineDataItemsGlobal,
    VisualViewModel,
    LegendDataExtended,
    Selection
} from './visualInterfaces';

export function implementLassoSelection(mainCont: Selection<any>, lassoContainer: Selection<any>, dataPoints: VisualDataPoint[], globalLines: LineDataPoint[], matrixFlowIndex: number, lassoColor: string,
    legend: Selection<any>, is: IInteractivityService<any>, behavior: WebBehavior,
    verticalLineDataItemsGlobal: VerticalLineDataItemsGlobalWithKey, shapes: shapes, legendFormatter: IValueFormatter, legendType: CategoryType) {

    let mainRect: BoundingRect = null;
    if (matrixFlowIndex == 0) {
        let lineChartRect: Selection<any> = lassoContainer.select(Visual.LineChartRectSelector.selectorName);
        let rectX: number = +lineChartRect.attr('x');
        let rectY: number = +lineChartRect.attr('y');
        let rectW: number = +lineChartRect.attr('width');
        let rectH: number = +lineChartRect.attr('height');
        mainRect = {
            top: rectY,
            left: rectX,
            right: rectX + rectW,
            bottom: rectY + rectH
        };
    }

    let dp: VisualDataPoint[] = [];
    legend.on('click', () => {
        lassoContainer.selectAll(Visual.LassoSvgSelector.selectorName).remove();
        lassoContainer.data([null]);
        let hasLasso: boolean = behavior.hasLassoSelection();
        if (hasLasso) {
            behavior.customLassoSelect([]);
            behavior.renderLassoSelection(false);
            dp = [];
        }
    });
    let isMouseDown: boolean = false;
    mainCont.on('mousemove', () => {
        let mouse = getMouseXY();
        let mouseX: number = reCountMouseX(mouse[0], mainRect);
        let mouseY: number = reCountMouseY(mouse[1], mainRect);

        let currentLassoData: LassoData = lassoContainer.data()[0];
        if (isMouseDown && currentLassoData && currentLassoData.startX != mouseX && currentLassoData.startY != mouseY) {
            if (is.hasSelection())
                is.clearSelection();
            lassoContainer.selectAll(Visual.LassoSvgSelector.selectorName).remove();
            behavior.renderLassoSelection(true);
            let lassoData: LassoData = generateLassoData(currentLassoData.startX, currentLassoData.startY, mouseX, mouseY, []);

            let childLassoContainer: Selection<any> = lassoContainer.select('#' + Visual.LassoDataSelectorId).append("svg").classed(Visual.LassoSvgSelector.className, true);

            dp = drawLassoRect(globalLines, lassoData, lassoColor, childLassoContainer, dataPoints, verticalLineDataItemsGlobal, shapes, legendFormatter, legendType);
            behavior.customLassoSelect(dp);
            lassoContainer.data([lassoData]);
        } else {
            let hasLasso: boolean = behavior.hasLassoSelection();
            if (hasLasso && dp)
                behavior.customLassoSelect(dp);
            dp = null;
        }
    });
    lassoContainer.on('mousedown', () => {
        dp = [];
        let mouse = getMouseXY();
        let startX: number = reCountMouseX(mouse[0], mainRect);
        let startY: number = reCountMouseY(mouse[1], mainRect);
        is.clearSelection();
        let lassoData: LassoData = generateLassoData(startX, startY, startX, startY, []);
        lassoContainer.data([lassoData]);
        behavior.renderLassoSelection(true);
        isMouseDown = true;
    });
    lassoContainer.on('mouseup', () => {
        isMouseDown = false;
        let mouse = getMouseXY();
        let mouseX: number = reCountMouseX(mouse[0], mainRect);
        let mouseY: number = reCountMouseY(mouse[1], mainRect);

        let currentLassoData: LassoData = lassoContainer.data()[0];
        if (currentLassoData && currentLassoData.startX == mouseX && currentLassoData.startY == mouseY) {
            lassoContainer.selectAll(Visual.LassoSvgSelector.selectorName).remove();
            behavior.renderLassoSelection(false);
            is.clearSelection();
            dp = [];
            lassoContainer.data([null]);
        }
        lassoContainer.selectAll(Visual.LassoRectSelector.selectorName).remove();
    });
}

export function getMouseXY(): number[] {
    let mouseEvent: MouseEvent = <MouseEvent>d3.event;
    return [mouseEvent.offsetX, mouseEvent.offsetY];
}

export function reCountMouseX(mouseX: number, mainRect: BoundingRect): number {
    if (mainRect) {
        if (mouseX < mainRect.left)
            mouseX = mainRect.left;
        if (mouseX > mainRect.right)
            mouseX = mainRect.right;
    }
    return mouseX;
}

export function reCountMouseY(mouseY: number, mainRect: BoundingRect): number {
    if (mainRect) {
        if (mouseY < mainRect.top)
            mouseY = mainRect.top;
        if (mouseY > mainRect.bottom)
            mouseY = mainRect.bottom;
    }
    return mouseY;
}

export function generateLassoData(startX: number, startY: number, endX: number, endY: number, oldSelectedLegendNames: string[]): LassoData {

    let minX: number = endX;
    let maxX: number = startX;
    if (startX < endX) {
        minX = startX;
        maxX = endX;
    }
    let minY: number = endY;
    let maxY: number = startY;
    if (startY < endY) {
        minY = startY;
        maxY = endY;
    }
    let lassoData: BoundingRect = {
        top: minY,
        left: minX,
        right: maxX,
        bottom: maxY
    };
    return <LassoData>{
        lassoData: lassoData,
        startX: startX,
        startY: startY,
        selectedLegendNames: oldSelectedLegendNames
    };
}

export function drawLassoRect(globalLines: LineDataPoint[], data: LassoData, lassoColor: string, cont: Selection<any>, dataPoints: VisualDataPoint[],
    verticalLineDataItemsGlobal: VerticalLineDataItemsGlobalWithKey, shapes: shapes, legendFormatter: IValueFormatter, legendType: CategoryType): VisualDataPoint[] {
    if (!data)
        return;

    cont.append("rect")
        .classed(Visual.LassoRectSelector.className, true)
        .attrs({
            'width': data.lassoData.right - data.lassoData.left,
            'height': data.lassoData.bottom - data.lassoData.top,
            'x': data.lassoData.left,
            'y': data.lassoData.top,
            'fill': lassoColor
        }).style('opacity', DimmedOpacity);

    let selectedLegendNames: string[] = [];
    let lines: LineDataPointForLasso[] = [];
    let points: SimplePoint[] = [];
    //tslint:disable-next-line
    for (let lineKey in verticalLineDataItemsGlobal) {
        let verticalLineDataItems: VerticalLineDataItem[] = verticalLineDataItemsGlobal[lineKey].verticalLineDataItems;
        for (let i = 0; i < verticalLineDataItems.length; i++) {
            let verticalLineDataItem: VerticalLineDataItem = verticalLineDataItems[i];
            let x: number = verticalLineDataItem.rectGlobalX + verticalLineDataItem.x;
            for (let j = 0; j < verticalLineDataItem.linePoints.length; j++) {
                let linePoint: LinePoint = verticalLineDataItem.linePoints[j];
                let y = linePoint.y + verticalLineDataItem.rectGlobalY;
                if (data.lassoData.left <= x && x <= data.lassoData.right && data.lassoData.top <= y && y <= data.lassoData.bottom) {
                    let name: string = linePoint.name;
                    let item: PrimitiveValue = (legendType == CategoryType.Date) ? new Date(name) : name;
                    let legendName: string = (legendFormatter) ? legendFormatter.format(item) : name;
                    if (selectedLegendNames.indexOf(legendName) == -1)
                        selectedLegendNames.push(legendName);
                    let point: SimplePoint = { x: x, y: y };
                    points.push({
                        x: verticalLineDataItem.tooltips[0].header,
                        y: +linePoint.value,
                        lineKey: linePoint.lineKey
                    });
                    pushPointToLines(point, lineKey + name, lines);
                }
            }
        }
    }
    let newDataPoints: VisualDataPoint[] = [];
    for (let j = 0; j < points.length; j++) {
        let point: SimplePoint = points[j];
        for (let i = 0; i < dataPoints.length; i++) {
            let dataPoint: VisualDataPoint = dataPoints[i];
            if (dataPoint.x == point.x && dataPoint.y == point.y && dataPoint.lineKey == point.lineKey) {
                dataPoint.selected = true;
                newDataPoints.push({
                    x: dataPoints[i].x,
                    y: dataPoints[i].y,
                    tooltips: dataPoints[i].tooltips,
                    selected: true,
                    identity: dataPoints[i].identity
                });
                break;
            }
        }
    }
    drawLines(cont, lines, globalLines, shapes);
    return newDataPoints;
}

//tslint:disable-next-line
export function drawLines(cont: Selection<any>, lines: LineDataPointForLasso[], globalLines: LineDataPoint[], shapes: shapes) {
    let newLines: LineDataPoint[] = [];
    let lineDD: string[] = [];
    let dots: LineDataPoint[] = [];
    for (let i = 0; i < lines.length; i++) {
        let line: LineDataPointForLasso = lines[i];
        if (line.points && line.points.length > 0) {
            let j: number = 0;
            while (j < globalLines.length && line.lineKey != globalLines[j].lineKey) {
                j = j + 1;
            }
            let globalLine: LineDataPoint = globalLines[j];
            let item: LineDataPoint = {
                lineKey: line.lineKey,
                name: globalLine.name,
                points: line.points,
                color: globalLine.color,
                strokeWidth: globalLine.strokeWidth,
                strokeLineJoin: globalLine.strokeLineJoin,
                lineStyle: globalLine.lineStyle,
                stepped: globalLine.stepped,

                showMarkers: globalLine.showMarkers,
                markerShape: globalLine.markerShape,
                markerSize: globalLine.markerSize,
                markerColor: globalLine.markerColor,
                selected: globalLine.selected,
                identity: globalLine.identity
            }
            let showMarkers: boolean = (item.showMarkers == true) || (item.showMarkers == null && shapes.showMarkers);
            if (line.points.length == 1 && !showMarkers)
                dots.push(item);
            newLines.push(item);
            let lineD = retrieveLineDForLasso(item.points);
            lineDD.push(lineD);
        }
    }
    let linesCont: Selection<any> = cont.append("svg");
    let lineGroupSelection: Selection<LineDataPoint> = linesCont
        .selectAll(Visual.SimpleLineSelector.selectorName)
        .data(newLines);

    let lineGroupSelectionAppend = lineGroupSelection
        .enter()
        .append("path");
    
    lineGroupSelectionAppend
        .classed(Visual.SimpleLineSelector.className, true);

    let lineGroupSelectionMerged = lineGroupSelection.merge(lineGroupSelectionAppend);

    lineGroupSelectionMerged
        .attrs({
            "d": (dataPoint: LineDataPoint, index: number) => {
                let lineD: string = lineDD[index];
                let stepped: boolean = (dataPoint.stepped == undefined) ? shapes.stepped : dataPoint.stepped;
                return (stepped)
                    ? MarkersUtility.GET_DATA_LINE_FOR_FOR_STEPPED_LINE_CHART(lineD)
                    : lineD;
            },
            "stroke": (dataPoint: LineDataPoint) => {
                return dataPoint.color;
            },
            'stroke-width': (dataPoint: LineDataPoint) => {
                return (dataPoint.strokeWidth == undefined) ? shapes.strokeWidth : dataPoint.strokeWidth;
            },
            "stroke-linejoin": (dataPoint: LineDataPoint) => {
                return (dataPoint.strokeLineJoin == undefined) ? shapes.strokeLineJoin : dataPoint.strokeLineJoin;
            },
            "stroke-dasharray": (dataPoint: LineDataPoint) => {
                return (dataPoint.lineStyle == undefined)
                    ? VizUtility.getLineStyleParam(shapes.lineStyle)
                    : VizUtility.getLineStyleParam(dataPoint.lineStyle);
            },
            'fill': 'none'
        })
        .style('opacity', 1);

    let lineNamesWithMarkers = renderVisual.RETRIEVE_LINE_NAMES_WITH_MARKERS(cont, linesCont, lineDD, shapes, newLines);
    for (let i = 0; i < newLines.length; i++) {
        let ldp: LineDataPoint = newLines[i];
        let marker: string = lineNamesWithMarkers[ldp.name];
        if (marker) {
            let item: Selection<any> = d3.select(lineGroupSelection[0][i]);
            item.attr('marker-start', marker);
            item.attr('marker-mid', marker);
            item.attr('marker-end', marker);
        }
    }

    let dotsGroupSelection: Selection<LineDataPoint> = linesCont
        .append("g")
        .selectAll(Visual.SimpleLineSelector.selectorName)
        .data(dots);

    let dotsGroupSelectionAppend = dotsGroupSelection
        .enter()
        .append("circle");

    dotsGroupSelectionAppend
        .classed(Visual.DotSelector.className, true);

    let dotsGroupSelectionMerged = dotsGroupSelection.merge(dotsGroupSelectionAppend);

    dotsGroupSelectionMerged
        .attrs({
            'cx': (dataPoint: LineDataPoint) => {
                return +dataPoint.points[0].x;
            },
            'cy': (dataPoint: LineDataPoint) => {
                return dataPoint.points[0].y;
            },
            'r': (dataPoint: LineDataPoint) => {
                let strokeWidth: number = dataPoint.strokeWidth == undefined
                    ? shapes.strokeWidth
                    : dataPoint.strokeWidth;
                return 2.5 + 0.5 * strokeWidth;
            }
        })
        .styles({
            'fill': (dataPoint: LineDataPoint) => {
                return dataPoint.color;
            }
        }).style('opacity', 1);
}

export function retrieveLineDForLasso(points: SimplePoint[]) {
    let lineD = "M" + points[0].x + ',' + points[0].y;
    for (let i = 1; i < points.length; i++) {
        lineD = lineD + 'L' + points[i].x + ',' + points[i].y;
    }
    return lineD;
}

export function pushPointToLines(point: SimplePoint, lineKey: string, lines: LineDataPointForLasso[]) {
    let lineKeyIndex: number = -1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].lineKey == lineKey) {
            lineKeyIndex = i;
            break;
        }
    }
    if (lineKeyIndex == -1) {
        let item: LineDataPointForLasso = {
            lineKey: lineKey,
            points: [point]
        }
        lines.push(item);
    } else {
        lines[lineKeyIndex].points.push(point);
    }
}