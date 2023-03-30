"use strict";

import powerbi from "powerbi-visuals-api";
import PrimitiveValue = powerbi.PrimitiveValue;
import {LegendDataPoint, MarkerShape} from "powerbi-visuals-utils-chartutils/lib/legend/legendInterfaces";
import DataViewObjects = powerbi.DataViewObjects;
import {IValueFormatter} from "powerbi-visuals-utils-formattingutils/lib/src/valueFormatter";
import {Selection} from "d3-selection";
import {VisualSettings} from "./settings";
import {BoundingRect} from "powerbi-visuals-utils-svgutils/lib/shapes/shapesInterfaces";
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;
import {SelectableDataPoint} from "powerbi-visuals-utils-interactivityutils/lib/interactivitySelectionService";
import {BaseDataPoint, IBehaviorOptions} from "powerbi-visuals-utils-interactivityutils/lib/interactivityBaseService";
import {SeriesMarkerShape} from "./seriesMarkerShape";
import {LegendIconType} from "./legendIconType";
import {ScaleOrdinal} from "d3-scale";
import {AxisDomain, AxisScale} from "d3-axis";

export type d3Selection<T> = Selection<any, T, any, any>;

export interface VisualViewModel {
    rows: PrimitiveValue[];
    columns: PrimitiveValue[];
    rowsFormat: string;
    columnsFormat: string;
    categories: PrimitiveValue[];
    legendDataPoint: LegendDataPointExtended[];
    dataPoints: VisualDataPoint[];
    lines: LineDataPoint[];
    lineKeyIndex: LineKeyIndex;
    domain: VisualDomain;
    valueFormat: string;
    categoryIsDate: boolean;
    categoryFormat: string;
    categoryIsScalar: boolean;
    categoryName: string;
    valuesName: string;
    legendFormatter: IValueFormatter;
    legendType: CategoryType;
    settings: VisualSettings;
}

export interface LegendDataExtended {
    title: string;
    dataPoints: LegendDataPointExtended[];
}

export enum CategoryType {
    Error = 0,
    String = 1,
    Number = 2,
    Boolean = 3,
    Date = 4
}

export interface LegendDataPointExtended extends LegendDataPoint {
    markerColor: string;
    showMarkers?: boolean;
    object: DataViewObjects;

    /**
     * Shape of a marker displayed in the legend.
     * Used instead of markerShape. Supports a bigger list of values that regular MarkerShape.
     */
    seriesMarkerShape: SeriesMarkerShape;

    /**
     * Style of markers displayed in the legend: line, marker or both.
     */
    style: LegendIconType;
}

export interface LineKeyIndex {
    [lineKey: string]: number;
}

export interface LegendBehaviorOptions extends IBehaviorOptions<BaseDataPoint> {
    legendItems: d3Selection<any>;
    legendIcons: d3Selection<any>;
    clearCatcher: d3Selection<any>;
}

export interface LassoData {
    lassoData: BoundingRect;
    startX: number;
    startY: number;
    selectedLegendNames: string[];
}

export interface LinePoint {
    y: number;
    value: string;
    name: string;
    color: string;
    showMarkers: boolean;
    lineKey: string;
}

export class XAxisData {
    x: AxisScale<AxisDomain>;
    xAxisDataPoints: any[];
    lines: LineDataPoint[];
    start: number;
    end: number;
}

export class VerticalLineDataItem {
    x: number;
    tooltips: VisualTooltipDataItem[];
    linePoints: LinePoint[];
    rectGlobalX: number;
    rectGlobalY: number;
}

export class VerticalLineDataItemsGlobalWithKey {
    [lineKey: string]: VerticalLineDataItemsGlobal;
}

export class VerticalLineDataItemsGlobal {
    verticalLineDataItems: VerticalLineDataItem[];
    hoverLineData: d3Selection<number>;
}

export const enum LabelsAction {
    Simple = 1,
    Rotate35 = 2,
    Rotate90 = 3
}

export interface SimplePoint {
    x: PrimitiveValue;
    y: number;
    tooltips?: VisualTooltipDataItem[];
    lineKey?: string;
}

export interface VisualDataPoint extends SimplePoint, SelectableDataPoint {
}

export interface Coordinates {
    x: number;
    y: number;
    value: string;
    bgX: number;
    bgY: number;
    bgWidth: number;
    bgHeight: number;
}

export interface LineDataPoint extends SelectableDataPoint {
    lineKey: string;
    name: string;
    points: SimplePoint[];
    color: string;
    strokeWidth?: number;
    strokeLineJoin?: string;
    lineStyle?: string;
    stepped?: boolean;

    showMarkers?: boolean;
    seriesMarkerShape?: SeriesMarkerShape;
    markerSize?: number;
    markerColor?: string;
}

export class LineDataPointForLasso {
    lineKey: string;
    points: SimplePoint[];
}

export interface VisualDomain {
    start?: number;
    end?: number;
    startForced: boolean;
    endForced: boolean;
}
