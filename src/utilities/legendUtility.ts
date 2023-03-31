"use strict";

import powerbi from "powerbi-visuals-api";
import {LegendSettings} from "../settings";
import {d3Selection, LegendDataExtended, LegendDataPointExtended} from "../visualInterfaces";
import {
    ILegend,
    LegendData, LegendDataPoint,
    LegendPosition,
    MarkerShape
} from "powerbi-visuals-utils-chartutils/lib/legend/legendInterfaces";
import {ColorHelper} from "powerbi-visuals-utils-colorutils";
import {fromPixelToPoint, fromPointToPixel, measureTextWidth, TextProperties} from "./textUtility";
import {getTailoredTextOrDefault} from "powerbi-visuals-utils-formattingutils/lib/src/textMeasurementService";
import {select as d3select, selectAll as d3selectAll} from "d3-selection";
import {Visual} from "../visual";
import {parseTranslateTransform, translate as svgTranslate} from "powerbi-visuals-utils-svgutils/lib/manipulation";
import {SeriesMarkerShape} from "../seriesMarkerShape";
import {LegendIconType} from "../legendIconType";
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import DataViewMetadataColumn = powerbi.DataViewMetadataColumn;
import DataView = powerbi.DataView;
import DataViewValueColumnGroup = powerbi.DataViewValueColumnGroup;
import DataViewValueColumns = powerbi.DataViewValueColumns;
import DataViewCategoryColumn = powerbi.DataViewCategoryColumn;
import ISelectionId = powerbi.visuals.ISelectionId;
import DataViewObjects = powerbi.DataViewObjects;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IViewport = powerbi.IViewport;
import {MarkersUtility} from "./markersUtility";
import {LegendBehavior} from "../legendBehavior";
import {IMargin} from "powerbi-visuals-utils-svgutils";

const paddingText: number = 10;
const arrowWidth: number = 7.5;
let lineLen: number = 30;
let circleD: number = 10;

export function renderLegend(
    legendSettings: LegendSettings,
    dataPoints: LegendDataPointExtended[],
    legend: ILegend,
    options: VisualUpdateOptions,
    margin: IMargin) {
    let legendData: LegendData = {
        dataPoints: []
    };
    if (!legendSettings.show || dataPoints == null || dataPoints.length <= 1) {
        legend.drawLegend(legendData, options.viewport);
        return;
    }

    legend.changeOrientation(<any>LegendPosition[legendSettings.position]);

    let legendName: string = (legendSettings.showTitle) ? legendSettings.legendName : "";
    if (legendSettings.position == "Top"
        || legendSettings.position == "TopCenter"
        || legendSettings.position == "Bottom"
        || legendSettings.position == "BottomCenter") {
        let textProp: TextProperties = {
            text: legendName,
            fontFamily: legendSettings.fontFamily,
            fontSize: legendSettings.fontSize + "px"
        };
        let legendNameWidth: number = fromPointToPixel(measureTextWidth(textProp));
        if (legendNameWidth > options.viewport.width / 3) {
            let maxTitleWidth: number = fromPixelToPoint(options.viewport.width / 3);
            legendName = getTailoredTextOrDefault(textProp, maxTitleWidth);
        }
    }

    legendData = {
        title: legendName,
        dataPoints: dataPoints,
        labelColor: legendSettings.legendNameColor,
        fontSize: legendSettings.fontSize
    };
    legend.drawLegend(legendData, options.viewport);

    let legendItems: d3Selection<LegendDataPointExtended> = d3selectAll('svg.legend g.legendItem');
    drawCustomLegendIcons(legendItems, legendSettings, dataPoints);
    appendLegendMargins(legend, margin);
}

