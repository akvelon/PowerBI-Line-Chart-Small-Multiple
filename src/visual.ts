"use strict";

import "../style/visual.less";
import "core-js/stable";
import powerbi from 'powerbi-visuals-api';
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import DataView = powerbi.DataView;
import PrimitiveValue = powerbi.PrimitiveValue;
import DataViewCategoryColumn = powerbi.DataViewCategoryColumn;
import ValueTypeDescriptor = powerbi.ValueTypeDescriptor;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;
import ISelectionIdBuilder = powerbi.extensibility.ISelectionIdBuilder;
import ISelectionId = powerbi.extensibility.ISelectionId;
import DataViewObjects = powerbi.DataViewObjects;
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualObjectInstanceEnumeration = powerbi.VisualObjectInstanceEnumeration;
import EnumerateVisualObjectInstancesOptions = powerbi.EnumerateVisualObjectInstancesOptions;
import VisualUpdateType = powerbi.VisualUpdateType;
import DataViewMetadataColumn = powerbi.DataViewMetadataColumn;
import DataViewValueColumn = powerbi.DataViewValueColumn;

import * as d3 from 'd3';
import "d3-selection-multi";
import { ITooltipServiceWrapper } from 'powerbi-visuals-utils-tooltiputils';
import { legend, legendPosition, legendInterfaces } from 'powerbi-visuals-utils-chartutils';
import ILegend = legendInterfaces.ILegend;
import LegendModule = legend;
import LegendPosition = legendInterfaces.LegendPosition;
import { valueFormatter } from 'powerbi-visuals-utils-formattingutils';
import IValueFormatter = valueFormatter.IValueFormatter;
import { interactivityBaseService, interactivitySelectionService } from 'powerbi-visuals-utils-interactivityutils';
import IInteractivityService = interactivityBaseService.IInteractivityService;
import createInteractivitySelectionService = interactivitySelectionService.createInteractivitySelectionService;

import { createTooltipServiceWrapper } from 'powerbi-visuals-utils-tooltiputils';
import { CssConstants } from 'powerbi-visuals-utils-svgutils';
import ClassAndSelector = CssConstants.ClassAndSelector;
import createClassAndSelector = CssConstants.createClassAndSelector;

import { EnumerateObject } from './utilities/objectEnumerationUtility'
import { LegendBehavior} from './legendBehavior';
import { renderVisual } from './renderVisual';
import { VizUtility } from './utilities/vizUtility';
import { retrieveLegendCategoryColumn, renderLegend, positionChartArea, getLegendData } from './utilities/legendUtility';
import { implementLassoSelection } from './lasso';
import { WebBehavior, WebBehaviorOptions } from './behavior';
import { 
    MinStrokeWidth,
    PrecisionMinValue,
    MaximumSizeStartValue,
    MaximumSizeEndValue,
    MinCategoryWidthStartValue,
    MinCategoryWidthEndValue,
    NiceDateFormat,
    DefaultSeparator,
    legendSettings,
    VisualSettings
} from './settings';
import {
    VerticalLineDataItemsGlobalWithKey,
    VisualViewModel,
    VisualDomain,
    VisualDataPoint,
    LegendDataPointExtended,
    LineDataPoint,
    LineKeyIndex,
    CategoryType,
    LegendDataExtended,
    Selection
} from './visualInterfaces';

