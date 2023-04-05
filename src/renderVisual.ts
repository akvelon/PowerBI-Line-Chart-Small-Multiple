'use strict';

import powerbi from 'powerbi-visuals-api';
import {
    Coordinates,
    d3Selection,
    LabelsAction,
    LineDataPoint,
    SimplePoint,
    VerticalLineDataItem,
    VerticalLineDataItemsGlobalWithKey,
    VisualDomain,
    VisualViewModel,
    XAxisData,
} from './visualInterfaces';
import {IInteractivityService} from 'powerbi-visuals-utils-interactivityutils/lib/interactivityBaseService';
import {ITooltipServiceWrapper} from 'powerbi-visuals-utils-tooltiputils';
import {AxisPosition, DataLabelEps, DataLabelR, NiceDateFormat, VisualSettings} from './settings';
import {IValueFormatter, ValueFormatterOptions} from 'powerbi-visuals-utils-formattingutils/lib/src/valueFormatter';
import {Formatter, getLineStyleParam} from './utilities/vizUtility';
import {
    DisplayUnitSystemType,
} from 'powerbi-visuals-utils-formattingutils/lib/src/displayUnitSystem/displayUnitSystemType';
import {Visual} from './visual';
import {
    NumberValue,
    scaleLinear as d3scaleLinear,
    scaleLog as d3scaleLog,
    scalePoint as d3scalePoint,
    scaleTime as d3scaleTime,
} from 'd3-scale';
import {
    fromPoint,
    fromPointToPixel,
    measureTextWidth,
    TextProperties,
    truncateAxis,
    wrapAxis,
} from './utilities/textUtility';
import {getTailoredTextOrDefault} from 'powerbi-visuals-utils-formattingutils/lib/src/textMeasurementService';
import {curveLinear as d3curveLinear, line as d3line, Line as d3Line} from 'd3-shape';
import {Axis as d3Axis, axisBottom as d3axisBottom, AxisDomain, axisLeft as d3axisLeft, AxisScale} from 'd3-axis';
import {MarkersUtility} from './utilities/markersUtility';
import {getOpacity} from './behavior';
import {select as d3select} from 'd3-selection';
import {drawPointsForVerticalLine, findNearestVerticalLineIndex, generateVerticalLineData} from './verticalLine';
import {ISize} from 'powerbi-visuals-utils-svgutils/lib/shapes/shapesInterfaces';
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import PrimitiveValue = powerbi.PrimitiveValue;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;

export class RenderVisual {
    private categories: PrimitiveValue[];
    private categoryIsDate: boolean;
    private categoryIsScalar: boolean;
    private categoryName: string;
    private valuesName: string;
    private settings: VisualSettings;

    private xFormatter: IValueFormatter;
    private yFormatter: IValueFormatter;
    private dataLabelFormatter: IValueFormatter;
    private tooltipFormatter: IValueFormatter;
    private tooltipServiceWrapper: ITooltipServiceWrapper;
    public verticalLineDataItemsGlobal: VerticalLineDataItemsGlobalWithKey;

    private domainY: VisualDomain;
    private isSeparateDomainY: boolean;
    private interactivityService: IInteractivityService<any>;
    private hasSelection: boolean;

    private ResponsiveMinWidth: number = 50;
    private ResponsiveMinHeight: number = 50;
    private MaxYLogScaleShowDivider: number = 15;
    private MaxLogScaleDivider: number = 10;

    constructor(host: IVisualHost, container: d3Selection<any>, model: VisualViewModel, domainY: VisualDomain, interactivityService: IInteractivityService<any>, tooltipServiceWrapper: ITooltipServiceWrapper) {
        this.categories = model.categories;
        this.categoryIsDate = model.categoryIsDate;
        this.categoryIsScalar = model.categoryIsScalar;
        this.categoryName = model.categoryName;
        this.valuesName = model.valuesName;
        this.settings = model.settings;
        this.domainY = domainY;
        this.isSeparateDomainY = model.settings.yAxis.chartRangeType == 'separate';

        if (model.categoryIsScalar) {
            this.xFormatter = Formatter.getFormatter({
                format: model.categoryFormat,
                value: model.settings.xAxis.displayUnits,
                precision: model.settings.xAxis.precision,
                displayUnitSystemType: 0,
                cultureSelector: host.locale,
            });
        } else {
            const format: string = (model.categoryIsDate && !model.categoryFormat) ? NiceDateFormat : model.categoryFormat;
            this.xFormatter = Formatter.getFormatter({
                format: format,
                cultureSelector: host.locale,
            });
        }

        this.yFormatter = Formatter.getFormatter({
            format: model.valueFormat,
            value: model.settings.yAxis.displayUnits,
            formatSingleValues: (model.settings.yAxis.displayUnits == 0),
            precision: model.settings.yAxis.precision,
            displayUnitSystemType: 0,
            cultureSelector: host.locale,
        });
        const displayUnits: number = model.settings.dataLabels.displayUnits != 0 ? model.settings.dataLabels.displayUnits : model.settings.yAxis.displayUnits;
        const precision: number = model.settings.dataLabels.precision != null ? model.settings.dataLabels.precision : 1;
        const properties: ValueFormatterOptions = {
            value: displayUnits,
            formatSingleValues: displayUnits == 0,
            allowFormatBeautification: true,
            displayUnitSystemType: DisplayUnitSystemType.DataLabels,
            precision: precision,
            cultureSelector: host.locale,
        };
        this.dataLabelFormatter = Formatter.getFormatter(properties);
        this.tooltipFormatter = Formatter.getFormatter({
            value: 0,
            precision: undefined,
            displayUnitSystemType: 0,
            cultureSelector: host.locale,
        });
        this.interactivityService = interactivityService;
        this.hasSelection = interactivityService && interactivityService.hasSelection();
        this.tooltipServiceWrapper = tooltipServiceWrapper;
        this.verticalLineDataItemsGlobal = {};

        //clear drawed lines
        container.selectAll(Visual.SmallMultipleSelector.selectorName).remove();
    }

    public renderSmallMultipleWithTitle(
        itemContainer: d3Selection<SVGElement>,
        itemWidth: number,
        itemHeight: number,
        titleHeight: number,
        title: string,
        lines: LineDataPoint[],
        lineKey: string,
        rectGlobalX: number,
        rectGlobalY: number) {
        itemContainer.classed(Visual.SmallMultipleSelector.className, true);
        if (this.settings.smallMultiple.showChartTitle) {
            const textContainer: d3Selection<SVGElement> = itemContainer.append('g')
                .attr('width', itemWidth)
                .attr('height', titleHeight);
            textContainer.append('rect')
                .classed('clearCatcher', true)
                .attr('width', itemWidth)
                .attr('height', titleHeight);

            const titleFontFamily: string = this.settings.smallMultiple.fontFamily;
            const titleFontSize: string = this.settings.smallMultiple.fontSize + 'px';
            const titleTextProp: TextProperties = {
                text: title,
                fontFamily: titleFontFamily,
                fontSize: titleFontSize,
            };
            const titleWidth: number = measureTextWidth(titleTextProp);
            const titleX: number = (titleWidth > itemWidth) ? 0 : (itemWidth - titleWidth) / 2;
            const shortTitle = getTailoredTextOrDefault(titleTextProp, itemWidth);

            textContainer.append('text')
                .classed(Visual.SmallMultipleNameSelector.className, true)
                .attr('font-family', titleFontFamily)
                .attr('font-size', titleFontSize)
                .attr('fill', this.settings.smallMultiple.smColor)
                .attr('height', titleHeight)
                .attr('x', titleX)
                .attr('y', titleHeight * 2 / 3)
                .text(shortTitle);
            textContainer.append('title').text(title);

            const svgContainer: d3Selection<SVGElement> = itemContainer
                .append('g')
                .attr('width', itemWidth)
                .attr('height', itemHeight)
                .attr('transform', 'translate(0,' + titleHeight + ')');
            this.renderSmallMultiple(svgContainer, lines, itemWidth, itemHeight, lineKey, false, 0, false, rectGlobalX, rectGlobalY + titleHeight);
        } else {
            this.renderSmallMultiple(itemContainer, lines, itemWidth, itemHeight, lineKey, false, 0, false, rectGlobalX, rectGlobalY);
        }
    }

