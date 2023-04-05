'use strict';

import powerbi from 'powerbi-visuals-api';
import {LegendSettings} from '../settings';
import {d3Selection} from '../visualInterfaces';
import {LegendPosition} from 'powerbi-visuals-utils-chartutils/lib/legend/legendInterfaces';
import {ColorHelper} from 'powerbi-visuals-utils-colorutils';
import {fromPixelToPoint, fromPointToPixel, measureTextWidth, TextProperties} from './textUtility';
import {getTailoredTextOrDefault} from 'powerbi-visuals-utils-formattingutils/lib/src/textMeasurementService';
import {select as d3select, selectAll as d3selectAll} from 'd3-selection';
import {SeriesMarkerShape} from '../seriesMarkerShape';
import {LegendIconType} from '../legendIconType';
import {IMargin} from 'powerbi-visuals-utils-svgutils';
import {IScrollableLegend, ScrollableLegendData, ScrollableLegendDataPoint} from './scrollableLegend';
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import DataViewMetadataColumn = powerbi.DataViewMetadataColumn;
import DataView = powerbi.DataView;
import DataViewValueColumnGroup = powerbi.DataViewValueColumnGroup;

import DataViewCategoryColumn = powerbi.DataViewCategoryColumn;
import ISelectionId = powerbi.visuals.ISelectionId;

import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IViewport = powerbi.IViewport;

const paddingText: number = 10;
const arrowWidth: number = 7.5;
const lineLen: number = 30;
const circleD: number = 10;

export function renderLegend(
    legendSettings: LegendSettings,
    dataPoints: ScrollableLegendDataPoint[],
    legend: IScrollableLegend,
    options: VisualUpdateOptions,
    margin: IMargin) {
    let legendData: ScrollableLegendData = {
        dataPoints: [],
    };
    if (!legendSettings.show || dataPoints == null || dataPoints.length <= 1) {
        legend.drawLegend(legendData, options.viewport);
        return;
    }

    legend.changeOrientation(<any>LegendPosition[legendSettings.position]);

    let legendName: string = (legendSettings.showTitle && legendSettings.legendName) || '';
    if (legendSettings.position == 'Top'
        || legendSettings.position == 'TopCenter'
        || legendSettings.position == 'Bottom'
        || legendSettings.position == 'BottomCenter') {
        const textProp: TextProperties = {
            text: legendName,
            fontFamily: legendSettings.fontFamily,
            fontSize: legendSettings.fontSize + 'px',
        };
        const legendNameWidth: number = fromPointToPixel(measureTextWidth(textProp));
        if (legendNameWidth > options.viewport.width / 3) {
            const maxTitleWidth: number = fromPixelToPoint(options.viewport.width / 3);
            legendName = getTailoredTextOrDefault(textProp, maxTitleWidth);
        }
    }

    legendData = {
        title: legendName,
        dataPoints: dataPoints,
        labelColor: legendSettings.legendNameColor,
        fontSize: legendSettings.fontSize,
        fontFamily: legendSettings.fontFamily,
    };
    legend.drawLegend(legendData, options.viewport);

    appendLegendMargins(legend, margin);
}

export function calculateItemWidth(legendSettings: LegendSettings, dataPoints: ScrollableLegendDataPoint[]): number {
    if (!dataPoints || dataPoints.length == 0) return 0;
    let sumLength: number = 0;
    const padding: number = legendSettings.fontSize / 4;
    const iconLength: number = dataPoints[0].seriesMarkerShape == SeriesMarkerShape.circle ? circleD : lineLen;
    for (let i = 0; i < dataPoints.length; i++) {
        const dataPoint: ScrollableLegendDataPoint = dataPoints[i];
        const textProp: TextProperties = {
            text: dataPoint.label,
            fontFamily: legendSettings.fontFamily,
            fontSize: legendSettings.fontSize + 'px',
        };
        const textLength: number = fromPointToPixel(measureTextWidth(textProp));
        const dataPointLength: number = iconLength + padding + textLength + padding;
        sumLength = sumLength + dataPointLength;
    }

    return dataPoints.length > 0
        ? sumLength / dataPoints.length
        : sumLength;
}

export function getLegendData(dataView: DataView, host: IVisualHost, legend: LegendSettings): ScrollableLegendData {
    const isLegendFilled: boolean = IsLegendFilled(dataView);
    const legendIcons = {
        'markers': LegendIconType.markers,
        'linemarkers': LegendIconType.lineMarkers,
        'line': LegendIconType.line,
    };

    const legendIcon: LegendIconType = legendIcons[legend.style];
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
        const column: DataViewMetadataColumn = columns[i];
        if (column.roles?.['Legend']) {
            return true;
        }
    }

    if (dataView.categorical && !dataView.categorical.categories && dataView.categorical.values) {
        const grouped: DataViewValueColumnGroup[] = dataView.categorical.values.grouped();
        return grouped.length > 1;
    }

    return false;
}