//tslint:disable-next-line
function visualTransform(options: VisualUpdateOptions, host: IVisualHost): VisualViewModel {
    //Get DataViews
    let dataViews = options.dataViews;
    let hasDataViews = (dataViews && dataViews[0]);
    let hasCategoricalData = (hasDataViews && dataViews[0].categorical && dataViews[0].categorical.values);

    const dataView: DataView = options && options.dataViews && options.dataViews[0];
    if (!dataView || options.type === VisualUpdateType.ResizeEnd) {
        return;
    }
    let settings = Visual.PARSE_SETTINGS(dataView);

    //Limit some properties
    if (settings.shapes.strokeWidth < MinStrokeWidth) settings.shapes.strokeWidth = MinStrokeWidth;
    if (settings.xAxis.strokeWidth < MinStrokeWidth) settings.xAxis.strokeWidth = MinStrokeWidth;
    if (settings.yAxis.strokeWidth < MinStrokeWidth) settings.yAxis.strokeWidth = MinStrokeWidth;
    if (settings.xAxis.precision < PrecisionMinValue) settings.xAxis.precision = PrecisionMinValue;
    if (settings.yAxis.precision < PrecisionMinValue) settings.yAxis.precision = PrecisionMinValue;
    if (settings.dataLabels.precision < PrecisionMinValue) settings.dataLabels.precision = PrecisionMinValue;
    if (settings.xAxis.maximumSize < MaximumSizeStartValue) settings.xAxis.maximumSize = MaximumSizeStartValue;
    if (settings.xAxis.maximumSize > MaximumSizeEndValue) settings.xAxis.maximumSize = MaximumSizeEndValue;
    if (settings.xAxis.minCategoryWidth < MinCategoryWidthStartValue) settings.xAxis.minCategoryWidth = MinCategoryWidthStartValue;
    if (settings.xAxis.minCategoryWidth > MinCategoryWidthEndValue) settings.xAxis.minCategoryWidth = MinCategoryWidthEndValue;

    //Get DataPoints
    let domain: VisualDomain = { startForced: false, endForced: false };
    if (settings.yAxis.chartRangeType == "custom") {
        if (settings.yAxis.start !== null) {
            domain.start = settings.yAxis.start;
            domain.startForced = true;
        }
        if (settings.yAxis.end !== null) {
            domain.end = settings.yAxis.end;
            domain.endForced = true;
        }
    }

    let rowsData: PrimitiveValue[] = [];
    let columnsData: PrimitiveValue[] = [];
    let rowsFormat: string = '';
    let columnsFormat: string = '';
    let categoryData: PrimitiveValue[] = [];
    let categoryName: string = "";
    let valuesName: string = "";
    let dataPoints: VisualDataPoint[] = [];
    let legendDataPoint: LegendDataPointExtended[] = [];
    let lines: LineDataPoint[] = [];
    let lineKeyIndex: LineKeyIndex = {};
    let categoryIsDate: boolean = false;
    let categoryFormat: string = null;
    let valueFormat: string = null;
    let legendFormatter: IValueFormatter = null;
    let legendType: CategoryType = CategoryType.String;
    let categoryIsScalar: boolean = false;

    if (hasCategoricalData) {
        let dataCategorical = dataViews[0].categorical;
        let category: DataViewCategoryColumn[] = [];
        let row: DataViewCategoryColumn = null;
        let column: DataViewCategoryColumn = null;
        let categoryLength: number = 0;
        if (dataCategorical.categories) {
            for(let i=0;i<dataCategorical.categories.length;i++) {
                let item: DataViewCategoryColumn = dataCategorical.categories[i];
                categoryLength = item.values.length;
                if (item.source.roles["Category"]) {
                    categoryName = categoryName + item.source.displayName + " ";
                    category.push(item);
                }
                if (item.source.roles["Row"]) {
                    rowsFormat = item.source.format;
                    row = item;
                }
                if (item.source.roles["Column"]) {
                    columnsFormat = item.source.format;
                    column = item;
                }
            }
        }

        let categorySourceType: CategoryType = CategoryType.String;
        if (category.length == 1) {
            categoryFormat = category[0].source.format;
            let categoryIsBoolean: boolean = false;
            let type: ValueTypeDescriptor = category[0].source.type;
            if (type) {
                categoryIsDate = type.dateTime;
                categoryIsScalar = type.numeric;
                categoryIsBoolean = type.bool;
            }
            categorySourceType = retrieveCategoryType(categoryIsScalar, categoryIsDate, categoryIsBoolean);
            if (categorySourceType == CategoryType.Date && !categoryFormat)
                categoryFormat = NiceDateFormat;
            if (categorySourceType != CategoryType.Number && categorySourceType != CategoryType.Date) {
                settings.xAxis.axisType = "categorical";
            }
        } else if (category.length > 1) {
            categorySourceType = CategoryType.String;
            settings.xAxis.axisType = "categorical";
        }

        let categoryDataKeys: string[] = [];
        let rowKeys: string[] = [];
        let columnKeys: string[] = [];
        for(let i=0;i<categoryLength;i++) {

            let item: PrimitiveValue;
            let key: string;
            if (category.length > 0) {
                if (category.length == 1) {
                    item = category[0].values[i];
                } else {
                    item = "";
                    for(let cI = 0;cI<category.length;cI++) {
                        let formattedValue: string = formatDrillDownXAxisValue(category[cI], i, host.locale);
                        item = item + formattedValue + " ";
                    }
                }
                key = item.toString();
                if (categoryDataKeys.indexOf(key) == -1) {
                    categoryDataKeys.push(key);
                    categoryData.push(item);
                }
            }
            if (row != null) {
                item = row.values[i];
                key = item.toString();
                if (rowKeys.indexOf(key) == -1) {
                    rowKeys.push(key);
                    rowsData.push(item);
                }
            }
            if (column != null) {
                item = column.values[i];
                key = item.toString();
                if (columnKeys.indexOf(key) == -1) {
                    columnKeys.push(key);
                    columnsData.push(item);
                }
            }
        }
        categoryDataKeys = [];
        rowKeys = [];
        columnKeys = [];
        rowsData = (row != null) ? get_sorted(rowsData, row.source.type) : [];
        columnsData = (column != null) ? get_sorted(columnsData, column.source.type) : [];

        let legendData: LegendDataExtended = getLegendData(dataView, host, settings.legend);
        if (settings.legend.legendName == null)
            settings.legend.legendName = legendData.title;
        legendDataPoint = legendData.dataPoints;

        let legendFormat: string = null;
        if (legendDataPoint.length > 0) {
            const columns: DataViewMetadataColumn[] = dataView.metadata.columns;
            let legendValueType: ValueTypeDescriptor = null;
            for(let i=0;i<columns.length;i++) {
                let column: DataViewMetadataColumn = columns[i];
                if (column.roles["Legend"]) {
                    legendFormat = column.format;
                    legendValueType = column.type;
                    break;
                }
                if (column.roles["Values"] && !column.groupName) {
                    valuesName = valuesName + column.displayName + " ";
                }
            }
            if (legendValueType) {
                legendType = retrieveCategoryType(legendValueType.numeric, legendValueType.dateTime, legendValueType.bool);
            } else {
                let legendIsBoolean: boolean = false;
                if (legendDataPoint.length == 2) {
                    let labels: string[] = [legendDataPoint[0].tooltip.toLowerCase(), legendDataPoint[1].tooltip.toLowerCase()];
                    if (labels.indexOf("false") != -1 && labels.indexOf("true") != -1) {
                        legendIsBoolean = true;
                        legendType = CategoryType.Boolean;
                    }
                }
                if (!legendIsBoolean) {
                    let item: string = legendDataPoint[0].tooltip;
                    let legendIsNumber: boolean = !isNaN(+item);
                    if (legendIsNumber) {
                        legendType = CategoryType.Number;
                    } else {
                        let legendIsDate: boolean = !isNaN(+Date.parse(item));
                        if (legendIsDate)
                            legendType = CategoryType.Date;
                    }
                }
            }
        }
        switch (legendType) {
            case CategoryType.Number: {
                legendFormatter = VizUtility.Formatter.GET_FORMATTER({
                    format: legendFormat,
                    value: 0,
                    precision: null,
                    displayUnitSystemType: 0,
                    cultureSelector: host.locale});
                for(let i=0;i<legendDataPoint.length;i++) {
                    legendDataPoint[i].label = legendFormatter.format(legendDataPoint[i].tooltip);
                }
                break;
            }
            case CategoryType.Date: {
                legendFormat = legendFormat ? legendFormat : NiceDateFormat;
                legendFormatter = VizUtility.Formatter.GET_FORMATTER({
                    format: legendFormat,
                    cultureSelector: host.locale});
                for(let i=0;i<legendDataPoint.length;i++) {
                    let d: Date = new Date(legendDataPoint[i].tooltip);
                    legendDataPoint[i].label = legendFormatter.format(d);
                }
                break;
            }
            case CategoryType.Boolean: {
                legendFormatter = VizUtility.Formatter.GET_FORMATTER({
                    format: legendFormat,
                    cultureSelector: host.locale});
                for(let i=0;i<legendDataPoint.length;i++) {
                    legendDataPoint[i].label = legendFormatter.format(legendDataPoint[i].tooltip);
                }
                break;
            }
            case CategoryType.String: {
                legendFormatter = null;
                break;
            }
        }

        let legendItemIndexForNameKey: {} = {};
        for(let i=0;i<legendDataPoint.length;i++) {
            legendItemIndexForNameKey[legendDataPoint[i].tooltip] = i;
        }

        let tooltipsDataViewValueColumns: DataViewValueColumn[] = [];
        for (let ii = 0; ii < dataCategorical.values.length; ii++) {
            let dataValue: DataViewValueColumn = dataCategorical.values[ii];
            if (dataValue.source.roles["Tooltips"]) {
                tooltipsDataViewValueColumns.push(dataValue);
            }
        }
        let legendColumn: DataViewCategoryColumn = retrieveLegendCategoryColumn(dataView);
        let newLegendDataPoint: LegendDataPointExtended[] = [];
        let existedLegendNames: string[] = [];
        for (let ii = 0; ii < dataCategorical.values.length; ii++) {
            let dataValue: DataViewValueColumn = dataCategorical.values[ii];
            if (dataValue.source.roles["Values"]) {
                if (ii == 0) {
                    valueFormat = dataValue.source.format;
                }
                for(let i=0;i<dataValue.values.length;i++) {
                    let value: PrimitiveValue = dataValue.values[i];
                    let highlights: boolean = value == null
                        ? false
                        : ((dataValue.highlights != null)
                            ? dataValue.highlights[i] != null
                            : true);
                    if (highlights) {
                        value = +value;
                        let displayName: string =  dataValue.source.groupName!=null
                            ? dataValue.source.groupName.toString()
                            : (legendColumn && legendColumn.values
                                ? legendColumn.values[i].toString()
                                : dataValue.source.displayName);
                        //generate key
                        let rowIndex = 0;
                        if (row != null) {
                            let rowValue: PrimitiveValue = row.values[i];
                            rowIndex =rowsData.indexOf(rowValue);
                        }
                        let columnIndex = 0;
                        if (column != null) {
                            let columnValue: PrimitiveValue = column.values[i];
                            columnIndex = columnsData.indexOf(columnValue);
                        }
                        let lineKey: string = rowIndex + DefaultSeparator + columnIndex + DefaultSeparator;
                        //domain
                        if (!domain.startForced)
                            domain.start = (domain.start !== undefined ? Math.min(domain.start, value) : value);
                        if (!domain.endForced)
                            domain.end = (domain.end !== undefined ? Math.max(domain.end, value) : value);
                        //linePoint
                        let lineIndex: number = lineKeyIndex[lineKey + displayName];
                        let lineDataPoint: LineDataPoint = (lineIndex != undefined)
                            ? lines[lineIndex]
                            : null;

                        //generate tooltips
                        let legendDataPointIndex: number = legendItemIndexForNameKey[displayName];
                        let legendDataPointItem: LegendDataPointExtended = legendDataPoint[legendDataPointIndex];
                        let color: string = legendDataPointItem.color;
                        let tooltipName: string = legendDataPointItem.tooltip;
                        if (existedLegendNames.indexOf(tooltipName) == -1) {
                            existedLegendNames.push(tooltipName);
                            newLegendDataPoint.push(legendDataPointItem);
                        }
                        switch (legendType) {
                            case CategoryType.Number: {
                                tooltipName = legendFormatter.format(+tooltipName);
                                break;
                            }
                            case CategoryType.Date: {
                                let item: Date = new Date(tooltipName);
                                tooltipName = legendFormatter.format(item);
                                break;
                            }
                        }
                        let xValue: PrimitiveValue;
                        switch (category.length) {
                            case 0: {
                                xValue = "";
                                break;
                            }
                            case 1: {
                                xValue = category[0].values[i];
                                break;
                            }
                            default: {
                                xValue = "";
                                for(let cI = 0;cI<category.length;cI++) {
                                    let formattedValue: string = formatDrillDownXAxisValue(category[cI], i, host.locale);
                                    xValue = xValue + formattedValue + " ";
                                }
                                break;
                            }
                        }
                        let tooltipFormatter = VizUtility.Formatter.GET_FORMATTER({
                            format: dataValue.source.format,
                            value: 0,
                            precision: null,
                            displayUnitSystemType: 0,
                            cultureSelector: host.locale});
                        let tooltip: VisualTooltipDataItem = {
                            displayName: tooltipName,
                            value: tooltipFormatter.format(value),
                            color: color
                        };
                        let tooltips: VisualTooltipDataItem[] = [tooltip];
                        for(let k=0;k<tooltipsDataViewValueColumns.length;k++) {
                            let tooltipDataValueColumn: DataViewValueColumn = tooltipsDataViewValueColumns[k];
                            let tooltipName: string =  tooltipDataValueColumn.source.groupName!=null
                                ? tooltipDataValueColumn.source.groupName.toString()
                                : displayName;
                            if (tooltipName == displayName) {
                                let tooltipValue: PrimitiveValue = tooltipDataValueColumn.values[i];
                                let tooltipValueIsDate: boolean = !isNaN(+Date.parse(tooltipValue.toString()));
                                let format: string = tooltipDataValueColumn.source.format;
                                if (tooltipValueIsDate) {
                                    tooltipValue = new Date(tooltipValue.toString());
                                    format = format ? format : NiceDateFormat;
                                }
                                let formatter = VizUtility.Formatter.GET_FORMATTER({
                                    format: format,
                                    precision: null,
                                    displayUnitSystemType: 0,
                                    cultureSelector: host.locale});
                                let tooltip: VisualTooltipDataItem = {
                                    displayName: tooltipDataValueColumn.source.displayName,
                                    value: formatter.format(tooltipValue)
                                };
                                tooltips.push(tooltip);
                            }
                        }
                        //generate dataPoint
                        let selectionIdBuilder: ISelectionIdBuilder = host.createSelectionIdBuilder();
                        for(let cI = 0;cI<category.length;cI++) {
                            selectionIdBuilder =  selectionIdBuilder.withCategory(category[cI], i);
                        }
                        let dataPointIdentity: ISelectionId = legendDataPoint.length > 2
                            ? selectionIdBuilder
                                .withSeries(dataCategorical.values, dataValue)
                                .withMeasure(dataValue.source.queryName)
                                .createSelectionId()
                            : selectionIdBuilder
                                .withMeasure(dataValue.source.queryName)
                                .createSelectionId();
                        let dataPoint: VisualDataPoint = {
                            x: xValue,
                            y: value,
                            tooltips: tooltips,
                            lineKey: lineKey + displayName,
                            selected: false,
                            identity: dataPointIdentity,
                        };
                        dataPoints.push(dataPoint);
                        if (lineDataPoint) {
                            lineDataPoint.points.push(dataPoint);
                        } else {
                            let object: DataViewObjects = legendDataPointItem.object;
                            let identity: ISelectionId = legendDataPointItem.identity;

                            lineDataPoint = {
                                lineKey: lineKey + displayName,
                                name: displayName,
                                points: [dataPoint],
                                color: color,
                                identity: identity,
                                selected: false
                            };

                            let objectShapesDefined: boolean = (object != undefined) && (object.shapes != undefined);
                            if (objectShapesDefined && settings.shapes.customizeSeries) {
                                if (object.shapes.seriesStrokeWidth != undefined)
                                    lineDataPoint.strokeWidth = +object.shapes.seriesStrokeWidth;
                                if (object.shapes.seriesStrokeLineJoin != undefined)
                                    lineDataPoint.strokeLineJoin = object.shapes.seriesStrokeLineJoin.toString();
                                if (object.shapes.seriesLineStyle != undefined)
                                    lineDataPoint.lineStyle = object.shapes.seriesLineStyle.toString();
                                if (object.shapes.seriesStepped != undefined)
                                    lineDataPoint.stepped = object.shapes.seriesStepped == true;
                                if (object.shapes.seriesShowMarkers != undefined)
                                    lineDataPoint.showMarkers = object.shapes.seriesShowMarkers == true;
                                if (object.shapes.seriesMarkerShape != undefined)
                                    lineDataPoint.markerShape = object.shapes.seriesMarkerShape.toString();
                                if (object.shapes.seriesMarkerSize != undefined)
                                    lineDataPoint.markerSize = +object.shapes.seriesMarkerSize;
                                if (object.shapes.seriesMarkerColor != undefined) {
                                    let colorMarkerShapes: string = object.shapes.seriesMarkerColor["solid"].color;
                                    lineDataPoint.markerColor = colorMarkerShapes;
                                    if (lineDataPoint.markerColor == "")
                                        lineDataPoint.markerColor = color;
                                }
                            }
                            let letShowMarkers: boolean = (lineDataPoint.showMarkers == true || (lineDataPoint.showMarkers == null && settings.shapes.showMarkers));
                            let markerColor: string = lineDataPoint.markerColor ? lineDataPoint.markerColor : settings.shapes.markerColor;
                            legendDataPointItem.markerColor = markerColor ? markerColor : color;
                            legendDataPointItem.showMarkers = letShowMarkers;
                            legendDataPointItem.markerShape = <legendInterfaces.MarkerShape>(lineDataPoint.markerShape ? lineDataPoint.markerShape : settings.shapes.markerShape);
                            legendDataPoint[legendDataPointIndex] = legendDataPointItem;

                            lineIndex = lines.push(lineDataPoint);
                            lineKeyIndex[lineKey + displayName] = lineIndex - 1;
                        }
                    }
                }
            }
        }
        legendDataPoint = newLegendDataPoint;

        if (lines.length > 0 && categoryData.length == 0) {
            settings.xAxis.axisType = "categorical";
            categoryIsScalar = false;
            categoryIsDate = false;
            categorySourceType = CategoryType.String;
            categoryData = [""];
        }
        if (settings.xAxis.axisType == "continuous") {
            switch (categorySourceType) {
                case CategoryType.Number: {
                    categoryData = categoryData.sort(sortNumber);
                    legendDataPoint = legendDataPoint.sort(sortNumberLegend);
                    break;
                }
                case CategoryType.Date: {
                    categoryData = categoryData.sort(sortDate);
                    legendDataPoint = legendDataPoint.sort(sortDateLegend);
                    break;
                }
            }
            for(let i=0;i<legendDataPoint.length;i++) {
                legendDataPoint[i].showMarkers = false;
            }
        }
    }

    if (!domain.start) domain.start = 0;
    if (!domain.end) domain.end = 0;
    if (domain.start > domain.end)
        domain.end = domain.start;
    //sort data points
    for(let i=0;i<lines.length;i++) {
        let points: any[] = lines[i].points;
        let newPoints: any[] = [];
        for(let j=0;j<categoryData.length;j++) {
            let categoryString: string = categoryData[j].toString();
            let k: number = 0;
            while(k<points.length) {
                let pointCategoryString: string = points[k].x.toString();
                if (categoryString == pointCategoryString) {
                    newPoints.push(points[k]);
                    break;
                }
                k = k + 1;
            }
            if (points.length == newPoints.length)
                break;
        }
        lines[i].points = newPoints;
    }

    if (settings.xAxis.axisType !== "categorical") {
        settings.shapes.showMarkers = false;
    }

    if (settings.shapes.customizeSeries) {
        if (settings.shapes.series == "") {
            settings.shapes.series = legendDataPoint[0].label;
        }
    }
    return {
        rows: rowsData,
        columns: columnsData,
        rowsFormat: rowsFormat,
        columnsFormat: columnsFormat,
        categories: categoryData,
        categoryName: categoryName,
        valuesName: valuesName,
        dataPoints: dataPoints,
        legendDataPoint: legendDataPoint,
        lines: lines,
        lineKeyIndex: lineKeyIndex,
        categoryIsDate: categoryIsDate,
        categoryFormat: categoryFormat,
        valueFormat: valueFormat,
        categoryIsScalar: categoryIsScalar,
        legendFormatter: legendFormatter,
        legendType: legendType,
        domain: domain,
        settings: settings,
    };
}