    public retrieveNewLegendPosition(
        svgContainer: d3Selection<SVGElement>,
        lines: LineDataPoint[],
        width: number,
        height: number,
        legendPosition: string,
        legendHeight: number): string {
        if (!this.settings.general.responsive || legendPosition == 'None')
            return legendPosition;
        let resultLegendPosition: string = legendPosition;

        let axisPadding: number = this.retrieveAxisPadding();
        let yAxisWidth = this.retrieveYAxisWidth(lines, svgContainer);
        let axisMargin: number = this.retrieveAxisMargin();
        let totalXWidth: number = width - yAxisWidth - axisPadding - 2 * axisMargin;

        if ((width - yAxisWidth - axisPadding - 2 * axisMargin < this.ResponsiveMinWidth)) {
            yAxisWidth = width - this.ResponsiveMinWidth - axisPadding - 2 * axisMargin;
            const minYAxisWidth: number = measureTextWidth({
                fontSize: this.settings.yAxis.fontSize + 'px',
                fontFamily: this.settings.yAxis.fontFamily,
                text: '...',
            });
            if (yAxisWidth < minYAxisWidth) {
                axisPadding = 0;
                axisMargin = 5;
                yAxisWidth = 0;
            }
            if (legendPosition != 'Top' && legendPosition != 'TopCenter')
                return 'Top';
        }
        totalXWidth = width - yAxisWidth - axisPadding - 2 * axisMargin;

        const xAxisDataPoints = this.categories;
        const xRange: number[] = this.retrieveXRange(yAxisWidth, axisPadding, axisMargin, width);
        const xIsCategorical: boolean = (this.settings.xAxis.axisType === 'categorical');
        const xAxisData: XAxisData = this.retrieveXData(xIsCategorical, lines, xAxisDataPoints, xRange);
        const x = xAxisData.x;

        const tickMaxWidth = xAxisDataPoints.length > 0
            ? ((xRange[1] - xRange[0]) / xAxisDataPoints.length)
            : 0;
        const plotSize = {width: width, height: height};
        let xAxisHeight = this.renderXAxis(svgContainer, plotSize, x, xIsCategorical, xAxisDataPoints, tickMaxWidth, xRange, axisPadding, xAxisData.start, xAxisData.end);
        if (height - legendHeight - xAxisHeight - axisPadding < this.ResponsiveMinHeight) {
            xAxisHeight = 0;
        }
        svgContainer.selectAll('svg').remove();

        if ((totalXWidth < this.ResponsiveMinWidth) || plotSize.height - legendHeight - xAxisHeight - axisPadding < this.ResponsiveMinHeight) {
            resultLegendPosition = 'None';
        }
        return resultLegendPosition;
    }

    private retrieveAxisPadding(): number {
        return 10;
    }

    private retrieveAxisMargin(): number {
        let longestXAxis: string | undefined;

        for (let i = 1; i < this.categories.length; i++) {
            const value: PrimitiveValue = this.categoryIsDate ? new Date(this.categories[i].toString()) : this.categories[i];
            const item: string = this.xFormatter.format(value);
            if (longestXAxis == null || item.length > longestXAxis.length)
                longestXAxis = item;
        }
        const xAxisFontSize = this.settings.xAxis.fontSize.toString() + 'px';
        const xAxisWidth: number = measureTextWidth({
            fontSize: xAxisFontSize,
            fontFamily: this.settings.xAxis.fontFamily,
            text: longestXAxis,
        });

        return xAxisWidth / 2;
    }

    private retrieveYAxisWidth(lines: LineDataPoint[], svgContainer: d3Selection<SVGElement>): number {
        let yAxisWidth = 0;
        if (this.settings.yAxis.show) {
            const yAxisFontSize = this.settings.yAxis.fontSize + 'px';

            const domainY: VisualDomain = this.retrieveDomainY(lines);
            const yScale: number[] = d3scaleLinear()
                .domain([domainY.end, domainY.start])
                .nice()
                .ticks();
            for (let i = 0; i < yScale.length; i++) {
                const yValue: string = this.yFormatter ? this.yFormatter.format(yScale[i]) : yScale[i].toString();
                const currentYValueLength: number = measureTextWidth({
                    fontSize: yAxisFontSize,
                    fontFamily: this.settings.yAxis.fontFamily,
                    text: yValue,
                });
                if (currentYValueLength > yAxisWidth)
                    yAxisWidth = currentYValueLength;
            }
            yAxisWidth = yAxisWidth + 5;
            if (this.settings.yAxis.showTitle) {
                const titleHeight: number = this.retrieveYAxisTitleHeight(svgContainer);
                yAxisWidth = yAxisWidth + titleHeight;
            }
        }
        return yAxisWidth;
    }

    private retrieveYAxisTitleHeight(svgContainer: d3Selection<SVGElement>): number {
        const titleCont: d3Selection<any> = svgContainer.append('g');
        const titleText: string = this.retrieveYAxisTitleText();
        titleCont.append('text')
            .attr('font-family', this.settings.yAxis.titleFontFamily)
            .attr('font-size', this.settings.yAxis.titleFontSize + 'px')
            .attr('fill', this.settings.yAxis.axisTitleColor)
            .text(titleText);
        const n = <any>titleCont.node();
        const titleHeight: number = n.getBBox().height;
        titleCont.remove();
        return titleHeight;
    }

    private retrieveYAxisTitleText(): string {
        let titleText: string = this.settings.yAxis.axisTitle ? this.settings.yAxis.axisTitle : this.valuesName;
        const titleStyle: string = (this.settings.yAxis.displayUnits == 1000 || this.settings.yAxis.displayUnits == 1000000 ||
            this.settings.yAxis.displayUnits == 1000000000 || this.settings.yAxis.displayUnits == 1000000000000)
            ? this.settings.yAxis.titleStyleFull
            : this.settings.yAxis.titleStyle;
        switch (titleStyle) {
            case 'showUnitOnly': {
                titleText = this.retrieveXDisplayUnitsForTitle(this.settings.yAxis.displayUnits);
                break;
            }
            case 'showBoth': {
                const displayUnits: string = this.retrieveXDisplayUnitsForTitle(this.settings.yAxis.displayUnits);
                titleText = titleText + ' (' + displayUnits + ')';
                break;
            }
        }
        return titleText;
    }

    private retrieveXRange(yAxisWidth: number, axisPadding: number, axisMargin: number, width: number): number[] {
        let xRange: number[];
        if (this.settings.yAxis.position == AxisPosition.Left) {
            xRange = [yAxisWidth + axisPadding + axisMargin, width - axisMargin];
        } else {
            xRange = [axisMargin, width - axisMargin - axisPadding - yAxisWidth];
        }
        if (xRange[1] < xRange[0]) {
            const n: number = xRange[0];
            xRange[0] = xRange[1];
            xRange[1] = n;
        }
        return xRange;
    }