export function drawCustomLegendIcons(legendItems: d3Selection<any>, legendSettings: LegendSettings, dataPoints: LegendDataPointExtended[]) {
    if (!dataPoints || dataPoints.length == 0) return;
    let legendStyle = dataPoints[0].style;
    let legendItemsLen = legendItems && legendItems.size();
    if (!legendItemsLen) {
        return;
    }

    let isLongMarker: boolean = legendStyle == LegendIconType.line || legendStyle == LegendIconType.lineMarkers;
    let isTopOrBottomLegend: boolean = legendSettings.position == "Top" || legendSettings.position == "TopCenter"
        || legendSettings.position == "Bottom" || legendSettings.position == "BottomCenter";

    let legendGroup: d3Selection<any> = d3select(legendItems.node().parentElement);
    let legend: d3Selection<any> = d3select(legendGroup.node().parentElement);

    let markerSize: number = 6;
    let padding: number = legendSettings.fontSize / 4;
    let arrowHeight: number = 15;
    let minCx: number = isLongMarker ? lineLen / 2 + padding : circleD / 2 + padding;
    let svgLegendWidth: number = +legend.attr('width');
    let svgLegendHeight: number = +legend.attr('height');

    const firstLegendNode = d3select<any, LegendDataPoint>(legendItems.nodes()[0]);
    const firstName: string = firstLegendNode.data()[0].tooltip;
    const lastLegendNode = d3select<any, LegendDataPoint>(legendItems.nodes()[legendItemsLen - 1]);
    const lastName: string = lastLegendNode.data()[0].tooltip;

    console.log(firstName)
    console.log(lastName)

    let legendItemsFirstIndex: number;
    let legendItemsLastIndex: number;
    for (let j = 0; j < dataPoints.length; j++) {
        let label: string = dataPoints[j].label;
        if (label == firstName) {
            legendItemsFirstIndex = j;
        }
        if (label == lastName) {
            legendItemsLastIndex = j;
        }
    }

    console.log(legendItemsFirstIndex)
    console.log(legendItemsLastIndex)

    const isLastData: boolean = legendItemsLastIndex == dataPoints.length - 1;

    let titleElement: d3Selection<any> = legendGroup.select('.legendTitle');
    let titleWidth: number = 0;
    if (titleElement && !titleElement.empty()) {
        let maxTitleWidth: number = isTopOrBottomLegend ? svgLegendWidth / 3 : svgLegendWidth;
        let maxTitleWidthPoint: number = fromPixelToPoint(maxTitleWidth);
        let textProp: TextProperties = {
            text: legendSettings.legendName,
            fontFamily: legendSettings.fontFamily,
            fontSize: legendSettings.fontSize + "px"
        };
        let shortTitle: string = getTailoredTextOrDefault(textProp, maxTitleWidthPoint);
        titleElement.text(shortTitle);
        titleElement.append('title').text(legendSettings.legendName);

        textProp.text = shortTitle;
        titleWidth = fromPointToPixel(measureTextWidth(textProp));
    }

    let arrowCount: number = 0;
    let defaultArrows: d3Selection<any> = legendGroup.selectAll(Visual.NavigationArrow.selectorName);
    let arrowLeft: d3Selection<any> = legendGroup.selectAll(Visual.NavigationArrowCustomLeft.selectorName);
    let arrowRight: d3Selection<any> = legendGroup.selectAll(Visual.NavigationArrowCustomRight.selectorName);

    let defaultTranslateXForTopOrBottomCenter: number = 5;
    let defaultTranslateYForTopOrBottomCenter: number = 0;
    let translateLegendGroupX: number = 0;

    if (isTopOrBottomLegend && legendItemsLen < dataPoints.length) {
        let arrowY: number = (svgLegendHeight - arrowHeight) / 2;
        defaultArrows.attr('transform', 'translate(' + svgLegendWidth + ',' + arrowY + ')')
            .attr('opacity', 0);
        if (legendSettings.position == "TopCenter" || legendSettings.position == "BottomCenter") {
            translateLegendGroupX = defaultTranslateXForTopOrBottomCenter;
            let transform: string = 'translate(' + defaultTranslateXForTopOrBottomCenter + ',' + defaultTranslateYForTopOrBottomCenter + ')';
            legendGroup.attr('transform', transform);
        }

        // TODO Fix left arrow
        // let leftArrowX: number = -translateLegendGroupX - arrowWidth;
        // if (legendItemsFirstIndex != 0) {
        //     leftArrowX = titleWidth + padding;
        //     arrowCount = arrowCount + 1;
        // }
        //
        // if (arrowLeft.nodes()[0] == null) {
        //     arrowLeft = legendGroup.append('g')
        //         .classed(Visual.NavigationArrowCustomLeft.className, true)
        //         .attr('transform', 'translate(' + leftArrowX + ',' + arrowY + ')');
        //     arrowLeft.append('path')
        //         .attr("d", "M0 0L0 15L7.5 7.5 Z")
        //         .attr("transform", "rotate(180 3.75 7.5)");
        // } else {
        //     arrowLeft.attr('transform', 'translate(' + leftArrowX + ',' + arrowY + ')');
        // }

        // let rightArrowX: number = svgLegendWidth;
        // if (!isLastData) {
        //     rightArrowX = svgLegendWidth - arrowWidth - translateLegendGroupX;
        //     arrowCount = arrowCount + 1;
        // }

        // if (arrowRight.nodes()[0] == null) {
        //     arrowRight = legendGroup.append('g')
        //         .classed(Visual.NavigationArrowCustomRight.className, true)
        //         .attr('transform', 'translate(' + rightArrowX + ',' + arrowY + ')');
        //     arrowRight.append('path')
        //         .attr("d", "M0 0L0 15L7.5 7.5 Z")
        //         .attr("transform", "rotate(0 3.75 7.5)");
        // } else {
        //     arrowRight.attr('transform', 'translate(' + rightArrowX + ',' + arrowY + ')');
        // }
    } else {
        arrowLeft.remove();
        arrowRight.remove();
        defaultArrows.attr('opacity', 1);
    }

    legend.selectAll('defs').remove();
    let defs: d3Selection<any> = legend.append("defs");
    let prefixForArrow: number = legendItemsFirstIndex == 0 ? 0 : arrowWidth;
    let cx0: number = isTopOrBottomLegend ? translateLegendGroupX + titleWidth + paddingText + prefixForArrow : minCx;
    let cx1: number = cx0;
    let currentItemWidth: number = (svgLegendWidth - arrowWidth - cx0) / legendItemsLen - padding;
    currentItemWidth = currentItemWidth < 0 ? 0 : currentItemWidth;

    for (let i = 0; i < legendItemsLen; i++) {
        let parent: d3Selection<any> = d3select(legendItems.nodes()[i]);
        const legendIconElement = parent.select('.legendIcon')
        const legendIconElementTransform = legendIconElement.attr('transform')
        const translate = parseTranslateTransform(legendIconElementTransform);
        let cx: number = isTopOrBottomLegend
            ? ((isLastData)
                ? cx1
                : cx0 + i * currentItemWidth)
            : minCx;
        const cy = +translate.y;
        legendIconElement.attr('transform', svgTranslate(cx, cy));

        let text: d3Selection<any> = parent.select('text');
        let name: string = parent.select('title').text();
        console.log(name)

        let dataPointIndex: number;
        for (let j = 0; j < dataPoints.length; j++) {
            if (dataPoints[j].label == name) {
                dataPointIndex = j;
                break;
            }
        }

        let dataPoint: LegendDataPointExtended = dataPoints[dataPointIndex];
        console.log(dataPoint)

        //start set short name for legend label
        let textProp: TextProperties = {
            text: name,
            fontFamily: legendSettings.fontFamily,
            fontSize: legendSettings.fontSize + "px"
        };
        let shortText: string;
        if (isTopOrBottomLegend) {
            cx = isLongMarker ? cx + lineLen / 2 : cx + circleD / 2;
            legendIconElement.attr('transform', svgTranslate(cx, cy));
            let deltaX: number = isLongMarker ? -padding - lineLen : -padding - circleD;
            deltaX = (i < legendItemsLen - 1) ? deltaX + currentItemWidth : deltaX + svgLegendWidth - arrowWidth - cx;
            let maxTextLen: number = fromPixelToPoint(deltaX);
            shortText = getTailoredTextOrDefault(textProp, maxTextLen);
            textProp.text = shortText;
            let textLen: number = fromPointToPixel(measureTextWidth(textProp));
            cx1 = isLongMarker ? cx + lineLen / 2 : cx + circleD / 2;
            cx1 = cx1 + padding + textLen + padding;
        } else {
            let textX: number = +text.attr('x');
            let textLen: number = isLongMarker
                ? svgLegendWidth - textX + (circleD - lineLen)
                : svgLegendWidth - textX;
            let maxTextLen: number = fromPixelToPoint(textLen) - padding;
            shortText = getTailoredTextOrDefault(textProp, maxTextLen);
        }

        text.text(shortText);

        //end set short name for legend label
        parent.selectAll('.legend-item-line').remove();
        parent.selectAll('.legend-item-marker').remove();

        legendIconElement.attr('opacity', 1);

        let customLegendLine: d3Selection<any> = parent.insert("path", ":first-child").classed("legend-item-line", true);
        let customLegendMarker: d3Selection<any> = parent.insert("path", "circle").classed("legend-item-marker", true);

        console.log(legendStyle)
        switch (legendStyle) {
            case LegendIconType.markers: {
                text.attr('x', cx + circleD / 2 + padding);
                let showMarkers: boolean = (dataPoint.showMarkers == true || (dataPoint.showMarkers == null && this.shapes.showMarkers));
                if (showMarkers) {
                    // draw marker
                    MarkersUtility.initMarker(defs, dataPoint.label + LegendBehavior.legendMarkerSuffix + LegendBehavior.dimmedLegendMarkerSuffix, dataPoint.seriesMarkerShape, markerSize, LegendBehavior.dimmedLegendColor);
                    let color: string = legendSettings.matchLineColor ? dataPoint.color : dataPoint.markerColor;
                    let markerId: string = MarkersUtility.initMarker(defs, dataPoint.label + LegendBehavior.legendMarkerSuffix, dataPoint.seriesMarkerShape, markerSize, color);
                    if (markerId) {
                        customLegendMarker.attr('d', "M" + cx + "," + cy + "Z")
                            .attr('stroke-width', "2")
                            .attr('fill', "none")
                            .attr('marker-start', 'url(#' + markerId + ')')
                            .append('title')
                            .text(dataPoint.label);
                        legendIconElement.attr('opacity', 0);
                    }
                } else {
                    if (legendSettings.circleDefaultIcon != true) {
                        //draw short line
                        customLegendLine.attr('transform', "translate(" + cx + "," + cy + ")")
                            .attr('d', "M0 0 m -5 0 l 10 0")
                            .attr('stroke-width', "2")
                            .style('fill', dataPoint.color)
                            .style('stroke', dataPoint.color)
                            .style('stroke-linejoin', 'round')
                            .append('title')
                            .text(dataPoint.label);
                        legendIconElement.attr('opacity', 0);
                    }
                }
                break;
            }
            case LegendIconType.lineMarkers: {
                //draw line and marker
                let textX: number = cx + lineLen / 2 + padding;
                text.attr('x', textX);
                let lineStart: number = -lineLen - padding;
                let lineEnd: number = -padding;
                customLegendLine.attr('transform', "translate(" + textX + "," + cy + ")")
                    .attr('d', "M" + lineStart + ",0L" + lineEnd + ",0")
                    .attr('stroke-width', "2")
                    .attr('fill', "none")
                    .style('stroke', dataPoint.color)
                    .append('title')
                    .text(dataPoint.label);

                legendIconElement.attr('opacity', 0);
                legendIconElement.attr('r', lineLen / 2);
                let showMarkers: boolean = (dataPoint.showMarkers == true || (dataPoint.showMarkers == null && this.shapes.showMarkers));
                if (showMarkers) {
                    MarkersUtility.initMarker(defs, dataPoint.label + LegendBehavior.legendMarkerSuffix + LegendBehavior.dimmedLegendMarkerSuffix, dataPoint.seriesMarkerShape, markerSize, LegendBehavior.dimmedLegendColor);
                    let markerId: string = MarkersUtility.initMarker(defs, dataPoint.label + LegendBehavior.legendMarkerSuffix, dataPoint.seriesMarkerShape, markerSize, dataPoint.markerColor);
                    if (markerId) {
                        customLegendMarker.attr('d', "M" + cx + "," + cy + "Z")
                            .attr('stroke-width', "2")
                            .attr('fill', "none")
                            .attr('marker-start', 'url(#' + markerId + ')')
                            .append('title')
                            .text(dataPoint.label);
                    }
                }
                break;
            }
            case LegendIconType.line: {
                customLegendMarker.remove();
                //draw line
                let textX: number = cx + lineLen / 2 + padding;
                text.attr('x', textX);
                let lineStart: number = -lineLen - padding;
                let lineEnd: number = -padding;
                customLegendLine.attr('transform', "translate(" + textX + "," + cy + ")")
                    .attr('d', "M" + lineStart + ",0L" + lineEnd + ",0")
                    .attr('stroke-width', "2")
                    .attr('fill', 'none')
                    .style('stroke', dataPoint.color)
                    .append('title')
                    .text(dataPoint.label);
                legendIconElement.attr('opacity', 0);
                legendIconElement.attr('r', lineLen / 2);
                break;
            }
        }
    }

    if (legendSettings.position == "TopCenter" || legendSettings.position == "BottomCenter") {
        translateLegendGroupX = (isLastData)
            ? (translateLegendGroupX + svgLegendWidth - cx1 + padding) / 2
            : defaultTranslateXForTopOrBottomCenter;
        let transform: string = 'translate(' + translateLegendGroupX + ',' + defaultTranslateYForTopOrBottomCenter + ')';
        legendGroup.attr('transform', transform);
    }
}