function formatDrillDownXAxisValue(category: DataViewCategoryColumn, i: number, locale: string): string {
    let format: string = category.source.format;
    let categoryValue: PrimitiveValue;
    if (category.source.type && category.source.type.dateTime) {
        format = format ? format : NiceDateFormat;
        categoryValue = new Date(category.values[i].toString());
    } else {
        categoryValue = category.values[i];
    }
    let formatter: IValueFormatter = VizUtility.Formatter.GET_FORMATTER({
        format: format,
        cultureSelector: locale});
    return formatter.format(categoryValue);
}

function retrieveCategoryType(categoryIsScalar, categoryIsDate, categoryIsBoolean): CategoryType {
    if ((categoryIsBoolean && categoryIsScalar) || (categoryIsBoolean && categoryIsDate) ||(categoryIsScalar && categoryIsDate))
        return CategoryType.Error;
    return (categoryIsScalar)
        ? CategoryType.Number
        : ((categoryIsDate)
            ? CategoryType.Date
            : ((categoryIsBoolean)
                ? CategoryType.Boolean
                : CategoryType.String));
}
function sortNumberLegend(a: LegendDataPointExtended, b: LegendDataPointExtended) {
    return sortNumber(+a.tooltip, +b.tooltip);
}
function sortDateLegend(a: LegendDataPointExtended, b: LegendDataPointExtended) {
    let a1: Date = new Date(a.tooltip);
    let b1: Date = new Date(b.tooltip);
    return a1.getTime() - b1.getTime();
}
function sortNumber(a,b) {
    let a1: number = +a;
    let b1: number = +b;
    return a1-b1;
}
function sortDate(a,b) {
    let a1: Date = new Date(a.toString());
    let b1: Date = new Date(b.toString());
    return a1.getTime() - b1.getTime();
}
function get_sorted(array: any[], type: ValueTypeDescriptor):  PrimitiveValue[] {
    let result: PrimitiveValue[] = [];
    if (array) {
        let data = (type && type.numeric)
            ? array.sort(sortNumber)
            : ((type && type.dateTime)
                ? array.sort(sortDate)
                : array.sort());
        result = data;
    }
    return result;
}