    // eslint-disable-next-line max-lines-per-function
    private retrieveXData(
        xIsCategorical: boolean,
        lines: LineDataPoint[],
        xAxisDataPoints: PrimitiveValue[],
        xRange: number[]): XAxisData {
        let x: AxisScale<AxisDomain>;
        //set x
        let chartRangeType: string = this.settings.xAxis.chartRangeType;

        let start: number = 0;
        let end: number = 0;

        if (this.categoryIsDate) {
            const lastIndex: number = this.categories.length - 1;
            let minDate: Date = new Date(this.categories[0].toString());
            let maxDate: Date = new Date(this.categories[lastIndex].toString());
            if (chartRangeType == 'separate') {
                let minDateTemp: Date | null = null;
                let maxDateTemp: Date | null = null;
                for (let i = 0; i < lines.length; i++) {
                    const lineDataPoint: LineDataPoint = lines[i];
                    if (lineDataPoint.points) {
                        for (let j = 0; j < lineDataPoint.points.length; j++) {
                            const item: Date = lineDataPoint.points[j].x as Date;
                            if (minDateTemp == null || item < minDateTemp)
                                minDateTemp = item;
                            if (maxDateTemp == null || item > maxDateTemp)
                                maxDateTemp = item;
                        }
                    }
                }

                minDate = minDateTemp ?? minDate;
                maxDate = maxDateTemp ?? maxDate;

                const newxAxisDataPoints: Date[] = [];
                const keys: string[] = [];
                for (let i = 0; i < xAxisDataPoints.length; i++) {
                    const item: Date = xAxisDataPoints[i] as Date;
                    const itemKey: string = this.convertCategoryItemToString(item);
                    if ((minDate <= item) && (item <= maxDate) && (keys.indexOf(itemKey) == -1)) {
                        keys.push(itemKey);
                        newxAxisDataPoints.push(item);
                    }

                    if (item > maxDate)
                        break;
                }
                xAxisDataPoints = newxAxisDataPoints;
            }

            if (xIsCategorical) {
                const domain = xAxisDataPoints.map(primitiveValueToAxisDomain);
                x = d3scalePoint(domain, xRange);
            } else {
                x = d3scaleTime([minDate, maxDate], xRange);
            }
        } else {
            if (this.categoryIsScalar) {
                chartRangeType = this.settings.xAxis.chartRangeTypeForScalarAxis;
                const lastIndex: number = this.categories.length - 1;
                switch (chartRangeType) {
                    case 'custom': {
                        const startFormatted: number = (this.settings.xAxis.start != null) ? this.settings.xAxis.start : this.retrieveFormattedXValue(+this.categories[0]);
                        const endFormatted: number = (this.settings.xAxis.end != null) ? this.settings.xAxis.end : this.retrieveFormattedXValue(+this.categories[lastIndex]);
                        const precision = this.retrievexFormatPrecision();
                        start = startFormatted * precision;
                        end = endFormatted * precision;
                        lines = this.changeLinesForStartAndEndXAxis(lines, start, end);
                        const newxAxisDataPoints: number[] = [];
                        for (let i = 0; i < xAxisDataPoints.length; i++) {
                            const item: number = +xAxisDataPoints[i];
                            if ((start <= item) && (item <= end) && (newxAxisDataPoints.indexOf(item) == -1)) {
                                newxAxisDataPoints.push(xAxisDataPoints[i] as number);
                            }
                        }
                        xAxisDataPoints = newxAxisDataPoints;
                        break;
                    }
                    case 'separate': {
                        let startTemp: number | null = null;
                        let endTemp: number | null = null;
                        for (let i = 0; i < lines.length; i++) {
                            const lineItem: LineDataPoint = lines[i];
                            if (lineItem.points)
                                for (let j = 0; j < lineItem.points.length; j++) {
                                    const pointX: number = +lineItem.points[j].x;
                                    if (startTemp == null || pointX <= startTemp)
                                        startTemp = pointX;
                                    if (endTemp == null || pointX >= endTemp)
                                        endTemp = pointX;
                                }
                        }

                        start = startTemp ?? 0;
                        end = endTemp ?? 0;

                        break;
                    }
                    case 'common': {
                        start = +this.categories[0];
                        end = +this.categories[lastIndex];
                        break;
                    }
                }
            }

            if (chartRangeType == 'separate') {
                const newxAxisDataPoints: any[] = [];
                for (let k = 0; k < xAxisDataPoints.length; k++) {
                    const item: string = this.convertCategoryItemToString(xAxisDataPoints[k]);
                    let isExisted: boolean = false;
                    for (let i = 0; i < lines.length; i++) {
                        const lineItem: LineDataPoint = lines[i];
                        if (lineItem.points)
                            for (let j = 0; j < lineItem.points.length; j++) {
                                const pointX: string = this.convertCategoryItemToString(lineItem.points[j].x);
                                if (pointX == item) {
                                    isExisted = true;
                                    break;
                                }
                            }
                        if (isExisted)
                            break;
                    }
                    if (isExisted)
                        newxAxisDataPoints.push(xAxisDataPoints[k]);
                }
                xAxisDataPoints = newxAxisDataPoints;
            }

            if (xIsCategorical) {
                x = d3scalePoint(xAxisDataPoints as AxisDomain[], xRange);
            } else {
                if (start <= 0)
                    this.settings.xAxis.axisScale = 'linear';
                if (this.settings.xAxis.axisScale == 'linear') {
                    x = d3scaleLinear([start, end], xRange);
                } else {
                    if (chartRangeType != 'custom' && end / this.MaxLogScaleDivider <= start)
                        start = start / this.MaxLogScaleDivider;
                    x = d3scaleLog([start, end], xRange);
                }
            }
        }

        if (xAxisDataPoints.length == 1) {
            const domain = xAxisDataPoints.map(primitiveValueToAxisDomain);
            x = d3scalePoint(domain, xRange);
        }

        return {
            x: x,
            xAxisDataPoints: xAxisDataPoints,
            lines: lines,
            start: start,
            end: end,
        };
    }

