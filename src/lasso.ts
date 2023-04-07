import {
    CategoryType,
    d3Selection,
    LassoData,
    LineDataPoint,
    LineDataPointForLasso,
    LinePoint,
    SimplePoint,
    VerticalLineDataItem,
    VerticalLineDataItemsGlobalWithKey,
    VisualDataPoint,
} from './visualInterfaces';
import {IInteractivityService} from 'powerbi-visuals-utils-interactivityutils/lib/interactivityBaseService';
import {WebBehavior} from './behavior';
import {DimmedOpacity, Shapes} from './settings';
import {IValueFormatter} from 'powerbi-visuals-utils-formattingutils/lib/src/valueFormatter';
import {BoundingRect} from 'powerbi-visuals-utils-svgutils/lib/shapes/shapesInterfaces';
import {Visual} from './visual';
import powerbi from 'powerbi-visuals-api';
import {MarkersUtility} from './utilities/markersUtility';
import {getLineStyleParam} from './utilities/vizUtility';
import PrimitiveValue = powerbi.PrimitiveValue;

export function implementLassoSelection(
    mainCont: d3Selection<any>,
    lassoContainer: d3Selection<any>,
    dataPoints: VisualDataPoint[],
    globalLines: LineDataPoint[],
    matrixFlowIndex: number,
    lassoColor: string,
    legend: d3Selection<any>,
    is: IInteractivityService<any>,
    behavior: WebBehavior,
    verticalLineDataItemsGlobal: VerticalLineDataItemsGlobalWithKey,
    shapes: Shapes,
    legendFormatter: IValueFormatter,
    legendType: CategoryType) {

    let mainRect: BoundingRect = null;
    if (matrixFlowIndex == 0) {
        const lineChartRect: d3Selection<any> = lassoContainer.select(Visual.LineChartRectSelector.selectorName);
        const rectX: number = +lineChartRect.attr('x');
        const rectY: number = +lineChartRect.attr('y');
        const rectW: number = +lineChartRect.attr('width');
        const rectH: number = +lineChartRect.attr('height');
        mainRect = {
            top: rectY,
            left: rectX,
            right: rectX + rectW,
            bottom: rectY + rectH,
        };
    }

    let dp: VisualDataPoint[] = [];
    legend.on('click', function () {
        lassoContainer.selectAll(Visual.LassoSvgSelector.selectorName).remove();
        lassoContainer.data([null]);
        const hasLasso: boolean = behavior.hasLassoSelection();
        if (hasLasso) {
            behavior.customLassoSelect([]);
            behavior.renderLassoSelection(false);
            dp = [];
        }
    });
    let isMouseDown: boolean = false;
    mainCont.on('mousemove', function (e: MouseEvent) {

        const mouse = getMouseXY(e);
        const mouseX: number = reCountMouseX(mouse[0], mainRect);
        const mouseY: number = reCountMouseY(mouse[1], mainRect);
        const currentLassoData: LassoData = lassoContainer.data()[0];

        if (isMouseDown && currentLassoData && currentLassoData.startX != mouseX && currentLassoData.startY != mouseY) {
            if (is.hasSelection())
                is.clearSelection();
            lassoContainer.selectAll(Visual.LassoSvgSelector.selectorName).remove();
            behavior.renderLassoSelection(true);
            const lassoData: LassoData = generateLassoData(currentLassoData.startX, currentLassoData.startY, mouseX, mouseY, []);

            const childLassoContainer: d3Selection<any> = lassoContainer.select('#' + Visual.LassoDataSelectorId).append('svg').classed(Visual.LassoSvgSelector.className, true);

            dp = drawLassoRect(globalLines, lassoData, lassoColor, childLassoContainer, dataPoints, verticalLineDataItemsGlobal, shapes, legendFormatter, legendType);
            behavior.customLassoSelect(dp);
            lassoContainer.data([lassoData]);
        } else {
            const hasLasso: boolean = behavior.hasLassoSelection();
            if (hasLasso && dp)
                behavior.customLassoSelect(dp);
            dp = null;
        }
    });
    lassoContainer.on('mousedown', function (e: MouseEvent) {
        dp = [];
        const mouse = getMouseXY(e);
        const startX: number = reCountMouseX(mouse[0], mainRect);
        const startY: number = reCountMouseY(mouse[1], mainRect);
        is.clearSelection();
        const lassoData: LassoData = generateLassoData(startX, startY, startX, startY, []);
        lassoContainer.data([lassoData]);
        behavior.renderLassoSelection(true);
        isMouseDown = true;
    });
    lassoContainer.on('mouseup', function (e: MouseEvent) {
        isMouseDown = false;
        const mouse = getMouseXY(e);
        const mouseX: number = reCountMouseX(mouse[0], mainRect);
        const mouseY: number = reCountMouseY(mouse[1], mainRect);

        const currentLassoData: LassoData = lassoContainer.data()[0];
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

function getMouseXY(mouseEvent: MouseEvent): [number, number] {
    return [mouseEvent.offsetX, mouseEvent.offsetY];
}

function reCountMouseX(mouseX: number, mainRect: BoundingRect): number {
    if (mainRect) {
        if (mouseX < mainRect.left)
            mouseX = mainRect.left;
        if (mouseX > mainRect.right)
            mouseX = mainRect.right;
    }
    return mouseX;
}

function reCountMouseY(mouseY: number, mainRect: BoundingRect): number {
    if (mainRect) {
        if (mouseY < mainRect.top)
            mouseY = mainRect.top;
        if (mouseY > mainRect.bottom)
            mouseY = mainRect.bottom;
    }
    return mouseY;
}

function generateLassoData(startX: number, startY: number, endX: number, endY: number, oldSelectedLegendNames: string[]): LassoData {
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
    const lassoData: BoundingRect = {
        top: minY,
        left: minX,
        right: maxX,
        bottom: maxY,
    };
    const result: LassoData = {
        lassoData: lassoData,
        startX: startX,
        startY: startY,
        selectedLegendNames: oldSelectedLegendNames,
    };
    return result;
}

function drawLassoRect(
    globalLines: LineDataPoint[],
    data: LassoData,
    lassoColor: string,
    cont: d3Selection<any>,
    dataPoints: VisualDataPoint[],
    verticalLineDataItemsGlobal: VerticalLineDataItemsGlobalWithKey,
    shapes: Shapes,
    legendFormatter: IValueFormatter,
    legendType: CategoryType): VisualDataPoint[] {
    if (!data)
        return;

    cont.append('rect')
        .classed(Visual.LassoRectSelector.className, true)
        .attr('width', data.lassoData.right - data.lassoData.left)
        .attr('height', data.lassoData.bottom - data.lassoData.top)
        .attr('x', data.lassoData.left)
        .attr('y', data.lassoData.top)
        .attr('fill', lassoColor)
        .style('opacity', DimmedOpacity);

    const selectedLegendNames: string[] = [];
    const lines: LineDataPointForLasso[] = [];
    const points: SimplePoint[] = [];
    for (const lineKey in verticalLineDataItemsGlobal) {
        const verticalLineDataItems: VerticalLineDataItem[] = verticalLineDataItemsGlobal[lineKey].verticalLineDataItems;
        for (let i = 0; i < verticalLineDataItems.length; i++) {
            const verticalLineDataItem: VerticalLineDataItem = verticalLineDataItems[i];
            const x: number = verticalLineDataItem.rectGlobalX + verticalLineDataItem.x;
            for (let j = 0; j < verticalLineDataItem.linePoints.length; j++) {
                const linePoint: LinePoint = verticalLineDataItem.linePoints[j];
                const y = linePoint.y + verticalLineDataItem.rectGlobalY;
                if (data.lassoData.left <= x && x <= data.lassoData.right && data.lassoData.top <= y && y <= data.lassoData.bottom) {
                    const name: string = linePoint.name;
                    const item: PrimitiveValue = (legendType == CategoryType.Date) ? new Date(name) : name;
                    const legendName: string = (legendFormatter) ? legendFormatter.format(item) : name;
                    if (selectedLegendNames.indexOf(legendName) == -1)
                        selectedLegendNames.push(legendName);
                    const point: SimplePoint = {x: x, y: y};
                    points.push({
                        x: verticalLineDataItem.tooltips[0].header,
                        y: +linePoint.value,
                        lineKey: linePoint.lineKey,
                    });
                    pushPointToLines(point, lineKey + name, lines);
                }
            }
        }
    }
    const newDataPoints: VisualDataPoint[] = [];
    for (let j = 0; j < points.length; j++) {
        const point: SimplePoint = points[j];
        for (let i = 0; i < dataPoints.length; i++) {
            const dataPoint: VisualDataPoint = dataPoints[i];
            if (dataPoint.x == point.x && dataPoint.y == point.y && dataPoint.lineKey == point.lineKey) {
                dataPoint.selected = true;
                newDataPoints.push({
                    x: dataPoints[i].x,
                    y: dataPoints[i].y,
                    tooltips: dataPoints[i].tooltips,
                    selected: true,
                    identity: dataPoints[i].identity,
                });
                break;
            }
        }
    }
    drawLines(cont, lines, globalLines, shapes);
    return newDataPoints;
}

// eslint-disable-next-line max-lines-per-function
function drawLines(cont: d3Selection<any>, lines: LineDataPointForLasso[], globalLines: LineDataPoint[], shapes: Shapes) {
    const newLines: LineDataPoint[] = [];
    const lineDD: string[] = [];
    const dots: LineDataPoint[] = [];
    for (let i = 0; i < lines.length; i++) {
        const line: LineDataPointForLasso = lines[i];
        if (line.points && line.points.length > 0) {
            let j: number = 0;
            while (j < globalLines.length && line.lineKey != globalLines[j].lineKey) {
                j = j + 1;
            }

            const globalLine: LineDataPoint = globalLines[j];
            const item: LineDataPoint = {
                lineKey: line.lineKey,
                name: globalLine.name,
                points: line.points,
                color: globalLine.color,
                strokeWidth: globalLine.strokeWidth,
                strokeLineJoin: globalLine.strokeLineJoin,
                lineStyle: globalLine.lineStyle,
                stepped: globalLine.stepped,
                showMarkers: globalLine.showMarkers,
                seriesMarkerShape: globalLine.seriesMarkerShape,
                markerSize: globalLine.markerSize,
                markerColor: globalLine.markerColor,
                selected: globalLine.selected,
                identity: globalLine.identity,
            };
            const showMarkers: boolean = (item.showMarkers == true) || (item.showMarkers == null && shapes.showMarkers);
            if (line.points.length == 1 && !showMarkers)
                dots.push(item);
            newLines.push(item);
            const lineD = retrieveLineDForLasso(item.points);
            lineDD.push(lineD);
        }
    }

    const linesCont = cont.append('svg');
    const lineGroupSelection = linesCont
        .selectAll(Visual.SimpleLineSelector.selectorName)
        .data(newLines);

    const lineGroupSelectionEnter = lineGroupSelection.enter()
        .append('path')
        .classed(Visual.SimpleLineSelector.className, true);

    lineGroupSelectionEnter
        .attr('d', (dataPoint: LineDataPoint, index: number) => {
            const lineD: string = lineDD[index];
            const stepped: boolean = (dataPoint.stepped == undefined) ? shapes.stepped : dataPoint.stepped;
            return (stepped)
                ? MarkersUtility.getDataLineForForSteppedLineChart(lineD)
                : lineD;
        })
        .attr('stroke', (dataPoint: LineDataPoint) => dataPoint.color)
        .attr('stroke-width', (dataPoint: LineDataPoint) =>
            (dataPoint.strokeWidth == undefined) ? shapes.strokeWidth : dataPoint.strokeWidth)
        .attr('stroke-linejoin', (dataPoint: LineDataPoint) =>
            (dataPoint.strokeLineJoin == undefined) ? shapes.strokeLineJoin : dataPoint.strokeLineJoin)
        .attr('stroke-dasharray', (dataPoint: LineDataPoint) =>
            (dataPoint.lineStyle == undefined)
                ? getLineStyleParam(shapes.lineStyle)
                : getLineStyleParam(dataPoint.lineStyle))
        .attr('fill', 'none')
        .style('opacity', 1);

//         // TODO Fix showing markers on selection line
//         let lineNamesWithMarkers = retrieveLineNamesWithMarkers(cont, linesCont, lineDD, shapes, newLines);
//         for(let i=0;i<newLines.length;i++) {
//             let ldp: LineDataPoint = newLines[i];
//             let marker: string = lineNamesWithMarkers[ldp.name];
//             if (marker) {
//                 // TODO Fix selection array to nodes()
//                 let item: Selection<any> = d3.select(lineGroupSelection[0][i]);
//                 item.attr('marker-start', marker);
//                 item.attr('marker-mid', marker);
//                 item.attr('marker-end', marker);
//             }
//         }
//
//         // TODO Fix rendering dots for selection with only one point
//         let dotsGroupSelection: Update<LineDataPoint> = linesCont
//             .append("g")
//             .selectAll(Visual.SimpleLineSelector.selectorName)
//             .data(dots);
//
//         dotsGroupSelection
//             .enter()
//             .append("circle")
//             .classed(Visual.DotSelector.className, true);
//
//         dotsGroupSelection
//             .attr({
//                 'cx': (dataPoint: LineDataPoint) => {
//                     return +dataPoint.points[0].x;
//                 },
//                 'cy': (dataPoint: LineDataPoint) => {
//                     return dataPoint.points[0].y;
//                 },
//                 'r': (dataPoint: LineDataPoint) => {
//                     let strokeWidth: number = dataPoint.strokeWidth == undefined
//                         ? shapes.strokeWidth
//                         : dataPoint.strokeWidth;
//                     return 2.5 + 0.5*strokeWidth;
//                 }
//             })
//             .style({
//                 'fill': (dataPoint: LineDataPoint) => {
//                     return dataPoint.color;
//                 }
//             }).style('opacity', 1);
}

function retrieveLineDForLasso(points: SimplePoint[]) {
    let lineD = 'M' + points[0].x + ',' + points[0].y;
    for (let i = 1; i < points.length; i++) {
        lineD = lineD + 'L' + points[i].x + ',' + points[i].y;
    }
    return lineD;
}

function pushPointToLines(point: SimplePoint, lineKey: string, lines: LineDataPointForLasso[]) {
    let lineKeyIndex: number = -1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].lineKey == lineKey) {
            lineKeyIndex = i;
            break;
        }
    }
    if (lineKeyIndex == -1) {
        const item: LineDataPointForLasso = {
            lineKey: lineKey,
            points: [point],
        };
        lines.push(item);
    } else {
        lines[lineKeyIndex].points.push(point);
    }
}