function buildLegendData(
    dataView: DataView,
    host: IVisualHost,
    legendObjectProperties: LegendSettings,
    legendIcon: LegendIconType): ScrollableLegendData {
    const colorHelper: ColorHelper = new ColorHelper(
        host.colorPalette,
        {objectName: 'dataPoint', propertyName: 'fill'});

    const legendItems: ScrollableLegendDataPoint[] = [];

    const dataValues = dataView.categorical?.values;
    const grouped = dataValues?.grouped();

    if (dataValues && grouped && grouped.length > 1) {
        for (let i: number = 0, len: number = grouped.length; i < len; i++) {
            const grouping = grouped[i];

            const color = (grouping.objects && grouping.name && colorHelper.getColorForSeriesValue(
                grouping.objects,
                grouping.name)) || undefined;

            const selectionId: ISelectionId = host.createSelectionIdBuilder()
                .withSeries(dataValues, grouping)
                .createSelectionId();
            const label = grouping.name?.toString() ?? '';
            legendItems.push({
                color: color,
                seriesMarkerShape: SeriesMarkerShape.circle,
                legendIconType: legendIcon,
                label: label,
                tooltip: label,
                object: grouping.objects ?? {},
                identity: selectionId,
                selected: false,
            });
        }
    } else {
        const legendColumn = retrieveLegendCategoryColumn(dataView);
        const legendColumnValues = legendColumn?.values;
        if (legendColumnValues) {
            const legendKeys: string[] = [];
            for (let i: number = 0; i < legendColumnValues.length; i++) {
                const name: string = legendColumn.values[i].toString();
                if (legendKeys.indexOf(name) == -1) {
                    legendKeys.push(name);
                    const object = legendColumn.objects && legendColumn.objects.length > i
                        ? legendColumn.objects[i]
                        : null;
                    const color = (object && colorHelper.getColorForSeriesValue(
                        object,
                        name)) || undefined;

                    const selectionId: ISelectionId = host.createSelectionIdBuilder()
                        .withCategory(legendColumn, i)
                        .createSelectionId();
                    legendItems.push({
                        color: color,
                        seriesMarkerShape: SeriesMarkerShape.circle,
                        legendIconType: legendIcon,
                        label: name,
                        tooltip: name,
                        object: object ?? {},
                        identity: selectionId,
                        selected: false,
                    });
                }
            }
        }
    }

    const column = retrieveLegendMetadataColumn(dataView);
    const legendTitle = column
        ? column.displayName
        : legendObjectProperties.legendName;

    if (legendObjectProperties.legendName == null) {
        legendObjectProperties.legendName = legendTitle;
    }

    return {
        title: legendTitle,
        dataPoints: legendItems,
    };
}

function retrieveLegendMetadataColumn(dataView: DataView): DataViewMetadataColumn | null {
    const columns: DataViewMetadataColumn[] = dataView.metadata.columns;
    const columnsLen: number = columns ? columns.length : 0;
    for (let i = 0; i < columnsLen; i++) {
        const item: DataViewMetadataColumn = columns[i];
        if (item.roles?.['Legend']) {
            return item;
        }
    }

    return null;
}

export function retrieveLegendCategoryColumn(dataView: DataView): DataViewCategoryColumn | null {
    const categories: DataViewCategoryColumn[] = dataView.categorical?.categories ?? [];
    const categoriesLen: number = categories ? categories.length : 0;
    for (let i = 0; i < categoriesLen; i++) {
        const category: DataViewCategoryColumn = categories[i];
        if (category.source.roles?.['Legend']) {
            return category;
        }
    }

    return null;
}

function getNumberOfValues(dataView: DataView): number {
    const columns: DataViewMetadataColumn[] = dataView.metadata.columns;
    let valueFieldsCount: number = 0;

    for (const columnName in columns) {
        const column: DataViewMetadataColumn = columns[columnName];

        if (column.roles && column.roles['Values']) {
            ++valueFieldsCount;
        }
    }

    return valueFieldsCount;
}

function buildLegendDataForMultipleValues(
    host: IVisualHost,
    dataView: DataView,
    legendIcon: LegendIconType,
    title: string): ScrollableLegendData {
    const colorHelper = new ColorHelper(
        host.colorPalette,
        {objectName: 'dataPoint', propertyName: 'fill'});

    const legendItems: ScrollableLegendDataPoint[] = [];

    const values = dataView.categorical?.values;

    const numberOfValueFields = getNumberOfValues(dataView);
    const lastColors: string[] = [];
    if (values) {
        for (let i = 0; i < numberOfValueFields; i++) {

            const queryName = values[i].source.queryName ?? '';
            const selectionId: ISelectionId = host.createSelectionIdBuilder()
                .withMeasure(queryName)
                .createSelectionId();

            const objects = values[i].source.objects ?? {};
            const colorFromObject: string = colorHelper.getColorForMeasure(
                objects,
                queryName);
            let currentColor = i == 0 ? colorFromObject : lastColors[i - 1];
            let j: number = 0;
            while (lastColors.indexOf(currentColor) != -1) {
                currentColor = host.colorPalette.getColor('value' + j.toString()).value;
                j = j + 1;
            }
            lastColors.push(currentColor);

            const color: string = objects && objects.dataPoint ? colorFromObject : currentColor;

            const label: string = values[i].source.displayName;

            legendItems.push({
                color: color,
                seriesMarkerShape: SeriesMarkerShape.circle,
                legendIconType: legendIcon,
                label: label,
                tooltip: label,
                object: objects,
                identity: selectionId,
                selected: false,
            });
        }
    }

    return {
        title: title,
        dataPoints: legendItems,
    };
}

function appendLegendMargins(legend: IScrollableLegend, margins: IMargin): void {
    if (legend) {
        const legendViewPort: IViewport = legend.getMargins();
        const legendOrientation: LegendPosition = legend.getOrientation();
        const svgLegend: d3Selection<any> = d3select('svg.legend');
        const width: number = +svgLegend.attr('width');

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
}

export function positionChartArea(container: d3Selection<any>, legend: IScrollableLegend) {
    const margin = {top: 0, left: 0, bottom: 0, right: 0};
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