    private retrieveResponsiveIcon(svgContainer: d3Selection<SVGElement>) {
        const svgAxisContainer: d3Selection<SVGElement> = svgContainer
            .append('svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('viewBox', '0 0 24 24');
        const g = svgAxisContainer.append('g').attr('fill', '#333');
        g.append('path')
            .attr('d', 'M12,16.5703125 L13.140625,16.5703125 L13.140625,10.859375 L12,10.859375 L12,16.5703125 Z M10.8515625,9.7109375 L14.28125,9.7109375 L14.28125,17.7109375 L10.8515625,17.7109375 L10.8515625,9.7109375 Z M7.421875,16.5703125 L8.5703125,16.5703125 L8.5703125,8.5703125 L7.421875,8.5703125 L7.421875,16.5703125 Z M6.28125,7.4296875 L9.7109375,7.4296875 L9.7109375,17.7109375 L6.28125,17.7109375 L6.28125,7.4296875 Z M16.5703125,16.5703125 L17.7109375,16.5703125 L17.7109375,6.28125 L16.5703125,6.28125 L16.5703125,16.5703125 Z M15.421875,5.140625 L18.8515625,5.140625 L18.8515625,17.7109375 L15.421875,17.7109375 L15.421875,5.140625 Z M5.140625,4 L5.140625,18.859375 L20,18.859375 L20,20 L4,20 L4,4 L5.140625,4 Z');
    }

    public retrieveMaxCountOfXAxis(lines: LineDataPoint[]): number {
        const xAxisData: XAxisData = this.retrieveXData(true, lines, this.categories, [0, 0]);
        return xAxisData.xAxisDataPoints.length;
    }

    // eslint-disable-next-line max-lines-per-function
    public renderSmallMultiple(
        svgContainer: d3Selection<SVGElement>,
        lines: LineDataPoint[],
        width: number,
        height: number,
        lineKey: string,
        isResponsive: boolean,
        legendHeight: number,
        isLegendHidden: boolean,
        rectGlobalX: number,
        rectGlobalY: number) {
        svgContainer.classed(Visual.SmallMultipleSelector.className, true);
        svgContainer = svgContainer.append('svg');
        const plotSize: ISize = {width: width, height: height};

        let axisPadding: number = this.retrieveAxisPadding();
        let yAxisWidth = this.retrieveYAxisWidth(lines, svgContainer);
        const yAxisFontSize = this.settings.yAxis.fontSize + 'px';
        let axisMargin: number = this.retrieveAxisMargin();

        let showYAxis: boolean = true;
        let totalXWidth: number = width - yAxisWidth - axisPadding - 2 * axisMargin;

        if (totalXWidth < this.ResponsiveMinWidth) {
            yAxisWidth = plotSize.width - this.ResponsiveMinWidth - axisPadding - 2 * axisMargin;
            const minYAxisWidth: number = measureTextWidth({
                fontSize: yAxisFontSize,
                fontFamily: this.settings.yAxis.fontFamily,
                text: '...',
            });
            if (yAxisWidth < minYAxisWidth) {
                if (isResponsive) {
                    showYAxis = false;
                    axisPadding = 0;
                    axisMargin = 5;
                    yAxisWidth = 0;
                } else {
                    yAxisWidth = minYAxisWidth;
                }
            }
        }

        totalXWidth = width - yAxisWidth - axisPadding - 2 * axisMargin;

        //X
        let xAxisDataPoints = this.categories;
        let xRange = this.retrieveXRange(yAxisWidth, axisPadding, axisMargin, width);
        const xIsCategorical = (this.settings.xAxis.axisType === 'categorical');
        let xAxisData = this.retrieveXData(xIsCategorical, lines, xAxisDataPoints, xRange);
        let x = xAxisData.x;
        xAxisDataPoints = xAxisData.xAxisDataPoints;
        lines = xAxisData.lines;

        let tickMaxWidth = xAxisDataPoints.length > 0
            ? ((xRange[1] - xRange[0]) / xAxisDataPoints.length)
            : 0;
        let xAxisHeight = this.renderXAxis(svgContainer, plotSize, x, xIsCategorical, xAxisDataPoints, tickMaxWidth, xRange, axisPadding, xAxisData.start, xAxisData.end);
        if (isResponsive && (plotSize.height - legendHeight - xAxisHeight - axisPadding < this.ResponsiveMinHeight || isLegendHidden)) {
            svgContainer.selectAll('svg').remove();
            xAxisHeight = 0;
            axisMargin = 5;
            //recount
            xRange = this.retrieveXRange(yAxisWidth, axisPadding, axisMargin, width);
            xAxisData = this.retrieveXData(xIsCategorical, lines, xAxisDataPoints, xRange);
            x = xAxisData.x;
            xAxisDataPoints = xAxisData.xAxisDataPoints;
            lines = xAxisData.lines;
            tickMaxWidth = xAxisDataPoints.length > 0
                ? ((xRange[1] - xRange[0]) / xAxisDataPoints.length)
                : 0;
        }

        //Y
        let yRangeMax: number = isLegendHidden
            ? plotSize.height - axisPadding - xAxisHeight + legendHeight
            : plotSize.height - axisPadding - xAxisHeight;
        if (yRangeMax < 0)
            yRangeMax = 0;

        const yRange: number[] = [axisPadding, yRangeMax];
        const domainY: VisualDomain = this.retrieveDomainY(lines);
        let y: AxisScale<AxisDomain>;
        if (this.settings.yAxis.axisScale == 'linear') {
            y = d3scaleLinear([domainY.end, domainY.start], yRange)
                .nice().nice();
        } else {
            y = d3scaleLog([domainY.end, domainY.start], yRange);
        }

        if (showYAxis)
            this.renderYAxis(svgContainer, plotSize, y, domainY, axisPadding, yAxisWidth, yAxisFontSize);

        if (isResponsive && ((totalXWidth < this.ResponsiveMinWidth) || (plotSize.height - xAxisHeight - axisPadding < this.ResponsiveMinHeight))) {
            //draw image
            svgContainer.selectAll('svg').remove();
            this.retrieveResponsiveIcon(svgContainer);
            return;
        }

        //Draw line
        if (lines.length == 0)
            return;
        const line = d3line<SimplePoint>()
            .x((d) => x(primitiveValueToAxisDomain(d.x)) ?? 0)
            .y((d) => y(d.y) ?? 0)
            .curve(d3curveLinear);

        //prepare vertical line
        const showVerticalLine: boolean = (tickMaxWidth > 1);
        let xMouseMin: number = 0;
        let xMouseMax: number = 0;
        let hoverContainer: d3Selection<SVGElement> | undefined = undefined;
        let tooltipRect: d3Selection<SVGElement>;

        if (showVerticalLine) {
            xMouseMin = xRange[0] - axisMargin;
            xMouseMax = xRange[1] + axisMargin;
            hoverContainer = svgContainer.append('svg');
            tooltipRect = hoverContainer.append('rect')
                .classed('clearCatcher', true)
                .classed(Visual.LineChartRectSelector.className, true)
                .attr('width', xMouseMax - xMouseMin)
                .attr('height', yRangeMax)
                .attr('x', xMouseMin)
                .attr('y', 0)
                .attr('opacity', '1e-06')
                .attr('fill', '#fff');
        }

        //Render lines
        this.renderLines(svgContainer, lines, plotSize.width, yRangeMax, line);

        this.renderDataLabels(lines, xMouseMin, xMouseMax, yRangeMax + axisPadding, line, svgContainer);
        //Render vertical line
        if (!showVerticalLine || !hoverContainer) return;


        const hoverLine: d3Selection<SVGElement> = hoverContainer.append('path') // this is the vertical line to follow mouse
            .classed(Visual.HoverLineSelector.className, true)
            .style('opacity', 0);
        let hoverLineData: d3Selection<number> = hoverLine.data([0]);

        const shapesShowMarkers: boolean = this.settings.shapes.showMarkers;
        const verticalLineDataItems: VerticalLineDataItem[] = generateVerticalLineData(this.categoryIsDate, this.xFormatter, this.tooltipFormatter,
            lines, xAxisDataPoints, line, shapesShowMarkers, rectGlobalX, rectGlobalY);

        this.verticalLineDataItemsGlobal[lineKey] = {
            verticalLineDataItems: verticalLineDataItems,
            hoverLineData: hoverLineData,
        };

        const tooltipServiceWrapper = this.tooltipServiceWrapper;
        svgContainer.on('mouseout', function () {
            tooltipServiceWrapper.hide();
            hoverLine.style('opacity', 0);
            hoverContainer.selectAll(Visual.CircleSelector.selectorName).remove();
        });
        const is: IInteractivityService<any> = this.interactivityService;
        svgContainer.on('click', function (e: MouseEvent) {
            const mouseX: number = e.x;
            const mouseY: number = e.y;
            if (mouseX < xMouseMin || xMouseMax < mouseX || mouseY > yRangeMax) {
                is.clearSelection();
            }
        });
        svgContainer.on('mousemove', function (e: MouseEvent) {
            const mouseX: number = e.x;
            const mouseY: number = e.y;
            if (mouseX < xMouseMin || xMouseMax < mouseX || mouseY > yRangeMax) {
                tooltipServiceWrapper.hide();
                hoverLine.style('opacity', 0);
                hoverContainer.selectAll(Visual.CircleSelector.selectorName).remove();
            } else {
                const index: number = findNearestVerticalLineIndex(mouseX, verticalLineDataItems);
                hoverLineData = hoverLine.data([index]);
                const verticalLineDataItem: VerticalLineDataItem = verticalLineDataItems[index];
                if (verticalLineDataItem) {
                    const xValue: number = verticalLineDataItem.x;
                    drawPointsForVerticalLine(hoverContainer, xValue, verticalLineDataItem.linePoints);
                    const d: string = 'M' + xValue + ',' + yRangeMax + 'V0';
                    hoverLine.attr('d', d).style('opacity', 1);
                }
            }
        });
        tooltipServiceWrapper.addTooltip(tooltipRect,
            () => {
                const index: number = hoverLineData.data()[0];
                let tooltips: VisualTooltipDataItem[] = null;
                if (verticalLineDataItems[index])
                    tooltips = verticalLineDataItems[index].tooltips;
                return tooltips;
            },
            undefined,
            true);
    }

    // eslint-disable-next-line max-lines-per-function
    private renderXAxis(
        svgContainer: d3Selection<SVGElement>,
        plotSize: any,
        x: AxisScale<AxisDomain>,
        xIsCategorical: boolean,
        xAxisDataPoints: PrimitiveValue[],
        tickMaxWidth: number,
        xRange: number[],
        axisPadding: number,
        start: number,
        end: number): number {
        if (!this.settings.xAxis.show) return 0;
        const svgAxisContainer: d3Selection<SVGElement> = svgContainer
            .append('svg');

        const axisSvg = svgAxisContainer
            .selectAll('g.axis')
            .data([0]);

        const xAxisSvg = axisSvg.enter().append('g').attr('class', 'x axis');

        let xSpecial = x;
        let numTicks: number;
        let actionWithLabels: LabelsAction = LabelsAction.Simple;

        let longestXAxis = '';
        for (let i = 1; i < xAxisDataPoints.length; i++) {
            const value: PrimitiveValue = this.categoryIsDate ? new Date(xAxisDataPoints[i].toString()) : xAxisDataPoints[i];
            const item: string = this.xFormatter.format(value);
            if (longestXAxis == null || item.length > longestXAxis.length)
                longestXAxis = item;
        }

        const xAxisFontSize = this.settings.xAxis.fontSize.toString() + 'px';
        const xAxisWidth: number = measureTextWidth({
            fontSize: xAxisFontSize,
            fontFamily: this.settings.xAxis.fontFamily,
            text: longestXAxis,
        });

        if (xIsCategorical) {
            numTicks = xAxisDataPoints.length;
            const fontWidth = this.settings.xAxis.fontSize;

            if (tickMaxWidth < fontWidth) {
                actionWithLabels = LabelsAction.Rotate90;
                numTicks = xAxisDataPoints.length;
                xSpecial = d3scalePoint(xAxisDataPoints as AxisDomain[], xRange);
            } else if (tickMaxWidth < 1.9 * fontWidth) {
                actionWithLabels = LabelsAction.Rotate90;

            } else if (tickMaxWidth < 1.1 * xAxisWidth) {
                actionWithLabels = LabelsAction.Rotate35;
            }
        } else {
            const divider: number = 1.8 * xAxisWidth;
            numTicks = Math.floor((xRange[1] - xRange[0]) / divider);
            if (numTicks < 2)
                numTicks = 2;
            if (numTicks > xAxisDataPoints.length)
                numTicks = xAxisDataPoints.length;
            if (numTicks == 1 && this.settings.xAxis.axisScale == 'linear')
                xSpecial = d3scalePoint(xAxisDataPoints as AxisDomain[], xRange);
        }

        const xAxis = (this.categoryIsDate)
            ? d3axisBottom(xSpecial).ticks(numTicks).tickSize(0)
            : ((this.settings.xAxis.axisScale == 'log')
                ? d3axisBottom(xSpecial)
                : d3axisBottom(xSpecial).ticks(numTicks).tickSize(0));

        if (this.categoryIsDate) {
            if (xIsCategorical) {
                xAxis.tickFormat(d => this.xFormatter.format(d));
            }
            xAxisSvg.call(xAxis);
        } else {
            if (this.categoryIsScalar) {
                xAxis.tickFormat(d => this.xFormatter.format(d));
            }
            xAxisSvg.call(xAxis.scale(xSpecial));
        }

        xAxisSvg.selectAll('.domain').remove();

        const labels = xAxisSvg.selectAll('text')
            .style('fill', this.settings.xAxis.axisColor)
            .style('font-family', this.settings.xAxis.fontFamily)
            .style('font-size', xAxisFontSize);

        switch (actionWithLabels) {
            case LabelsAction.Simple: {
                const count: number = (labels.data().length == 0)
                    ? 1
                    : labels.data().length;
                if (this.settings.xAxis.axisScale == 'linear') {
                    const tickMaxWidth = (xRange[1] - xRange[0]) / count;
                    labels.call(wrapAxis, tickMaxWidth, {
                        fontFamily: this.settings.xAxis.fontFamily,
                        fontSize: xAxisFontSize,
                    });
                } else {
                    const labelXArray: number[] = [];
                    labels.each((number: any, index: number) => {
                        const item: d3Selection<any> = d3select(labels.nodes()[index]);
                        const parent: d3Selection<any> = d3select(item.node().parentElement);
                        let numberValue: number = number;
                        if (numberValue < 1) {
                            while (numberValue < 1) {
                                numberValue = numberValue * this.MaxLogScaleDivider;
                            }
                        } else {
                            while (numberValue > 1) {
                                numberValue = numberValue / this.MaxLogScaleDivider;
                            }
                        }
                        if (end / start > this.MaxLogScaleDivider && numberValue != 1) {
                            item.text('');
                            parent.select('line').remove();
                        } else {
                            const transform: string = parent.attr('transform');
                            const labelX: number = +transform.replace('translate(', '').split(',')[0];
                            labelXArray.push(labelX);
                            item.text(this.xFormatter.format(number));
                        }
                    });
                    for (let i = 0; i < labelXArray.length - 1; i++) {
                        labelXArray[i] = labelXArray[i + 1] - labelXArray[i];
                    }
                    labelXArray[labelXArray.length - 1] = plotSize.width - labelXArray[labelXArray.length - 1];
                    let labelIndex: number = 0;
                    labels.each((number: any, index: number) => {
                        const item: d3Selection<any> = d3select(labels.nodes()[index]);
                        const textTitle: string = item.text();
                        if (textTitle) {
                            const textProp: TextProperties = {
                                text: textTitle,
                                fontFamily: this.settings.xAxis.fontFamily,
                                fontSize: xAxisFontSize,
                            };
                            const maxTextWidth: number = labelXArray[labelIndex];
                            labelIndex = labelIndex + 1;
                            const text: string = getTailoredTextOrDefault(textProp, maxTextWidth);
                            item.text(text).append('title').text(textTitle);
                        }
                    });
                }
                break;
            }
            case LabelsAction.Rotate35: {
                labels.attr('transform', function (d) {
                    return 'translate(' + (<any>this).getBBox().height * -2 + ',' + (<any>this).getBBox().height + ')rotate(-35)';
                }).attr('dy', '0').attr('dx', '2.5em').style('text-anchor', 'end')
                    .call(truncateAxis, plotSize.height * this.settings.xAxis.maximumSize / 100, {
                        fontFamily: this.settings.xAxis.fontFamily,
                        fontSize: xAxisFontSize,
                    });
                break;
            }
            case LabelsAction.Rotate90: {
                labels.attr('transform', 'rotate(-90)')
                    .attr('dy', '-0.5em')
                    .style('text-anchor', 'end')
                    .call(truncateAxis, plotSize.height * this.settings.xAxis.maximumSize / 100, {
                        fontFamily: this.settings.xAxis.fontFamily,
                        fontSize: xAxisFontSize,
                    });
                let labelStartX: number | null = null;
                const removedIndexes: number[] = [];
                labels.each((number: any, index: number) => {
                    const item: d3Selection<any> = d3select(labels.nodes()[index]);
                    const parent: d3Selection<any> = d3select(item.node().parentElement);
                    const transform: string = parent.attr('transform');
                    const labelX: number = +transform.replace('translate(', '').split(',')[0];
                    if (labelStartX == null) {
                        labelStartX = labelX;
                    } else {
                        if (labelX - labelStartX < this.settings.xAxis.fontSize)
                            removedIndexes.push(index);
                        else
                            labelStartX = labelX;
                    }
                });
                for (let i = 0; i < removedIndexes.length; i++) {
                    const index = removedIndexes[i];
                    const item: d3Selection<any> = d3select(labels.nodes()[index]);
                    item.remove();
                }
                break;
            }
        }

        let n = <any>xAxisSvg.node();
        let xAxisHeight: number = n.getBBox().height;

        if (this.settings.xAxis.showTitle) {
            let titleTextFull: string = this.settings.xAxis.axisTitle ? this.settings.xAxis.axisTitle : this.categoryName;
            const titleStyle: string = (this.categoryIsScalar && (this.settings.xAxis.displayUnits == 1000 ||
                this.settings.xAxis.displayUnits == 1000000 || this.settings.xAxis.displayUnits == 1000000000 || this.settings.xAxis.displayUnits == 1000000000000))
                ? this.settings.xAxis.titleStyleFull
                : this.settings.xAxis.titleStyle;
            switch (titleStyle) {
                case 'showUnitOnly': {
                    titleTextFull = this.retrieveXDisplayUnitsForTitle(this.settings.xAxis.displayUnits);
                    break;
                }
                case 'showBoth': {
                    const displayUnits: string = this.retrieveXDisplayUnitsForTitle(this.settings.xAxis.displayUnits);
                    titleTextFull = titleTextFull + ' (' + displayUnits + ')';
                    break;
                }
            }

            const titleFontSize: string = this.settings.xAxis.titleFontSize + 'px';
            const textProp: TextProperties = {
                text: titleTextFull,
                fontFamily: this.settings.xAxis.titleFontFamily,
                fontSize: titleFontSize,
            };
            const titleText: string = getTailoredTextOrDefault(textProp, xRange[1] - xRange[0]);
            const titleCont: d3Selection<any> = xAxisSvg.append('g');
            titleCont.append('text')
                .attr('font-family', this.settings.xAxis.titleFontFamily)
                .attr('font-size', titleFontSize)
                .attr('fill', this.settings.xAxis.axisTitleColor)
                .attr('text-anchor', 'middle')
                .text(titleText)
                .append('title').text(titleTextFull);

            n = <any>titleCont.node();
            const titleHeight: number = n.getBBox().height;

            const titleX: number = (xRange[1] + xRange[0]) / 2;
            const delta: number = (titleHeight - this.settings.xAxis.titleFontSize) / 2;
            const titleY: number = xAxisHeight + titleHeight - delta;
            titleCont.attr('transform', 'translate(' + titleX + ',' + titleY + ')');
            xAxisHeight = xAxisHeight + titleHeight + delta;
        }
        xAxisSvg.attr('transform', 'translate(0,' + (plotSize.height - xAxisHeight) + ')');

        if (this.settings.xAxis.showGridlines) {
            const grid = svgAxisContainer.selectAll('g.x.axis').data([0]);
            const strokeDasharray = getLineStyleParam(this.settings.xAxis.lineStyle);
            grid.selectAll('line')
                .attr('y2', -plotSize.height + xAxisHeight + axisPadding)
                .style('stroke', this.settings.xAxis.gridlinesColor)
                .style('stroke-width', this.settings.xAxis.strokeWidth)
                .style('stroke-dasharray', () => strokeDasharray);
        }

        return xAxisHeight;
    }

    // eslint-disable-next-line max-lines-per-function
    private renderYAxis(
        svgContainer: d3Selection<SVGElement>,
        plotSize: ISize,
        y: AxisScale<AxisDomain>,
        domainY: VisualDomain,
        axisPadding: number,
        yAxisWidth: number,
        yAxisFontSize: string) {

        if (!this.settings.yAxis.show) return;
        let yAxis: d3Axis<PrimitiveValue | NumberValue>;
        //format axis for its' position
        if (this.settings.yAxis.position == AxisPosition.Left) {
            yAxis = d3axisLeft(y)
                .tickPadding(axisPadding)
                .tickSizeInner(plotSize.width - yAxisWidth - axisPadding)
                .ticks(Math.max(Math.floor(plotSize.height / 80), 2));
        } else {
            yAxis = d3axisLeft(y).tickPadding(axisPadding)
                .tickSizeInner(plotSize.width)
                .tickSizeOuter(yAxisWidth + axisPadding)
                .ticks(Math.max(Math.floor(plotSize.height / 80), 2));
        }

        const yFormatter = this.yFormatter;
        if (yFormatter) yAxis.tickFormat(function (d) {
            return yFormatter.format(d);
        });

        const svgAxisContainer: d3Selection<SVGElement> = svgContainer
            .append('svg')
            .attr('width', plotSize.width);

        const axisSvg = svgAxisContainer.selectAll('g.axis').data([1]);

        const yAxisSvg = axisSvg.enter().append('g')
            .attr('class', 'y axis')
            .attr('transform', 'translate(' + plotSize.width + ',0)');

        yAxisSvg.call(yAxis.scale(y));
        yAxisSvg.selectAll('.domain').remove();
        const labels: d3Selection<any> = yAxisSvg.selectAll('text')
            .style('fill', this.settings.yAxis.axisColor)
            .style('font-family', this.settings.yAxis.fontFamily)
            .style('font-size', yAxisFontSize);
        if (this.settings.yAxis.axisScale == 'linear') {
            labels.call(wrapAxis, yAxisWidth, {
                fontFamily: this.settings.xAxis.fontFamily,
                fontSize: yAxisFontSize,
            });
        } else {
            if (domainY.end / domainY.start > this.MaxYLogScaleShowDivider) {
                labels.each((number: any, index: number) => {
                    const item: d3Selection<any> = d3select(labels.nodes()[index]);
                    const parent: d3Selection<any> = d3select(item.node().parentElement);
                    let numberValue: number = number;
                    if (numberValue < 1) {
                        while (numberValue < 1) {
                            numberValue = numberValue * this.MaxLogScaleDivider;
                        }
                    } else {
                        while (numberValue > 1) {
                            numberValue = numberValue / this.MaxLogScaleDivider;
                        }
                    }
                    if (numberValue != 1) {
                        item.text('');
                        parent.select('line').remove();
                    }
                });
            }
        }

        //format gridlines
        const yAxisGridlinesStrokeWidth = (this.settings.yAxis.showGridlines) ? this.settings.yAxis.strokeWidth : 0;
        const strokeDasharray = getLineStyleParam(this.settings.yAxis.lineStyle);
        yAxisSvg.selectAll('line')
            .style('stroke', this.settings.yAxis.gridlinesColor)
            .style('stroke-width', yAxisGridlinesStrokeWidth)
            .style('stroke-dasharray', () => strokeDasharray);

        //format axis for its' position
        const titleHeight: number = (this.settings.yAxis.showTitle) ? this.retrieveYAxisTitleHeight(svgContainer) : 0;
        if (this.settings.yAxis.position == AxisPosition.Right) {
            const textTranslate = plotSize.width - titleHeight;
            yAxisSvg.selectAll('text').attr('transform', 'translate(' + textTranslate + ',0)');
            const lineTranslate = yAxisWidth + axisPadding;
            yAxisSvg.selectAll('line').attr('transform', 'translate(-' + lineTranslate + ',0)');
        }

        if (this.settings.yAxis.showTitle) {
            const titleTextFull: string = this.retrieveYAxisTitleText();
            const titleFontSize: string = this.settings.yAxis.titleFontSize + 'px';
            const textProp: TextProperties = {
                text: titleTextFull,
                fontFamily: this.settings.yAxis.titleFontFamily,
                fontSize: titleFontSize,
            };
            const titleText: string = getTailoredTextOrDefault(textProp, plotSize.height);

            let translateX: number;
            let transform: string;
            translateX = titleHeight - axisPadding < axisPadding ? axisPadding : titleHeight - axisPadding;
            if (this.settings.yAxis.position == AxisPosition.Right) {
                translateX = -translateX + plotSize.width;
                transform = 'rotate(90)';
            } else {
                transform = 'rotate(-90)';
            }

            const translateY: number = plotSize.height / 2;
            svgAxisContainer.append('g').attr('transform', 'translate(' + translateX + ',' + translateY + ')')
                .append('text')
                .attr('transform', transform)
                .attr('font-family', this.settings.yAxis.titleFontFamily)
                .attr('font-size', titleFontSize)
                .attr('fill', this.settings.yAxis.axisTitleColor)
                .attr('text-anchor', 'middle')
                .text(titleText)
                .append('title').text(titleTextFull);
        }
    }

    private retrieveFormattedXValue(x: number): number {
        return +this.xFormatter.format(x).replace(/[^.0-9]/g, '');
    }

    private retrieveXDisplayUnitsForTitle(displayUnits: number): string {
        let displayUnitsText: string = 'No Units';
        switch (displayUnits) {
            case 1000: {
                displayUnitsText = 'Thousands';
                break;
            }
            case 1000000: {
                displayUnitsText = 'Millions';
                break;
            }
            case 1000000000: {
                displayUnitsText = 'Billions';
                break;
            }
            case 1000000000000: {
                displayUnitsText = 'Trillions';
                break;
            }
        }
        return displayUnitsText;
    }

    private retrievexFormatPrecision(): number {
        let precision: number = 1;
        if (this.categoryIsScalar) {
            const customFormatter: IValueFormatter = Formatter.getFormatter({
                format: this.xFormatter.options?.format,
                value: 0,
                precision: undefined,
                displayUnitSystemType: 0,
                cultureSelector: this.xFormatter.options?.cultureSelector,
            });
            const simpleFormatX: string = customFormatter.format(1);
            const x: number = +simpleFormatX.replace(/[^.0-9]/g, '');
            precision = 1 / x;
        }
        return precision;
    }

    private changeLinesForStartAndEndXAxis(lines: LineDataPoint[], start: number, end: number): LineDataPoint[] {
        for (let i = 0; i < lines.length; i++) {
            const lineItem: LineDataPoint = lines[i];
            const newPoints: any[] = [];
            const keys: string[] = [];
            if (lineItem.points)
                for (let j = 0; j < lineItem.points.length; j++) {
                    const point: any = lineItem.points[j];
                    const x: number = +point.x;
                    if (start <= x && x <= end && keys.indexOf(point.x) == -1) {
                        keys.push(point.x);
                        newPoints.push(point);
                    }
                }
            lines[i].points = newPoints;
        }
        return lines;
    }

    public retrieveDomainY(lines: LineDataPoint[]): VisualDomain {
        let start: number | null = null;
        let end: number | null = null;
        let startForced: boolean = false;
        let endForced: boolean = false;
        if (this.isSeparateDomainY) {
            for (let i = 0; i < lines.length; i++) {
                const points: any[] = lines[i].points;
                for (let j = 0; j < points.length; j++) {
                    const yValue = points[j].y;
                    if (start == null || yValue < start)
                        start = yValue;
                    if (end == null || end < yValue)
                        end = yValue;
                }
            }
        } else {
            start = this.domainY.start;
            end = this.domainY.end;
            startForced = this.domainY.startForced;
            endForced = this.domainY.endForced;
        }

        start ??= 0;
        end ??= 0;

        if (start <= 0)
            this.settings.yAxis.axisScale = 'linear';
        if (this.settings.yAxis.axisScale == 'linear') {
            if (start == end) {
                let delta: number = Math.abs(start / 2);
                if (delta < 1)
                    delta = 1;
                start = start - delta;
                end = end + delta;
            }
        } else {
            if (this.settings.yAxis.chartRangeType != 'custom' && end / this.MaxYLogScaleShowDivider <= start)
                start = start / this.MaxLogScaleDivider;
        }

        return {
            start: start,
            end: end,
            startForced: startForced,
            endForced: endForced,
        };
    }

    // eslint-disable-next-line max-lines-per-function
    private renderLines(svgContainer: d3Selection<SVGElement>, lines: LineDataPoint[], width: number, height: number, line: d3Line<SimplePoint>) {
        //Trend lines
        const svgLinesContainerE: d3Selection<SVGElement> = svgContainer
            .append('svg')
            .attr('width', width)
            .attr('height', height);

        const shapes = this.settings.shapes;
        const hasSelection = this.hasSelection;
        const lineDD: string[] = [];
        for (let i = 0; i < lines.length; i++) {
            const dataPoint: LineDataPoint = lines[i];
            const points = dataPoint.points;
            const lineD = <string>line(points);
            lineDD.push(lineD);
        }

        svgLinesContainerE
            .selectAll(Visual.SimpleLineSelector.selectorName)
            .data(lines)
            .join('path')
            .classed(Visual.SimpleLineSelector.className, true)
            .attr('d', (dataPoint: LineDataPoint, index: number) => {
                const lineD = lineDD[index];
                const stepped: boolean = (dataPoint.stepped == undefined) ? this.settings.shapes.stepped : dataPoint.stepped;
                const dataLine: string = (stepped)
                    ? MarkersUtility.getDataLineForForSteppedLineChart(lineD)
                    : lineD;
                return dataLine;
            })
            .attr('stroke', (dataPoint: LineDataPoint) => {
                return dataPoint.color;
            })
            .attr('stroke-width', (dataPoint: LineDataPoint) => {
                const strokeWidth: number = (dataPoint.strokeWidth == undefined) ? this.settings.shapes.strokeWidth : dataPoint.strokeWidth;
                return strokeWidth;
            })
            .attr('stroke-linejoin', (dataPoint: LineDataPoint) => {
                const strokeLineJoin: string = (dataPoint.strokeLineJoin == undefined) ? this.settings.shapes.strokeLineJoin : dataPoint.strokeLineJoin;
                return strokeLineJoin;
            })
            .attr('stroke-dasharray', (dataPoint: LineDataPoint): string | null => {
                return !dataPoint.lineStyle
                    ? getLineStyleParam(this.settings.shapes.lineStyle)
                    : getLineStyleParam(dataPoint.lineStyle);
            })
            .attr('fill', 'none')
            .style('opacity', (dataPoint: LineDataPoint) => {
                const opacity: number = getOpacity(dataPoint.selected, hasSelection);
                const showMarkers: boolean = dataPoint.showMarkers != null
                    ? dataPoint.showMarkers
                    : shapes.showMarkers;
                const stepped: boolean = dataPoint.stepped != null
                    ? dataPoint.stepped
                    : shapes.stepped;
                // if (showMarkers && stepped) {
                //     const markerPathId: string = MarkersUtility.retrieveMarkerName(dataPoint.lineKey, Visual.MarkerLineSelector.className);
                //     svgLinesContainerE.selectAll('#' + markerPathId).style('opacity', opacity);
                // }
                return opacity;
            });

        // const lineNamesWithMarkers = RenderVisual.retrieveLineNamesWithMarkers(svgContainer, svgLinesContainerE, lineDD, this.settings.shapes, lines);
        // const svgLines = svgLinesContainerE.selectAll(Visual.SimpleLineSelector.selectorName);
        // for (let i = 0; i < lines.length; i++) {
        // const dataPoint: LineDataPoint = lines[i];
        // const marker: string = lineNamesWithMarkers[dataPoint.name];
        // if (marker) {
        //     const item: d3Selection<any> = d3select(svgLines.nodes()[i]);
        //     item.attr('marker-start', marker);
        //     item.attr('marker-mid', marker);
        //     item.attr('marker-end', marker);
        // }
        // }

        const dots: LineDataPoint[] = [];
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].points && lines[i].points.length == 1)
                dots.push(lines[i]);
        }

        // svgLinesContainerE.append("g")
        //     .selectAll(Visual.SimpleLineSelector.selectorName)
        //     .data(dots)
        //     .join("circle")
        //     .classed(Visual.DotSelector.className, true)
        //     .attr('cx', (dataPoint: LineDataPoint) => {
        //         let points: any = dataPoint.points;
        //         let lineD: string = line(points);
        //         let data: string[] = lineD.replace("M", "").replace("Z", "").split(",");
        //         return data[0];
        //     })
        //     .attr('cy', (dataPoint: LineDataPoint) => {
        //         let points: any = dataPoint.points;
        //         let lineD: string = line(points);
        //         let data: string[] = lineD.replace("M", "").replace("Z", "").split(",");
        //         return data[1];
        //     })
        //     .attr('r', (dataPoint: LineDataPoint) => {
        //         let strokeWidth: number = dataPoint.strokeWidth == undefined
        //             ? shapes.strokeWidth
        //             : dataPoint.strokeWidth;
        //         return 2.5 + 0.5 * strokeWidth;
        //     })
        //     .style('fill', (dataPoint: LineDataPoint) => {
        //         return dataPoint.color;
        //     })
        //     .style('fill-opacity', (dataPoint: LineDataPoint) => {
        //         let showMarkers: boolean = (dataPoint.showMarkers == undefined) ? this.settings.shapes.showMarkers : dataPoint.showMarkers;
        //         return showMarkers ? 0 : 1;
        //     })
        //     .style('opacity', (dataPoint: LineDataPoint) => {
        //         let opacity: number = getOpacity(dataPoint.selected, hasSelection);
        //         return opacity;
        //     });
        //
        // svgLinesContainerE.selectAll(Visual.InteractivityLineSelector.selectorName)
        //     .data(lines)
        //     .join("path")
        //     .classed(Visual.InteractivityLineSelector.className, true)
        //     .attr("d", (dataPoint: LineDataPoint) => {
        //         let points: any = dataPoint.points;
        //         let lineD: string = line(points);
        //         let stepped: boolean = (dataPoint.stepped == undefined) ? this.settings.shapes.stepped : dataPoint.stepped;
        //         let dataLine: string = (stepped)
        //             ? MarkersUtility.getDataLineForForSteppedLineChart(lineD)
        //             : lineD
        //         return dataLine;
        //     })
        //     .attr('stroke-width', '10')
        //     .attr("stroke-linejoin", "round")
        //     .attr('stroke', 'red')
        //     .attr('stroke-opacity', '0')
        //     .attr('fill', 'none');
    }

    // eslint-disable-next-line max-lines-per-function
    private renderDataLabels(
        lines: LineDataPoint[],
        minRangeX: number,
        maxRangeX: number,
        yRangeMax: number,
        line: d3Line<SimplePoint>,
        svgContainer: d3Selection<any>): void {

        const dataLabelsBackgroundContext = svgContainer.append('g')
            .classed('labelBackgroundGraphicsContext', true);
        dataLabelsBackgroundContext.selectAll('*').remove();

        const dataLabelsContext = svgContainer.append('g')
            .classed('labelGraphicsContext', true);
        dataLabelsContext.selectAll('*').remove();

        const labelSettings = this.settings.dataLabels;
        if (!labelSettings.show) return;

        const dataPoints: SimplePoint[] = [];
        for (let i = 0; i < lines.length; i++) {
            const points: SimplePoint[] = lines[i].points;
            if (points)
                for (let j = 0; j < points.length; j++)
                    dataPoints.push(points[j]);
        }

        const fontSizeInPx: string = fromPoint(labelSettings.fontSize);
        const fontFamily: string = labelSettings.fontFamily;

        const coords: Coordinates[] = [];
        const height: number = fromPointToPixel(labelSettings.fontSize);
        const deltaY: number = 20;
        const labelBackgroundWidthPadding: number = 16.2;
        const labelBackgroundHeightPadding: number = 2;
        const labelBackgroundYShift: number = -fromPointToPixel(labelSettings.fontSize) / 10;
        for (let i = 0; i < dataPoints.length; i++) {
            //init labelCoordinates
            const point: any = [{
                x: dataPoints[i].x,
                y: dataPoints[i].y,
            }];
            const lineD = line(point);
            const data: string[] = lineD?.replace('M', '').replace('Z', '').split(',') ?? ['0', '0'];
            const value = this.dataLabelFormatter.format(dataPoints[i].y);
            const width: number = measureTextWidth({
                fontFamily: fontFamily,
                fontSize: fontSizeInPx,
                text: value,
            });
            const coord: Coordinates = {
                x: +data[0],
                y: +data[1] - deltaY,
                value: value,
                bgWidth: width + labelBackgroundWidthPadding,
                bgHeight: height + labelBackgroundHeightPadding,
                bgX: +data[0] - width / 2 - labelBackgroundWidthPadding / 2,
                bgY: +data[1] - height - labelBackgroundYShift - deltaY,
            };

            if (coord.bgX + coord.bgWidth > maxRangeX || coord.bgX < minRangeX || coord.bgY + coord.bgHeight > yRangeMax || coord.bgY < 0) {
                continue;
            }

            let goToBottom: boolean = false;
            for (let j = 0; j < coords.length; j++) {
                const isDataLabelOk: boolean = this.isDataLabelOk(coords[j], coord);
                if (isDataLabelOk) {
                    goToBottom = true;
                    break;
                }
            }

            if (goToBottom) {
                coord.bgY = coord.bgY + deltaY * 2;
                coord.y = coord.y + deltaY * 2;
                if (coord.bgY + coord.bgHeight > yRangeMax) {
                    continue;
                }
            }

            let add: boolean = true;
            for (let j = 0; j < coords.length; j++) {
                const isDataLabelOk: boolean = this.isDataLabelOk(coords[j], coord);
                if (isDataLabelOk) {
                    add = false;
                    break;
                }
            }
            if (add) coords.push(coord);
        }

        const coordsLen: number = coords.length;
        const maxCount: number = (this.settings.xAxis.axisType === 'categorical')
            ? coordsLen
            : Math.round((0.1 + 0.009 * this.settings.dataLabels.labelDensity) * coordsLen);
        let newCoords: Coordinates[] = [];
        if (maxCount >= coordsLen) {
            newCoords = coords;
        } else {
            const indexes: number[] = [];
            let k: number = 2;
            while (newCoords.length < maxCount) {
                const j: number = Math.round(coordsLen / k);
                for (let i = 0; i < coordsLen; i = i + j) {
                    if (indexes.indexOf(i) == -1) {
                        indexes.push(i);
                        newCoords.push(coords[i]);
                        if (newCoords.length >= maxCount)
                            break;
                    }
                }
                k = k + 1;
            }
        }

        dataLabelsContext
            .selectAll(Visual.Label.selectorName)
            .data(newCoords)
            .join('svg:text')
            .classed('label', true)
            .attr('transform', (c: Coordinates) => {
                return 'translate(' + c.x + ',' + c.y + ')';
            })
            .attr('text-anchor', 'middle')
            .style('fill', labelSettings.color)
            .style('font-size', fontSizeInPx)
            .style('font-family', fontFamily)
            .style('pointer-events', 'none')
            .style('white-space', 'nowrap')
            .text((c: Coordinates) => c.value);

        if (!labelSettings.showBackground) return;

        const backgroundColor: string = this.settings.dataLabels.backgroundColor;
        const transparency: number = this.settings.dataLabels.transparency;

        dataLabelsBackgroundContext
            .selectAll(Visual.Label.selectorName)
            .data(newCoords)
            .join('svg:rect')
            .attr('height', d => {
                return d.bgHeight;
            })
            .attr('width', d => {
                return d.bgWidth;
            })
            .attr('x', d => {
                return d.bgX;
            })
            .attr('y', d => {
                return d.bgY;
            })
            .attr('rx', DataLabelR)
            .attr('ry', DataLabelR)
            .attr('fill', backgroundColor)
            .style('fill-opacity', (100 - transparency) / 100)
            .style('pointer-events', 'none');
    }

    private isDataLabelOk(item: Coordinates, coord: Coordinates): boolean {
        const result: boolean = (!((item.bgX + item.bgWidth - DataLabelEps < coord.bgX) || (coord.bgX + coord.bgWidth - DataLabelEps < item.bgX))) &&
            (!((item.bgY + item.bgHeight - DataLabelEps < coord.bgY) || (coord.bgY + coord.bgHeight - DataLabelEps < item.bgY)));
        return result;
    }

    // public static retrieveLineNamesWithMarkers(container: d3Selection<any>, svgLinesContainer: d3Selection<any>, lineDD: string[], shapes: Shapes, lines: LineDataPoint[]): {} {
    //     //init markers
    //     let lineNamesWithMarkers = {};
    //     let defsContainer = container.append('defs');
    //     let shapesShowMarkers: boolean = shapes.showMarkers;
    //     for (let i = 0; i < lines.length; i++) {
    //         let lineDataPoint: LineDataPoint = lines[i];
    //         //Marker
    //         let showMarkers: boolean = (lineDataPoint.showMarkers == undefined) ? shapesShowMarkers : lineDataPoint.showMarkers;
    //         if (!showMarkers) {
    //             continue;
    //         }
    //
    //         let markerShape: SeriesMarkerShape = (lineDataPoint.seriesMarkerShape == undefined) ? shapes.markerShape : lineDataPoint.seriesMarkerShape;
    //         let markerSize: number = (lineDataPoint.markerSize == undefined) ? shapes.markerSize : lineDataPoint.markerSize;
    //         let markerColor: string = (lineDataPoint.markerColor == undefined)
    //             ? (shapes.markerColor == "") ? lineDataPoint.color : shapes.markerColor
    //             : lineDataPoint.markerColor;
    //         let markerId: string = MarkersUtility.initMarker(defsContainer, lineDataPoint.name, markerShape, markerSize, markerColor);
    //         if (!markerId) {
    //             continue;
    //         }
    //
    //         let stepped: boolean = (lineDataPoint.stepped == undefined) ? shapes.stepped : lineDataPoint.stepped;
    //         if (stepped) {
    //             let lineD = lineDD[i];
    //             let strokeWidth: number = (lineDataPoint.strokeWidth == undefined) ? shapes.strokeWidth : lineDataPoint.strokeWidth;
    //             let markerPathId: string = MarkersUtility.retrieveMarkerName(lineDataPoint.lineKey, Visual.MarkerLineSelector.className);
    //             MarkersUtility.drawMarkersForSteppedLineChart(svgLinesContainer, lineD, markerPathId, markerId, strokeWidth);
    //         } else {
    //             lineNamesWithMarkers[lineDataPoint.name] = 'url(#' + markerId + ')';
    //         }
    //     }
    //     return lineNamesWithMarkers;
    // }

    public renderRowTitleForMatrixView(rowContainer: d3Selection<any>, titleHeight: number, maxTextWidth: number, separatorSize: number, titleX: string, i: number, separatorIndex: number) {
        const rowText: d3Selection<any> = rowContainer.append('g');
        rowText.attr('width', titleHeight)
            .attr('height', maxTextWidth)
            .attr('transform', 'translate(0,0)');
        rowText.append('rect')
            .classed('clearCatcher', true)
            .attr('width', titleHeight)
            .attr('height', maxTextWidth);
        const titleFontFamily: string = this.settings.smallMultiple.fontFamily;
        const titleFontSize: string = this.settings.smallMultiple.fontSize + 'px';
        const titleTextProp: TextProperties = {
            text: titleX,
            fontFamily: titleFontFamily,
            fontSize: titleFontSize,
        };
        const shortTitle: string = getTailoredTextOrDefault(titleTextProp, maxTextWidth - separatorSize * 3 / 2);
        titleTextProp.text = shortTitle;
        const titleWidth: number = measureTextWidth(titleTextProp);
        rowText.append('text')
            .classed(Visual.SmallMultipleNameSelector.className, true)
            .attr('font-family', titleFontFamily)
            .attr('font-size', titleFontSize)
            .attr('fill', this.settings.smallMultiple.smColor)
            .attr('width', titleHeight)
            .attr('x', -maxTextWidth / 2 + separatorSize / 2 - titleWidth / 2)
            .attr('y', titleHeight * 2 / 3)
            .attr('transform', 'rotate(-90)')
            .text(shortTitle);
        rowText.append('title').text(titleX);
        if (i > 0)
            RenderVisual.renderSeparatorLine(rowText, 0, -separatorSize / 2, titleHeight, -separatorSize / 2, separatorIndex);
    }

    public static renderSeparatorLine(separatorItem: d3Selection<any>, x1: number, y1: number, x2: number, y2: number, separatorIndex: number) {
        const separatorLine: d3Selection<any> = separatorItem.append('line')
            .attr('x1', x1)
            .attr('y1', y1)
            .attr('x2', x2)
            .attr('y2', y2)
            .style('stroke-width', 1);
        if (separatorIndex) {
            separatorLine.style('stroke', '#aaa');
        }
    }

    private convertCategoryItemToString(categoryItem: PrimitiveValue): string {
        if (!categoryItem) return '';
        return (this.categoryIsDate)
            ? new Date(categoryItem.toString()).toLocaleDateString()
            : ((this.categoryIsScalar)
                ? this.xFormatter.format(categoryItem).toString()
                : categoryItem.toString());
    }
}

const primitiveValueToAxisDomain = (pv: PrimitiveValue): AxisDomain => {
    if (typeof pv === 'boolean') {
        return pv ? 1 : 0;
    }

    return pv;
};