export function calculateItemWidth(legendSettings: LegendSettings, dataPoints: LegendDataPointExtended[]): number {
    if (!dataPoints || dataPoints.length == 0) return 0;
    let sumLength: number = 0;
    let padding: number = legendSettings.fontSize / 4;
    let iconLength: number = dataPoints[0].markerShape == MarkerShape.circle ? circleD : lineLen;
    for (let i = 0; i < dataPoints.length; i++) {
        let dataPoint: LegendDataPointExtended = dataPoints[i];
        let textProp: TextProperties = {
            text: dataPoint.label,
            fontFamily: legendSettings.fontFamily,
            fontSize: legendSettings.fontSize + "px"
        };
        let textLength: number = fromPointToPixel(measureTextWidth(textProp));
        let dataPointLength: number = iconLength + padding + textLength + padding;
        sumLength = sumLength + dataPointLength;
    }
    let itemWidth: number = dataPoints.length > 0
        ? sumLength / dataPoints.length
        : sumLength;
    return itemWidth;
}

export function generateLegendItemsForLeftOrRightClick(legendItems: d3Selection<any>, dataPoints: LegendDataPointExtended[], itemWidth: number, isLeft: boolean): d3Selection<any> {
    if (!legendItems || !dataPoints || itemWidth == 0) return;

    // let legendItemsLen: number = legendItems && !legendItems.empty() ? legendItems.size() : 0;
    // if (legendItemsLen < 1) return;
    // let legendGroup: d3Selection<any> = d3select(legendItems.node().parentElement);
    // let legend: d3Selection<any> = d3select(legendGroup.node().parentElement);
    //
    // let titleElement: d3Selection<any> = legendGroup.select('.legendTitle');
    // let titleWidth: number = 0;
    // let simpleTextElement: d3Selection<any> = legendGroup.select('text');
    // let fontFamily: string = simpleTextElement.style('font-family');
    // let fontSize: string = simpleTextElement.style('font-size');
    // if (titleElement && !titleElement.empty() && titleElement.node()) {
    //     let innerTitle: string = titleElement.select('title').text();
    //     let text: string = titleElement.text().split(innerTitle)[0];
    //     let textProp: TextProperties = {
    //         text: text,
    //         fontFamily: fontFamily,
    //         fontSize: fontSize
    //     };
    //     titleWidth = measureTextWidth(textProp);
    // }
    //
    // let svgLegendWidth: number = +legend.attr('width');
    // let width: number = svgLegendWidth - titleWidth - paddingText - 2 * arrowWidth;
    //
    // let numberOfItems: number = width / itemWidth;
    // let numberOfItemsInt: number = Math.ceil(numberOfItems);
    // numberOfItems = numberOfItemsInt > numberOfItems ? numberOfItemsInt - 1 : numberOfItemsInt;
    // if (numberOfItems <= 0)
    //     numberOfItems = 1;
    //
    // let start: number;
    // let end: number;
    // let parent: d3Selection<any>;
    // if (isLeft) {
    //     parent = d3select(legendItems.node());
    //     let firstName: string = parent.select('title').text();
    //     let legendItemsFirstIndex: number = 0;
    //     for (let j = 0; j < dataPoints.length; j++) {
    //         if (dataPoints[j].label == firstName) {
    //             legendItemsFirstIndex = j;
    //             break;
    //         }
    //     }
    //     end = legendItemsFirstIndex;
    //     start = end - numberOfItems;
    //     if (start < 0) {
    //         start = 0;
    //         end = numberOfItems;
    //     }
    // } else {
    //     parent = d3select(legendItems.nodes()[legendItemsLen - 1]);
    //     let lastName: string = parent.select('title').text();
    //     let legendItemsLastIndex: number;
    //     for (let j = 0; j < dataPoints.length; j++) {
    //         if (dataPoints[j].label == lastName) {
    //             legendItemsLastIndex = j;
    //             break;
    //         }
    //     }
    //     start = legendItemsLastIndex + 1;
    //     end = start + numberOfItems;
    // }
    // let newDataPoints: LegendDataPointExtended[] = dataPoints.slice(start, end);
    // if (newDataPoints.length > 0)
    //     legendItems = generateLegendItems(legendItems, newDataPoints);
    // return legendItems;
}