export class Visual implements IVisual {
    private host: IVisualHost;
    private model: VisualViewModel;
    private element: Selection<any>;
    private interactivityService: IInteractivityService<any>;
    private legend: ILegend;
    private tooltipServiceWrapper: ITooltipServiceWrapper;
    private behavior: WebBehavior;
    private legendBehavior: LegendBehavior;

    public static SmallMultipleSelector: ClassAndSelector = createClassAndSelector("customSM");
    public static SimpleLineSelector: ClassAndSelector = createClassAndSelector("simpleLine");
    public static InteractivityLineSelector: ClassAndSelector = createClassAndSelector("interactivity-line");
    public static DotSelector: ClassAndSelector = createClassAndSelector("dot");
    public static MarkerLineSelector: ClassAndSelector = createClassAndSelector("markerLine");
    public static CircleSelector: ClassAndSelector = createClassAndSelector("circle-item");
    public static HoverLineSelector: ClassAndSelector = createClassAndSelector("hover-line");
    public static LassoRectSelector: ClassAndSelector = createClassAndSelector("lasso-rect");
    public static LassoSvgSelector: ClassAndSelector = createClassAndSelector("lasso-svg");
    public static LineChartRectSelector: ClassAndSelector = createClassAndSelector("line-chart-rect");
    public static SmallMultipleNameSelector: ClassAndSelector = createClassAndSelector("sm-name");
    public static Label: ClassAndSelector = createClassAndSelector("data-label");
    public static NavigationArrow: ClassAndSelector = createClassAndSelector("navArrow");
    public static NavigationArrowCustomLeft: ClassAndSelector = createClassAndSelector("navArrowCustomLeft");
    public static NavigationArrowCustomRight: ClassAndSelector = createClassAndSelector("navArrowCustomRight");
    public static AxisGraphicsContextSelector: ClassAndSelector = createClassAndSelector("axisGraphicsContext");
    public static AxisLabelSelector: ClassAndSelector = createClassAndSelector("axisLabel");
    public static LassoDataSelectorId: string = "lasso-data";