function generateLegendItems(legendItems: d3Selection<any>, newDataPoints: LegendDataPointExtended[]): d3Selection<any> {
    console.log(legendItems)
    console.log(newDataPoints)

    // const legendIconElement = legendItems.select('.legendIcon')
    // const legendIconElementTransform = legendIconElement.attr('transform')
    // const translate = parseTranslateTransform(legendIconElementTransform);
    // const circleY = +translate.y;
    //
    // let text: d3Selection<any> = legendItems.select('text');
    // let textY: string = text.attr('y');
    // let textFill: string = text.style('fill');
    // let textFontSize: string = text.style('font-size');
    //
    // let legendGroup: d3Selection<any> = d3select(legendItems.node().parentElement);
    // legendItems.remove();
    // for (let i = 0; i < newDataPoints.length; i++) {
    //     let dataPoint: LegendDataPointExtended = newDataPoints[i];
    //     let legendItem: d3Selection<any> = legendGroup.append("g").classed('legendItem', true);
    //     legendItem.append('circle')
    //         .classed('legendIcon', true)
    //         .attr('cx', 0)
    //         .attr('cy', circleY)
    //         .attr('r', 5)
    //         .style('fill', LegendBehavior.dimmedLegendColor);
    //     legendItem.append('text')
    //         .classed('legendText', true)
    //         .attr('x', 0)
    //         .attr('y', textY)
    //         .style('fill', textFill)
    //         .style('font-size', textFontSize)
    //         .text(dataPoint.label);
    //     legendItem.append('title').text(dataPoint.label);
    //
    //     // legendItem.append(() => legendIconElement.node())
    //     // legendItem.append(() => text.node())
    // }
    //
    // legendItems = legendGroup.selectAll('.legendItem').data(newDataPoints);
    return legendItems;
}

export function getLegendData(dataView: DataView, host: IVisualHost, legend: LegendSettings): LegendDataExtended {
    let isLegendFilled: boolean = IsLegendFilled(dataView);
    let legendIcons = {
        "markers": LegendIconType.markers,
        "linemarkers": LegendIconType.lineMarkers,
        "line": LegendIconType.line,
    };

    let legendIcon: LegendIconType = legendIcons[legend.style];
    if (isLegendFilled) {
        return buildLegendData(dataView,
            host,
            legend,
            legendIcon);
    }

    return buildLegendDataForMultipleValues(host, dataView, legendIcon, legend.legendName);
}

function IsLegendFilled(dataView: DataView): boolean {
    const columns: DataViewMetadataColumn[] = dataView.metadata.columns;
    for (let i = 0; i < columns.length; i++) {
        let column: DataViewMetadataColumn = columns[i];
        if (column.roles["Legend"]) {
            return true;
        }
    }
    if (dataView.categorical.categories == null) {
        const grouped: DataViewValueColumnGroup[] = dataView.categorical.values.grouped();
        return grouped.length > 1;
    }
    return false;
}

function buildLegendData(
    dataView: DataView,
    host: IVisualHost,
    legendObjectProperties: LegendSettings,
    legendIcon: LegendIconType): LegendDataExtended {
    const colorHelper: ColorHelper = new ColorHelper(
        host.colorPalette,
        {objectName: "dataPoint", propertyName: "fill"});

    const legendItems: LegendDataPointExtended[] = [];

    let dataValues: DataViewValueColumns = dataView.categorical.values;
    const grouped: DataViewValueColumnGroup[] = dataValues.grouped();

    let legendColumn = retrieveLegendCategoryColumn(dataView);
    if (grouped.length > 1) {
        for (let i: number = 0, len: number = grouped.length; i < len; i++) {
            let grouping: DataViewValueColumnGroup = grouped[i];

            let color: string = colorHelper.getColorForSeriesValue(
                grouping.objects,
                grouping.name);

            let selectionId: ISelectionId = host.createSelectionIdBuilder()
                .withSeries(dataValues, grouping)
                .createSelectionId();
            let label: string = grouping.name.toString();
            legendItems.push({
                color: color,
                markerColor: color,
                markerShape: MarkerShape.circle,
                seriesMarkerShape: SeriesMarkerShape.circle,
                style: legendIcon,
                label: label,
                tooltip: label,
                object: grouping.objects,
                identity: selectionId,
                selected: false
            });
        }
    } else {
        let legendLength: number = legendColumn && legendColumn.values ? legendColumn.values.length : 0;
        let legendKeys: string[] = [];
        for (let i: number = 0; i < legendLength; i++) {
            let name: string = legendColumn.values[i].toString();
            if (legendKeys.indexOf(name) == -1) {
                legendKeys.push(name);
                let object: DataViewObjects = legendColumn.objects && legendColumn.objects.length > i
                    ? legendColumn.objects[i]
                    : null;
                let color: string = colorHelper.getColorForSeriesValue(
                    object,
                    name);

                let selectionId: ISelectionId = host.createSelectionIdBuilder()
                    .withCategory(legendColumn, i)
                    .createSelectionId();
                legendItems.push({
                    color: color,
                    markerColor: color,
                    markerShape: MarkerShape.circle,
                    seriesMarkerShape: SeriesMarkerShape.circle,
                    style: legendIcon,
                    label: name,
                    tooltip: name,
                    object: object,
                    identity: selectionId,
                    selected: false
                });
            }
        }
    }

    let column: DataViewMetadataColumn = retrieveLegendMetadataColumn(dataView);
    const legendTitle = column
        ? column.displayName
        : legendObjectProperties.legendName;

    if (legendObjectProperties.legendName == null) {
        legendObjectProperties.legendName = legendTitle;
    }

    return {
        title: legendTitle,
        dataPoints: legendItems
    };
}