    constructor(options: VisualConstructorOptions) {

        this.host = options.host;
        this.model = {
            rows:[],
            columns: [],
            rowsFormat: '',
            columnsFormat: '',
            categories: [],
            dataPoints: [],
            legendDataPoint: [],
            lines: [],
            lineKeyIndex: {},
            categoryName: '',
            valuesName: '',
            categoryIsDate: false, 
            categoryFormat: '',
            valueFormat: '',
            legendFormatter: null,
            legendType: CategoryType.String,
            categoryIsScalar: false,
            domain: {startForced: false, endForced: false},
            settings: <VisualSettings>VisualSettings.getDefault()
        };
        this.element = d3.select(options.element);
        this.interactivityService = createInteractivitySelectionService(options.host);
        this.legendBehavior = new LegendBehavior();
        this.legend = LegendModule.createLegend(options.element, false, this.interactivityService, true, LegendPosition.Top, this.legendBehavior);
        this.tooltipServiceWrapper = createTooltipServiceWrapper(
            options.host.tooltipService,
            options.element);
        this.behavior = new WebBehavior();
    }

    //tslint:disable-next-line
    public update(options: VisualUpdateOptions) {
        this.model = visualTransform(options, this.host);
        this.element.selectAll('div, svg:not(.legend)').remove();
        if (this.model.categories.length == 0) return;
        this.legendBehavior.addLegendData(this.model.settings.legend, this.model.legendDataPoint);
        let margin = {top: 0, left: 0, bottom: 0, right: 0};
        //Legend
        renderLegend(this.model.settings.legend, this.model.legendDataPoint, this.legend, options, margin);

        let containerSize = {
            width: options.viewport.width - margin.left - margin.right,
            height: options.viewport.height - margin.top - margin.bottom
        };

        let container: Selection<any> =  this.element
            .append('div')
            .classed('chart', true)
            .styles({
                'width' :  containerSize.width + 'px',
                'height':  containerSize.height + 'px'
            });
        positionChartArea(container, this.legend);
        this.interactivityService.applySelectionStateToData(this.model.lines);

        let renderSimpleVisual: renderVisual = new renderVisual(this.host, this.element, this.model, this.model.domain, this.interactivityService, this.tooltipServiceWrapper);

        let rowNumber: number = (this.model.rows.length == 0) ? 1 : this.model.rows.length;
        let columnsNumber: number = (this.model.columns.length == 0) ? 1 : this.model.columns.length;

        this.model.settings.smallMultiple.enable = rowNumber > 1 || columnsNumber > 1;
        if (!this.model.settings.smallMultiple.enable)
            if (this.model.settings.xAxis.minCategoryWidth < this.model.settings.xAxis.fontSize)
                this.model.settings.xAxis.minCategoryWidth = this.model.settings.xAxis.fontSize;

        let titleHeight: number = this.model.settings.smallMultiple.fontSize * 2;
        let separatorSize = 20;

        let separatorIndex = (this.model.settings.smallMultiple.enable && this.model.settings.smallMultiple.showSeparators) ? 1 : 0;
        let titleIndex = (this.model.settings.smallMultiple.enable && this.model.settings.smallMultiple.showChartTitle) ? 1 : 0;
        let matrixFlowIndex = (this.model.settings.smallMultiple.enable) ? 1 : 0;

        let minItemWidth: number = matrixFlowIndex
            ? this.model.settings.smallMultiple.minUnitWidth
            : containerSize.width;
        let matrixIndex: number = (this.model.settings.smallMultiple.enable && this.model.settings.smallMultiple.layoutMode == "Matrix") ? 1 : 0;
        let itemWidth: number = Math.max((containerSize.width - titleHeight*matrixIndex*titleIndex) / columnsNumber - separatorSize*matrixFlowIndex, minItemWidth);

        if (!matrixFlowIndex && !this.model.settings.general.responsive) {
            container.styles({
                'overflow-x': 'auto',
                'overflow-y': 'hidden'
            });
            let MinWidhtForNotResponsive: number = 200;
            if (itemWidth < MinWidhtForNotResponsive) {
                containerSize.height = containerSize.height - 20;
                itemWidth = MinWidhtForNotResponsive;
            }
        }

        let minItemHeight: number = matrixFlowIndex ? this.model.settings.smallMultiple.minUnitHeigth : containerSize.height;
        let columnTitleIndex: number = (this.model.columns.length > 0) ? titleIndex : 0;
        let itemHeight: number = matrixIndex
            ? Math.max((containerSize.height - separatorSize - titleHeight*columnTitleIndex) / rowNumber - separatorSize, minItemHeight)
            : Math.max((containerSize.height - separatorSize - 5) / rowNumber - titleHeight*titleIndex - separatorSize, minItemHeight);

        let selectionLines: LineDataPoint[] = [];
        let dots: LineDataPoint[] = [];

        if (matrixFlowIndex)
            this.model.settings.xAxis.minCategoryWidth = null;
        if (this.model.settings.xAxis.axisType === 'categorical' && !matrixFlowIndex) {
            let maxCountOfXAxis: number = renderSimpleVisual.retrieveMaxCountOfXAxis(this.model.lines);
            let maxWidth: number = maxCountOfXAxis * this.model.settings.xAxis.minCategoryWidth;
            itemWidth = (itemWidth > maxWidth) ? itemWidth : maxWidth;
        }
        let lassoContainer: Selection<any>;
        if (this.model.settings.smallMultiple.enable) {
            container.style('overflow', 'auto');
            switch (this.model.settings.smallMultiple.layoutMode) {
                case "Matrix": {
                    let rowHeight: number = itemHeight + separatorSize;
                    let matrixWidth: number = itemWidth*columnsNumber + separatorSize*(columnsNumber-1);
                    let rowTitleIndex: number = (this.model.rows.length > 0) ? titleIndex : 0;
                    let smContainer: Selection<any> = container.append("svg")
                        .attrs({
                            'width':  matrixWidth + titleHeight*titleIndex,
                            'height' : rowHeight* rowNumber + titleHeight*columnTitleIndex
                        });
                    smContainer.append('rect')
                        .classed('clearCatcher', true)
                        .attrs({
                            'width':  '100%',
                            'height': '100%'
                    });
                    lassoContainer = smContainer;
                    lassoContainer.append("svg").attr('id', Visual.LassoDataSelectorId);
                    for(let i=0;i<rowNumber;i++) {
                        let translateY: number = (i==0)
                            ? 0
                            : i*rowHeight + titleHeight*columnTitleIndex;
                        let matrixTitleIndex = (i==0)&&(columnTitleIndex== 1) ? 1 : 0
                        let rowContainer: Selection<any> = smContainer
                            .append("g")
                            .attrs({
                                'width':  matrixWidth + titleIndex*rowTitleIndex,
                                'height' : rowHeight + titleHeight*matrixTitleIndex,
                                'transform': 'translate(0,' + translateY + ')'
                            });
                        if (titleIndex == 1 && this.model.rows.length > 0) {
                            let maxTextWidth: number = rowHeight + titleHeight*matrixTitleIndex;
                            let titleX: string = this.formatSmallMultipleTitle(this.model.rows[i], this.model.rowsFormat, this.host.locale);
                            renderSimpleVisual.renderRowTitleForMatrixView(rowContainer, titleHeight, maxTextWidth, separatorSize, titleX, i, separatorIndex);
                        }
                        for(let j=0;j<columnsNumber;j++) {

                            let lineKey: string = this.retrieveLineKey(i,j);
                            let lines: LineDataPoint[] = this.retrieveLines(lineKey);
                            for(let k=0;k<lines.length;k++) {
                                selectionLines.push(lines[k]);
                                if (lines[k].points && lines[k].points.length == 1)
                                    dots.push(lines[k]);
                            }
                            let titleY: string = (this.model.columns.length > 0)
                                ? this.formatSmallMultipleTitle(this.model.columns[j], this.model.columnsFormat, this.host.locale)
                                : "";

                            let translateX: number = (itemWidth + separatorSize)*j + titleHeight*rowTitleIndex;
                            let rowItemHeight: number = (i == rowNumber-1) ? rowHeight - separatorSize : rowHeight + titleHeight*matrixTitleIndex;
                            let itemContainer: Selection<SVGElement> = rowContainer
                                .append('g')
                                .attrs({
                                    'width':  itemWidth,
                                    'height': rowItemHeight,
                                    'transform': 'translate('+ translateX +',0)'
                                });

                            if (i==0 && titleY!="")
                                renderSimpleVisual.renderSmallMultipleWithTitle(itemContainer, itemWidth, itemHeight, titleHeight, titleY, lines, lineKey, translateX, translateY);
                            else
                                renderSimpleVisual.renderSmallMultiple(itemContainer, lines, itemWidth, itemHeight, lineKey, false, 0, false, translateX, translateY);
                            //show row separator
                            if (i<rowNumber-1) {
                                let columnSeparatorY: number = itemHeight + titleHeight*matrixTitleIndex;
                                let rowSeparator: Selection<any> = itemContainer.append("g").attrs({
                                    'width':  itemWidth,
                                    'height': separatorSize,
                                    'transform': 'translate(0,'+ columnSeparatorY +')'
                                });
                                renderVisual.RENDER_SEPARATOR_LINE(rowSeparator, 0, separatorSize/2, itemWidth, separatorSize/2, separatorIndex);
                            }
                            //show column separator
                            if (j<columnsNumber-1) {
                                let columnSeparatorX: number = translateX +itemWidth;
                                let columnSeparator: Selection<any> = rowContainer.append("g").attrs({
                                        'width':  separatorSize,
                                        'height': rowHeight + titleHeight*matrixTitleIndex,
                                        'transform': 'translate('+ columnSeparatorX +',0)'
                                });
                                renderVisual.RENDER_SEPARATOR_LINE(columnSeparator, separatorSize/2, 0, separatorSize/2, rowHeight + titleHeight*matrixTitleIndex, separatorIndex);
                                if (i<rowNumber-1) {
                                    let separatorY = itemHeight + titleHeight*matrixTitleIndex + separatorSize/2;
                                    renderVisual.RENDER_SEPARATOR_LINE(columnSeparator, 0, separatorY, separatorSize, separatorY, separatorIndex);
                                }
                            }
                        }
                    }
                    break;
                }
                case "Flow": {
                    let containerDevideCount = Math.floor((containerSize.width + separatorSize) / (itemWidth + separatorSize));
                    let itemCountForRow: number = (containerDevideCount < this.model.settings.smallMultiple.minRowWidth)
                        ? this.model.settings.smallMultiple.minRowWidth
                        : containerDevideCount;
                    itemCountForRow = Math.floor(columnsNumber/itemCountForRow)
                                ? itemCountForRow
                                : columnsNumber%itemCountForRow;
                    let rowHeight: number = (columnsNumber%itemCountForRow)
                        ? (itemHeight + titleHeight*titleIndex + separatorSize)*(Math.floor(columnsNumber/itemCountForRow) + 1)
                        : (itemHeight + titleHeight*titleIndex + separatorSize)*Math.floor(columnsNumber/itemCountForRow);
                    let rowHeights: number[] = [];
                    let rowSumHeight: number = 0;
                    let rowItemHeight: number;
                    let showEmptySmallMultiples: boolean = this.model.settings.smallMultiple.showEmptySmallMultiples;
                    let maxColumnsNumber: number = showEmptySmallMultiples ? columnsNumber : 0;
                    for(let i=0;i<rowNumber;i++) {
                        if (showEmptySmallMultiples) {
                            rowItemHeight = rowHeight;
                        } else {
                            let columnsNumber1: number = 0;
                            for(let j=0;j<columnsNumber;j++) {
                                let lineKey: string = this.retrieveLineKey(i,j);
                                let lines: LineDataPoint[] = this.retrieveLines(lineKey);
                                if (lines.length > 0)
                                    columnsNumber1 = columnsNumber1 + 1;
                            }
                            if (maxColumnsNumber < columnsNumber1)
                                maxColumnsNumber = columnsNumber1;
                            rowItemHeight = (columnsNumber1%itemCountForRow)
                                ? (itemHeight + titleHeight*titleIndex + separatorSize)*(Math.floor(columnsNumber1/itemCountForRow) + 1)
                                : (itemHeight + titleHeight*titleIndex + separatorSize)*Math.floor(columnsNumber1/itemCountForRow);
                        }
                        rowHeights.push(rowItemHeight);
                        rowSumHeight = rowSumHeight + rowItemHeight + separatorSize;
                    }
                    if (itemCountForRow < maxColumnsNumber)
                        maxColumnsNumber = itemCountForRow;
                    itemWidth = Math.max(itemWidth, (containerSize.width - separatorSize)/maxColumnsNumber - separatorSize);
                    let flowWidth: number = Math.max(containerSize.width, (itemWidth + separatorSize)*maxColumnsNumber - separatorSize);
                    let smContainer: Selection<any> = container.append("svg")
                        .attrs({
                            'width':  flowWidth,
                            'height' : rowSumHeight - separatorSize
                        });
                    smContainer.append('rect')
                        .classed('clearCatcher', true)
                        .attrs({
                            'width':  '100%',
                            'height': '100%'
                    });
                    lassoContainer = smContainer;
                    lassoContainer.append("svg").attr('id', Visual.LassoDataSelectorId);
                    let oldRowItemHeight: number = 0;
                    for(let i=0;i<rowNumber;i++) {
                        rowItemHeight = rowHeights[i];
                        let translateY = oldRowItemHeight;
                        oldRowItemHeight = translateY + rowItemHeight + separatorSize;
                        let rowContainer: Selection<any> = smContainer
                            .append("g")
                            .attrs({
                                'width':  flowWidth,
                                'height' : rowItemHeight,
                                'transform': 'translate(0,' + translateY + ')'
                        });
                        let j1: number = -1;
                        for(let j=0;j<columnsNumber;j++) {
                            let lineKey: string = this.retrieveLineKey(i,j);
                            let lines: LineDataPoint[] = this.retrieveLines(lineKey);
                            if (lines.length == 0 && !showEmptySmallMultiples)
                                continue;
                            j1 = j1 + 1;
                            let j2: number = showEmptySmallMultiples ? j : j1;
                            for(let k=0;k<lines.length;k++) {
                                selectionLines.push(lines[k]);
                                if (lines[k].points && lines[k].points.length == 1)
                                    dots.push(lines[k]);
                            }
                            let title: string = this.getTitle(i,j, this.model.rowsFormat, this.model.columnsFormat, this.host.locale);

                            let translateItemX: number = (j2%itemCountForRow)*(itemWidth + separatorSize);
                            let translateItemY: number = Math.floor(j2/itemCountForRow)*(itemHeight + titleHeight*titleIndex + separatorSize);
                            let itemContainer: Selection<SVGElement> = rowContainer
                                .append('g')
                                .attrs({
                                    'width':  itemWidth,
                                    'height': itemHeight + titleHeight*titleIndex,
                                    'transform': 'translate('+ translateItemX +',' + translateItemY + ')'
                                });
                            renderSimpleVisual.renderSmallMultipleWithTitle(itemContainer, itemWidth, itemHeight, titleHeight, title, lines, lineKey, translateItemX, translateY + translateItemY);
                        }
                        if (separatorIndex && i<rowNumber-1) {
                            let translateSeparatorY: number = translateY + rowItemHeight;
                            let rowSeparator: Selection<any> = smContainer.append("g").attrs({
                                'width':  flowWidth,
                                'height': separatorSize,
                                'transform': 'translate(0,'+ translateSeparatorY +')'
                            });
                            renderVisual.RENDER_SEPARATOR_LINE(rowSeparator, 0, separatorSize/2, (itemWidth + separatorSize)*itemCountForRow, separatorSize/2, separatorIndex);
                        }
                    }
                    break;
                }
            }
        } else {
            //simple view
            let scrollbarMargin: number = 25;
            if (itemWidth > containerSize.width)
                itemHeight = itemHeight - scrollbarMargin;
            let svgContainer: Selection<SVGElement> = container
                .append('svg')
                .attrs({
                    'width':  itemWidth,
                    'height': itemHeight
            });
            let lineKey: string = this.retrieveLineKey(0,0);
            let lines: LineDataPoint[] = this.retrieveLines(lineKey);
            selectionLines = lines;
            for(let k=0;k<lines.length;k++) {
                if (lines[k].points && lines[k].points.length == 1)
                    dots.push(lines[k]);
            }

            let legendPosition: string = this.model.settings.legend.position;
            let legendHeight: number = margin.top;
            let newLegendPosition: string = null;
            let svgContainerWidth: number = itemWidth;
            let svgContainerHeight: number = itemHeight;
            let stepCount: number = 0;
            let maxStepCount: number = this.model.settings.general.responsive ? 2 : 0;
            while (stepCount<maxStepCount && legendPosition!="None") {
                newLegendPosition = renderSimpleVisual.retrieveNewLegendPosition(svgContainer, lines, svgContainerWidth, svgContainerHeight, legendPosition, legendHeight);
                let legendSettings: legendSettings = {
                    show: this.model.settings.legend.show,
                    position: newLegendPosition,
                    showTitle: this.model.settings.legend.showTitle,
                    legendName: this.model.settings.legend.legendName,
                    legendNameColor: this.model.settings.legend.legendNameColor,
                    fontFamily : this.model.settings.legend.fontFamily,
                    fontSize: this.model.settings.legend.fontSize,
                    style: this.model.settings.legend.style,
                    matchLineColor: this.model.settings.legend.matchLineColor,
                    circleDefaultIcon: this.model.settings.legend.circleDefaultIcon
                };
                if (newLegendPosition == "None") {
                    this.model.settings.legend.position = "None";
                }
                margin = {top: 0, left: 0, bottom: 0, right: 0};
                renderLegend(legendSettings, this.model.legendDataPoint, this.legend, options, margin);
                legendHeight =  this.retrieveLegendHeight(legendHeight, legendPosition, margin);
                containerSize = {
                    width: options.viewport.width - margin.left - margin.right,
                    height: options.viewport.height - margin.top - margin.bottom
                };
                this.element.selectAll('.chart').remove();
                svgContainerWidth = Math.max(itemWidth, containerSize.width);
                svgContainerHeight = Math.max(itemHeight, containerSize.height);
                container =  this.element
                    .append('div')
                    .classed('chart', true)
                    .styles({
                        'width' :  containerSize.width + 'px',
                        'height':  containerSize.height + 'px'
                    });
                positionChartArea(container, this.legend);
                container.styles({
                    'overflow-x': 'auto',
                    'overflow-y': 'hidden'
                });
                if (svgContainerWidth > containerSize.width)
                    svgContainerHeight = svgContainerHeight - scrollbarMargin;
                svgContainer = container
                    .append('svg')
                    .attrs({
                        'width':  svgContainerWidth,
                        'height': svgContainerHeight
                });
                if (legendPosition == newLegendPosition) {
                    break;
                } else{
                    legendPosition = newLegendPosition;
                }
                stepCount = stepCount + 1;
            }
            let isLegendHidden: boolean = (legendPosition == "None");
            svgContainer.append("svg").attr('id', Visual.LassoDataSelectorId);
            renderSimpleVisual.renderSmallMultiple(svgContainer, lines, svgContainerWidth, svgContainerHeight, lineKey,
                this.model.settings.general.responsive, legendHeight, isLegendHidden, 0 , 0);
            lassoContainer = svgContainer;
        }

        //selection
        let legendContainer: Selection<any> = this.element.select('.legend');
        let verticalLineDataItemsGlobal: VerticalLineDataItemsGlobalWithKey = renderSimpleVisual.verticalLineDataItemsGlobal;
        let behaviorOptions: WebBehaviorOptions =
                new WebBehaviorOptions(container, this.model.dataPoints, selectionLines, dots, this.tooltipServiceWrapper, verticalLineDataItemsGlobal,
                    this.legendBehavior, this.model.legendDataPoint, this.model.legendFormatter, this.model.legendType, this.model.settings.shapes, this.behavior);
            // this.interactivityService.bind(this.model.dataPoints, this.behavior, behaviorOptions);
            this.interactivityService.bind(behaviorOptions);

        let clearContainer: Selection<any> = lassoContainer.selectAll('.clearCatcher,'+ Visual.SmallMultipleNameSelector.selectorName);
        let behavior: WebBehavior = this.behavior;
        clearContainer.on('click', () => {
            behavior.clearCather();
        });
        //lasso
        let lassoColor: string = this.model.settings.selectionColor.fill;
        implementLassoSelection(this.element, lassoContainer, this.model.dataPoints, this.model.lines, matrixFlowIndex, lassoColor, legendContainer,
            this.interactivityService, this.behavior, verticalLineDataItemsGlobal, this.model.settings.shapes, this.model.legendFormatter, this.model.legendType);
        //start legend changing by click
        let legendBehavior = this.legendBehavior;
        let legendPosition: string = this.model.settings.legend.position;
        let is: IInteractivityService<any> = this.interactivityService;
        if (legendPosition == "Top" || legendPosition == "TopCenter" || legendPosition == "Bottom" || legendPosition == "BottomCenter") {
            legendBehavior.leftOrRightClick(true, legendBehavior);
            let hasSelection: boolean = is.hasSelection();
            legendBehavior.renderSelection(hasSelection);
        }
        let arrowLeft: Selection<any> = this.element.select(Visual.NavigationArrowCustomLeft.selectorName);
        arrowLeft.on('click', () => {
            legendBehavior.leftOrRightClick(true, legendBehavior);
            let hasSelection: boolean = is.hasSelection();
            legendBehavior.renderSelection(hasSelection);
        });
        let arrowRight: Selection<any> = this.element.select(Visual.NavigationArrowCustomRight.selectorName);
        arrowRight.on('click', () => {
            legendBehavior.leftOrRightClick(false, legendBehavior);
            let hasSelection: boolean = is.hasSelection();
            legendBehavior.renderSelection(hasSelection);
        });
        //end legend changing by click
    }