function retrieveLegendMetadataColumn(dataView: DataView): DataViewMetadataColumn {
    let column: DataViewMetadataColumn = null;
    let columns: DataViewMetadataColumn[] = dataView.metadata.columns;
    let columnsLen: number = columns ? columns.length : 0;
    for (let i = 0; i < columnsLen; i++) {
        let item: DataViewMetadataColumn = columns[i];
        if (item.roles["Legend"]) {
            column = item;
            break;
        }
    }
    return column;
}

export function retrieveLegendCategoryColumn(dataView: DataView): DataViewCategoryColumn {
    let legendColumn: DataViewCategoryColumn = null;
    let categories: DataViewCategoryColumn[] = dataView.categorical.categories;
    let categoriesLen: number = categories ? categories.length : 0;
    for (let i = 0; i < categoriesLen; i++) {
        let category: DataViewCategoryColumn = categories[i];
        if (category.source.roles["Legend"]) {
            legendColumn = category;
            break;
        }
    }
    return legendColumn;
}

function getNumberOfValues(dataView: DataView): number {
    const columns: DataViewMetadataColumn[] = dataView.metadata.columns;
    let valueFieldsCount: number = 0;

    for (let columnName in columns) {
        const column: DataViewMetadataColumn = columns[columnName];

        if (column.roles && column.roles["Values"]) {
            ++valueFieldsCount;
        }
    }

    return valueFieldsCount;
}

function buildLegendDataForMultipleValues(
    host: IVisualHost,
    dataView: DataView,
    legendIcon: LegendIconType,
    title: string): LegendDataExtended {
    let colorHelper: ColorHelper = new ColorHelper(
        host.colorPalette,
        {objectName: "dataPoint", propertyName: "fill"});

    const legendItems: LegendDataPointExtended[] = [];

    const values = dataView.categorical.values;

    const numberOfValueFields = getNumberOfValues(dataView);
    let lastColors: string[] = [];
    for (let i = 0; i < numberOfValueFields; i++) {
        let selectionId: ISelectionId = host.createSelectionIdBuilder()
            .withMeasure(values[i].source.queryName)
            .createSelectionId();

        let objects: DataViewObjects = values[i].source.objects;
        let colorFromObject: string = colorHelper.getColorForMeasure(
            objects,
            values[i].source.queryName);
        let currentColor = i == 0 ? colorFromObject : lastColors[i - 1];
        let j: number = 0;
        while (lastColors.indexOf(currentColor) != -1) {
            currentColor = host.colorPalette.getColor("value" + j.toString()).value;
            j = j + 1;
        }
        lastColors.push(currentColor);

        let color: string = objects && objects.dataPoint ? colorFromObject : currentColor;

        let label: string = values[i].source.displayName;

        legendItems.push({
            color: color,
            markerColor: color,
            markerShape: MarkerShape.circle,
            seriesMarkerShape: SeriesMarkerShape.circle,
            style: legendIcon,
            label: label,
            tooltip: label,
            object: values[i].source.objects,
            identity: selectionId,
            selected: false
        });
    }

    colorHelper = null;

    return {
        title: title,
        dataPoints: legendItems
    };
}