    private formatSmallMultipleTitle(value: PrimitiveValue, format: string, locale: string): string {
        let isDate: boolean = !isNaN(+Date.parse(value.toString()));
        if (isDate) {
            format = format ? format : NiceDateFormat;
            value = new Date(value.toString());
        }
        let formatter: IValueFormatter = VizUtility.Formatter.GET_FORMATTER({
            format: format,
            cultureSelector: locale});
        return formatter.format(value);
    }

    private retrieveLegendHeight(legendHeight: number, legendPosition: string, margin: any) {
        if (legendPosition == "Top" || legendPosition == "TopCenter")
            legendHeight = margin.top;
        if (legendPosition == "Bottom" || legendPosition == "BottomCenter")
            legendHeight = margin.bottom;
        return legendHeight;
    }

    private retrieveLineKey(i: number, j: number): string {
        return i + DefaultSeparator + j + DefaultSeparator;
    }

    private retrieveLines(lineKey: string): LineDataPoint[] {
        let lines: LineDataPoint[] = [];
        for (let k=0;k<this.model.legendDataPoint.length;k++) {
            let key: string = lineKey + this.model.legendDataPoint[k].tooltip;
            let lineIndex: number = this.model.lineKeyIndex[key];
            let lineDataPoint: LineDataPoint = this.model.lines[lineIndex];
            if (lineDataPoint)
                lines.push(lineDataPoint);
        }
        return lines;
    }
    private getTitle(i: number, j: number, rowsFormat: string, columnsFormat: string, locale: string): string {
        return (this.model.rows.length > 0)
            ? ((this.model.columns.length > 0)
                ? this.formatSmallMultipleTitle(this.model.rows[i], rowsFormat, locale) + ", " + this.formatSmallMultipleTitle(this.model.columns[j], columnsFormat, locale)
                : this.formatSmallMultipleTitle(this.model.rows[i], rowsFormat, locale))
            : ((this.model.columns.length > 0)
                ? this.formatSmallMultipleTitle(this.model.columns[j], columnsFormat, locale)
                : "");
    }
    public static PARSE_SETTINGS(dataView: DataView): VisualSettings {
        return <VisualSettings>VisualSettings.parse(dataView);
    }

    public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstanceEnumeration {
        let instanceEnumeration: VisualObjectInstanceEnumeration = VisualSettings.enumerateObjectInstances(this.model.settings, options);
        EnumerateObject.SET_INSTANCES(this.model.settings, instanceEnumeration, this.model);
        return instanceEnumeration;
    }
}