function appendLegendMargins(legend: ILegend, margins: IMargin) {

    if (legend) {
        let legendViewPort: IViewport = legend.getMargins();
        let legendOrientation: LegendPosition = legend.getOrientation();
        let svgLegend: d3Selection<any> = d3select('svg.legend');
        let width: number = +svgLegend.attr('width');

        if (legend.isVisible()) {
            if (legendOrientation == LegendPosition.Top || legendOrientation == LegendPosition.TopCenter) {
                margins.top += legendViewPort.height;
            } else if (legendOrientation == LegendPosition.Left || legendOrientation == LegendPosition.LeftCenter) {
                margins.left += width;
            } else if (legendOrientation == LegendPosition.Right || legendOrientation == LegendPosition.RightCenter) {
                margins.right += width;
            } else {
                margins.bottom += legendViewPort.height;
            }
        }
    }
    return margins;
}

export function positionChartArea(container: d3Selection<any>, legend: ILegend) {
    let margin = {top: 0, left: 0, bottom: 0, right: 0};
    appendLegendMargins(legend, margin);
    if (margin.top)
        container.style('margin-top', margin.top + 'px');
    if (margin.bottom)
        container.style('margin-bottom', margin.bottom + 'px');
    if (margin.left)
        container.style('margin-left', margin.left + 'px');
    if (margin.right)
        container.style('margin-right', margin.right + 'px');
}
